#include <iostream>
#include <unistd.h>
#include <sys/wait.h>
#include <sys/types.h>
#include <signal.h>
#include <cstring>
#include <cerrno>

using namespace std;

int main(int argc, char* argv[]) {

    // Take the program path from command line
    if (argc < 2) {
        cerr << "Usage: ./sandbox_executor <program>" << endl;
        return 1;
    }

    const char* program = argv[1];

    cout << "CodeShield Sandbox" << endl;
    cout << "Program: " << program << endl;

    // Pipe is used to send child output to parent
    // pipe_fd[0] is for reading and pipe_fd[1] is for writing
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

    // Child process will run the submitted program
    if (pid == 0) {

        // Child does not need the reading side
        close(pipe_fd[0]);

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

    // Parent keeps the child PID to monitor it
    cout << "[Parent] Child PID: " << pid << endl;

    // Parent only reads from the pipe
    close(pipe_fd[1]);

    cout << "\n----- Program Output -----\n";

    char buffer[4096];
    ssize_t bytes_read;

    // Read the output produced by the child
    while ((bytes_read = read(
        pipe_fd[0],
        buffer,
        sizeof(buffer) - 1
    )) > 0) {

        buffer[bytes_read] = '\0';

        cout << buffer;
        cout.flush();
    }

    close(pipe_fd[0]);

    // Wait until the child finishes
    int status;

    pid_t result = waitpid(
        pid,
        &status,
        0
    );

    if (result == -1) {
        perror("waitpid failed");
        return 1;
    }

    cout << "\n--------------------------\n";

    // Check if the program ended normally
    if (WIFEXITED(status)) {

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

    // Check if the process was terminated by a signal
    else if (WIFSIGNALED(status)) {

        int signal_number = WTERMSIG(status);

        cout << "Child terminated by signal: "
             << signal_number << endl;

        cout << "Signal number: "
             << signal_number << endl;

        cout << "Verdict: RUNTIME ERROR" << endl;
    }

    else {
        cout << "Unknown child status" << endl;
    }

    cout << "Sandbox execution completed." << endl;

    return 0;
}