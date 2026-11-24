# #!/usr/bin/env python3
# """
# CodeShield judge load test.

# Ek saath N students ki tarah /run request bhejta hai, phir har result ka
# intezaar karke batata hai ki queue ne kitna time liya.

# Chalane ka tareeka (backend folder se):

#     python3 load_test.py --token "$TOKEN" --problem 1 --users 10
#     python3 load_test.py --token "$TOKEN" --problem 1 --users 40 --language java

# Zaroori: pip install requests

# Dhyan: ye sirf /run (visible test cases) ko test karta hai. /submit mein hidden
# test cases bhi chalte hain, isliye asli exam ka load thoda zyada hoga.
# """

# import argparse
# import json
# import statistics
# import threading
# import time
# from collections import Counter

# import requests


# SAMPLES = {
#     "cpp": """#include <iostream>
# using namespace std;

# int main() {
#     long long a, b;
#     cin >> a >> b;
#     cout << a + b << endl;
#     return 0;
# }
# """,
#     "java": """import java.util.*;

# public class Main {
#     public static void main(String[] args) {
#         Scanner s = new Scanner(System.in);
#         long a = s.nextLong();
#         long b = s.nextLong();
#         System.out.println(a + b);
#     }
# }
# """,
#     "python": """import sys

# t = sys.stdin.read().split()
# print(int(t[0]) + int(t[1]))
# """,
# }

# ACCEPTED = {"AC", "Accepted"}


# def percentile(values, pct):
#     if not values:
#         return 0.0

#     ordered = sorted(values)
#     index = min(len(ordered) - 1, int(round(pct / 100 * (len(ordered) - 1))))

#     return ordered[index]


# def show_status(base_url, headers, label):
#     try:
#         response = requests.get(
#             f"{base_url}/api/judge/status", headers=headers, timeout=10
#         )
#         print(f"{label}: {json.dumps(response.json())}")
#     except Exception as exc:
#         print(f"{label}: status nahi mila ({exc})")


# def one_student(index, args, headers, code, start_gate, results):
#     record = {
#         "user": index,
#         "http": None,
#         "verdict": None,
#         "seconds": None,
#         "note": "",
#     }

#     session = requests.Session()

#     try:
#         start_gate.wait()

#         began = time.perf_counter()

#         response = session.post(
#             f"{args.base_url}/run",
#             headers=headers,
#             json={
#                 "code": code,
#                 "problem_id": args.problem,
#                 "language": args.language,
#             },
#             timeout=30,
#         )

#         record["http"] = response.status_code

#         if response.status_code != 202:
#             try:
#                 record["note"] = response.json().get("error", "")
#             except Exception:
#                 record["note"] = response.text[:80]

#             record["verdict"] = f"HTTP {response.status_code}"
#             results.append(record)
#             return

#         run_id = response.json().get("run_id") or response.json().get(
#             "submission_id"
#         )

#         deadline = began + args.timeout

#         while time.perf_counter() < deadline:
#             poll = session.get(
#                 f"{args.base_url}/result/{run_id}",
#                 headers=headers,
#                 timeout=15,
#             )

#             data = poll.json() if poll.ok else {}

#             if data.get("status") == "completed":
#                 record["seconds"] = time.perf_counter() - began
#                 record["verdict"] = data.get("verdict") or "UNKNOWN"
#                 results.append(record)
#                 return

#             time.sleep(0.3)

#         record["verdict"] = "CLIENT TIMEOUT"
#         record["note"] = f"{args.timeout}s mein result nahi aaya"

#     except Exception as exc:
#         record["verdict"] = "CLIENT ERROR"
#         record["note"] = str(exc)[:80]

#     results.append(record)


# def main():
#     parser = argparse.ArgumentParser(description="CodeShield judge load test")
#     parser.add_argument("--token", required=True, help="student JWT token")
#     parser.add_argument("--problem", type=int, required=True, help="problem_id")
#     parser.add_argument("--users", type=int, default=10)
#     parser.add_argument(
#         "--language", choices=["cpp", "java", "python"], default="cpp"
#     )
#     parser.add_argument("--base-url", default="http://localhost:5000")
#     parser.add_argument(
#         "--code-file", help="apna solution (default: a+b wala sample)"
#     )
#     parser.add_argument(
#         "--timeout", type=int, default=120, help="har result ka max intezaar (sec)"
#     )
#     args = parser.parse_args()

#     if args.code_file:
#         with open(args.code_file) as file:
#             code = file.read()
#     else:
#         code = SAMPLES[args.language]

#     headers = {
#         "Authorization": f"Bearer {args.token}",
#         "Content-Type": "application/json",
#     }

#     print(
#         f"\n{args.users} users, language={args.language}, "
#         f"problem={args.problem}\n"
#     )

#     show_status(args.base_url, headers, "Pehle")

#     results = []
#     start_gate = threading.Barrier(args.users + 1)

#     threads = [
#         threading.Thread(
#             target=one_student,
#             args=(i + 1, args, headers, code, start_gate, results),
#         )
#         for i in range(args.users)
#     ]

#     for thread in threads:
#         thread.start()

#     # Sab threads ek saath chhodo
#     start_gate.wait()
#     run_started = time.perf_counter()

#     for thread in threads:
#         thread.join()

#     total = time.perf_counter() - run_started

#     show_status(args.base_url, headers, "Baad mein")

#     waits = [r["seconds"] for r in results if r["seconds"] is not None]
#     verdicts = Counter(r["verdict"] for r in results)
#     accepted = sum(count for v, count in verdicts.items() if v in ACCEPTED)

