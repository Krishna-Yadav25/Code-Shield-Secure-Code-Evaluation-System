#include <iostream>
#include <unistd.h>
#include <sys/wait.h>
#include <sys/types.h>
#include <signal.h>
#include <fcntl.h>
#include <sys/resource.h>
#include <sys/prctl.h>
#include <sched.h>
#include <sys/stat.h>
#include <cstring>
#include <cerrno>
#include <chrono>
#include <fstream>
#include <string>

using namespace std;


// ------------------------------------------------
// CGROUP HELPER FUNCTIONS
// ------------------------------------------------

// Get the cgroup directory available to the current user
string getCgroupBasePath() {

    string uid = to_string(getuid());

    return "/sys/fs/cgroup/user.slice/user-" +
           uid +
           ".slice/user@" +
           uid +
           ".service";
}


// Create a separate cgroup for this execution
bool createCgroup(string& cgroup_path) {

    string name =
        "codeshield-" +
        to_string(getpid()) +
        "-" +
        to_string(
            chrono::duration_cast<chrono::milliseconds>(
                chrono::steady_clock::now().time_since_epoch()
            ).count()
        );

    cgroup_path = getCgroupBasePath() + "/" + name;

    if (mkdir(cgroup_path.c_str(), 0755) == -1) {

        if (errno != EEXIST) {

            cerr << "[CGroup] Could not create cgroup: "
                 << strerror(errno) << endl;

            return false;
        }
    }

    cout << "[CGroup] Created: "
         << cgroup_path << endl;

    return true;
}


// Write a value into a cgroup control file
bool writeCgroupFile(
    const string& file_path,
    const string& value
) {

    ofstream file(file_path);

    if (!file.is_open()) {

        cerr << "[CGroup] Cannot open: "
             << file_path << endl;

        return false;
    }

    file << value;

    if (!file.good()) {

        cerr << "[CGroup] Failed to write: "
             << file_path << endl;

        return false;
    }

    return true;
}


// Apply CPU, memory and process limits
bool setCgroupLimits(
    const string& cgroup_path
) {

    bool success = true;


    // ------------------------------------------------
    // CPU LIMIT
    // ------------------------------------------------

    // 50000 / 100000 means 50% of one CPU
    if (writeCgroupFile(
            cgroup_path + "/cpu.max",
            "50000 100000"
        )) {

        cout << "[CGroup] CPU limit applied"
             << endl;
    }
    else {

        success = false;
    }


    // ------------------------------------------------
    // MEMORY LIMIT
    // ------------------------------------------------

    // 256 MB = 268435456 bytes
    if (writeCgroupFile(
            cgroup_path + "/memory.max",
            "268435456"
        )) {

        cout << "[CGroup] Memory limit applied"
             << endl;
    }
    else {

        success = false;
    }


    // ------------------------------------------------
    // PROCESS LIMIT
    // ------------------------------------------------

    if (writeCgroupFile(
            cgroup_path + "/pids.max",
            "10"
        )) {

        cout << "[CGroup] Process limit applied"
             << endl;
    }
    else {

        success = false;
    }


    return success;
}


// Add a process to the cgroup
bool addProcessToCgroup(
    const string& cgroup_path,
    pid_t pid
) {

    string pid_value = to_string(pid);

    if (writeCgroupFile(
            cgroup_path + "/cgroup.procs",
            pid_value
        )) {

        cout << "[CGroup] Child added: "
             << pid << endl;

        return true;
    }

    return false;
}


// Remove cgroup after execution
void removeCgroup(
    const string& cgroup_path
) {

    if (rmdir(cgroup_path.c_str()) == 0) {

        cout << "[CGroup] Removed"
             << endl;
    }
    else {

        cerr << "[CGroup] Could not remove cgroup: "
             << strerror(errno) << endl;
    }
}


