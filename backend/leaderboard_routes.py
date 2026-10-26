

import os
import sys
import traceback
from functools import wraps

from flask import Blueprint, jsonify, request


PROJECT_ROOT = os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))
)

if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from database.auth import verify_token, get_connection


DEFAULT_MAX_MARKS = 10.0

leaderboard_bp = Blueprint(
    "leaderboard",
    __name__,
    url_prefix="/api"
)


# ---------------------------------------------------------
# AUTH (student ya teacher, dono chalte hain)
# ---------------------------------------------------------

def require_login(function):
    @wraps(function)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authorization token required"}), 401

        try:
            payload = verify_token(auth_header.split(" ", 1)[1].strip())
        except Exception:
            payload = None

        if not isinstance(payload, dict) or payload.get("user_id") is None:
            return jsonify({"error": "Invalid or expired token"}), 401

        if payload.get("role") not in ("student", "teacher"):
            return jsonify({"error": "Access denied"}), 403

        request.user = payload
        return function(*args, **kwargs)

    return wrapper


def close_db(cur, conn):
    if cur:
        cur.close()
    if conn:
        conn.close()


def to_iso(value):
    return value.isoformat() if value else None


# ---------------------------------------------------------
# LIST OF TESTS
# ---------------------------------------------------------

@leaderboard_bp.route("/leaderboard/contests", methods=["GET"])
@require_login
def leaderboard_contests():
    conn = cur = None

    user_id = request.user["user_id"]
    is_teacher = request.user["role"] == "teacher"

    try:
        conn = get_connection()
        cur = conn.cursor()

        if is_teacher:
            cur.execute(
                """
                SELECT contest_id, title, end_time
                FROM Contests
                WHERE created_by = %s
                ORDER BY end_time DESC
                """,
                (user_id,)
            )
        else:
            cur.execute(
                """
                SELECT DISTINCT c.contest_id, c.title, c.end_time
                FROM Contests c
                JOIN Problems p ON p.contest_id = c.contest_id
                JOIN Submissions s ON s.problem_id = p.problem_id
                WHERE s.user_id = %s
                ORDER BY c.end_time DESC
                """,
                (user_id,)
            )

        contests = [
            {
                "contest_id": r[0],
                "title": r[1],
                "end_time": to_iso(r[2])
            }
            for r in cur.fetchall()
        ]

        return jsonify({"contests": contests}), 200

    except Exception:
        traceback.print_exc()
        return jsonify({
            "error": "Could not load tests. Check the backend terminal."
        }), 500

    finally:
        close_db(cur, conn)


# ---------------------------------------------------------
# LEADERBOARD OF ONE TEST
# ---------------------------------------------------------

@leaderboard_bp.route("/leaderboard/<int:contest_id>", methods=["GET"])
@require_login
def leaderboard(contest_id):
    conn = cur = None

    user_id = request.user["user_id"]
    is_teacher = request.user["role"] == "teacher"

    try:
        conn = get_connection()
        cur = conn.cursor()

        # ---- access check ----
        if is_teacher:
            cur.execute(
                """
                SELECT contest_id, title
                FROM Contests
                WHERE contest_id = %s AND created_by = %s
                """,
                (contest_id, user_id)
            )
        else:
            cur.execute(
                """
                SELECT c.contest_id, c.title
                FROM Contests c
                WHERE c.contest_id = %s
                  AND EXISTS (
                        SELECT 1
                        FROM Submissions s
                        JOIN Problems p ON p.problem_id = s.problem_id
                        WHERE p.contest_id = c.contest_id
                          AND s.user_id = %s
                  )
                """,
                (contest_id, user_id)
            )

        contest = cur.fetchone()

        if not contest:
            return jsonify({
                "error": "Leaderboard not available for this test"
            }), 404

       
        cur.execute(
            """
            SELECT COUNT(*), COALESCE(SUM(COALESCE(max_marks, %s)), 0)
            FROM Problems
            WHERE contest_id = %s
            """,
            (DEFAULT_MAX_MARKS, contest_id)
        )
        total_problems, total_max_marks = cur.fetchone()

      
        cur.execute(
            """
            SELECT
                s.user_id,
                COALESCE(u.username, 'Student ' || s.user_id::text),
                COALESCE(r.test_cases_passed, 0),
                COALESCE(r.test_cases_total, 0),
                r.awarded_marks,
                COALESCE(p.max_marks, %s),
                COALESCE(r.execution_time_ms, 0),
                r.verdict
            FROM Submissions s
            JOIN Problems p ON p.problem_id = s.problem_id
            LEFT JOIN Users u ON u.user_id = s.user_id
            LEFT JOIN LATERAL (
                SELECT * FROM Results
                WHERE submission_id = s.submission_id
                ORDER BY created_at DESC, result_id DESC
                LIMIT 1
            ) r ON TRUE
            WHERE p.contest_id = %s
              AND s.submission_id = (
                    SELECT MAX(s2.submission_id)
                    FROM Submissions s2
                    WHERE s2.user_id = s.user_id
                      AND s2.problem_id = s.problem_id
              )
            """,
            (DEFAULT_MAX_MARKS, contest_id)
        )

        students = {}

        for row in cur.fetchall():
            uid, username, passed, total, awarded, max_marks, time_ms, verdict = row

            passed = int(passed or 0)
            total = int(total or 0)
            max_marks = float(max_marks or DEFAULT_MAX_MARKS)

            auto_marks = (
                round((passed / total) * max_marks, 2) if total > 0 else 0.0
            )
            marks = float(awarded) if awarded is not None else auto_marks

            entry = students.setdefault(uid, {
                "user_id": uid,
                "username": username,
                "total_marks": 0.0,
                "total_time_ms": 0,
                "problems_attempted": 0,
                "problems_solved": 0
            })

            entry["total_marks"] += marks
            entry["total_time_ms"] += int(time_ms or 0)
            entry["problems_attempted"] += 1

            if str(verdict or "").strip().upper() in ("AC", "ACCEPTED", "ACCEPT"):
                entry["problems_solved"] += 1

        ordered = sorted(
            students.values(),
            key=lambda e: (-e["total_marks"], e["total_time_ms"], e["username"])
        )

        
        entries = []
        previous_key = None
        current_rank = 0

        for position, entry in enumerate(ordered, start=1):
            key = (round(entry["total_marks"], 2), entry["total_time_ms"])

            if key != previous_key:
                current_rank = position
                previous_key = key

            entries.append({
                "rank": current_rank,
                "user_id": entry["user_id"],
                "username": entry["username"],
                "total_marks": round(entry["total_marks"], 2),
                "max_marks": float(total_max_marks or 0),
                "problems_solved": entry["problems_solved"],
                "problems_attempted": entry["problems_attempted"],
                "total_time_ms": entry["total_time_ms"],
                "is_me": entry["user_id"] == user_id
            })

        my_rank = next((e["rank"] for e in entries if e["is_me"]), None)

        return jsonify({
            "contest_id": contest[0],
            "title": contest[1],
            "total_problems": total_problems or 0,
            "total_max_marks": float(total_max_marks or 0),
            "my_rank": my_rank,
            "entries": entries
        }), 200

    except Exception:
        traceback.print_exc()
        return jsonify({
            "error": "Could not load leaderboard. Check the backend."
        }), 500

    finally:
        close_db(cur, conn)