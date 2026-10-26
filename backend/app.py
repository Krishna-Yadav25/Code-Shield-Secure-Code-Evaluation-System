import os
import sys
import time
import queue
import threading
import subprocess

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from assessment_routes import assessment_bp
from notification_routes import notification_bp

PROJECT_ROOT = os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))
)

if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# ============================================================
# LOAD ENVIRONMENT
# ============================================================

load_dotenv()


# ============================================================
# PROJECT PATH
# ============================================================

BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)


# ============================================================
# DATABASE IMPORTS
# ============================================================

from database.insert_result import (
    create_submission,
    update_submission_status,
    insert_result
)

from database.auth import (
    verify_token,
    get_connection
)


# ============================================================
# ROUTE IMPORTS
# ============================================================

from auth_routes import auth_bp
from oauth_routes import oauth_bp, init_oauth
from dashboard_routes import dashboard_bp
from coding_routes import coding_bp


# ============================================================
# FLASK APP
# ============================================================

app = Flask(__name__)

app.secret_key = os.getenv(
    "FLASK_SECRET_KEY",
    "codeshield_flask_dev_secret"
)

CORS(app)


# ============================================================
# REGISTER BLUEPRINTS
# ============================================================

app.register_blueprint(auth_bp)

init_oauth(app)
app.register_blueprint(oauth_bp)

app.register_blueprint(dashboard_bp)
app.register_blueprint(coding_bp)
app.register_blueprint(assessment_bp)
app.register_blueprint(notification_bp)


# ============================================================
# SANDBOX
# ============================================================

SANDBOX_EXECUTOR_PATH = os.path.join(
    BASE_DIR,
    "sandbox",
    "sandbox_executor"
)


# ============================================================
# TEMP DIRECTORY
# ============================================================

TEMP_DIR = "/tmp/codeshield"

os.makedirs(
    TEMP_DIR,
    exist_ok=True
)


# ============================================================
# JOB QUEUE
# ============================================================

job_queue = queue.Queue()


# ============================================================
# IN-MEMORY RESULTS
# ============================================================

results = {}

results_lock = threading.Lock()


# ============================================================
# RUN ID
# Negative IDs are used for Run Code.
# They are NOT database submissions.
# ============================================================

next_run_id = -1
run_id_lock = threading.Lock()


def generate_run_id():
    global next_run_id

    with run_id_lock:
        run_id = next_run_id
        next_run_id -= 1

    return run_id


# ============================================================
# AUTHENTICATION
# ============================================================

def get_logged_in_user():

    auth_header = request.headers.get(
        "Authorization"
    )

    if not auth_header:
        return None

    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(
        " ",
        1
    )[1].strip()

    if not token:
        return None

    try:
        return verify_token(token)

    except Exception:
        return None


# ============================================================
# GET TEST CASES
# ============================================================

def get_test_cases(
    problem_id,
    include_hidden=True
):

    conn = None
    cur = None

    try:

        conn = get_connection()
        cur = conn.cursor()

        if include_hidden:

            cur.execute(
                """
                SELECT
                    testcase_id,
                    input,
                    expected_output,
                    is_hidden
                FROM TestCases
                WHERE problem_id = %s
                ORDER BY testcase_id ASC
                """,
                (problem_id,)
            )

        else:

            cur.execute(
                """
                SELECT
                    testcase_id,
                    input,
                    expected_output,
                    is_hidden
                FROM TestCases
                WHERE problem_id = %s
                  AND is_hidden = FALSE
                ORDER BY testcase_id ASC
                """,
                (problem_id,)
            )

        rows = cur.fetchall()

        test_cases = []

        for row in rows:

            test_cases.append(
                {
                    "testcase_id": row[0],
                    "input": (
                        row[1]
                        if row[1] is not None
                        else ""
                    ),
                    "expected_output": (
                        row[2]
                        if row[2] is not None
                        else ""
                    ),
                    "is_hidden": bool(row[3])
                }
            )

        return test_cases

    finally:

        if cur:
            cur.close()

        if conn:
            conn.close()


# ============================================================
# NORMALIZE OUTPUT
# ============================================================

