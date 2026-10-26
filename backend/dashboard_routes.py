from flask import Blueprint, request, jsonify
from functools import wraps
import os
import sys
import bcrypt


sys.path.append(os.path.join(os.path.dirname(__file__), "..", "database"))
from auth import verify_token, get_connection

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api")

DEFAULT_MAX_MARKS = 10.0


# =========================================================
# AUTH / ROLE CHECK
# =========================================================

def require_role(required_role):
    def decorator(function):
        @wraps(function)
        def wrapper(*args, **kwargs):
            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                return jsonify({"error": "Authorization token required"}), 401

            payload = verify_token(auth_header.split(" ", 1)[1])
            if not payload:
                return jsonify({"error": "Invalid or expired token"}), 401
            if payload.get("role") != required_role:
                return jsonify({"error": f"{required_role} role required"}), 403

            request.user = payload
            return function(*args, **kwargs)
        return wrapper
    return decorator




def to_iso(value):
    return value.isoformat() if value else None


def close_db(cur, conn):
    if cur:
        cur.close()
    if conn:
        conn.close()


# =========================================================
# STUDENT DASHBOARD
# =========================================================

@dashboard_bp.route("/student/dashboard", methods=["GET"])
@require_role("student")
def student_dashboard():
    conn = cur = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        user_id = request.user["user_id"]

        cur.execute("""
            SELECT contest_id, title, description, start_time, end_time
            FROM Contests
            WHERE start_time <= NOW() AND end_time >= NOW()
            ORDER BY start_time ASC
        """)
        available_tests = [
            {
                "contest_id": r[0],
                "title": r[1],
                "description": r[2],
                "start_time": to_iso(r[3]),
                "end_time": to_iso(r[4])
            }
            for r in cur.fetchall()
        ]

        cur.execute("""
            SELECT s.submission_id, p.title, s.language, s.status,
                   s.submitted_at, r.verdict
            FROM Submissions s
            JOIN Problems p ON p.problem_id = s.problem_id
            LEFT JOIN LATERAL (
                SELECT verdict FROM Results
                WHERE submission_id = s.submission_id
                ORDER BY created_at DESC, result_id DESC
                LIMIT 1
            ) r ON TRUE
            WHERE s.user_id = %s
            ORDER BY s.submitted_at DESC NULLS LAST
            LIMIT 10
        """, (user_id,))
        recent_submissions = [
            {
                "submission_id": r[0],
                "problem": r[1],
                "language": r[2],
                "status": r[3],
                "submitted_at": to_iso(r[4]),
                "verdict": r[5]
            }
            for r in cur.fetchall()
        ]

        return jsonify({
            "user": {
                "user_id": user_id,
                "username": request.user.get("username"),
                "role": request.user["role"]
            },
            "available_tests": available_tests,
            "recent_submissions": recent_submissions
        }), 200

    except Exception as exc:
        if conn:
            conn.rollback()
        print("STUDENT DASHBOARD ERROR:", exc)
        return jsonify({"error": str(exc)}), 500
    finally:
        close_db(cur, conn)


# =========================================================
# STUDENT PUBLISHED RESULTS
# =========================================================

