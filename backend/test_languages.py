# """
# Check karta hai ki C++, Python aur Java tumhare sandbox_executor ke andar chalte
# hain ya nahi (bilkul wahi tareeka jo judge use karta hai).

# Chalao:   cd ~/codeshield/backend && python3 test_languages.py
# """

# import os
# import subprocess
# import sys

# HERE = os.path.dirname(os.path.abspath(__file__))
# sys.path.insert(0, HERE)

# from languages import build_program, cleanup_paths  # noqa: E402

# SANDBOX = os.path.join(os.path.dirname(HERE), "sandbox", "sandbox_executor")
# TEMP = "/tmp/codeshield"

# SAMPLES = {
#     "cpp": (
#         "#include <iostream>\n"
#         "int main(){int a,b;std::cin>>a>>b;std::cout<<a+b<<std::endl;}\n"
#     ),
#     "python": "a, b = map(int, input().split())\nprint(a + b)\n",
#     "java": (
#         "import java.util.*;\n"
#         "public class Main {\n"
#         "  public static void main(String[] args) {\n"
#         "    Scanner s = new Scanner(System.in);\n"
#         "    System.out.println(s.nextInt() + s.nextInt());\n"
#         "  }\n}\n"
#     ),
# }


# def program_output(text):
#     marker = "----- Program Output -----"

#     if marker not in text:
#         return text.strip()

#     part = text.split(marker, 1)[1]

#     return part.split("--------------------------", 1)[0].strip()


# def main():
#     if not os.path.exists(SANDBOX):
#         print(f"sandbox_executor not found at {SANDBOX}")
#         return 1

#     os.makedirs(TEMP, exist_ok=True)

#     all_ok = True

#     for language, code in SAMPLES.items():
#         cleanup = []
#         base = os.path.join(TEMP, f"selftest_{language}")

#         try:
#             compiled, run_path = build_program(language, code, base, cleanup)

#             if compiled.returncode != 0:
#                 print(f"[FAIL] {language:7} compile step failed:")
#                 print("       " + compiled.stderr.strip().replace("\n", "\n       "))
#                 all_ok = False
#                 continue

#             process = subprocess.run(
#                 [SANDBOX, run_path],
#                 input="2 3\n",
#                 capture_output=True,
#                 text=True,
#                 timeout=40,
#             )

#             raw = (process.stdout or "") + (process.stderr or "")
#             output = program_output(raw)

#             if "Verdict: SUCCESS" in raw and output == "5":
#                 print(f"[ OK ] {language:7} printed 5 inside the sandbox")
#             else:
#                 all_ok = False
#                 print(f"[FAIL] {language:7} sandbox said:")
#                 print("       " + raw.strip().replace("\n", "\n       ")[:600])

#         except Exception as exc:
#             all_ok = False
#             print(f"[FAIL] {language:7} {exc}")

#         finally:
#             cleanup_paths(cleanup)

#     print()
#     print("ALL LANGUAGES WORK" if all_ok else "Some languages failed (see above)")

#     return 0 if all_ok else 1


# if __name__ == "__main__":
#     sys.exit(main())

"""
Check karta hai ki C++, Python aur Java sandbox_executor ke andar chalte hain ya nahi
(bilkul wahi self-test jo backend start hote waqt chalata hai).

Chalao:   cd ~/codeshield/backend && python3 test_languages.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from languages import LABELS, selftest_language  # noqa: E402

SANDBOX = os.path.join(os.path.dirname(HERE), "sandbox", "sandbox_executor")
TEMP = "/tmp/codeshield"


def main():
    if not os.path.exists(SANDBOX):
        print(f"sandbox_executor not found at {SANDBOX}")
        return 1

    all_ok = True

    for language in ("cpp", "python", "java"):
        ok, detail = selftest_language(language, SANDBOX, TEMP)

        if ok:
            print(f"[ OK ] {language:7} printed 5 inside the sandbox")
        else:
            all_ok = False
            print(f"[FAIL] {language:7} {detail}")

    print()
    print("ALL LANGUAGES WORK" if all_ok else "Some languages failed (see above)")

    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())