# """
# AI question generation for CodeShield.

# Flow:
#   1. Ask Claude for coding problems (JSON only).
#   2. Validate / clean every question.
#   3. Compile the AI's reference solution and run it on every test case
#      inside the existing sandbox_executor. If the output matches the
#      expected output the question is marked "verified".
# """

# import json
# import os
# import re
# import subprocess
# import uuid

# import anthropic


# BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# SANDBOX_EXECUTOR_PATH = os.path.join(BASE_DIR, "sandbox", "sandbox_executor")
# TEMP_DIR = "/tmp/codeshield"

# MAX_QUESTIONS = 8
# VALID_DIFFICULTIES = ("Easy", "Medium", "Hard")
# DEFAULT_MAX_MARKS = 10.0


# class AIServiceError(Exception):
#     """Raised when the AI call or its response cannot be used."""


# # ============================================================
# # PROMPT
# # ============================================================

# SYSTEM_PROMPT = """You write C++ programming problems for a college coding test.

# Return ONLY one JSON object, no markdown fences, no text before or after:

# {
#   "questions": [
#     {
#       "title": "short title",
#       "statement": "full problem statement",
#       "difficulty": "Easy" | "Medium" | "Hard",
#       "time_limit_ms": 1000,
#       "memory_limit_mb": 256,
#       "max_marks": 10,
#       "reference_solution": "complete C++17 program",
#       "test_cases": [
#         {"input": "...", "expected_output": "...", "is_hidden": false}
#       ]
#     }
#   ]
# }

# Rules:
# - The statement must be self-contained: description, Input Format, Output Format,
#   Constraints, and one worked example with a short explanation.
# - Programs read from stdin and print to stdout.
# - Every input must have exactly ONE correct output. Never ask for "any valid answer".
# - Provide 2 visible test cases (the first must be the example from the statement)
#   and at least 3 hidden test cases that cover edge cases.
# - Keep test inputs small enough to type by hand.
# - "reference_solution" must be a complete C++17 program that reads stdin.
# - "expected_output" must be exactly what the reference solution prints.
# - Do not repeat questions."""


# def _build_user_prompt(topic, difficulty, count, notes):
#     prompt = (
#         f"Create {count} {difficulty} coding problem(s) on this topic: {topic}."
#     )

#     if notes:
#         prompt += f"\nExtra instructions from the teacher: {notes}"

#     return prompt


# # ============================================================
# # AI CALL
# # ============================================================

# def _call_ai(topic, difficulty, count, notes):
#     api_key = os.getenv("ANTHROPIC_API_KEY")

#     if not api_key:
#         raise AIServiceError("ANTHROPIC_API_KEY is not set on the server.")

#     model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5")

#     client = anthropic.Anthropic(api_key=api_key, timeout=180.0)

#     try:
#         message = client.messages.create(
#             model=model,
#             max_tokens=12000,
#             system=SYSTEM_PROMPT,
#             messages=[
#                 {
#                     "role": "user",
#                     "content": _build_user_prompt(
#                         topic, difficulty, count, notes
#                     ),
#                 }
#             ],
#         )
#     except anthropic.APIError as exc:
#         print("AI API ERROR:", exc)
#         raise AIServiceError("The AI service request failed. Try again.")

#     if message.stop_reason == "max_tokens":
#         raise AIServiceError(
#             "The AI response was cut off. Ask for fewer questions."
#         )

#     return "".join(
#         block.text for block in message.content if block.type == "text"
#     )


# def _parse_json(text):
#     text = (text or "").strip()
#     text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)

#     start = text.find("{")
#     end = text.rfind("}")

#     if start == -1 or end == -1:
#         raise AIServiceError("The AI returned an unreadable answer. Try again.")

#     try:
#         return json.loads(text[start:end + 1])
#     except json.JSONDecodeError:
#         raise AIServiceError("The AI returned an unreadable answer. Try again.")


# # ============================================================
# # VALIDATION
# # Used for AI output AND for edited questions coming from the
# # frontend, so nothing unchecked reaches the database.
# # ============================================================

# def _number(value, default, low, high):
#     try:
#         number = float(value)
#     except (TypeError, ValueError):
#         return default

