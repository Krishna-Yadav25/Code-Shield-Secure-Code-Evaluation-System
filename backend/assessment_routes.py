from functools import wraps

from flask import Blueprint, request, jsonify

from database.auth import get_connection, verify_token

from proctoring_routes import is_frozen


assessment_bp = Blueprint("assessment", __name__, url_prefix="/api")


# =========================================================
# Authentication
# =========================================================

def require_role(role):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            auth_header = request.headers.get("Authorization", "")

            if not auth_header.startswith("Bearer "):
                return jsonify({"error": "Authorization token required"}), 401

            token = auth_header.split(" ", 1)[1]
            user = verify_token(token)

            if not user:
                return jsonify({"error": "Invalid or expired token"}), 401

            if user.get("role") != role:
                return jsonify({"error": f"{role} role required"}), 403

            request.user = user
            return func(*args, **kwargs)

        return wrapper
    return decorator


# =========================================================
# Database helpers
# =========================================================

def close_db(cur, conn):
    if cur:
        cur.close()
    if conn:
        conn.close()


def get_contest_problem(cur, contest_id, problem_id):
    cur.execute(
        """
        SELECT 1
        FROM Problems
        WHERE problem_id = %s AND contest_id = %s
        """,
        (problem_id, contest_id)
    )
    return cur.fetchone() is not None


def get_or_create_attempt(cur, contest_id, user_id):
    cur.execute(
        """
        INSERT INTO ContestAttempts (contest_id, user_id)
        VALUES (%s, %s)
        ON CONFLICT (contest_id, user_id) DO NOTHING
        """,
        (contest_id, user_id)
    )

    cur.execute(
        """
        SELECT attempt_id, status, started_at, submitted_at
        FROM ContestAttempts
        WHERE contest_id = %s AND user_id = %s
        """,
        (contest_id, user_id)
    )
    return cur.fetchone()


# =========================================================
# Start test
# POST /api/tests/<contest_id>/start
# =========================================================

@assessment_bp.route("/tests/<int:contest_id>/start", methods=["POST"])
@require_role("student")
def start_test(contest_id):
    conn = cur = None

    try:
        conn = get_connection()
        cur = conn.cursor()
        user_id = request.user["user_id"]

        cur.execute(
            """
            SELECT
                start_time <= NOW(),
                end_time > NOW()
            FROM Contests
            WHERE contest_id = %s
            """,
            (contest_id,)
        )
        timing = cur.fetchone()

        if not timing:
            return jsonify({"error": "Test not found"}), 404

        if not timing[0]:
            return jsonify({"error": "Test has not started yet"}), 403

        if not timing[1]:
            return jsonify({"error": "Test has ended"}), 403

        attempt = get_or_create_attempt(cur, contest_id, user_id)

        if not attempt:
            conn.rollback()
            return jsonify({"error": "Could not create test attempt"}), 500

        if attempt[1] != "in_progress":
            conn.commit()
            return jsonify({
                "attempt_id": attempt[0],
                "status": attempt[1],
                "already_submitted": True
            }), 200

        cur.execute(
            """
            INSERT INTO ContestAttemptProblems (attempt_id, problem_id)
            SELECT %s, problem_id
            FROM Problems
            WHERE contest_id = %s
            ON CONFLICT (attempt_id, problem_id) DO NOTHING
            """,
            (attempt[0], contest_id)
        )

        conn.commit()

        return jsonify({
            "attempt_id": attempt[0],
            "status": "in_progress",
            "message": "Test attempt started"
        }), 200

    except Exception as exc:
        if conn:
            conn.rollback()
        print("Start test error:", exc)
        return jsonify({"error": "Could not start test attempt"}), 500

    finally:
        close_db(cur, conn)


# =========================================================
# Record activity and time spent
# =========================================================

@assessment_bp.route("/tests/<int:contest_id>/activity", methods=["POST"])
@require_role("student")
def record_activity(contest_id):
    conn = cur = None

    try:
        data = request.get_json(silent=True) or {}
        problem_id = data.get("problem_id")

        if not problem_id:
            return jsonify({"error": "problem_id is required"}), 400

        conn = get_connection()
        cur = conn.cursor()
        user_id = request.user["user_id"]

        cur.execute(
            """
            SELECT ca.attempt_id, ca.status, c.end_time > NOW()
            FROM ContestAttempts ca
            JOIN Contests c ON c.contest_id = ca.contest_id
            WHERE ca.contest_id = %s AND ca.user_id = %s
            """,
            (contest_id, user_id)
        )
        attempt = cur.fetchone()

        if not attempt:
            return jsonify({
                "error": "Start the test before recording activity"
            }), 409

        if attempt[1] != "in_progress":
            return jsonify({"error": "Test has already been submitted"}), 409

        if not attempt[2]:
            return jsonify({"error": "Test has ended"}), 403

        if not get_contest_problem(cur, contest_id, problem_id):
            return jsonify({
                "error": "Problem does not belong to this test"
            }), 400

        cur.execute(
            """
            INSERT INTO ContestAttemptProblems (
                attempt_id,
                problem_id,
                first_opened_at,
                last_activity_at,
                attempted
            )
            VALUES (%s, %s, NOW(), NOW(), FALSE)
            ON CONFLICT (attempt_id, problem_id)
            DO UPDATE SET
                time_spent_seconds =
                    ContestAttemptProblems.time_spent_seconds +
                    LEAST(
                        120,
                        GREATEST(
                            0,
                            EXTRACT(
                                EPOCH FROM (
                                    NOW() -
                                    ContestAttemptProblems.last_activity_at
                                )
                            )::INTEGER
                        )
                    ),
                last_activity_at = NOW()
            """,
            (attempt[0], problem_id)
        )

        conn.commit()
        return jsonify({"message": "Activity recorded"}), 200

    except Exception as exc:
        if conn:
            conn.rollback()
        print("Record activity error:", exc)
        return jsonify({"error": "Could not record activity"}), 500

    finally:
        close_db(cur, conn)


