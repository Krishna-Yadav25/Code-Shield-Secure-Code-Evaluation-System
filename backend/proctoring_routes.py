"""
CodeShield Proctoring API (tab-switch tracking + test freeze).

Student:
    POST /api/tests/<contest_id>/tab-switch   -> ek tab switch report karo
    GET  /api/tests/<contest_id>/session      -> mera current status (active / frozen)

Teacher:
    GET  /api/teacher/tests/<contest_id>/proctoring
    POST /api/teacher/tests/<contest_id>/sessions/<user_id>/unlock

Rule:
    MAX_TAB_SWITCHES tak switch allowed hain. Usse upar jaate hi test freeze.
    Freeze sirf teacher unlock kar sakta hai. Count server par rakha jata hai,
    isliye student browser se bypass nahi kar sakta.
"""

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


MAX_TAB_SWITCHES = 4

# Ek hi tab switch par visibilitychange + blur dono fire hote hain;
# 2 second ke andar ke events ek hi switch maane jate hain.
SWITCH_DEBOUNCE_SECONDS = 2

FROZEN_MESSAGE = "Your test is frozen. Ask your teacher to unlock it."

proctoring_bp = Blueprint(
    "proctoring",
    __name__,
    url_prefix="/api"
)


# ---------------------------------------------------------
# AUTH
# ---------------------------------------------------------

def require_role(required_role):
    def decorator(function):
        @wraps(function)
        def wrapper(*args, **kwargs):
            auth_header = request.headers.get("Authorization", "")

            if not auth_header.startswith("Bearer "):
                return jsonify({
                    "error": "Authorization token required"
                }), 401

            try:
                payload = verify_token(auth_header.split(" ", 1)[1].strip())
            except Exception:
                payload = None

            if not isinstance(payload, dict):
                return jsonify({
                    "error": "Invalid or expired token"
                }), 401

            if payload.get("role") != required_role:
                return jsonify({
                    "error": f"{required_role} role required"
                }), 403

            if payload.get("user_id") is None:
                return jsonify({
                    "error": "Token does not contain user_id"
                }), 401

            request.user = payload
            return function(*args, **kwargs)

        return wrapper
    return decorator


# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------

def close_db(cur, conn):
    if cur:
        cur.close()
    if conn:
        conn.close()


def to_iso(value):
    return value.isoformat() if value else None


def build_state(status, count, reason, counted=False):
    count = int(count or 0)

    return {
        "status": status,
        "frozen": status == "frozen",
        "tab_switch_count": count,
        "max_switches": MAX_TAB_SWITCHES,
        "remaining": max(0, MAX_TAB_SWITCHES - count),
        "freeze_reason": reason or "",
        "counted": counted
    }


def read_state(cur, contest_id, user_id):
    cur.execute(
        """
        SELECT status, tab_switch_count, freeze_reason
        FROM TestSessions
        WHERE contest_id = %s AND user_id = %s
        """,
        (contest_id, user_id)
    )
    row = cur.fetchone()

    if not row:
        return build_state("active", 0, "")

    return build_state(row[0], row[1], row[2])


def log_event(cur, user_id, contest_id, event_type):
    cur.execute(
        """
        INSERT INTO ActivityLog (user_id, contest_id, event_type)
        VALUES (%s, %s, %s)
        """,
        (user_id, contest_id, event_type[:50])
    )


# ---------------------------------------------------------
# FREEZE CHECKS (dusri route files yahan se import karti hain)
# ---------------------------------------------------------

def is_frozen(cur, contest_id, user_id):
    """Already khule cursor ke saath check."""

    cur.execute(
        """
        SELECT 1
        FROM TestSessions
        WHERE contest_id = %s
          AND user_id = %s
          AND status = 'frozen'
        """,
        (contest_id, user_id)
    )

    return cur.fetchone() is not None


def _frozen_lookup(query, params):
    """
    Apna connection khol ke check karta hai.
    Error aaye (jaise table abhi bani nahi) to False deta hai,
    taaki baaki app na tute.
    """

    conn = cur = None

    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(query, params)
        return cur.fetchone() is not None

    except Exception as exc:
        print("FROZEN CHECK ERROR:", exc)
        return False

    finally:
        close_db(cur, conn)