def normalize_output(output):

    if output is None:
        return ""

    output = output.replace(
        "\r\n",
        "\n"
    )

    output = output.replace(
        "\r",
        "\n"
    )

    return output.strip()


# ============================================================
# EXTRACT PROGRAM OUTPUT
# ============================================================

def extract_program_output(output):

    if not output:
        return ""

    marker = "----- Program Output -----"

    if marker in output:

        program_output = output.split(
            marker,
            1
        )[1]

        separator = "--------------------------"

        if separator in program_output:

            program_output = program_output.split(
                separator,
                1
            )[0]

        return program_output.strip()

    return output.strip()


# ============================================================
# GET SANDBOX VERDICT
# ============================================================

def get_sandbox_verdict(output):

    if "Verdict: SUCCESS" in output:
        return "SUCCESS"

    if "Verdict: COMPILATION ERROR" in output:
        return "COMPILATION ERROR"

    if "Verdict: TIME LIMIT EXCEEDED" in output:
        return "TIME LIMIT EXCEEDED"

    if "Verdict: CPU LIMIT EXCEEDED" in output:
        return "CPU LIMIT EXCEEDED"

    if "Verdict: RESOURCE LIMIT EXCEEDED" in output:
        return "RESOURCE LIMIT EXCEEDED"

    if "Verdict: RUNTIME ERROR" in output:
        return "RUNTIME ERROR"

    return "RUNTIME ERROR"


# ============================================================
# SAVE DATABASE RESULT
# Only used for Submit.
# ============================================================

def save_database_result(
    submission_id,
    verdict,
    execution_time_ms,
    memory_used_kb,
    test_cases_passed,
    test_cases_total
):

    update_submission_status(
        submission_id,
        "completed"
    )

    insert_result(
        submission_id,
        verdict,
        execution_time_ms,
        memory_used_kb,
        test_cases_passed,
        test_cases_total
    )


# ============================================================
# UPDATE MEMORY RESULT
# ============================================================

def update_memory_result(
    result_id,
    status,
    verdict,
    execution_time_ms=0,
    memory_used_kb=0,
    test_cases_passed=0,
    test_cases_total=0,
    output=None
):

    with results_lock:

        results[result_id] = {
            "status": status,
            "verdict": verdict,
            "execution_time_ms": execution_time_ms,
            "memory_used_kb": memory_used_kb,
            "test_cases_passed": test_cases_passed,
            "test_cases_total": test_cases_total,
            "output": output
        }


# ============================================================
# WORKER
# ============================================================

