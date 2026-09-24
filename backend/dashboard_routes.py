from flask import Blueprint, request, jsonify
from functools import wraps
import os
import sys
import bcrypt

# =========================================================
# DATABASE PATH
# =========================================================

sys.path.append(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "database"
    )
)

from auth import verify_token, get_connection


# =========================================================
# BLUEPRINT
# =========================================================

dashboard_bp = Blueprint(
    "dashboard",
    __name__,
    url_prefix="/api"
)


# =========================================================
# AUTHENTICATION / ROLE CHECK
# =========================================================

def require_role(required_role):

    def decorator(function):

        @wraps(function)
        def wrapper(*args, **kwargs):

            auth_header = request.headers.get(
                "Authorization",
                ""
            )

            # -------------------------------------------------
            # Authorization header check
            # -------------------------------------------------

            if not auth_header.startswith("Bearer "):

                return jsonify({
                    "error": "Authorization token required"
                }), 401

            token = auth_header.split(
                " ",
                1
            )[1]

            # -------------------------------------------------
            # Verify JWT
            # -------------------------------------------------

            payload = verify_token(token)

            if payload is None:

                return jsonify({
                    "error": "Invalid or expired token"
                }), 401

            # -------------------------------------------------
            # Role check
            # -------------------------------------------------

            if payload.get("role") != required_role:

                return jsonify({
                    "error": f"{required_role} role required"
                }), 403

            request.user = payload

            return function(*args, **kwargs)

        return wrapper

    return decorator


# =========================================================
# STUDENT DASHBOARD
# =========================================================

@dashboard_bp.route(
    "/student/dashboard",
    methods=["GET"]
)
@require_role("student")
def student_dashboard():

    user_id = request.user["user_id"]

    conn = get_connection()
    cur = conn.cursor()

    try:

        # -------------------------------------------------
        # Available ACTIVE tests
        # -------------------------------------------------

        cur.execute(
            """
            SELECT
                contest_id,
                title,
                description,
                start_time,
                end_time
            FROM Contests
            WHERE start_time <= NOW()
              AND end_time >= NOW()
            ORDER BY start_time ASC
            """
        )

        tests = cur.fetchall()

        available_tests = []

        for test in tests:

            available_tests.append({

                "contest_id": test[0],

                "title": test[1],

                "description": test[2],

                "start_time":
                    test[3].isoformat()
                    if test[3]
                    else None,

                "end_time":
                    test[4].isoformat()
                    if test[4]
                    else None

            })

        # -------------------------------------------------
        # Student submissions
        # -------------------------------------------------

        cur.execute(
            """
            SELECT
                s.submission_id,
                p.title,
                s.language,
                s.status,
                s.submitted_at,
                r.verdict
            FROM Submissions s
            JOIN Problems p
                ON s.problem_id = p.problem_id
            LEFT JOIN Results r
                ON s.submission_id = r.submission_id
            WHERE s.user_id = %s
            ORDER BY s.submitted_at DESC
            LIMIT 10
            """,
            (user_id,)
        )

        submissions = cur.fetchall()

        recent_submissions = []

        for submission in submissions:

            recent_submissions.append({

                "submission_id":
                    submission[0],

                "problem":
                    submission[1],

                "language":
                    submission[2],

                "status":
                    submission[3],

                "submitted_at":
                    submission[4].isoformat()
                    if submission[4]
                    else None,

                "verdict":
                    submission[5]

            })

        return jsonify({

            "user": {

                "user_id":
                    request.user["user_id"],

                "username":
                    request.user["username"],

                "role":
                    request.user["role"]

            },

            "available_tests":
                available_tests,

            "recent_submissions":
                recent_submissions

        }), 200

    except Exception as e:

        conn.rollback()

        print(
            "STUDENT DASHBOARD ERROR:",
            e
        )

        return jsonify({
            "error": str(e)
        }), 500

    finally:

        cur.close()
        conn.close()


# =========================================================
# STUDENT UNLOCK TEST
# =========================================================