int main(int argc, char* argv[]) {


    // ------------------------------------------------
    // COMMAND LINE INPUT
    // ------------------------------------------------

    // Take the program path from command line
    if (argc < 2) {

        cerr << "Usage: ./sandbox_executor <program>"
             << endl;

        return 1;
    }


    const char* program = argv[1];


    // Time limit for the program
    const int TIME_LIMIT = 5;


    cout << "CodeShield Sandbox" << endl;

    cout << "Program: "
         << program
         << endl;

    cout << "Time Limit: "
         << TIME_LIMIT
         << " seconds"
         << endl;


    // ------------------------------------------------
    // CREATE CGROUP
    // ------------------------------------------------

    string cgroup_path;

    bool cgroup_created =
        createCgroup(cgroup_path);


    if (cgroup_created) {

        if (!setCgroupLimits(cgroup_path)) {

            cout << "[CGroup] Some limits could not be applied"
                 << endl;

            cout << "[CGroup] Continuing with available limits"
                 << endl;
        }
    }
    else {

        cout << "[CGroup] Continuing without cgroup"
             << endl;
    }


    // ------------------------------------------------
    // OUTPUT PIPE
    // ------------------------------------------------

    // Create a pipe to capture child output
    int pipe_fd[2];

    if (pipe(pipe_fd) == -1) {

        perror("pipe failed");

        if (cgroup_created) {
            removeCgroup(cgroup_path);
        }

        return 1;
    }


    // ------------------------------------------------
    // SYNCHRONIZATION PIPE
    // ------------------------------------------------

    // Parent uses this pipe to tell child when cgroup
    // setup has been completed
    int sync_pipe[2];

    if (pipe(sync_pipe) == -1) {

        perror("sync pipe failed");

        close(pipe_fd[0]);
        close(pipe_fd[1]);

        if (cgroup_created) {
            removeCgroup(cgroup_path);
        }

        return 1;
    }


    // ------------------------------------------------
    // FORK
    // ------------------------------------------------

    // Create a child process
    pid_t pid = fork();


    if (pid < 0) {

        perror("fork failed");

        close(pipe_fd[0]);
        close(pipe_fd[1]);

        close(sync_pipe[0]);
        close(sync_pipe[1]);

        if (cgroup_created) {
            removeCgroup(cgroup_path);
        }

        return 1;
    }


    // =================================================
    // CHILD PROCESS
    // =================================================

    if (pid == 0) {


        // Child does not need the reading side
        close(pipe_fd[0]);


        // Child only reads the synchronization signal
        close(sync_pipe[1]);


        // ------------------------------------------------
        // WAIT FOR CGROUP SETUP
        // ------------------------------------------------

        char sync_signal;

        ssize_t sync_result =
            read(
                sync_pipe[0],
                &sync_signal,
                1
            );


        close(sync_pipe[0]);


        if (sync_result != 1) {

            cerr << "[Child] CGroup synchronization failed"
                 << endl;

            _exit(127);
        }


        // ------------------------------------------------
        // PID NAMESPACE
        // ------------------------------------------------

        // Create a new user and PID namespace
        if (unshare(
                CLONE_NEWUSER | CLONE_NEWPID
            ) == -1) {

            perror("PID namespace failed");

            _exit(127);
        }


        // ------------------------------------------------
        // CREATE PROCESS INSIDE PID NAMESPACE
        // ------------------------------------------------

        pid_t namespace_pid = fork();


        if (namespace_pid < 0) {

            perror("namespace fork failed");

            _exit(127);
        }


        // Outer child waits for namespace process
        if (namespace_pid > 0) {

            int namespace_status;


            waitpid(
                namespace_pid,
                &namespace_status,
                0
            );


            if (WIFEXITED(namespace_status)) {

                _exit(
                    WEXITSTATUS(namespace_status)
                );
            }


            if (WIFSIGNALED(namespace_status)) {

                kill(
                    getpid(),
                    WTERMSIG(namespace_status)
                );
            }


            _exit(127);
        }


        // ------------------------------------------------
        // CODE BELOW RUNS INSIDE PID NAMESPACE
        // ------------------------------------------------

        // If the parent process is killed,
        // terminate this process as well
        prctl(
            PR_SET_PDEATHSIG,
            SIGKILL
        );


        // ------------------------------------------------
        // CPU LIMIT
        // ------------------------------------------------

        // Set CPU time limit
        struct rlimit cpu_limit;


        // Soft limit = 1 second
        cpu_limit.rlim_cur = 1;


        // Hard limit = 2 seconds
        cpu_limit.rlim_max = 2;


        if (setrlimit(
                RLIMIT_CPU,
                &cpu_limit
            ) == -1) {

            perror("CPU limit failed");

            _exit(127);
        }


        // ------------------------------------------------
        // MEMORY LIMIT
        // ------------------------------------------------

        // Set memory limit
        struct rlimit memory_limit;


        // Limit = 256 MB
        memory_limit.rlim_cur =
            256 * 1024 * 1024;


        memory_limit.rlim_max =
            256 * 1024 * 1024;


        if (setrlimit(
                RLIMIT_AS,
                &memory_limit
            ) == -1) {

            perror("Memory limit failed");

            _exit(127);
        }


        // ------------------------------------------------
        // PROCESS LIMIT
        // ------------------------------------------------

        // Limit the number of processes
        struct rlimit process_limit;


        // Maximum number of processes
        process_limit.rlim_cur = 10;

        process_limit.rlim_max = 10;


        if (setrlimit(
                RLIMIT_NPROC,
                &process_limit
            ) == -1) {

            perror("Process limit failed");

            _exit(127);
        }


        // ------------------------------------------------
        // OUTPUT REDIRECTION
        // ------------------------------------------------

        // Send normal output to the pipe
        if (dup2(
                pipe_fd[1],
                STDOUT_FILENO
            ) == -1) {

            perror("dup2 stdout failed");

            _exit(127);
        }


        // Send error output to the same pipe
        if (dup2(
                pipe_fd[1],
                STDERR_FILENO
            ) == -1) {

            perror("dup2 stderr failed");

            _exit(127);
        }


        // Pipe write end is no longer needed
        close(pipe_fd[1]);


        // ------------------------------------------------
        // EXECUTE PROGRAM
        // ------------------------------------------------

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


    // =================================================
    // PARENT PROCESS
    // =================================================


    cout << "[Parent] Child PID: "
         << pid
         << endl;


    // Parent does not write program output
    close(pipe_fd[1]);


    // ------------------------------------------------
    // ADD CHILD TO CGROUP
    // ------------------------------------------------

    bool child_added_to_cgroup = false;


    if (cgroup_created) {

        child_added_to_cgroup =
            addProcessToCgroup(
                cgroup_path,
                pid
            );


        if (!child_added_to_cgroup) {

            cout << "[CGroup] Could not add child"
                 << endl;

            cout << "[CGroup] Continuing with RLIMIT protection"
                 << endl;
        }
    }


    // ------------------------------------------------
    // RELEASE CHILD
    // ------------------------------------------------

    // Tell child that cgroup setup is complete
    char sync_signal = '1';


    if (write(
            sync_pipe[1],
            &sync_signal,
            1
        ) != 1) {

        perror("sync signal failed");

        kill(pid, SIGKILL);

        waitpid(pid, nullptr, 0);

        close(sync_pipe[1]);
        close(pipe_fd[0]);

        if (cgroup_created) {
            removeCgroup(cgroup_path);
        }

        return 1;
    }


    close(sync_pipe[1]);


    // ------------------------------------------------
    // MAKE PIPE NON-BLOCKING
    // ------------------------------------------------

    int flags =
        fcntl(
            pipe_fd[0],
            F_GETFL,
            0
        );


    if (flags == -1) {

        perror("fcntl get flags failed");

        kill(pid, SIGKILL);

        waitpid(pid, nullptr, 0);

        close(pipe_fd[0]);

        if (cgroup_created) {
            removeCgroup(cgroup_path);
        }

        return 1;
    }


    if (fcntl(
            pipe_fd[0],
            F_SETFL,
            flags | O_NONBLOCK
        ) == -1) {

        perror("fcntl set flags failed");

        kill(pid, SIGKILL);

        waitpid(pid, nullptr, 0);

        close(pipe_fd[0]);

        if (cgroup_created) {
            removeCgroup(cgroup_path);
        }

        return 1;
    }


    cout << "\n----- Program Output -----\n";


    // ------------------------------------------------
    // OUTPUT BUFFER
    // ------------------------------------------------

    char buffer[4096];


    // Used to identify wall-clock timeout
    bool timed_out = false;


    // Store child process status
    int status = 0;


    // Store execution start time
    auto start_time =
        chrono::steady_clock::now();


    // ------------------------------------------------
    // MONITOR CHILD PROCESS
    // ------------------------------------------------

    while (true) {


        // Read available output from the child
        ssize_t bytes_read =
            read(
                pipe_fd[0],
                buffer,
                sizeof(buffer) - 1
            );


        if (bytes_read > 0) {

            buffer[bytes_read] = '\0';

            cout << buffer;

            cout.flush();
        }


        // Check whether child has finished
        pid_t result =
            waitpid(
                pid,
                &status,
                WNOHANG
            );


        // Child has finished
        if (result == pid) {

            break;
        }


        // waitpid failed
        if (result == -1) {

            perror("waitpid failed");

            kill(
                pid,
                SIGKILL
            );

            waitpid(
                pid,
                nullptr,
                0
            );

            close(pipe_fd[0]);

            if (cgroup_created) {
                removeCgroup(cgroup_path);
            }

            return 1;
        }


        // ------------------------------------------------
        // WALL CLOCK TIME CHECK
        // ------------------------------------------------

        auto current_time =
            chrono::steady_clock::now();


        auto elapsed =
            chrono::duration_cast<
                chrono::seconds
            >(
                current_time - start_time
            ).count();


        // Kill process if it exceeds time limit
        if (elapsed >= TIME_LIMIT) {

            cout << "\n\nTime limit exceeded!"
                 << endl;

            cout << "Sending SIGKILL to child..."
                 << endl;


            if (kill(
                    pid,
                    SIGKILL
                ) == -1) {

                perror("kill failed");
            }


            timed_out = true;


            // Wait for killed child
            waitpid(
                pid,
                &status,
                0
            );


            break;
        }


        // Small delay before checking again
        usleep(10000);
    }


    // ------------------------------------------------
    // READ REMAINING OUTPUT
    // ------------------------------------------------

    while (true) {

        ssize_t bytes_read =
            read(
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


    // ------------------------------------------------
    // WALL CLOCK TIMEOUT
    // ------------------------------------------------

    if (timed_out) {

        cout << "Child terminated by SIGKILL"
             << endl;

        cout << "Verdict: TIME LIMIT EXCEEDED"
             << endl;
    }


    // ------------------------------------------------
    // NORMAL TERMINATION
    // ------------------------------------------------

    else if (WIFEXITED(status)) {

        int exit_code =
            WEXITSTATUS(status);


        cout << "Child exited normally"
             << endl;


        cout << "Exit code: "
             << exit_code
             << endl;


        if (exit_code == 0) {

            cout << "Verdict: SUCCESS"
                 << endl;
        }
        else {

            cout << "Verdict: RUNTIME ERROR"
                 << endl;
        }
    }


    // ------------------------------------------------
    // PROCESS TERMINATED BY SIGNAL
    // ------------------------------------------------

    else if (WIFSIGNALED(status)) {

        int signal_number =
            WTERMSIG(status);


        cout << "Child terminated by signal: "
             << signal_number
             << endl;


        // CPU time limit exceeded
        if (signal_number == SIGXCPU) {

            cout << "Verdict: CPU LIMIT EXCEEDED"
                 << endl;
        }


        // SIGKILL from resource limit
        else if (signal_number == SIGKILL) {

            cout << "Verdict: RESOURCE LIMIT EXCEEDED"
                 << endl;
        }


        // Other signals
        else {

            cout << "Verdict: RUNTIME ERROR"
                 << endl;
        }
    }


    // ------------------------------------------------
    // UNKNOWN STATUS
    // ------------------------------------------------

    else {

        cout << "Unknown child status"
             << endl;
    }


    // ------------------------------------------------
    // REMOVE CGROUP
    // ------------------------------------------------

    if (cgroup_created) {

        removeCgroup(cgroup_path);
    }


    cout << "Sandbox execution completed."
         << endl;


    return 0;
}