

"""
CodeShield: multi-language support (C++, Java, Python).

Judge sandbox_executor ko ek "executable" path deta hai. C++ ke liye wo asli
binary hai. Java / Python ke liye hum ek chhota shell wrapper banate hain jo
interpreter ko chalata hai, aur wahi wrapper sandbox ko dete hain. Isliye
sandbox ke saare limits (time, memory, ...) in languages par bhi lagte hain.
"""

import os
import re
import shlex
import shutil
import subprocess
import sys
from types import SimpleNamespace


SUPPORTED_LABEL = "C++, Java, Python"

LABELS = {"cpp": "C++", "python": "Python", "java": "Java"}

ALIASES = {
    "cpp": "cpp",
    "c++": "cpp",
    "cxx": "cpp",
    "java": "java",
    "python": "python",
    "python3": "python",
    "py": "python",
}

# Compile / syntax-check ke liye maximum seconds
COMPILE_TIMEOUT = {"cpp": 15, "java": 30, "python": 10}

# JVM flags. Sandbox "address space" (RLIMIT_AS) lagata hai aur JVM bahut saari
# virtual memory reserve karta hai, isliye in flags se reservations chhote rakhe
# hain. -Xlog:disable zaroori hai: warning messages program ke output mein mil
# jaate hain aur answer galat dikhata hai.
JAVA_FLAGS = (
    "-Xmx192m -Xss1m "
    "-XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:CICompilerCount=1 "
    "-XX:ReservedCodeCacheSize=32m -XX:CompressedClassSpaceSize=64m "
    "-XX:MaxMetaspaceSize=96m -XX:MaxDirectMemorySize=16m "
    "-XX:-UsePerfData -XX:+DisableAttachMechanism -Xshare:auto "
    "-Xlog:disable -Xlog:all=off"
)

# Sandbox ke extra limits (C++ / Python ke liye purane default limits hi rahte hain).
# JVM ~12 threads banata hai, isliye procs 10 se zyada chahiye.
SANDBOX_OPTIONS = {
    "cpp": [],
    "python": [],
    "java": [
        "--memory-mb=512",    # asli RAM (cgroup)
        "--address-mb=1536",  # virtual address space (RLIMIT_AS)
        "--time=10",          # JVM startup + compile ke liye zyada waqt
        "--procs=64",
        "--cpu=100",
    ],
}


def sandbox_command(sandbox_path, run_path, language):
    """sandbox_executor ko chalane ki poori command (language ke limits ke saath)."""
    return [sandbox_path, run_path, *SANDBOX_OPTIONS.get(language, [])]


def normalize_language(value):
    """User ka diya naam -> "cpp" / "java" / "python". Samajh na aaye to None."""
    return ALIASES.get(str(value if value is not None else "cpp").strip().lower())


def _failed(message):
    return SimpleNamespace(returncode=1, stderr=message)


def _ok():
    return SimpleNamespace(returncode=0, stderr="")


def _write(path, text):
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(text)


def _write_wrapper(path, command):
    _write(path, "#!/bin/sh\nexec " + command + "\n")
    os.chmod(path, 0o755)


