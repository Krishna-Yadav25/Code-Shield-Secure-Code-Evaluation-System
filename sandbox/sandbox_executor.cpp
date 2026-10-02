#include <iostream>
#include <unistd.h>
#include <sys/wait.h>
#include <sys/types.h>
#include <signal.h>
#include <fcntl.h>
#include <sys/resource.h>
#include <cstring>
#include <cerrno>
#include <chrono>

using namespace std;

int main(int argc, char* argv[]) {

    // Take the program path from command line
    if (argc < 2) {
        cerr << "Usage: ./sandbox_executor <program>" << endl;
        return 1;
    }

    const char* program = argv[1];

    // Time limit for the program in seconds
    const int TIME_LIMIT = 5;

    cout << "CodeShield Sandbox" << endl;
    cout << "Program: " << program << endl;
    cout << "Time Limit: " << TIME_LIMIT << " seconds" << endl;

    // Pipe is used to capture child output
    int pipe_fd[2];

    if (pipe(pipe_fd) == -1) {
        perror("pipe failed");
        return 1;
    }

    // Create a child process
    pid_t pid = fork();

    if (pid < 0) {
        perror("fork failed");

        close(pipe_fd[0]);
        close(pipe_fd[1]);

        return 1;
    }

    // Child process
    if (pid == 0) {

        // Child does not need the reading side
        close(pipe_fd[0]);

        /*
         * Set CPU time limit.
         * Soft limit = 1 second
         * Hard limit = 2 seconds
         */
        struct rlimit cpu_limit;

        cpu_limit.rlim_cur = 1;
        cpu_limit.rlim_max = 2;

        if (setrlimit(RLIMIT_CPU, &cpu_limit) == -1) {
            perror("CPU limit failed");
            _exit(127);
        }

        /*
         * Set memory limit.
         * Limit = 256 MB
         */
        struct rlimit memory_limit;

        memory_limit.rlim_cur = 256 * 1024 * 1024;
        memory_limit.rlim_max = 256 * 1024 * 1024;

        if (setrlimit(RLIMIT_AS, &memory_limit) == -1) {
            perror("Memory limit failed");
            _exit(127);
        }

        // Send normal output to the pipe
        if (dup2(pipe_fd[1], STDOUT_FILENO) == -1) {
            perror("dup2 stdout failed");
            _exit(127);
        }

        // Send error output to the same pipe
        if (dup2(pipe_fd[1], STDERR_FILENO) == -1) {
            perror("dup2 stderr failed");
            _exit(127);
        }

        close(pipe_fd[1]);

        // Execute the submitted program
        execl(
            program,
            program,
            (char*)NULL
        );

        // This runs only if exec fails
        perror("exec failed");

        _exit(127);
    }

    // Parent process
    cout << "[Parent] Child PID: " << pid << endl;

    // Parent only reads from the pipe
    close(pipe_fd[1]);

    // Make the pipe non-blocking
    int flags = fcntl(pipe_fd[0], F_GETFL, 0);

    if (flags == -1) {
        perror("fcntl get flags failed");

        kill(pid, SIGKILL);
        waitpid(pid, nullptr, 0);

        close(pipe_fd[0]);

        return 1;
    }

    if (fcntl(pipe_fd[0], F_SETFL, flags | O_NONBLOCK) == -1) {
        perror("fcntl set flags failed");

        kill(pid, SIGKILL);
        waitpid(pid, nullptr, 0);

        close(pipe_fd[0]);

        return 1;
    }

    cout << "\n----- Program Output -----\n";

    char buffer[4096];

    bool timed_out = false;

    int status = 0;

    // Store the time when execution started
    auto start_time = chrono::steady_clock::now();

    while (true) {

        // Read available output from the child
        ssize_t bytes_read = read(
            pipe_fd[0],
            buffer,
            sizeof(buffer) - 1
        );

        if (bytes_read > 0) {

            buffer[bytes_read] = '\0';

            cout << buffer;
            cout.flush();
        }

        // Check whether the child has finished
        pid_t result = waitpid(
            pid,
            &status,
            WNOHANG
        );

        if (result == pid) {
            break;
        }

        if (result == -1) {
            perror("waitpid failed");

            kill(pid, SIGKILL);
            waitpid(pid, nullptr, 0);

            close(pipe_fd[0]);

            return 1;
        }

        // Check how much wall-clock time has passed
        auto current_time = chrono::steady_clock::now();

        auto elapsed =
            chrono::duration_cast<chrono::seconds>(
                current_time - start_time
            ).count();

        // Kill the process if it exceeds the wall-clock limit
        if (elapsed >= TIME_LIMIT) {

            cout << "\n\nTime limit exceeded!" << endl;

            cout << "Sending SIGKILL to child..." << endl;

            if (kill(pid, SIGKILL) == -1) {
                perror("kill failed");
            }

            timed_out = true;

            // Wait for the killed child
            waitpid(pid, &status, 0);

            break;
        }

        // Small delay before checking again
        usleep(10000);
    }

    // Read remaining output after process termination
    while (true) {

        ssize_t bytes_read = read(
            pipe_fd[0],
            buffer,
            sizeof(buffer) - 1
        );

        if (bytes_read > 0) {

            buffer[bytes_read] = '\0';

            cout << buffer;
            cout.flush();
        }
        else {
            break;
        }
    }

    close(pipe_fd[0]);

    cout << "\n--------------------------\n";

    // Handle wall-clock timeout
    if (timed_out) {

        cout << "Child terminated by SIGKILL" << endl;

        cout << "Verdict: TIME LIMIT EXCEEDED" << endl;
    }

    // Check normal termination
    else if (WIFEXITED(status)) {

        int exit_code = WEXITSTATUS(status);

        cout << "Child exited normally" << endl;

        cout << "Exit code: " << exit_code << endl;

        if (exit_code == 0) {

            cout << "Verdict: SUCCESS" << endl;
        }
        else {

            cout << "Verdict: RUNTIME ERROR" << endl;
        }
    }

    // Check if process was terminated by a signal
    else if (WIFSIGNALED(status)) {

        int signal_number = WTERMSIG(status);

        cout << "Child terminated by signal: "
             << signal_number << endl;

        // SIGXCPU means CPU time limit was reached
        if (signal_number == SIGXCPU) {

            cout << "Verdict: CPU LIMIT EXCEEDED" << endl;
        }
        else if (signal_number == SIGKILL) {

            /*
             * SIGKILL can also happen when the CPU hard limit
             * is reached. Wall-clock timeout is handled above.
             */
            cout << "Verdict: RESOURCE LIMIT EXCEEDED" << endl;
        }
        else {

            cout << "Verdict: RUNTIME ERROR" << endl;
        }
    }

    else {

        cout << "Unknown child status" << endl;
    }

    cout << "Sandbox execution completed." << endl;

    return 0;
}