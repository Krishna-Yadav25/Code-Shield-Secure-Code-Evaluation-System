#include <iostream>
#include <unistd.h>
#include <sys/wait.h>
#include <sys/types.h>
#include <signal.h>
#include <fcntl.h>
#include <cstring>

using namespace std;

int main(int argc, char* argv[]) {

    // --------------------------------------------------
    // Check input
    // --------------------------------------------------

    if (argc < 2) {
        cerr << "Usage: ./sandbox_executor <program>" << endl;
        return 1;
    }

    const char* program = argv[1];

    cout << "CodeShield Sandbox" << endl;
    cout << "Program: " << program << endl;

    // --------------------------------------------------
    // Create child process
    // --------------------------------------------------

    pid_t pid = fork();

    if (pid < 0) {
        perror("fork failed");
        return 1;
    }

    // --------------------------------------------------
    // CHILD PROCESS
    // --------------------------------------------------

    if (pid == 0) {

        cout << "[Child] PID: " << getpid() << endl;

        // Execute submitted program
        execl(
            program,
            program,
            (char*)NULL
        );

        // execl returns only if execution failed
        perror("[Child] exec failed");

        _exit(127);
    }

    // --------------------------------------------------
    // PARENT PROCESS
    // --------------------------------------------------

    cout << "[Parent] Child PID: " << pid << endl;

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

    // --------------------------------------------------
    // Check child result
    // --------------------------------------------------

    if (WIFEXITED(status)) {

        int exit_code = WEXITSTATUS(status);

        cout << "[Parent] Child exited normally" << endl;
        cout << "Exit code: " << exit_code << endl;

    }
    else if (WIFSIGNALED(status)) {

        int signal_number = WTERMSIG(status);

        cout << "[Parent] Child terminated by signal: "
             << signal_number << endl;
    }

    cout << "Sandbox execution completed." << endl;

    return 0;
}