@dashboard_bp.route("/student/results", methods=["GET"])
@require_role("student")
def student_results():
    conn = cur = None
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                r.result_id,
                s.submission_id,
                c.title,
                p.title,
                r.awarded_marks,
                COALESCE(p.max_marks, %s),
                r.test_cases_passed,
                r.test_cases_total,
                r.teacher_feedback,
                r.published_at,
                r.verdict
            FROM Submissions s
            JOIN Problems p ON p.problem_id = s.problem_id
            JOIN Contests c ON c.contest_id = p.contest_id
            JOIN LATERAL (
                SELECT * FROM Results
                WHERE submission_id = s.submission_id
                ORDER BY created_at DESC, result_id DESC
                LIMIT 1
            ) r ON TRUE
            WHERE s.user_id = %s
              AND r.teacher_review_status = 'published'
            ORDER BY r.published_at DESC NULLS LAST
        """, (DEFAULT_MAX_MARKS, request.user["user_id"]))

        results = [
            {
                "result_id": r[0],
                "submission_id": r[1],
                "contest_title": r[2],
                "problem_title": r[3],
                "awarded_marks": float(r[4] or 0),
                "max_marks": float(r[5]),
                "test_cases_passed": r[6] or 0,
                "test_cases_total": r[7] or 0,
                "teacher_feedback": r[8] or "",
                "published_at": to_iso(r[9]),
                "verdict": r[10]
            }
            for r in cur.fetchall()
        ]

        return jsonify({"results": results}), 200

    except Exception as exc:
        if conn:
            conn.rollback()
        print("STUDENT RESULTS ERROR:", exc)
        return jsonify({"error": str(exc)}), 500
    finally:
        close_db(cur, conn)


# =========================================================
# STUDENT UNLOCK TEST
# =========================================================

@dashboard_bp.route("/student/tests/<int:contest_id>/unlock", methods=["POST"])
@require_role("student")
def unlock_test(contest_id):
    conn = cur = None
    data = request.get_json(silent=True) or {}
    password = str(data.get("password", ""))

    if not password:
        return jsonify({"error": "Test password is required"}), 400

    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT contest_id, title, description, start_time, end_time,
                   access_password_hash,
                   CASE WHEN start_time > NOW() THEN 'NOT_STARTED'
                        WHEN end_time < NOW() THEN 'ENDED'
                        ELSE 'ACTIVE' END
            FROM Contests
            WHERE contest_id = %s
        """, (contest_id,))
        row = cur.fetchone()

        if not row:
            return jsonify({"error": "Test not found"}), 404
        if row[6] == "NOT_STARTED":
            return jsonify({"error": "This test has not started yet"}), 403
        if row[6] == "ENDED":
            return jsonify({"error": "This test has ended"}), 403
        if not row[5]:
            return jsonify({
                "error": "This test does not have a password configured"
            }), 403

        try:
            correct = bcrypt.checkpw(
                password.encode("utf-8"),
                row[5].encode("utf-8")
            )
        except Exception as bcrypt_error:
            print("BCRYPT ERROR:", bcrypt_error)
            correct = False

        if not correct:
            return jsonify({"error": "Incorrect test password"}), 401

        return jsonify({
            "message": "Test unlocked successfully",
            "contest_id": row[0],
            "title": row[1],
            "description": row[2],
            "start_time": to_iso(row[3]),
            "end_time": to_iso(row[4]),
            "unlocked": True
        }), 200

    except Exception as exc:
        if conn:
            conn.rollback()
        print("UNLOCK TEST ERROR:", exc)
        return jsonify({"error": str(exc)}), 500
    finally:
        close_db(cur, conn)


# =========================================================
# TEACHER DASHBOARD
# =========================================================

@dashboard_bp.route("/teacher/dashboard", methods=["GET"])
@require_role("teacher")
def teacher_dashboard():
    conn = cur = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        teacher_id = request.user["user_id"]

        cur.execute("""
            SELECT c.contest_id, c.title, c.description,
                   c.start_time, c.end_time,
                   COUNT(p.problem_id) AS problem_count
            FROM Contests c
            LEFT JOIN Problems p ON p.contest_id = c.contest_id
            WHERE c.created_by = %s
            GROUP BY c.contest_id, c.title, c.description,
                     c.start_time, c.end_time, c.created_at
            ORDER BY c.created_at DESC
        """, (teacher_id,))
        tests = [
            {
                "contest_id": r[0],
                "title": r[1],
                "description": r[2],
                "start_time": to_iso(r[3]),
                "end_time": to_iso(r[4]),
                "problem_count": r[5]
            }
            for r in cur.fetchall()
        ]

        cur.execute("""
            SELECT COUNT(*)
            FROM Submissions s
            JOIN Problems p ON p.problem_id = s.problem_id
            JOIN Contests c ON c.contest_id = p.contest_id
            WHERE c.created_by = %s
        """, (teacher_id,))
        total_submissions = cur.fetchone()[0] or 0

        return jsonify({
            "user": {
                "user_id": teacher_id,
                "username": request.user.get("username"),
                "role": request.user["role"]
            },
            "tests": tests,
            "total_submissions": total_submissions
        }), 200

    except Exception as exc:
        if conn:
            conn.rollback()
        print("TEACHER DASHBOARD ERROR:", exc)
        return jsonify({"error": str(exc)}), 500
    finally:
        close_db(cur, conn)


# =========================================================
# TEACHER TEST DETAILS
# =========================================================