def build_program(language, code, base, cleanup):
    """
    Code ko chalne layak banata hai.

    base:    temp path prefix, jaise /tmp/codeshield/submit_12
    cleanup: list; banaye hue saare files / folders isme jodte jaate hain
    Returns: (compile_result, run_path)
             compile_result.returncode != 0  => compile / syntax error
             run_path = wo path jo sandbox_executor ko diya jayega
    """

    timeout = COMPILE_TIMEOUT[language]

    # ------------------------------------------------------ C++
    if language == "cpp":
        source = base + ".cpp"
        _write(source, code)
        cleanup.extend([source, base])

        compiled = subprocess.run(
            ["g++", source, "-o", base],
            capture_output=True,
            text=True,
            timeout=timeout,
        )

        return compiled, base

    # ------------------------------------------------------ Python
    if language == "python":
        python = shutil.which("python3") or sys.executable

        source = base + ".py"
        _write(source, code)
        cleanup.append(source)

        # Sirf syntax check (code chalta nahi, .pyc bhi nahi banta)
        check = subprocess.run(
            [
                python,
                "-c",
                "import sys; compile(open(sys.argv[1], encoding='utf-8')"
                ".read(), sys.argv[1], 'exec')",
                source,
            ],
            capture_output=True,
            text=True,
            timeout=timeout,
        )

        if check.returncode != 0:
            return check, None

        wrapper = base + ".run"
        _write_wrapper(
            wrapper, f"{shlex.quote(python)} -B {shlex.quote(source)}"
        )
        cleanup.append(wrapper)

        return _ok(), wrapper

    # ------------------------------------------------------ Java
    java = shutil.which("java")
    javac = shutil.which("javac")

    if not java or not javac:
        return _failed(
            "Java is not installed on the judge server (java / javac not found)."
        ), None

    # Public class ka naam hi file ka naam hona chahiye; na mile to Main
    match = re.search(
        r"public\s+(?:final\s+|abstract\s+)*class\s+([A-Za-z_]\w*)", code
    )
    class_name = match.group(1) if match else "Main"

    directory = base + "_java"
    os.makedirs(directory, exist_ok=True)
    cleanup.append(directory)

    source = os.path.join(directory, class_name + ".java")
    _write(source, code)

    compiled = subprocess.run(
        [javac, "--release", "21", "-encoding", "UTF-8", "-d", directory, source],
        capture_output=True,
        text=True,
        timeout=timeout,
    )

    if compiled.returncode != 0:
        return compiled, None

    wrapper = base + ".run"
    _write_wrapper(
        wrapper,
        f"{shlex.quote(java)} {JAVA_FLAGS} -cp {shlex.quote(directory)} "
        f"{shlex.quote(class_name)}",
    )
    cleanup.append(wrapper)

    return _ok(), wrapper


def cleanup_paths(paths):
    for path in paths:
        try:
            if os.path.isdir(path):
                shutil.rmtree(path, ignore_errors=True)
            elif os.path.exists(path):
                os.remove(path)
        except OSError:
            pass


# ============================================================
# SELF TEST: kaunsi language sandbox ke andar sach mein chalti hai
# ============================================================

SELFTEST_CODE = {
    "cpp": (
        "#include <iostream>\n"
        "int main(){int a,b;std::cin>>a>>b;std::cout<<a+b<<std::endl;}\n"
    ),
    "python": "a, b = map(int, input().split())\nprint(a + b)\n",
    "java": (
        "import java.util.*;\n"
        "public class Main {\n"
        "  public static void main(String[] args) {\n"
        "    Scanner s = new Scanner(System.in);\n"
        "    System.out.println(s.nextInt() + s.nextInt());\n"
        "  }\n}\n"
    ),
}


def program_output(text):
    marker = "----- Program Output -----"

    if marker not in text:
        return text.strip()

    part = text.split(marker, 1)[1]

    return part.split("--------------------------", 1)[0].strip()


def selftest_language(language, sandbox_path, temp_dir):
    """Returns (ok: bool, detail: str)."""

    cleanup = []
    base = os.path.join(temp_dir, f"selftest_{language}")

    try:
        os.makedirs(temp_dir, exist_ok=True)

        compiled, run_path = build_program(
            language, SELFTEST_CODE[language], base, cleanup
        )

        if compiled.returncode != 0:
            return False, "build failed: " + compiled.stderr.strip()[:300]

        process = subprocess.run(
            sandbox_command(sandbox_path, run_path, language),
            input="2 3\n",
            capture_output=True,
            text=True,
            timeout=60,
        )

        raw = (process.stdout or "") + (process.stderr or "")

        if "Verdict: SUCCESS" in raw and program_output(raw) == "5":
            return True, "ok"

        return False, "sandbox said: " + raw.strip()[-400:]

    except Exception as exc:
        return False, str(exc)

    finally:
        cleanup_paths(cleanup)


def detect_languages(sandbox_path, temp_dir):
    """
    Har language ko sandbox mein chalakar dekhta hai.
    C++ hamesha available maana jata hai (base language, kabhi block nahi hoti).

    Returns {"available": ["cpp", ...], "details": {"java": "sandbox said: ..."}}
    """

    available = []
    details = {}

    for language in ("cpp", "python", "java"):
        ok, detail = selftest_language(language, sandbox_path, temp_dir)

        details[language] = detail

        if ok or language == "cpp":
            available.append(language)

    return {"available": available, "details": details}