@dashboard_bp.route(
    "/student/tests/<int:contest_id>/unlock",
    methods=["POST"]
)
@require_role("student")
def unlock_test(contest_id):

    data = request.get_json()

    if not data:

        return jsonify({
            "error": "Request body is required"
        }), 400

    password = data.get(
        "password",
        ""
    )

    if not password:

        return jsonify({
            "error": "Test password is required"
        }), 400

    conn = get_connection()
    cur = conn.cursor()

    try:

        # -------------------------------------------------
        # Get test
        # -------------------------------------------------

        cur.execute(
            """
            SELECT
                contest_id,
                title,
                description,
                start_time,
                end_time,
                access_password_hash
            FROM Contests
            WHERE contest_id = %s
            """,
            (contest_id,)
        )

        contest = cur.fetchone()

        if not contest:

            return jsonify({
                "error": "Test not found"
            }), 404

        contest_id_db = contest[0]
        title = contest[1]
        description = contest[2]
        start_time = contest[3]
        end_time = contest[4]
        password_hash = contest[5]

        # =================================================
        # IMPORTANT TIMEZONE FIX
        # =================================================
        #
        # Do NOT do:
        #
        # current_time < start_time
        #
        # because PostgreSQL can return different timezone
        # types.
        #
        # Instead PostgreSQL itself compares the timestamps.
        # =================================================

        cur.execute(
            """
            SELECT
                CASE
                    WHEN start_time > NOW()
                        THEN 'NOT_STARTED'

                    WHEN end_time < NOW()
                        THEN 'ENDED'

                    ELSE 'ACTIVE'
                END
            FROM Contests
            WHERE contest_id = %s
            """,
            (contest_id,)
        )

        time_status = cur.fetchone()[0]

        # -------------------------------------------------
        # Test not started
        # -------------------------------------------------

        if time_status == "NOT_STARTED":

            return jsonify({
                "error":
                    "This test has not started yet"
            }), 403

        # -------------------------------------------------
        # Test ended
        # -------------------------------------------------

        if time_status == "ENDED":

            return jsonify({
                "error":
                    "This test has ended"
            }), 403

        # -------------------------------------------------
        # Check password configured
        # -------------------------------------------------

        if not password_hash:

            return jsonify({
                "error":
                    "This test does not have a password configured"
            }), 403

        # -------------------------------------------------
        # Verify bcrypt password
        # -------------------------------------------------

        try:

            password_correct = bcrypt.checkpw(
                password.encode("utf-8"),
                password_hash.encode("utf-8")
            )

        except Exception as e:

            print(
                "BCRYPT ERROR:",
                e
            )

            password_correct = False

        # -------------------------------------------------
        # Wrong password
        # -------------------------------------------------

        if not password_correct:

            return jsonify({
                "error":
                    "Incorrect test password"
            }), 401

        # -------------------------------------------------
        # Password correct
        # -------------------------------------------------

        return jsonify({

            "message":
                "Test unlocked successfully",

            "contest_id":
                contest_id_db,

            "title":
                title,

            "description":
                description,

            "start_time":
                start_time.isoformat()
                if start_time
                else None,

            "end_time":
                end_time.isoformat()
                if end_time
                else None,

            "unlocked":
                True

        }), 200

    except Exception as e:

        conn.rollback()

        print(
            "UNLOCK TEST ERROR:",
            e
        )

        return jsonify({
            "error": str(e)
        }), 500

    finally:

        cur.close()
        conn.close()


# =========================================================
# TEACHER DASHBOARD
# =========================================================