@dashboard_bp.route("/teacher/tests/<int:contest_id>", methods=["GET"])
@require_role("teacher")
def teacher_test_details(contest_id):
    conn = cur = None
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT contest_id, title, description, start_time, end_time,
                   access_password_hash, created_at
            FROM Contests
            WHERE contest_id = %s AND created_by = %s
        """, (contest_id, request.user["user_id"]))
        test = cur.fetchone()

        if not test:
            return jsonify({
                "error": "Test not found or you do not have permission"
            }), 404

        cur.execute(
            "SELECT COUNT(*) FROM Problems WHERE contest_id = %s",
            (contest_id,)
        )
        problem_count = cur.fetchone()[0] or 0

        cur.execute("""
            SELECT COUNT(*)
            FROM Submissions s
            JOIN Problems p ON p.problem_id = s.problem_id
            WHERE p.contest_id = %s
        """, (contest_id,))
        submission_count = cur.fetchone()[0] or 0

        return jsonify({
            "contest_id": test[0],
            "title": test[1],
            "description": test[2],
            "start_time": to_iso(test[3]),
            "end_time": to_iso(test[4]),
            "password_protected": test[5] is not None,
            "problem_count": problem_count,
            "submission_count": submission_count,
            "created_at": to_iso(test[6])
        }), 200

    except Exception as exc:
        if conn:
            conn.rollback()
        print("TEACHER TEST DETAILS ERROR:", exc)
        return jsonify({"error": str(exc)}), 500
    finally:
        close_db(cur, conn)


# =========================================================
# TEACHER CREATE TEST
# =========================================================

@dashboard_bp.route("/teacher/tests", methods=["POST"])
@require_role("teacher")
def create_test():
    conn = cur = None
    data = request.get_json(silent=True) or {}

    title = data.get("title")
    description = data.get("description", "")
    start_time = data.get("start_time")
    end_time = data.get("end_time")
    access_password = data.get("access_password")

    if not all([title, start_time, end_time]):
        return jsonify({
            "error": "title, start_time and end_time are required"
        }), 400

    password_hash = None
    if access_password is not None and str(access_password).strip():
        access_password = str(access_password)
        if len(access_password) < 4:
            return jsonify({
                "error": "Test password must contain at least 4 characters"
            }), 400
        password_hash = bcrypt.hashpw(
            access_password.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")

    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO Contests
                (title, description, created_by, start_time, end_time,
                 access_password_hash)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING contest_id
        """, (
            title, description, request.user["user_id"],
            start_time, end_time, password_hash
        ))
        contest_id = cur.fetchone()[0]
        conn.commit()

        return jsonify({
            "message": "Test created successfully",
            "contest_id": contest_id,
            "password_protected": password_hash is not None
        }), 201

    except Exception as exc:
        if conn:
            conn.rollback()
        print("CREATE TEST ERROR:", exc)
        return jsonify({"error": str(exc)}), 500
    finally:
        close_db(cur, conn)


# =========================================================
# TEACHER SET / CHANGE / REMOVE TEST PASSWORD
# =========================================================

