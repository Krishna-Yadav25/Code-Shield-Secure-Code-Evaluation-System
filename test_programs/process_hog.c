#include <stdio.h>
#include <unistd.h>
#include <sys/wait.h>

int main() {

    printf("Starting process creation test...\n");

    int created = 0;

    for (int i = 0; i < 100; i++) {

        pid_t pid = fork();

        if (pid < 0) {
            perror("fork failed");
            break;
        }

        if (pid == 0) {
            sleep(2);
            return 0;
        }

        created++;
    }

    printf("Processes created: %d\n", created);

    for (int i = 0; i < created; i++) {
        wait(NULL);
    }

    return 0;
}