@dashboard_bp.route(
    "/teacher/dashboard",
    methods=["GET"]
)
@require_role("teacher")
def teacher_dashboard():

    user_id = request.user["user_id"]

    conn = get_connection()
    cur = conn.cursor()

    try:

        # -------------------------------------------------
        # Teacher's tests
        # -------------------------------------------------

        cur.execute(
            """
            SELECT
                c.contest_id,
                c.title,
                c.description,
                c.start_time,
                c.end_time,
                COUNT(p.problem_id)
            FROM Contests c
            LEFT JOIN Problems p
                ON c.contest_id = p.contest_id
            WHERE c.created_by = %s
            GROUP BY
                c.contest_id,
                c.title,
                c.description,
                c.start_time,
                c.end_time
            ORDER BY c.created_at DESC
            """,
            (user_id,)
        )

        tests = cur.fetchall()

        teacher_tests = []

        for test in tests:

            teacher_tests.append({

                "contest_id":
                    test[0],

                "title":
                    test[1],

                "description":
                    test[2],

                "start_time":
                    test[3].isoformat()
                    if test[3]
                    else None,

                "end_time":
                    test[4].isoformat()
                    if test[4]
                    else None,

                "problem_count":
                    test[5]

            })

        # -------------------------------------------------
        # Total submissions
        # -------------------------------------------------

        cur.execute(
            """
            SELECT COUNT(*)
            FROM Submissions s
            JOIN Problems p
                ON s.problem_id = p.problem_id
            JOIN Contests c
                ON p.contest_id = c.contest_id
            WHERE c.created_by = %s
            """,
            (user_id,)
        )

        total_submissions = cur.fetchone()[0]

        return jsonify({

            "user": {

                "user_id":
                    request.user["user_id"],

                "username":
                    request.user["username"],

                "role":
                    request.user["role"]

            },

            "tests":
                teacher_tests,

            "total_submissions":
                total_submissions

        }), 200

    except Exception as e:

        conn.rollback()

        print(
            "TEACHER DASHBOARD ERROR:",
            e
        )

        return jsonify({
            "error": str(e)
        }), 500

    finally:

        cur.close()
        conn.close()


# =========================================================
# TEACHER TEST DETAILS
# =========================================================

@dashboard_bp.route(
    "/teacher/tests/<int:contest_id>",
    methods=["GET"]
)
@require_role("teacher")
def teacher_test_details(contest_id):

    conn = get_connection()
    cur = conn.cursor()

    try:

        # -------------------------------------------------
        # Get test owned by teacher
        # -------------------------------------------------

        cur.execute(
            """
            SELECT
                contest_id,
                title,
                description,
                start_time,
                end_time,
                access_password_hash,
                created_at
            FROM Contests
            WHERE contest_id = %s
              AND created_by = %s
            """,
            (
                contest_id,
                request.user["user_id"]
            )
        )

        test = cur.fetchone()

        if not test:

            return jsonify({
                "error":
                    "Test not found or you do not have permission"
            }), 404

        # -------------------------------------------------
        # Count problems
        # -------------------------------------------------

        cur.execute(
            """
            SELECT COUNT(*)
            FROM Problems
            WHERE contest_id = %s
            """,
            (contest_id,)
        )

        problem_count = cur.fetchone()[0]

        # -------------------------------------------------
        # Count submissions
        # -------------------------------------------------

        cur.execute(
            """
            SELECT COUNT(*)
            FROM Submissions s
            JOIN Problems p
                ON s.problem_id = p.problem_id
            WHERE p.contest_id = %s
            """,
            (contest_id,)
        )

        submission_count = cur.fetchone()[0]

        # -------------------------------------------------
        # Response
        # -------------------------------------------------

        return jsonify({

            "contest_id":
                test[0],

            "title":
                test[1],

            "description":
                test[2],

            "start_time":
                test[3].isoformat()
                if test[3]
                else None,

            "end_time":
                test[4].isoformat()
                if test[4]
                else None,

            "password_protected":
                test[5] is not None,

            "problem_count":
                problem_count,

            "submission_count":
                submission_count,

            "created_at":
                test[6].isoformat()
                if test[6]
                else None

        }), 200

    except Exception as e:

        conn.rollback()

        print(
            "TEACHER TEST DETAILS ERROR:",
            e
        )

        return jsonify({
            "error": str(e)
        }), 500

    finally:

        cur.close()
        conn.close()


# =========================================================
# TEACHER CREATE TEST
# =========================================================