#     return min(max(number, low), high)


# def clean_question(raw):
#     if not isinstance(raw, dict):
#         raise ValueError("Invalid question format")

#     title = str(raw.get("title", "")).strip()[:200]
#     statement = str(raw.get("statement", "")).strip()

#     if not title or not statement:
#         raise ValueError("Every question needs a title and a statement")

#     difficulty = str(raw.get("difficulty", "Easy")).strip().capitalize()

#     if difficulty not in VALID_DIFFICULTIES:
#         raise ValueError(f"'{title}': difficulty must be Easy, Medium or Hard")

#     raw_cases = raw.get("test_cases")

#     if not isinstance(raw_cases, list):
#         raise ValueError(f"'{title}': test cases are missing")

#     test_cases = []

#     for case in raw_cases:
#         if not isinstance(case, dict):
#             continue

#         case_input = str(case.get("input", ""))
#         case_output = str(case.get("expected_output", ""))

#         if not case_input.strip() or not case_output.strip():
#             continue

#         test_cases.append({
#             "input": case_input,
#             "expected_output": case_output,
#             "is_hidden": bool(case.get("is_hidden", False)),
#         })

#     if len(test_cases) < 2:
#         raise ValueError(f"'{title}': at least 2 valid test cases are required")

#     # Always keep one visible and one hidden case.
#     if all(c["is_hidden"] for c in test_cases):
#         test_cases[0]["is_hidden"] = False

#     if not any(c["is_hidden"] for c in test_cases):
#         test_cases[-1]["is_hidden"] = True

#     return {
#         "title": title,
#         "statement": statement,
#         "difficulty": difficulty,
#         "time_limit_ms": int(_number(raw.get("time_limit_ms"), 1000, 100, 10000)),
#         "memory_limit_mb": int(_number(raw.get("memory_limit_mb"), 256, 16, 1024)),
#         "max_marks": _number(raw.get("max_marks"), DEFAULT_MAX_MARKS, 0.5, 1000),
#         "test_cases": test_cases,
#     }


# # ============================================================
# # SANDBOX VERIFICATION
# # ============================================================

# def _normalize(text):
#     return (text or "").replace("\r\n", "\n").replace("\r", "\n").strip()


# def _extract_program_output(output):
#     marker = "----- Program Output -----"

#     if marker not in output:
#         return output.strip()

#     program_output = output.split(marker, 1)[1]
#     separator = "--------------------------"

#     if separator in program_output:
#         program_output = program_output.split(separator, 1)[0]

#     return program_output.strip()


# def verify_question(question, reference_solution):
#     """Returns (verified: bool, note: str)."""

#     if not reference_solution or not str(reference_solution).strip():
#         return False, "No reference solution, so test cases were not checked."

#     if not os.path.exists(SANDBOX_EXECUTOR_PATH):
#         return False, "Sandbox not found, so test cases were not checked."

#     os.makedirs(TEMP_DIR, exist_ok=True)

#     uid = uuid.uuid4().hex
#     source_path = os.path.join(TEMP_DIR, f"ai_{uid}.cpp")
#     executable_path = os.path.join(TEMP_DIR, f"ai_{uid}")

#     try:
#         with open(source_path, "w") as file:
#             file.write(str(reference_solution))

#         compiled = subprocess.run(
#             ["g++", "-std=c++17", source_path, "-o", executable_path],
#             capture_output=True,
#             text=True,
#             timeout=30,
#         )

#         if compiled.returncode != 0:
#             return False, "The reference solution did not compile."

#         for index, case in enumerate(question["test_cases"], start=1):
#             test_input = case["input"]

#             if not test_input.endswith("\n"):
#                 test_input += "\n"

#             try:
#                 process = subprocess.run(
#                     [SANDBOX_EXECUTOR_PATH, executable_path],
#                     input=test_input,
#                     capture_output=True,
#                     text=True,
#                     timeout=15,
#                 )
#             except subprocess.TimeoutExpired:
#                 return False, f"Reference solution timed out on test case {index}."

#             output = (process.stdout or "") + (process.stderr or "")

#             if "Verdict: SUCCESS" not in output:
#                 return False, f"Reference solution failed on test case {index}."