def is_user_frozen_for_contest(user_id, contest_id):
    return _frozen_lookup(
        """
        SELECT 1
        FROM TestSessions
        WHERE contest_id = %s
          AND user_id = %s
          AND status = 'frozen'
        """,
        (contest_id, user_id)
    )


def is_user_frozen_for_problem(user_id, problem_id):
    return _frozen_lookup(
        """
        SELECT 1
        FROM TestSessions ts
        JOIN Problems p ON p.contest_id = ts.contest_id
        WHERE p.problem_id = %s
          AND ts.user_id = %s
          AND ts.status = 'frozen'
        """,
        (problem_id, user_id)
    )


# ---------------------------------------------------------
# STUDENT: REPORT A TAB SWITCH
# ---------------------------------------------------------

@proctoring_bp.route("/tests/<int:contest_id>/tab-switch", methods=["POST"])
@require_role("student")
def report_tab_switch(contest_id):
    conn = cur = None

    user_id = request.user["user_id"]
    data = request.get_json(silent=True) or {}
    reason = str(data.get("reason") or "tab_hidden")[:30]

    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT start_time <= NOW(), end_time > NOW()
            FROM Contests
            WHERE contest_id = %s
            """,
            (contest_id,)
        )
        timing = cur.fetchone()

        if not timing:
            return jsonify({"error": "Test not found"}), 404

        cur.execute(
            """
            SELECT status
            FROM ContestAttempts
            WHERE contest_id = %s AND user_id = %s
            """,
            (contest_id, user_id)
        )
        attempt = cur.fetchone()

        # Test chal nahi raha / submit ho chuka => switch count nahi hota
        if (
            not timing[0]
            or not timing[1]
            or not attempt
            or attempt[0] != "in_progress"
        ):
            return jsonify(read_state(cur, contest_id, user_id)), 200

        cur.execute(
            """
            INSERT INTO TestSessions (contest_id, user_id)
            VALUES (%s, %s)
            ON CONFLICT (contest_id, user_id) DO NOTHING
            """,
            (contest_id, user_id)
        )

        # Row lock, taaki do events ek saath aaye to count double na ho
        cur.execute(
            """
            SELECT
                session_id,
                status,
                tab_switch_count,
                freeze_reason,
                (
                    last_switch_at IS NOT NULL
                    AND last_switch_at > NOW() - (%s * INTERVAL '1 second')
                )
            FROM TestSessions
            WHERE contest_id = %s AND user_id = %s
            FOR UPDATE
            """,
            (SWITCH_DEBOUNCE_SECONDS, contest_id, user_id)
        )
        session_id, status, count, freeze_reason, recent = cur.fetchone()

        # Pehle se frozen ya abhi-abhi count hua => kuch nahi badalna
        if status == "frozen" or recent:
            conn.commit()
            return jsonify(build_state(status, count, freeze_reason)), 200

        count += 1

        if count > MAX_TAB_SWITCHES:
            freeze_reason = (
                f"Exceeded the tab-switch limit "
                f"({count} switches, {MAX_TAB_SWITCHES} allowed)"
            )

            cur.execute(
                """
                UPDATE TestSessions
                SET tab_switch_count = %s,
                    last_switch_at = NOW(),
                    status = 'frozen',
                    frozen_at = NOW(),
                    freeze_reason = %s
                WHERE session_id = %s
                """,
                (count, freeze_reason, session_id)
            )

            log_event(cur, user_id, contest_id, f"tab_switch:{reason}")
            log_event(cur, user_id, contest_id, "test_frozen")

            status = "frozen"

        else:
            cur.execute(
                """
                UPDATE TestSessions
                SET tab_switch_count = %s,
                    last_switch_at = NOW()
                WHERE session_id = %s
                """,
                (count, session_id)
            )

            log_event(cur, user_id, contest_id, f"tab_switch:{reason}")

        conn.commit()

        return jsonify(
            build_state(status, count, freeze_reason, counted=True)
        ), 200

    except Exception:
        if conn:
            conn.rollback()
        traceback.print_exc()
        return jsonify({
            "error": "Could not record tab switch. Check the backend terminal."
        }), 500

    finally:
        close_db(cur, conn)


# ---------------------------------------------------------
# STUDENT: CURRENT SESSION STATUS
# ---------------------------------------------------------

@proctoring_bp.route("/tests/<int:contest_id>/session", methods=["GET"])
@require_role("student")
def my_session(contest_id):
    conn = cur = None

    try:
        conn = get_connection()
        cur = conn.cursor()

        return jsonify(
            read_state(cur, contest_id, request.user["user_id"])
        ), 200

    except Exception:
        traceback.print_exc()
        return jsonify({
            "error": "Could not load session. Check the backend terminal."
        }), 500

    finally:
        close_db(cur, conn)


# ---------------------------------------------------------
# TEACHER: LIST SESSIONS
# ---------------------------------------------------------

@proctoring_bp.route(
    "/teacher/tests/<int:contest_id>/proctoring",
    methods=["GET"]
)
@require_role("teacher")
def teacher_proctoring(contest_id):
    conn = cur = None

    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT 1 FROM Contests
            WHERE contest_id = %s AND created_by = %s
            """,
            (contest_id, request.user["user_id"])
        )

        if not cur.fetchone():
            return jsonify({
                "error": "Test not found or access denied"
            }), 404

        cur.execute(
            """
            SELECT
                u.user_id,
                u.username,
                ts.status,
                ts.tab_switch_count,
                ts.frozen_at,
                ts.freeze_reason,
                ts.unlock_count,
                ts.unlocked_at,
                ca.status
            FROM TestSessions ts
            JOIN Users u ON u.user_id = ts.user_id
            LEFT JOIN ContestAttempts ca
                ON ca.contest_id = ts.contest_id
               AND ca.user_id = ts.user_id
            WHERE ts.contest_id = %s
            ORDER BY
                (ts.status = 'frozen') DESC,
                ts.tab_switch_count DESC,
                u.username
            """,
            (contest_id,)
        )

        sessions = [
            {
                "user_id": r[0],
                "username": r[1],
                "status": r[2],
                "tab_switch_count": r[3],
                "frozen_at": to_iso(r[4]),
                "freeze_reason": r[5] or "",
                "unlock_count": r[6],
                "unlocked_at": to_iso(r[7]),
                "attempt_status": r[8]
            }
            for r in cur.fetchall()
        ]

        return jsonify({
            "contest_id": contest_id,
            "max_switches": MAX_TAB_SWITCHES,
            "frozen_count": sum(1 for s in sessions if s["status"] == "frozen"),
            "sessions": sessions
        }), 200

    except Exception:
        traceback.print_exc()
        return jsonify({
            "error": "Could not load proctoring data. Check the backend terminal."
        }), 500

    finally:
        close_db(cur, conn)


