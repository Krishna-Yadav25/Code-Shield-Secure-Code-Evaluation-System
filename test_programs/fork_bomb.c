// fork_bomb.c
// Another deliberately malicious "student submission" — repeatedly
// forks itself. Used to test whether pids.max in your cgroup actually
// stops process-count explosion.
//
// Compile: gcc -o fork_bomb fork_bomb.c
//
// WARNING: run this ONLY inside a VM/sandbox you don't mind rebooting,
// and ONLY through your executor once cgroups pids.max is active.
// Running this with no protection at all can make your machine unusable
// until reboot.

#include <unistd.h>

int main() {
    while (1) {
        fork();
    }
    return 0;
}