#             actual = _normalize(_extract_program_output(output))
#             expected = _normalize(case["expected_output"])

#             if actual != expected:
#                 return False, f"Expected output does not match on test case {index}."

#         return True, "All test cases match the reference solution."

#     except Exception as exc:
#         print("AI VERIFY ERROR:", exc)
#         return False, "Verification could not be completed."

#     finally:
#         for path in (source_path, executable_path):
#             try:
#                 if os.path.exists(path):
#                     os.remove(path)
#             except OSError:
#                 pass


# # ============================================================
# # PUBLIC ENTRY POINT
# # ============================================================

# def generate_questions(topic, difficulty, count, notes=""):
#     count = max(1, min(int(count), MAX_QUESTIONS))

#     data = _parse_json(_call_ai(topic, difficulty, count, notes))
#     raw_questions = data.get("questions")

#     if not isinstance(raw_questions, list) or not raw_questions:
#         raise AIServiceError("The AI did not return any questions. Try again.")

#     questions = []

#     for raw in raw_questions[:count]:
#         try:
#             question = clean_question(raw)
#         except ValueError as exc:
#             print("AI QUESTION SKIPPED:", exc)
#             continue

#         verified, note = verify_question(
#             question,
#             raw.get("reference_solution") if isinstance(raw, dict) else None,
#         )

#         question["verified"] = verified
#         question["verify_note"] = note
#         question["reference_solution"] = str(raw.get("reference_solution", ""))
#         questions.append(question)

#     if not questions:
#         raise AIServiceError("None of the generated questions were usable. Try again.")

#     return questions




import json
import os
import re
import subprocess
import uuid
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import errors


# ============================================================
# PATHS AND CONFIGURATION
# ============================================================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SANDBOX_EXECUTOR_PATH = os.path.join(
    BASE_DIR, "sandbox", "sandbox_executor"
)
TEMP_DIR = "/tmp/codeshield"

MAX_QUESTIONS = 8
VALID_DIFFICULTIES = ("Easy", "Medium", "Hard")
DEFAULT_MAX_MARKS = 10.0
DEFAULT_MODEL = "gemini-3.6-flash"


# Load .env from the project root or backend directory.
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BACKEND_DIR.parent

backend_env = BACKEND_DIR / ".env"
project_env = PROJECT_DIR / ".env"

if backend_env.exists():
    load_dotenv(backend_env, override=False)
elif project_env.exists():
    load_dotenv(project_env, override=False)


class AIServiceError(Exception):
    """Raised when the AI call or its response cannot be used."""


# ============================================================
# PROMPT
# ============================================================

SYSTEM_PROMPT = """
You generate coding problems for a college coding assessment platform.

Return ONLY one valid JSON object, with no Markdown fences and
no text before or after the JSON.

Required structure:
{
  "questions": [
    {
      "title": "short title",
      "statement": "complete problem statement",
      "difficulty": "Easy",
      "time_limit_ms": 1000,
      "memory_limit_mb": 256,
      "max_marks": 10,
      "reference_solution": "complete C++17 program",
      "test_cases": [
        {
          "input": "input text",
          "expected_output": "exact output",
          "is_hidden": false
        }
      ]
    }
  ]
}

Rules:
1. Each problem must be self-contained.
2. Include Description, Input Format, Output Format, Constraints,
   one worked example, and a short explanation.
3. Programs must read from stdin and print to stdout.
4. Every input must have exactly one correct output.
5. Provide at least 2 visible and 3 hidden test cases.
6. The first visible test case must match the worked example.
7. Include meaningful edge cases.
8. Keep test inputs small enough to type by hand.
9. reference_solution must be a complete C++17 program.
10. expected_output must exactly match the solution's output.
11. Do not repeat questions.
12. Return the requested number of questions whenever possible.
13. Do not use Markdown outside JSON string values.
"""


def _build_user_prompt(topic, difficulty, count, notes):
    prompt = (
        f"Create {count} {difficulty} coding problem(s) "
        f"on this topic: {topic}.\n"
        "Use C++17 for every reference solution. "
        "Follow the required JSON structure exactly."
    )

    if notes:
        prompt += f"\nExtra instructions from the teacher: {notes}"

    return prompt


