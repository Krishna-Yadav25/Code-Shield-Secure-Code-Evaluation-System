import os
import sys

from flask import Blueprint, request, jsonify

sys.path.append(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "database"
    )
)

from auth import get_connection, verify_token


# ============================================================
# BLUEPRINT
# ============================================================

coding_bp = Blueprint(
    "coding",
    __name__,
    url_prefix="/api"
)


# ============================================================
# AUTHENTICATION HELPER
# ============================================================

def get_logged_in_user():

    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return None

    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ", 1)[1].strip()

    if not token:
        return None

    try:
        return verify_token(token)

    except Exception:
        return None


# ============================================================
# CREATE PROBLEM
# Teacher only
# ============================================================

@coding_bp.route(
    "/teacher/tests/<int:contest_id>/problems",
    methods=["POST"]
)
def create_problem(contest_id):

    user = get_logged_in_user()

    if not user:
        return jsonify({
            "error": "Authentication required"
        }), 401

    if user.get("role") != "teacher":
        return jsonify({
            "error": "Teacher access required"
        }), 403

    data = request.get_json(silent=True) or {}

    title = data.get("title")
    statement = data.get("statement")
    difficulty = data.get("difficulty", "Easy")
    time_limit_ms = data.get("time_limit_ms", 1000)
    memory_limit_mb = data.get("memory_limit_mb", 256)

    if not title or not statement:

        return jsonify({
            "error": "Title and statement are required"
        }), 400

    if difficulty not in [
        "Easy",
        "Medium",
        "Hard"
    ]:

        return jsonify({
            "error": "Difficulty must be Easy, Medium or Hard"
        }), 400

    conn = None
    cur = None

    try:

        conn = get_connection()

        cur = conn.cursor()

        # ----------------------------------------------------
        # Verify that teacher owns the test
        # ----------------------------------------------------

        cur.execute(
            """
            SELECT contest_id
            FROM Contests
            WHERE contest_id = %s
            AND created_by = %s
            """,
            (
                contest_id,
                user.get("user_id")
            )
        )

        contest = cur.fetchone()

        if not contest:

            return jsonify({
                "error": "Test not found or access denied"
            }), 404

        # ----------------------------------------------------
        # Create problem
        # ----------------------------------------------------

        cur.execute(
            """
            INSERT INTO Problems
            (
                contest_id,
                title,
                statement,
                difficulty,
                time_limit_ms,
                memory_limit_mb
            )
            VALUES
            (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s
            )
            RETURNING problem_id
            """,
            (
                contest_id,
                title,
                statement,
                difficulty,
                time_limit_ms,
                memory_limit_mb
            )
        )

        problem_id = cur.fetchone()[0]

        conn.commit()

        return jsonify({
            "message": "Problem created successfully",
            "problem_id": problem_id
        }), 201

    except Exception as e:

        if conn:
            conn.rollback()

        print(
            "CREATE PROBLEM ERROR:",
            str(e)
        )

        return jsonify({
            "error": str(e)
        }), 500

    finally:

        if cur:
            cur.close()

        if conn:
            conn.close()


# ============================================================
# GET PROBLEMS OF A TEST
# Student / Teacher
# ============================================================

@coding_bp.route(
    "/tests/<int:contest_id>/problems",
    methods=["GET"]
)
def get_test_problems(contest_id):

    user = get_logged_in_user()

    if not user:

        return jsonify({
            "error": "Authentication required"
        }), 401

    conn = None
    cur = None

    try:

        conn = get_connection()

        cur = conn.cursor()

        cur.execute(
            """
            SELECT
                problem_id,
                title,
                statement,
                difficulty,
                time_limit_ms,
                memory_limit_mb
            FROM Problems
            WHERE contest_id = %s
            ORDER BY problem_id
            """,
            (contest_id,)
        )

        rows = cur.fetchall()

        problems = []

        for row in rows:

            problems.append({
                "problem_id": row[0],
                "title": row[1],
                "statement": row[2],
                "difficulty": row[3],
                "time_limit_ms": row[4],
                "memory_limit_mb": row[5]
            })

        return jsonify({
            "contest_id": contest_id,
            "problems": problems
        }), 200

    except Exception as e:

        print(
            "GET PROBLEMS ERROR:",
            str(e)
        )

        return jsonify({
            "error": str(e)
        }), 500

    finally:

        if cur:
            cur.close()

        if conn:
            conn.close()