def worker():

    while True:

        job = job_queue.get()

        result_id = job["result_id"]
        problem_id = job["problem_id"]
        code = job["code"]

       
        job_type = job.get(
            "job_type",
            "submit"
        )

        persist_to_database = (
            job_type == "submit"
        )

        
        file_prefix = (
            "submit"
            if persist_to_database
            else "run"
        )

        source_path = os.path.join(
            TEMP_DIR,
            f"{file_prefix}_{abs(result_id)}.cpp"
        )

        executable_path = os.path.join(
            TEMP_DIR,
            f"{file_prefix}_{abs(result_id)}"
        )

        try:

            # ==================================================
            # INITIAL STATUS
            # ==================================================

            update_memory_result(
                result_id,
                "compiling",
                None,
                output="Compiling code..."
            )

            if persist_to_database:

                update_submission_status(
                    result_id,
                    "running"
                )

            # ==================================================
            # WRITE SOURCE
            # ==================================================

            with open(
                source_path,
                "w"
            ) as file:

                file.write(code)

            # ==================================================
            # COMPILE
            # ==================================================

            compile_start = time.perf_counter()

            compile_process = subprocess.run(
                [
                    "g++",
                    source_path,
                    "-o",
                    executable_path
                ],
                capture_output=True,
                text=True,
                timeout=10
            )

            compile_time_ms = int(
                (
                    time.perf_counter()
                    - compile_start
                ) * 1000
            )

            # ==================================================
            # COMPILATION ERROR
            # ==================================================

            if compile_process.returncode != 0:

                verdict = "COMPILATION ERROR"

                output = compile_process.stderr

                if persist_to_database:

                    save_database_result(
                        result_id,
                        verdict,
                        compile_time_ms,
                        0,
                        0,
                        0
                    )

                update_memory_result(
                    result_id,
                    "completed",
                    verdict,
                    compile_time_ms,
                    0,
                    0,
                    0,
                    output
                )

                continue

            # ==================================================
            # GET TEST CASES
            # Submit  -> visible + hidden
            # Run     -> visible only
            # ==================================================

            test_cases = get_test_cases(
                problem_id,
                include_hidden=persist_to_database
            )

            total_test_cases = len(
                test_cases
            )

            passed_test_cases = 0
            total_execution_time = 0

            final_verdict = "AC"
            final_output = ""

            # ==================================================
            # NO TEST CASES
            # ==================================================

            if total_test_cases == 0:

                final_verdict = "SYSTEM ERROR"

                final_output = (
                    "No test cases found "
                    "for this problem."
                )

                if persist_to_database:

                    save_database_result(
                        result_id,
                        final_verdict,
                        compile_time_ms,
                        0,
                        0,
                        0
                    )

                update_memory_result(
                    result_id,
                    "completed",
                    final_verdict,
                    compile_time_ms,
                    0,
                    0,
                    0,
                    final_output
                )

                continue

            # ==================================================
            # RUN ALL TEST CASES
            # ==================================================

            for index, test_case in enumerate(
                test_cases,
                start=1
            ):

                test_input = test_case["input"]
                expected_output = test_case[
                    "expected_output"
                ]
                is_hidden = test_case["is_hidden"]

                # Show progress
                update_memory_result(
                    result_id,
                    "running",
                    None,
                    total_execution_time,
                    0,
                    passed_test_cases,
                    total_test_cases,
                    f"Running test case {index} "
                    f"of {total_test_cases}..."
                )

                # ==================================================
                # PREPARE INPUT
                # ==================================================

                if test_input is None:
                    test_input = ""

                else:
                    test_input = str(
                        test_input
                    )

                if (
                    test_input
                    and not test_input.endswith("\n")
                ):
                    test_input += "\n"

                # ==================================================
                # RUN SANDBOX
                # ==================================================

                start_time = time.perf_counter()

                try:

                    sandbox_process = subprocess.run(
                        [
                            SANDBOX_EXECUTOR_PATH,
                            executable_path
                        ],
                        input=test_input,
                        capture_output=True,
                        text=True,
                        timeout=15
                    )

                except subprocess.TimeoutExpired:

                    total_execution_time += 15000

                    if final_verdict == "AC":

                        final_verdict = (
                            "TIME LIMIT EXCEEDED"
                        )

                        final_output = (
                            "Program execution "
                            "exceeded the backend timeout."
                        )

                    continue

                end_time = time.perf_counter()

                execution_time_ms = int(
                    (
                        end_time
                        - start_time
                    ) * 1000
                )

                total_execution_time += (
                    execution_time_ms
                )

                # ==================================================
                # COMBINE OUTPUT
                # ==================================================

                stdout = (
                    sandbox_process.stdout
                    or ""
                )

                stderr = (
                    sandbox_process.stderr
                    or ""
                )

                sandbox_output = (
                    stdout + stderr
                )

                # ==================================================
                # SANDBOX VERDICT
                # ==================================================

                sandbox_verdict = (
                    get_sandbox_verdict(
                        sandbox_output
                    )
                )

                # ==================================================
                # SANDBOX FAILURE
                # (runtime error, TLE, resource limit...)
                # ==================================================

                if sandbox_verdict != "SUCCESS":

                    if final_verdict == "AC":

                        final_verdict = (
                            sandbox_verdict
                        )

                        # Do not leak hidden test details
                        final_output = (
                            f"{sandbox_verdict} "
                            f"on a hidden test case."
                            if is_hidden
                            else sandbox_output
                        )

                    # Move on to the next test case
                    continue

                # ==================================================
                # ACTUAL PROGRAM OUTPUT
                # ==================================================

                actual_output = (
                    extract_program_output(
                        sandbox_output
                    )
                )

                normalized_actual = (
                    normalize_output(
                        actual_output
                    )
                )

                normalized_expected = (
                    normalize_output(
                        expected_output
                    )
                )

                # ==================================================
                # COMPARE
                # ==================================================

                if (
                    normalized_actual
                    == normalized_expected
                ):

                    passed_test_cases += 1

                    if final_verdict == "AC":

                        final_output = (
                            actual_output
                        )

                elif final_verdict == "AC":

                    final_verdict = (
                        "WRONG ANSWER"
                    )

                    if is_hidden:

                       
                        final_output = (
                            "Wrong answer on a "
                            "hidden test case."
                        )

                    else:

                        final_output = (
                            f"Wrong answer on "
                            f"test case {index}.\n\n"
                            "Expected:\n"
                            + normalized_expected
                            + "\n\nActual:\n"
                            + normalized_actual
                        )

            # ==================================================
            # FINAL VERDICT
            # AC only when every test case passed
            # ==================================================

            if (
                final_verdict == "AC"
                and passed_test_cases
                != total_test_cases
            ):

                final_verdict = "WRONG ANSWER"

            # ==================================================
            # SAVE SUBMIT RESULT TO DATABASE
            # ==================================================

            if persist_to_database:

                save_database_result(
                    result_id,
                    final_verdict,
                    total_execution_time,
                    0,
                    passed_test_cases,
                    total_test_cases
                )

            # ==================================================
            # SAVE MEMORY RESULT
            # ==================================================

            update_memory_result(
                result_id,
                "completed",
                final_verdict,
                total_execution_time,
                0,
                passed_test_cases,
                total_test_cases,
                final_output
            )

        except subprocess.TimeoutExpired:

            verdict = "TIME LIMIT EXCEEDED"

            output = (
                "Backend execution timeout."
            )

            if persist_to_database:

                try:

                    save_database_result(
                        result_id,
                        verdict,
                        15000,
                        0,
                        0,
                        0
                    )

                except Exception as db_error:

                    print(
                        "DATABASE ERROR:",
                        db_error
                    )

            update_memory_result(
                result_id,
                "completed",
                verdict,
                15000,
                0,
                0,
                0,
                output
            )

        except Exception as e:

            print(
                "WORKER ERROR:",
                str(e)
            )

            if persist_to_database:

                try:

                    update_submission_status(
                        result_id,
                        "completed"
                    )

                    insert_result(
                        result_id,
                        "SYSTEM ERROR",
                        0,
                        0,
                        0,
                        0
                    )

                except Exception as db_error:

                    print(
                        "DATABASE ERROR:",
                        db_error
                    )

            update_memory_result(
                result_id,
                "completed",
                "SYSTEM ERROR",
                0,
                0,
                0,
                0,
                f"Execution error: {e}"
            )

        finally:

            # ==================================================
            # CLEAN SOURCE
            # ==================================================

            try:

                if os.path.exists(
                    source_path
                ):

                    os.remove(
                        source_path
                    )

            except Exception as e:

                print(
                    "SOURCE CLEANUP ERROR:",
                    e
                )

            # ==================================================
            # CLEAN EXECUTABLE
            # ==================================================

            try:

                if os.path.exists(
                    executable_path
                ):

                    os.remove(
                        executable_path
                    )

            except Exception as e:

                print(
                    "EXECUTABLE CLEANUP ERROR:",
                    e
                )

            job_queue.task_done()


