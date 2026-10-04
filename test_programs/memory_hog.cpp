#include <iostream>
#include <vector>

using namespace std;

int main() {

    cout << "Trying to allocate memory..." << endl;

    vector<char> memory;

    try {
        memory.resize(512 * 1024 * 1024);

        cout << "Memory allocation succeeded!" << endl;
    }
    catch (const bad_alloc& e) {
        cerr << "Memory allocation failed!" << endl;
        return 1;
    }

    return 0;
}