#     print("\n" + "=" * 52)
#     print(f"Total time        : {total:.1f} s")

#     if waits:
#         print(f"Wait per student  : avg {statistics.mean(waits):.1f} s, "
#               f"p90 {percentile(waits, 90):.1f} s, worst {max(waits):.1f} s")
#         print(f"Throughput        : {len(waits) / total:.2f} runs/sec")
#     else:
#         print("Wait per student  : koi run complete nahi hua")

#     print(f"Accepted          : {accepted} / {args.users}")
#     print("Verdicts          :", dict(verdicts))

#     problems = [r for r in results if r["note"]]

#     if problems:
#         print("\nPehle kuch errors:")

#         for record in problems[:5]:
#             print(f"  user {record['user']}: {record['verdict']} - {record['note']}")

#     print("=" * 52)

#     print(
#         "\nAccepted kam ho aur verdict WRONG ANSWER ho to ho sakta hai problem a+b "
#         "na ho. Apna sahi solution --code-file se do.\n"
#         "HTTP 429 = queue/user limit lagi (.env check karo), "
#         "HTTP 423 = ye student frozen hai."
#     )


# if __name__ == "__main__":
#     main()


"""
CodeShield load test: N students ek saath Run dabate hain.

Usage (backend chalu hona chahiye):
  python3 load_test.py --token <JWT> --problem 1 --users 20
  python3 load_test.py --token <JWT> --problem 1 --users 20 --language java --code-file Main.java

Token: browser DevTools > Application > Local Storage > codeshield_token
Problem: wo problem_id jiska expected output simple ho (a+b jaisa).
"""
import argparse
import statistics
import sys
import threading
import time

import requests

DEFAULT_CODE = {
    "cpp": '#include <iostream>\nusing namespace std;\nint main(){long long a,b;cin>>a>>b;cout<<a+b;return 0;}\n',
    "python": "a, b = map(int, input().split())\nprint(a + b)\n",
    "java": "import java.util.*;\npublic class Main {\n  public static void main(String[] x) {\n"
            "    Scanner s = new Scanner(System.in);\n    System.out.println(s.nextLong() + s.nextLong());\n  }\n}\n",
}


def unique_code(code, language, idx):
    """Har student ka code thoda alag (comment), taaki compile cache load test ko jhootha tez na kare."""
    mark = f"{idx}-{time.time_ns()}"
    return code + (f"\n# {mark}\n" if language == "python" else f"\n// {mark}\n")


def one_student(idx, args, code, out):
    code = code if args.same_code else unique_code(code, args.language, idx)
    headers = {"Authorization": f"Bearer {args.token}", "Content-Type": "application/json"}
    start = time.perf_counter()
    try:
        r = requests.post(
            f"{args.base}/run",
            json={"code": code, "problem_id": args.problem, "language": args.language},
            headers=headers, timeout=30,
        )
        data = r.json() if r.content else {}
        rid = data.get("run_id") or data.get("submission_id")
        if not r.ok or not rid:
            out[idx] = ("HTTP_%s" % r.status_code, time.perf_counter() - start)
            return

        deadline = time.time() + args.timeout
        while time.time() < deadline:
            res = requests.get(f"{args.base}/result/{rid}", headers=headers, timeout=30).json()
            if res.get("status") == "completed":
                out[idx] = (res.get("verdict") or "?", time.perf_counter() - start)
                return
            time.sleep(0.3)
        out[idx] = ("POLL_TIMEOUT", time.perf_counter() - start)
    except Exception as exc:  # noqa: BLE001
        out[idx] = (f"ERR_{type(exc).__name__}", time.perf_counter() - start)


def pct(values, p):
    values = sorted(values)
    return values[min(len(values) - 1, int(round(p / 100 * (len(values) - 1))))]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--token", required=True)
    ap.add_argument("--problem", type=int, required=True)
    ap.add_argument("--users", type=int, default=10)
    ap.add_argument("--language", default="cpp", choices=["cpp", "python", "java"])
    ap.add_argument("--code-file")
    ap.add_argument("--same-code", action="store_true",
                    help="sab ka bilkul same code (compile cache hit; asli load jaisa nahi)")
    ap.add_argument("--base", default="http://localhost:5000")
    ap.add_argument("--timeout", type=int, default=120, help="per-run wait (sec)")
    args = ap.parse_args()

    code = open(args.code_file).read() if args.code_file else DEFAULT_CODE[args.language]
    out = {}
    threads = [threading.Thread(target=one_student, args=(i, args, code, out)) for i in range(args.users)]

    wall = time.perf_counter()
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    wall = time.perf_counter() - wall

    verdicts = {}
    for v, _ in out.values():
        verdicts[v] = verdicts.get(v, 0) + 1
    times = [t for _, t in out.values()]

    print(f"\nUsers: {args.users}  Language: {args.language}  Total time: {wall:.1f}s")
    print(f"Verdicts: {verdicts}")
    print(f"Wait per student  avg {statistics.mean(times):.1f}s | p50 {pct(times,50):.1f}s | "
          f"p90 {pct(times,90):.1f}s | worst {max(times):.1f}s")
    print(f"Throughput: {args.users / wall:.2f} runs/sec")
    ok = sum(1 for v in out.values() if v[0] in ("AC", "Accepted"))
    print(f"Accepted: {ok}/{args.users}")
    sys.exit(0)


if __name__ == "__main__":
    main()