@dashboard_bp.route(
    "/teacher/tests",
    methods=["POST"]
)
@require_role("teacher")
def create_test():

    data = request.get_json()

    if not data:

        return jsonify({
            "error": "Request body is required"
        }), 400

    title = data.get("title")
    description = data.get("description")
    start_time = data.get("start_time")
    end_time = data.get("end_time")
    access_password = data.get("access_password")

    # -------------------------------------------------
    # Validation
    # -------------------------------------------------

    if not all([
        title,
        start_time,
        end_time
    ]):

        return jsonify({
            "error":
                "title, start_time and end_time are required"
        }), 400

    # -------------------------------------------------
    # Validate password
    # -------------------------------------------------

    password_hash = None

    if access_password is not None:

        access_password = str(
            access_password
        )

        if access_password.strip() != "":

            if len(access_password) < 4:

                return jsonify({
                    "error":
                        "Test password must contain at least 4 characters"
                }), 400

            password_hash = bcrypt.hashpw(
                access_password.encode("utf-8"),
                bcrypt.gensalt()
            ).decode("utf-8")

    conn = get_connection()
    cur = conn.cursor()

    try:

        # -------------------------------------------------
        # Create test
        # -------------------------------------------------

        cur.execute(
            """
            INSERT INTO Contests
            (
                title,
                description,
                created_by,
                start_time,
                end_time,
                access_password_hash
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
            RETURNING contest_id
            """,
            (
                title,
                description,
                request.user["user_id"],
                start_time,
                end_time,
                password_hash
            )
        )

        contest_id = cur.fetchone()[0]

        conn.commit()

        return jsonify({

            "message":
                "Test created successfully",

            "contest_id":
                contest_id,

            "password_protected":
                password_hash is not None

        }), 201

    except Exception as e:

        conn.rollback()

        print(
            "CREATE TEST ERROR:",
            e
        )

        return jsonify({
            "error": str(e)
        }), 500

    finally:

        cur.close()
        conn.close()


# =========================================================
# TEACHER SET / CHANGE / REMOVE TEST PASSWORD
# =========================================================

@dashboard_bp.route(
    "/teacher/tests/<int:contest_id>/password",
    methods=["PUT"]
)
@require_role("teacher")
def set_test_password(contest_id):

    data = request.get_json()

    if not data:

        return jsonify({
            "error": "Request body is required"
        }), 400

    password = data.get("password")

    if password is None:

        return jsonify({
            "error": "Password field is required"
        }), 400

    password = str(password)

    conn = get_connection()
    cur = conn.cursor()

    try:

        # -------------------------------------------------
        # Verify test belongs to teacher
        # -------------------------------------------------

        cur.execute(
            """
            SELECT
                contest_id,
                title
            FROM Contests
            WHERE contest_id = %s
              AND created_by = %s
            """,
            (
                contest_id,
                request.user["user_id"]
            )
        )

        contest = cur.fetchone()

        if not contest:

            return jsonify({
                "error":
                    "Test not found or you do not have permission"
            }), 404

        # -------------------------------------------------
        # REMOVE PASSWORD
        # -------------------------------------------------

        if password.strip() == "":

            cur.execute(
                """
                UPDATE Contests
                SET access_password_hash = NULL
                WHERE contest_id = %s
                """,
                (contest_id,)
            )

            conn.commit()

            return jsonify({

                "message":
                    "Test password removed successfully",

                "password_protected":
                    False

            }), 200

        # -------------------------------------------------
        # PASSWORD LENGTH
        # -------------------------------------------------

        if len(password) < 4:

            return jsonify({
                "error":
                    "Password must contain at least 4 characters"
            }), 400

        # -------------------------------------------------
        # HASH PASSWORD
        # -------------------------------------------------

        password_hash = bcrypt.hashpw(
            password.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")

        # -------------------------------------------------
        # UPDATE DATABASE
        # -------------------------------------------------

        cur.execute(
            """
            UPDATE Contests
            SET access_password_hash = %s
            WHERE contest_id = %s
            """,
            (
                password_hash,
                contest_id
            )
        )

        conn.commit()

        return jsonify({

            "message":
                "Test password saved successfully",

            "password_protected":
                True

        }), 200

    except Exception as e:

        conn.rollback()

        print(
            "SET TEST PASSWORD ERROR:",
            e
        )

        return jsonify({
            "error": str(e)
        }), 500

    finally:

        cur.close()
        conn.close()