# ============================================================
# GET VISIBLE TEST CASES
# Student can only see visible cases
# ============================================================

@coding_bp.route(
    "/problems/<int:problem_id>/testcases",
    methods=["GET"]
)
def get_visible_testcases(problem_id):

    user = get_logged_in_user()

    if not user:

        return jsonify({
            "error": "Authentication required"
        }), 401

    conn = None
    cur = None

    try:

        conn = get_connection()

        cur = conn.cursor()

        cur.execute(
            """
            SELECT
                testcase_id,
                input,
                expected_output
            FROM TestCases
            WHERE problem_id = %s
            AND is_hidden = FALSE
            ORDER BY testcase_id
            """,
            (problem_id,)
        )

        rows = cur.fetchall()

        testcases = []

        for row in rows:

            testcases.append({
                "testcase_id": row[0],
                "input": row[1],
                "expected_output": row[2]
            })

        return jsonify({
            "problem_id": problem_id,
            "testcases": testcases
        }), 200

    except Exception as e:

        print(
            "GET VISIBLE TEST CASES ERROR:",
            str(e)
        )

        return jsonify({
            "error": str(e)
        }), 500

    finally:

        if cur:
            cur.close()

        if conn:
            conn.close()


# ============================================================
# TEACHER TEST CASE MANAGEMENT
# ============================================================


# ============================================================
# GET ALL TEST CASES
# Teacher only
# ============================================================

@coding_bp.route(
    "/teacher/problems/<int:problem_id>/testcases",
    methods=["GET"]
)
def get_test_cases(problem_id):

    user = get_logged_in_user()

    if not user:

        return jsonify({
            "error": "Authentication required"
        }), 401

    if user.get("role") != "teacher":

        return jsonify({
            "error": "Teacher access required"
        }), 403

    conn = None
    cursor = None

    try:

        conn = get_connection()

        cursor = conn.cursor()

        # ----------------------------------------------------
        # Verify problem belongs to this teacher
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT p.problem_id
            FROM Problems p
            JOIN Contests c
                ON p.contest_id = c.contest_id
            WHERE p.problem_id = %s
            AND c.created_by = %s
            """,
            (
                problem_id,
                user.get("user_id")
            )
        )

        problem = cursor.fetchone()

        if not problem:

            return jsonify({
                "error": "Problem not found or access denied"
            }), 404

        # ----------------------------------------------------
        # Get all test cases
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                testcase_id,
                problem_id,
                input,
                expected_output,
                is_hidden
            FROM TestCases
            WHERE problem_id = %s
            ORDER BY testcase_id ASC
            """,
            (problem_id,)
        )

        rows = cursor.fetchall()

        test_cases = []

        for row in rows:

            test_cases.append({
                "testcase_id": row[0],
                "problem_id": row[1],
                "input": row[2],
                "expected_output": row[3],
                "is_hidden": row[4]
            })

        return jsonify({
            "test_cases": test_cases
        }), 200

    except Exception as e:

        if conn:
            conn.rollback()

        print(
            "GET TEST CASES ERROR:",
            str(e)
        )

        return jsonify({
            "error": str(e)
        }), 500

    finally:

        if cursor:
            cursor.close()

        if conn:
            conn.close()


# ============================================================
# CREATE TEST CASE
# Teacher only
# ============================================================