# ============================================================
# START WORKER
# ============================================================

worker_thread = threading.Thread(
    target=worker,
    daemon=True
)

worker_thread.start()


# ============================================================
# SUBMIT CODE
# ============================================================

@app.route(
    "/submit",
    methods=["POST"]
)
def submit_code():

    user = get_logged_in_user()

    if not user:

        return jsonify({
            "error":
                "Authentication required"
        }), 401

    data = request.get_json(
        silent=True
    )

    if not data:

        return jsonify({
            "error":
                "Request body is required"
        }), 400

    code = data.get(
        "code",
        ""
    )

    if not code.strip():

        return jsonify({
            "error":
                "Code cannot be empty"
        }), 400

    problem_id = data.get(
        "problem_id"
    )

    if not problem_id:

        return jsonify({
            "error":
                "problem_id is required"
        }), 400

    language = data.get(
        "language",
        "cpp"
    )

    if language.lower() != "cpp":

        return jsonify({
            "error":
                "Currently only C++ is supported"
        }), 400

    user_id = user.get(
        "user_id"
    )

    if not user_id:

        return jsonify({
            "error":
                "Invalid user information"
        }), 401

    # ========================================================
    # CREATE DATABASE SUBMISSION
    # ========================================================

    try:

        submission_id = create_submission(
            user_id=user_id,
            problem_id=problem_id,
            code=code,
            language="cpp"
        )

    except Exception as e:

        print(
            "SUBMISSION DATABASE ERROR:",
            e
        )

        return jsonify({
            "error":
                "Could not create submission",
            "details":
                str(e)
        }), 500

    # ========================================================
    # INITIAL RESULT
    # ========================================================

    update_memory_result(
        submission_id,
        "queued",
        None,
        output="Code submitted to execution queue..."
    )

    # ========================================================
    # ADD SUBMIT JOB
    # ========================================================

    job_queue.put({
        "result_id":
            submission_id,

        "problem_id":
            problem_id,

        "code":
            code,

        "job_type":
            "submit"
    })

    return jsonify({
        "message":
            "Code submitted successfully",

        "submission_id":
            submission_id,

        "status":
            "queued"
    }), 202