# ============================================================
# GEMINI API CALL
# ============================================================

def _call_ai(topic, difficulty, count, notes):
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise AIServiceError(
            "GEMINI_API_KEY is missing. Check your .env file."
        )

    model = os.getenv("GEMINI_MODEL", DEFAULT_MODEL)

    try:
        client = genai.Client(api_key=api_key)

        response = client.models.generate_content(
            model=model,
            contents=(
                SYSTEM_PROMPT
                + "\n\n"
                + _build_user_prompt(topic, difficulty, count, notes)
            ),
            config={
                "temperature": 0.2,
                "response_mime_type": "application/json",
            },
        )

    except errors.APIError as exc:
        status_code = getattr(exc, "code", None)
        print("GEMINI API ERROR:", exc)

        if status_code == 429:
            message = (
                "Gemini API quota exceeded or rate limit reached. "
                "Check your API quota and try again later."
            )
        elif status_code in (500, 502, 503, 504):
            message = (
                "Gemini is temporarily unavailable or overloaded. "
                "Please try again shortly."
            )
        else:
            message = (
                "Gemini request failed. Check your model name, "
                "API configuration, and available quota."
            )

        raise AIServiceError(message) from exc

    except Exception as exc:
        print("GEMINI REQUEST ERROR:", exc)
        raise AIServiceError(
            "Could not contact Gemini. Check the server logs."
        ) from exc

    response_text = getattr(response, "text", None)

    if not response_text or not response_text.strip():
        raise AIServiceError(
            "Gemini returned an empty response. Please try again."
        )

    return response_text


# ============================================================
# JSON PARSING
# ============================================================

def _parse_json(text):
    text = (text or "").strip()

    text = re.sub(
        r"^\s*```(?:json)?\s*|\s*```\s*$",
        "",
        text,
        flags=re.IGNORECASE,
    )

    start = text.find("{")
    end = text.rfind("}")

    if start == -1 or end == -1 or end < start:
        raise AIServiceError(
            "Gemini returned an unreadable answer. Try again."
        )

    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError as exc:
        raise AIServiceError(
            "Gemini returned invalid JSON. Please try again."
        ) from exc


# ============================================================
# VALIDATION
# ============================================================

def _number(value, default, low, high):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default

    if not (number == number and abs(number) != float("inf")):
        return default

    return min(max(number, low), high)


def clean_question(raw):
    if not isinstance(raw, dict):
        raise ValueError("Invalid question format")

    title = str(raw.get("title", "")).strip()[:200]
    statement = str(raw.get("statement", "")).strip()

    if not title or not statement:
        raise ValueError(
            "Every question needs a title and a statement"
        )

    difficulty = str(
        raw.get("difficulty", "Easy")
    ).strip().capitalize()

    if difficulty not in VALID_DIFFICULTIES:
        raise ValueError(
            f"'{title}': difficulty must be Easy, Medium or Hard"
        )

    raw_cases = raw.get("test_cases")

    if not isinstance(raw_cases, list):
        raise ValueError(f"'{title}': test cases are missing")

    test_cases = []

    for case in raw_cases:
        if not isinstance(case, dict):
            continue

        case_input = str(case.get("input", ""))
        case_output = str(case.get("expected_output", ""))

        if not case_input.strip() or not case_output.strip():
            continue

        test_cases.append({
            "input": case_input,
            "expected_output": case_output,
            "is_hidden": bool(case.get("is_hidden", False)),
        })

    if len(test_cases) < 2:
        raise ValueError(
            f"'{title}': at least 2 valid test cases are required"
        )

    # Keep at least one visible and one hidden case.
    if all(case["is_hidden"] for case in test_cases):
        test_cases[0]["is_hidden"] = False

    if not any(case["is_hidden"] for case in test_cases):
        test_cases[-1]["is_hidden"] = True

    return {
        "title": title,
        "statement": statement,
        "difficulty": difficulty,
        "time_limit_ms": int(
            _number(raw.get("time_limit_ms"), 1000, 100, 10000)
        ),
        "memory_limit_mb": int(
            _number(raw.get("memory_limit_mb"), 256, 16, 1024)
        ),
        "max_marks": _number(
            raw.get("max_marks"), DEFAULT_MAX_MARKS, 0.5, 1000
        ),
        "test_cases": test_cases,
    }