@coding_bp.route(
    "/teacher/problems/<int:problem_id>/testcases",
    methods=["POST"]
)
def create_test_case(problem_id):

    user = get_logged_in_user()

    if not user:

        return jsonify({
            "error": "Authentication required"
        }), 401

    if user.get("role") != "teacher":

        return jsonify({
            "error": "Teacher access required"
        }), 403

    data = request.get_json(silent=True) or {}

    input_data = data.get("input", "")
    expected_output = data.get(
        "expected_output",
        ""
    )

    is_hidden = bool(
        data.get(
            "is_hidden",
            False
        )
    )

    # --------------------------------------------------------
    # Validate input
    # --------------------------------------------------------

    if not str(input_data).strip():

        return jsonify({
            "error": "Input is required"
        }), 400

    if not str(expected_output).strip():

        return jsonify({
            "error": "Expected output is required"
        }), 400

    conn = None
    cursor = None

    try:

        conn = get_connection()

        cursor = conn.cursor()

        # ----------------------------------------------------
        # Verify problem belongs to teacher
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT p.problem_id
            FROM Problems p
            JOIN Contests c
                ON p.contest_id = c.contest_id
            WHERE p.problem_id = %s
            AND c.created_by = %s
            """,
            (
                problem_id,
                user.get("user_id")
            )
        )

        problem = cursor.fetchone()

        if not problem:

            return jsonify({
                "error": "Problem not found or access denied"
            }), 404

        # ----------------------------------------------------
        # Insert test case
        # ----------------------------------------------------

        cursor.execute(
            """
            INSERT INTO TestCases
            (
                problem_id,
                input,
                expected_output,
                is_hidden
            )
            VALUES
            (
                %s,
                %s,
                %s,
                %s
            )
            RETURNING testcase_id
            """,
            (
                problem_id,
                str(input_data),
                str(expected_output),
                is_hidden
            )
        )

        testcase_id = cursor.fetchone()[0]

        conn.commit()

        return jsonify({
            "message": "Test case created successfully",
            "testcase_id": testcase_id
        }), 201

    except Exception as e:

        if conn:
            conn.rollback()

        print(
            "CREATE TEST CASE ERROR:",
            str(e)
        )

        return jsonify({
            "error": str(e)
        }), 500

    finally:

        if cursor:
            cursor.close()

        if conn:
            conn.close()


# ============================================================
# DELETE TEST CASE
# Teacher only
# ============================================================

@coding_bp.route(
    "/teacher/testcases/<int:testcase_id>",
    methods=["DELETE"]
)
def delete_test_case(testcase_id):

    user = get_logged_in_user()

    if not user:

        return jsonify({
            "error": "Authentication required"
        }), 401

    if user.get("role") != "teacher":

        return jsonify({
            "error": "Teacher access required"
        }), 403

    conn = None
    cursor = None

    try:

        conn = get_connection()

        cursor = conn.cursor()

        # ----------------------------------------------------
        # Verify testcase belongs to teacher's problem
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT tc.testcase_id
            FROM TestCases tc
            JOIN Problems p
                ON tc.problem_id = p.problem_id
            JOIN Contests c
                ON p.contest_id = c.contest_id
            WHERE tc.testcase_id = %s
            AND c.created_by = %s
            """,
            (
                testcase_id,
                user.get("user_id")
            )
        )

        testcase = cursor.fetchone()

        if not testcase:

            return jsonify({
                "error": "Test case not found or access denied"
            }), 404

        # ----------------------------------------------------
        # Delete
        # ----------------------------------------------------

        cursor.execute(
            """
            DELETE FROM TestCases
            WHERE testcase_id = %s
            RETURNING testcase_id
            """,
            (testcase_id,)
        )

        deleted = cursor.fetchone()

        if not deleted:

            conn.rollback()

            return jsonify({
                "error": "Test case not found"
            }), 404

        conn.commit()

        return jsonify({
            "message": "Test case deleted successfully"
        }), 200

    except Exception as e:

        if conn:
            conn.rollback()

        print(
            "DELETE TEST CASE ERROR:",
            str(e)
        )

        return jsonify({
            "error": str(e)
        }), 500

    finally:

        if cursor:
            cursor.close()

        if conn:
            conn.close()