# ---------------------------------------------------------
# TEACHER: UNLOCK A STUDENT
# ---------------------------------------------------------

@proctoring_bp.route(
    "/teacher/tests/<int:contest_id>/sessions/<int:student_id>/unlock",
    methods=["POST"]
)
@require_role("teacher")
def unlock_student(contest_id, student_id):
    conn = cur = None
    teacher_id = request.user["user_id"]

    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT 1 FROM Contests
            WHERE contest_id = %s AND created_by = %s
            """,
            (contest_id, teacher_id)
        )

        if not cur.fetchone():
            return jsonify({
                "error": "Test not found or access denied"
            }), 404

        cur.execute(
            """
            UPDATE TestSessions
            SET status = 'active',
                tab_switch_count = 0,
                last_switch_at = NULL,
                frozen_at = NULL,
                freeze_reason = NULL,
                unlock_count = unlock_count + 1,
                unlocked_by = %s,
                unlocked_at = NOW()
            WHERE contest_id = %s
              AND user_id = %s
              AND status = 'frozen'
            RETURNING session_id
            """,
            (teacher_id, contest_id, student_id)
        )

        if not cur.fetchone():
            conn.rollback()
            return jsonify({
                "error": "This student's test is not frozen"
            }), 409

        log_event(cur, student_id, contest_id, "test_unlocked")

        conn.commit()

        return jsonify({
            "message": "Student unlocked. They can continue the test."
        }), 200

    except Exception:
        if conn:
            conn.rollback()
        traceback.print_exc()
        return jsonify({
            "error": "Could not unlock student. Check the backend terminal."
        }), 500

    finally:
        close_db(cur, conn)