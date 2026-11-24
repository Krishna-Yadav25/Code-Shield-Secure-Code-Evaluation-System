#include <bits/stdc++.h>
using namespace std;

int main() {
    vector<long long> v;
    long long x;
    while (cin >> x) v.push_back(x);

    long long sum = 0;

    // Agar pehla number baaki numbers ki ginti ke barabar hai (n, phir array),
    // to pehla number chhodo; warna sab numbers jodo.
    if (!v.empty() && (long long)v.size() - 1 == v[0]) {
        for (size_t i = 1; i < v.size(); i++) sum += v[i];
    } else {
        for (long long y : v) sum += y;
    }

    cout << sum << endl;
    return 0;
}