@dashboard_bp.route("/teacher/tests/<int:contest_id>/password", methods=["PUT"])
@require_role("teacher")
def set_test_password(contest_id):
    conn = cur = None
    data = request.get_json(silent=True)

    if data is None or "password" not in data:
        return jsonify({"error": "Password field is required"}), 400

    password = str(data["password"])

    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT contest_id FROM Contests
            WHERE contest_id = %s AND created_by = %s
        """, (contest_id, request.user["user_id"]))

        if not cur.fetchone():
            return jsonify({
                "error": "Test not found or you do not have permission"
            }), 404

        if password.strip():
            if len(password) < 4:
                return jsonify({
                    "error": "Password must contain at least 4 characters"
                }), 400
            password_hash = bcrypt.hashpw(
                password.encode("utf-8"),
                bcrypt.gensalt()
            ).decode("utf-8")
        else:
            password_hash = None

        cur.execute("""
            UPDATE Contests
            SET access_password_hash = %s
            WHERE contest_id = %s AND created_by = %s
        """, (password_hash, contest_id, request.user["user_id"]))
        conn.commit()

        return jsonify({
            "message": (
                "Test password saved successfully"
                if password_hash
                else "Test password removed successfully"
            ),
            "password_protected": password_hash is not None
        }), 200

    except Exception as exc:
        if conn:
            conn.rollback()
        print("SET TEST PASSWORD ERROR:", exc)
        return jsonify({"error": str(exc)}), 500
    finally:
        close_db(cur, conn)


# =========================================================
# TEACHER TEST REPORT
# =========================================================

@dashboard_bp.route("/teacher/tests/<int:contest_id>/report", methods=["GET"])
@require_role("teacher")
def teacher_test_report(contest_id):
    conn = cur = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        teacher_id = request.user["user_id"]

        # ---- ownership check ----
        cur.execute("""
            SELECT contest_id, title
            FROM Contests
            WHERE contest_id = %s AND created_by = %s
        """, (contest_id, teacher_id))
        contest = cur.fetchone()

        if not contest:
            return jsonify({"error": "Test not found or access denied"}), 404

        # ---- overall stats ----
        cur.execute("""
            SELECT
                COUNT(DISTINCT s.user_id),
                COUNT(DISTINCT s.submission_id),
                COUNT(DISTINCT CASE
                    WHEN UPPER(COALESCE(r.verdict, ''))
                         IN ('AC', 'ACCEPTED', 'ACCEPT')
                    THEN s.submission_id
                END),
                COUNT(DISTINCT p.problem_id)
            FROM Contests c
            LEFT JOIN Problems p ON p.contest_id = c.contest_id
            LEFT JOIN Submissions s ON s.problem_id = p.problem_id
            LEFT JOIN LATERAL (
                SELECT verdict FROM Results
                WHERE submission_id = s.submission_id
                ORDER BY created_at DESC, result_id DESC
                LIMIT 1
            ) r ON TRUE
            WHERE c.contest_id = %s AND c.created_by = %s
        """, (contest_id, teacher_id))
        stats = cur.fetchone()

        
        cur.execute("""
            SELECT
                s.submission_id,                                   -- 0
                s.user_id,                                         -- 1
                COALESCE(u.username, 'Student ' || s.user_id::text), -- 2
                p.problem_id,                                      -- 3
                p.title,                                           -- 4
                s.language,                                        -- 5
                s.status,                                          -- 6
                r.verdict,                                         -- 7
                COALESCE(r.test_cases_passed, 0),                  -- 8
                COALESCE(r.test_cases_total, 0),                   -- 9
                r.awarded_marks,                                   -- 10 (NULL = abhi review nahi hua)
                COALESCE(r.teacher_review_status, 'pending'),      -- 11
                COALESCE(r.teacher_feedback, ''),                  -- 12
                s.submitted_at,                                    -- 13
                r.execution_time_ms,                               -- 14
                r.memory_used_kb,                                  -- 15
                r.published_at,                                    -- 16
                COALESCE(p.max_marks, %s)                          -- 17
            FROM Submissions s
            JOIN Problems p ON p.problem_id = s.problem_id
            JOIN Contests c ON c.contest_id = p.contest_id
            LEFT JOIN Users u ON u.user_id = s.user_id
            LEFT JOIN LATERAL (
                SELECT * FROM Results
                WHERE submission_id = s.submission_id
                ORDER BY created_at DESC, result_id DESC
                LIMIT 1
            ) r ON TRUE
            WHERE c.contest_id = %s
              AND c.created_by = %s
              AND s.submission_id = (
                    SELECT MAX(s2.submission_id)
                    FROM Submissions s2
                    WHERE s2.user_id = s.user_id
                      AND s2.problem_id = s.problem_id
              )
            ORDER BY s.submitted_at DESC NULLS LAST
        """, (DEFAULT_MAX_MARKS, contest_id, teacher_id))

        submissions = []
        for r in cur.fetchall():
            passed = int(r[8] or 0)
            total = int(r[9] or 0)
            max_marks = float(r[17] or DEFAULT_MAX_MARKS)

            auto_marks = (
                round((passed / total) * max_marks, 2)
                if total > 0 else 0.0
            )

           
            awarded = float(r[10]) if r[10] is not None else auto_marks

            submissions.append({
                "submission_id": r[0],
                "user_id": r[1],
                "username": r[2],
                "problem_id": r[3],
                "problem_title": r[4],
                "language": r[5],
                "status": r[6],
                "verdict": r[7],
                "test_cases_passed": passed,
                "test_cases_total": total,
                "automatic_score": auto_marks,
                "awarded_marks": awarded,
                "teacher_review_status": r[11],
                "teacher_feedback": r[12] or "",
                "submitted_at": to_iso(r[13]),
                "execution_time_ms": r[14],
                "memory_used_kb": r[15],
                "published_at": to_iso(r[16]),
                "max_marks": max_marks
            })

        cur.execute("""
            SELECT
                p.problem_id,
                p.title,
                COUNT(DISTINCT s.submission_id),
                COUNT(DISTINCT CASE
                    WHEN UPPER(COALESCE(r.verdict, ''))
                         IN ('AC', 'ACCEPTED', 'ACCEPT')
                    THEN s.submission_id
                END)
            FROM Problems p
            JOIN Contests c ON c.contest_id = p.contest_id
            LEFT JOIN Submissions s ON s.problem_id = p.problem_id
            LEFT JOIN LATERAL (
                SELECT verdict FROM Results
                WHERE submission_id = s.submission_id
                ORDER BY created_at DESC, result_id DESC
                LIMIT 1
            ) r ON TRUE
            WHERE c.contest_id = %s AND c.created_by = %s
            GROUP BY p.problem_id, p.title
            ORDER BY p.problem_id
        """, (contest_id, teacher_id))

        problem_summary = [
            {
                "problem_id": r[0],
                "problem_title": r[1],
                "submissions": r[2],
                "accepted": r[3]
            }
            for r in cur.fetchall()
        ]

        return jsonify({
            "contest_id": contest[0],
            "title": contest[1],
            "submissions": submissions,
            "analytics": {
                "total_students": stats[0] or 0,
                "total_submissions": stats[1] or 0,
                "accepted_submissions": stats[2] or 0,
                "total_problems": stats[3] or 0,
                "problem_summary": problem_summary
            }
        }), 200

    except Exception as exc:
        if conn:
            conn.rollback()
        print("TEACHER TEST REPORT ERROR:", exc)
        return jsonify({"error": str(exc)}), 500
    finally:
        close_db(cur, conn)


# =========================================================
# TEACHER REVIEW / PUBLISH
# =========================================================

@dashboard_bp.route(
    "/teacher/submissions/<int:submission_id>/review",
    methods=["PUT"]
)
@require_role("teacher")
def review_submission(submission_id):
    conn = cur = None
    data = request.get_json(silent=True) or {}

    marks = data.get("awarded_marks")
    feedback = str(data.get("teacher_feedback", "") or "")
    action = data.get("action", "save")

    if marks is None or marks == "":
        return jsonify({"error": "Marks are required"}), 400

    try:
        marks = float(marks)
    except (TypeError, ValueError):
        return jsonify({"error": "Marks must be a number"}), 400

    if marks < 0:
        return jsonify({"error": "Marks cannot be negative"}), 400

    if action not in ("save", "publish"):
        return jsonify({"error": "Invalid review action"}), 400

    try:
        conn = get_connection()
        cur = conn.cursor()
        teacher_id = request.user["user_id"]

        cur.execute("""
            SELECT s.submission_id, COALESCE(p.max_marks, %s)
            FROM Submissions s
            JOIN Problems p ON p.problem_id = s.problem_id
            JOIN Contests c ON c.contest_id = p.contest_id
            WHERE s.submission_id = %s AND c.created_by = %s
        """, (DEFAULT_MAX_MARKS, submission_id, teacher_id))
        owned = cur.fetchone()

        if not owned:
            return jsonify({
                "error": "Submission not found or access denied"
            }), 404

        max_marks = float(owned[1])
        if marks > max_marks:
            return jsonify({
                "error": f"Marks cannot exceed {max_marks:g}"
            }), 400

       
        cur.execute("""
            SELECT result_id FROM Results
            WHERE submission_id = %s
            ORDER BY created_at DESC, result_id DESC
            LIMIT 1
        """, (submission_id,))
        result = cur.fetchone()

        if not result:
            return jsonify({
                "error": "No execution result exists for this submission"
            }), 404

        new_status = "published" if action == "publish" else "reviewed"

        cur.execute("""
            UPDATE Results
            SET awarded_marks = %s,
                teacher_feedback = %s,
                teacher_review_status = %s,
                reviewed_by = %s,
                reviewed_at = NOW(),
                published_at = CASE WHEN %s = 'publish' THEN NOW() ELSE NULL END
            WHERE result_id = %s
        """, (marks, feedback, new_status, teacher_id, action, result[0]))
        conn.commit()

        return jsonify({
            "message": (
                "Result published successfully"
                if action == "publish"
                else "Review saved successfully"
            ),
            "submission_id": submission_id,
            "result_id": result[0],
            "awarded_marks": marks,
            "teacher_review_status": new_status,
            "published": action == "publish"
        }), 200

    except Exception as exc:
        if conn:
            conn.rollback()
        print("REVIEW SUBMISSION ERROR:", exc)
        return jsonify({"error": str(exc)}), 500
    finally:
        close_db(cur, conn)