# ============================================================
# SANDBOX VERIFICATION
# ============================================================

def _normalize(text):
    return (text or "").replace("\r\n", "\n").replace("\r", "\n").strip()


def _extract_program_output(output):
    marker = "----- Program Output -----"

    if marker not in output:
        return output.strip()

    program_output = output.split(marker, 1)[1]
    separator = "--------------------------"

    if separator in program_output:
        program_output = program_output.split(separator, 1)[0]

    return program_output.strip()


def verify_question(question, reference_solution):
    """Return (verified: bool, note: str)."""

    if not reference_solution or not str(reference_solution).strip():
        return False, "No reference solution, so test cases were not checked."

    if not os.path.exists(SANDBOX_EXECUTOR_PATH):
        return False, "Sandbox not found, so test cases were not checked."

    os.makedirs(TEMP_DIR, exist_ok=True)

    uid = uuid.uuid4().hex
    source_path = os.path.join(TEMP_DIR, f"ai_{uid}.cpp")
    executable_path = os.path.join(TEMP_DIR, f"ai_{uid}")

    try:
        with open(source_path, "w", encoding="utf-8") as file:
            file.write(str(reference_solution))

        compiled = subprocess.run(
            ["g++", "-std=c++17", source_path, "-o", executable_path],
            capture_output=True,
            text=True,
            timeout=30,
        )

        if compiled.returncode != 0:
            return False, "The reference solution did not compile."

        for index, case in enumerate(question["test_cases"], start=1):
            test_input = case["input"]

            if not test_input.endswith("\n"):
                test_input += "\n"

            try:
                process = subprocess.run(
                    [SANDBOX_EXECUTOR_PATH, executable_path],
                    input=test_input,
                    capture_output=True,
                    text=True,
                    timeout=15,
                )
            except subprocess.TimeoutExpired:
                return False, (
                    f"Reference solution timed out on test case {index}."
                )

            output = (process.stdout or "") + (process.stderr or "")

            if "Verdict: SUCCESS" not in output:
                return False, (
                    f"Reference solution failed on test case {index}."
                )

            actual = _normalize(_extract_program_output(output))
            expected = _normalize(case["expected_output"])

            if actual != expected:
                return False, (
                    f"Expected output does not match on test case {index}."
                )

        return True, "All test cases match the reference solution."

    except Exception as exc:
        print("AI VERIFY ERROR:", exc)
        return False, "Verification could not be completed."

    finally:
        for path in (source_path, executable_path):
            try:
                if os.path.exists(path):
                    os.remove(path)
            except OSError:
                pass


# ============================================================
# PUBLIC ENTRY POINT
# ============================================================

def generate_questions(topic, difficulty, count, notes=""):
    if not str(topic or "").strip():
        raise AIServiceError("Please enter a topic.")

    difficulty = str(difficulty or "Easy").strip().capitalize()

    if difficulty not in VALID_DIFFICULTIES:
        raise AIServiceError(
            "Difficulty must be Easy, Medium or Hard."
        )

    try:
        count = int(count)
    except (TypeError, ValueError) as exc:
        raise AIServiceError("Question count must be a number.") from exc

    count = max(1, min(count, MAX_QUESTIONS))

    data = _parse_json(
        _call_ai(topic, difficulty, count, notes)
    )

    raw_questions = data.get("questions")

    if not isinstance(raw_questions, list) or not raw_questions:
        raise AIServiceError(
            "Gemini did not return any questions. Try again."
        )

    questions = []

    for raw in raw_questions[:count]:
        try:
            question = clean_question(raw)
        except ValueError as exc:
            print("AI QUESTION SKIPPED:", exc)
            continue

        reference_solution = (
            raw.get("reference_solution", "")
            if isinstance(raw, dict)
            else ""
        )

        verified, note = verify_question(
            question, reference_solution
        )

        question["verified"] = verified
        question["verify_note"] = note
        question["reference_solution"] = str(reference_solution)

        questions.append(question)

    if not questions:
        raise AIServiceError(
            "None of the generated questions were usable. Try again."
        )

    return questions