# ============================================================
# RUN CODE
# Visible test cases ONLY
# ============================================================

@app.route(
    "/run",
    methods=["POST"]
)
def run_code():

    user = get_logged_in_user()

    if not user:

        return jsonify({
            "error":
                "Authentication required"
        }), 401

    data = request.get_json(
        silent=True
    )

    if not data:

        return jsonify({
            "error":
                "Request body is required"
        }), 400

    code = data.get(
        "code",
        ""
    )

    if not code.strip():

        return jsonify({
            "error":
                "Code cannot be empty"
        }), 400

    problem_id = data.get(
        "problem_id"
    )

    if not problem_id:

        return jsonify({
            "error":
                "problem_id is required"
        }), 400

    language = data.get(
        "language",
        "cpp"
    )

    if language.lower() != "cpp":

        return jsonify({
            "error":
                "Currently only C++ is supported"
        }), 400

    # ========================================================
    # GENERATE TEMPORARY RUN ID
    # ========================================================

    run_id = generate_run_id()

    update_memory_result(
        run_id,
        "queued",
        None,
        output="Code sent to execution queue..."
    )

    # ========================================================
    # ADD RUN JOB
    # ========================================================

    job_queue.put({
        "result_id":
            run_id,

        "problem_id":
            problem_id,

        "code":
            code,

        "job_type":
            "run"
    })

    return jsonify({
        "message":
            "Code sent for execution",

        "run_id":
            run_id,

        "submission_id":
            run_id,

        "status":
            "queued"
    }), 202


# ============================================================
# GET RESULT
# Works for both Submit and Run Code
# ============================================================

@app.route(
    "/result/<path:result_id>",
    methods=["GET"]
)
def get_result(result_id):

    try:
        result_id = int(result_id)

    except ValueError:

        return jsonify({
            "error": "Invalid execution ID"
        }), 400

    with results_lock:

        result = results.get(
            result_id
        )

    if result is None:

        return jsonify({
            "error":
                "Execution result not found"
        }), 404

    return jsonify({

        "submission_id":
            result_id,

        "run_id":
            result_id
            if result_id < 0
            else None,

        **result

    }), 200


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route(
    "/",
    methods=["GET"]
)
def home():

    return jsonify({

        "project":
            "CodeShield",

        "status":
            "Backend running",

        "authentication":
            "Email/Password + Google OAuth + GitHub OAuth",

        "sandbox":
            "C++ Sandbox Executor",

        "queue":
            "Worker Queue Active",

        "database":
            "PostgreSQL",

        "evaluation":
            "Visible Run + Hidden Submit Evaluation Active"

    })


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":

    app.run(
        debug=True,
        port=5000,
        use_reloader=False
    )