# =========================================================
# Final submit entire test
# =========================================================

@assessment_bp.route("/tests/<int:contest_id>/final-submit", methods=["POST"])
@require_role("student")
def final_submit_test(contest_id):
    conn = cur = None

    try:
        conn = get_connection()
        cur = conn.cursor()
        user_id = request.user["user_id"]

        cur.execute(
            "SELECT end_time FROM Contests WHERE contest_id = %s",
            (contest_id,)
        )
        contest = cur.fetchone()

        if not contest:
            return jsonify({"error": "Test not found"}), 404

        attempt = get_or_create_attempt(cur, contest_id, user_id)

        if not attempt:
            conn.rollback()
            return jsonify({"error": "Could not create test attempt"}), 500

        if attempt[1] != "in_progress":
            conn.commit()
            return jsonify({
                "message": "Test was already submitted",
                "status": attempt[1]
            }), 200

        cur.execute(
            """
            SELECT end_time <= NOW()
            FROM Contests
            WHERE contest_id = %s
            """,
            (contest_id,)
        )
        is_over = cur.fetchone()[0]

        if not is_over and is_frozen(cur, contest_id, user_id):
            return jsonify({
                "error": "Your test is frozen. Ask your teacher to unlock it."
            }), 423

        new_status = "auto_submitted" if is_over else "submitted"

        cur.execute(
            """
            UPDATE ContestAttempts
            SET status = %s, submitted_at = NOW()
            WHERE attempt_id = %s AND status = 'in_progress'
            """,
            (new_status, attempt[0])
        )

        conn.commit()

        return jsonify({
            "message": "Test submitted successfully",
            "status": new_status
        }), 200

    except Exception as exc:
        if conn:
            conn.rollback()
        print("Final submission error:", exc)
        return jsonify({"error": "Could not submit test"}), 500

    finally:
        close_db(cur, conn)


# =========================================================
# Teacher: attempt / time-spent report
# =========================================================

@assessment_bp.route(
    "/teacher/tests/<int:contest_id>/attempts",
    methods=["GET"]
)
@require_role("teacher")
def teacher_attempts_report(contest_id):
    conn = cur = None

    try:
        conn = get_connection()
        cur = conn.cursor()
        teacher_id = request.user["user_id"]

        cur.execute(
            """
            SELECT contest_id, title, start_time, end_time
            FROM Contests
            WHERE contest_id = %s AND created_by = %s
            """,
            (contest_id, teacher_id)
        )
        contest = cur.fetchone()

        if not contest:
            return jsonify({
                "error": "Test not found or access denied"
            }), 404

        cur.execute(
            """
            SELECT
                u.user_id,
                u.username,
                ca.attempt_id,
                ca.status,
                ca.started_at,
                ca.submitted_at,
                COUNT(DISTINCT cap.problem_id)
                    FILTER (WHERE cap.attempted),
                (
                    SELECT COUNT(*)
                    FROM Problems p
                    WHERE p.contest_id = ca.contest_id
                ),
                COALESCE(SUM(cap.time_spent_seconds), 0)
            FROM ContestAttempts ca
            JOIN Users u ON u.user_id = ca.user_id
            LEFT JOIN ContestAttemptProblems cap
                ON cap.attempt_id = ca.attempt_id
            WHERE ca.contest_id = %s
            GROUP BY
                u.user_id, u.username, ca.attempt_id,
                ca.status, ca.started_at, ca.submitted_at,
                ca.contest_id
            ORDER BY ca.started_at DESC
            """,
            (contest_id,)
        )

        students = []
        for row in cur.fetchall():
            students.append({
                "user_id": row[0],
                "username": row[1],
                "attempt_id": row[2],
                "status": row[3],
                "started_at": row[4].isoformat() if row[4] else None,
                "submitted_at": row[5].isoformat() if row[5] else None,
                "attempted_questions": row[6],
                "total_questions": row[7],
                "total_time_seconds": row[8]
            })

        cur.execute(
            """
            SELECT
                u.username,
                p.problem_id,
                p.title,
                cap.attempted,
                cap.time_spent_seconds,
                cap.final_submission_id,
                s.status,
                r.verdict,
                r.execution_time_ms,
                r.test_cases_passed,
                r.test_cases_total
            FROM ContestAttempts ca
            JOIN Users u ON u.user_id = ca.user_id
            JOIN ContestAttemptProblems cap
                ON cap.attempt_id = ca.attempt_id
            JOIN Problems p ON p.problem_id = cap.problem_id
            LEFT JOIN Submissions s
                ON s.submission_id = cap.final_submission_id
            LEFT JOIN LATERAL (
                SELECT
                    verdict,
                    execution_time_ms,
                    test_cases_passed,
                    test_cases_total
                FROM Results
                WHERE submission_id = s.submission_id
                ORDER BY created_at DESC, result_id DESC
                LIMIT 1
            ) r ON TRUE
            WHERE ca.contest_id = %s
            ORDER BY u.username, p.problem_id
            """,
            (contest_id,)
        )

        questions = []
        for row in cur.fetchall():
            questions.append({
                "username": row[0],
                "problem_id": row[1],
                "problem_title": row[2],
                "attempted": row[3],
                "time_spent_seconds": row[4],
                "submission_id": row[5],
                "submission_status": row[6],
                "verdict": row[7],
                "execution_time_ms": row[8],
                "test_cases_passed": row[9],
                "test_cases_total": row[10]
            })

        cur.execute(
            "SELECT COUNT(*) FROM ContestAttempts WHERE contest_id = %s",
            (contest_id,)
        )
        total_students = cur.fetchone()[0]

        cur.execute(
            """
            SELECT COUNT(*)
            FROM ContestAttempts
            WHERE contest_id = %s
              AND status IN ('submitted', 'auto_submitted')
            """,
            (contest_id,)
        )
        submitted_students = cur.fetchone()[0]

        conn.commit()

        return jsonify({
            "test": {
                "contest_id": contest[0],
                "title": contest[1],
                "start_time": contest[2].isoformat() if contest[2] else None,
                "end_time": contest[3].isoformat() if contest[3] else None
            },
            "summary": {
                "students_started": total_students,
                "students_submitted": submitted_students,
                "students_in_progress": total_students - submitted_students
            },
            "students": students,
            "question_details": questions
        }), 200

    except Exception as exc:
        if conn:
            conn.rollback()
        print("Teacher attempts report error:", exc)
        return jsonify({"error": "Could not load attempts report"}), 500

    finally:
        close_db(cur, conn)


# =========================================================
# Link a submission to a question
# =========================================================

@assessment_bp.route(
    "/tests/<int:contest_id>/record-submission",
    methods=["POST"]
)
@require_role("student")
def record_question_submission(contest_id):
    conn = cur = None

    try:
        data = request.get_json(silent=True) or {}
        problem_id = data.get("problem_id")
        submission_id = data.get("submission_id")

        if not problem_id or not submission_id:
            return jsonify({
                "error": "problem_id and submission_id are required"
            }), 400

        conn = get_connection()
        cur = conn.cursor()
        user_id = request.user["user_id"]

        cur.execute(
            """
            SELECT ca.attempt_id, ca.status, c.end_time > NOW()
            FROM ContestAttempts ca
            JOIN Contests c ON c.contest_id = ca.contest_id
            WHERE ca.contest_id = %s AND ca.user_id = %s
            """,
            (contest_id, user_id)
        )
        attempt = cur.fetchone()

        if not attempt:
            return jsonify({
                "error": "Start the test before submitting a question"
            }), 409

        if attempt[1] != "in_progress":
            return jsonify({"error": "Test has already been submitted"}), 409

        if not attempt[2]:
            return jsonify({"error": "Test has ended"}), 403

        cur.execute(
            """
            SELECT s.submission_id
            FROM Submissions s
            JOIN Problems p ON p.problem_id = s.problem_id
            WHERE s.submission_id = %s
              AND s.user_id = %s
              AND s.problem_id = %s
              AND p.contest_id = %s
            """,
            (submission_id, user_id, problem_id, contest_id)
        )

        if not cur.fetchone():
            return jsonify({
                "error": "Submission does not belong to this student and test"
            }), 403

        cur.execute(
            """
            UPDATE ContestAttemptProblems
            SET attempted = TRUE,
                final_submission_id = %s,
                last_activity_at = NOW()
            WHERE attempt_id = %s AND problem_id = %s
            """,
            (submission_id, attempt[0], problem_id)
        )

        if cur.rowcount == 0:
            return jsonify({
                "error": "Question tracking record not found; start the test again"
            }), 409

        conn.commit()

        return jsonify({
            "message": "Question submission linked to test",
            "problem_id": problem_id,
            "submission_id": submission_id
        }), 200

    except Exception as exc:
        if conn:
            conn.rollback()
        print("Record question submission error:", exc)
        return jsonify({
            "error": "Could not record question submission"
        }), 500

    finally:
        close_db(cur, conn)