"""
CodeShield Incident API: multiple faces / different person / face not visible.

Student:
    POST /api/tests/<contest_id>/incident
         kind = MULTI_FACE | FACE_MISMATCH | NO_FACE | CAMERA_OFF
         photo = camera frame (JPEG data URL)
         count = false -> alert gaze counter / GazeEvents mein dobara na ginna
                          (jab wahi alert /gaze-event se pehle hi gina ja chuka ho)
         -> incident save hota hai aur teacher ko photo ke saath alert jata hai.
         Student ka test NAHI rukta, aur student ko kuch dikhta bhi nahi.

Teacher:
    GET  /api/teacher/tests/<contest_id>/incidents
    POST /api/teacher/tests/<contest_id>/incidents/<incident_id>/decide
         decision = freeze -> student ka test freeze (incident review mein rehta hai)
         decision = reject -> student ka test END ho jata hai (submit)
         decision = allow  -> dismiss (galat alarm); frozen ho to unlock bhi
"""

import os
import sys
import traceback

from flask import Blueprint, jsonify, request


PROJECT_ROOT = os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))
)

if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from database.auth import get_connection
from proctoring_routes import (
    require_role,
    close_db,
    to_iso,
    log_event,
    build_state,
    ensure_session,
    attempt_status,
    freeze_session,
    end_attempt,
    with_note,
    teacher_owns_contest,
    test_is_running_for,
    TEACHER_FREEZE_REASON,
    TEACHER_END_REASON
)


INCIDENT_KINDS = {
    "MULTI_FACE": "Multiple faces detected in the camera",
    "FACE_MISMATCH": "The person in front of the camera does not match the registered student",
    "NO_FACE": "The student's face is not visible in the camera",
    "CAMERA_OFF": "The student's camera is turned off or blocked"
}

# Pehle 250_000 tha: badi photo chupchap hat jati thi aur incident bina photo ke banta tha
MAX_PHOTO_CHARS = 400_000
MAX_NOTE_CHARS = 300
LIST_LIMIT = 60

# Ek hi kind ka naya incident itne second tak dobara nahi banta (spam roakne ke liye)
INCIDENT_COOLDOWN_SECONDS = 60

incident_bp = Blueprint(
    "incident",
    __name__,
    url_prefix="/api"
)


def clean_photo(raw):
    if not isinstance(raw, str):
        return None

    if not raw.startswith("data:image/jpeg;base64,"):
        return None

    if len(raw) > MAX_PHOTO_CHARS:
        return None

    return raw


def record_incident(cur, contest_id, user_id, kind, photo, count=True):
    """
    Incident + teacher alert banata hai (commit caller karta hai).
    Cooldown ke andar wahi alert dobara nahi banta.
    Returns True agar naya incident bana.

    identity_routes.py periodic face mismatch ke liye isi ko call karta hai.
    """

    if kind not in INCIDENT_KINDS:
        return False

    ensure_session(cur, contest_id, user_id)

    cur.execute(
        """
        SELECT session_id, status, gaze_warning_count, cheat_submitted
        FROM TestSessions
        WHERE contest_id = %s AND user_id = %s
        FOR UPDATE
        """,
        (contest_id, user_id)
    )
    session_id, status, gaze, ended = cur.fetchone()

    if ended or status == "frozen":
        return False

    cur.execute(
        """
        SELECT 1
        FROM ProctorIncidents
        WHERE contest_id = %s
          AND user_id = %s
          AND kind = %s
          AND status = 'pending'
          AND created_at > NOW() - (%s * INTERVAL '1 second')
        """,
        (contest_id, user_id, kind, INCIDENT_COOLDOWN_SECONDS)
    )

    if cur.fetchone():
        return False

    cur.execute(
        """
        INSERT INTO ProctorIncidents (contest_id, user_id, kind, photo)
        VALUES (%s, %s, %s, %s)
        """,
        (contest_id, user_id, kind, photo)
    )

    if count:
        cur.execute("SAVEPOINT gaze_sp")

        try:
            cur.execute(
                """
                INSERT INTO GazeEvents
                    (contest_id, user_id, event_type, duration_ms)
                VALUES (%s, %s, %s, 0)
                """,
                (contest_id, user_id, kind)
            )
            cur.execute("RELEASE SAVEPOINT gaze_sp")
        except Exception:
            cur.execute("ROLLBACK TO SAVEPOINT gaze_sp")

        cur.execute(
            """
            UPDATE TestSessions
            SET gaze_warning_count = %s,
                last_gaze_at = NOW()
            WHERE session_id = %s
            """,
            (gaze + 1, session_id)
        )

    log_event(cur, user_id, contest_id, f"incident:{kind}")

    return True


# ---------------------------------------------------------
# STUDENT: REPORT INCIDENT (sirf teacher ko alert)
# ---------------------------------------------------------

@incident_bp.route("/tests/<int:contest_id>/incident", methods=["POST"])
@require_role("student")
def report_incident(contest_id):
    conn = cur = None

    user_id = request.user["user_id"]
    data = request.get_json(silent=True) or {}

    kind = str(data.get("kind") or "").upper()

    if kind not in INCIDENT_KINDS:
        return jsonify({"error": "Invalid incident type"}), 400

    photo = clean_photo(data.get("photo"))

    # count=false: ye alert /gaze-event se pehle hi gina ja chuka hai,
    # yahan sirf photo wala incident banana hai (double count nahi)
    count_it = data.get("count") is not False

    try:
        conn = get_connection()
        cur = conn.cursor()

        found, running = test_is_running_for(cur, contest_id, user_id)

        if not found:
            return jsonify({"error": "Test not found"}), 404

        if not running:
            return jsonify(build_state("active", 0, "")), 200

        ensure_session(cur, contest_id, user_id)

        cur.execute(
            """
            SELECT session_id, status, tab_switch_count, gaze_warning_count,
                   cheat_submitted, freeze_reason
            FROM TestSessions
            WHERE contest_id = %s AND user_id = %s
            FOR UPDATE
            """,
            (contest_id, user_id)
        )
        session_id, status, tabs, gaze, ended, reason = cur.fetchone()

        # Pehle se frozen / ended: naya incident nahi banta
        if ended or status == "frozen":
            conn.commit()
            return jsonify(
                build_state(
                    status, tabs, reason, gaze=gaze, auto_submit=bool(ended)
                )
            ), 200

        # Wahi alert abhi-abhi aaya tha: dobara photo nahi
        cur.execute(
            """
            SELECT 1
            FROM ProctorIncidents
            WHERE contest_id = %s
              AND user_id = %s
              AND kind = %s
              AND status = 'pending'
              AND created_at > NOW() - (%s * INTERVAL '1 second')
            """,
            (contest_id, user_id, kind, INCIDENT_COOLDOWN_SECONDS)
        )

        if cur.fetchone():
            conn.commit()
            return jsonify(
                build_state(status, tabs, reason, gaze=gaze)
            ), 200

        cur.execute(
            """
            INSERT INTO ProctorIncidents (contest_id, user_id, kind, photo)
            VALUES (%s, %s, %s, %s)
            """,
            (contest_id, user_id, kind, photo)
        )

        if count_it:
            # Teacher ke alert count / chips mein bhi dikhe
            cur.execute("SAVEPOINT gaze_sp")

            try:
                cur.execute(
                    """
                    INSERT INTO GazeEvents
                        (contest_id, user_id, event_type, duration_ms)
                    VALUES (%s, %s, %s, 0)
                    """,
                    (contest_id, user_id, kind)
                )
                cur.execute("RELEASE SAVEPOINT gaze_sp")
            except Exception:
                cur.execute("ROLLBACK TO SAVEPOINT gaze_sp")

            gaze += 1

            cur.execute(
                """
                UPDATE TestSessions
                SET gaze_warning_count = %s,
                    last_gaze_at = NOW()
                WHERE session_id = %s
                """,
                (gaze, session_id)
            )

        log_event(cur, user_id, contest_id, f"incident:{kind}")

        conn.commit()

        return jsonify(
            build_state(status, tabs, reason, gaze=gaze)
        ), 200

    except Exception:
        if conn:
            conn.rollback()
        traceback.print_exc()
        return jsonify({
            "error": "Could not record the incident. Check the backend terminal."
        }), 500

    finally:
        close_db(cur, conn)


# ---------------------------------------------------------
# TEACHER: LIST
# ---------------------------------------------------------

@incident_bp.route(
    "/teacher/tests/<int:contest_id>/incidents",
    methods=["GET"]
)
@require_role("teacher")
def teacher_incidents(contest_id):
    conn = cur = None

    try:
        conn = get_connection()
        cur = conn.cursor()

        if not teacher_owns_contest(
            cur, contest_id, request.user["user_id"]
        ):
            return jsonify({
                "error": "Test not found or access denied"
            }), 404

        cur.execute(
            """
            SELECT i.incident_id, i.user_id, u.username, i.kind, i.photo,
                   i.status, i.note, i.created_at, i.decided_at, fp.photo,
                   COALESCE(ts.status = 'frozen', FALSE),
                   COALESCE(ts.cheat_submitted, FALSE)
            FROM ProctorIncidents i
            JOIN Users u ON u.user_id = i.user_id
            LEFT JOIN FaceProfiles fp ON fp.user_id = i.user_id
            LEFT JOIN TestSessions ts
                ON ts.contest_id = i.contest_id
               AND ts.user_id = i.user_id
            WHERE i.contest_id = %s
            ORDER BY (i.status = 'pending') DESC,
                     i.created_at DESC,
                     i.incident_id DESC
            LIMIT %s
            """,
            (contest_id, LIST_LIMIT)
        )

        incidents = [
            {
                "incident_id": r[0],
                "user_id": r[1],
                "username": r[2],
                "kind": r[3],
                "photo": r[4],
                "status": r[5],
                "note": r[6] or "",
                "created_at": to_iso(r[7]),
                "decided_at": to_iso(r[8]),
                "reference_photo": r[9] if r[3] == "FACE_MISMATCH" else None,
                "student_frozen": bool(r[10]) and not bool(r[11]),
                "student_ended": bool(r[11])
            }
            for r in cur.fetchall()
        ]

        return jsonify({
            "contest_id": contest_id,
            "pending": sum(1 for i in incidents if i["status"] == "pending"),
            "incidents": incidents
        }), 200

    except Exception:
        traceback.print_exc()
        return jsonify({
            "error": "Could not load incidents. Check the backend terminal."
        }), 500

    finally:
        close_db(cur, conn)


# ---------------------------------------------------------
# TEACHER: DECIDE (freeze / reject = end test / allow = dismiss)
# ---------------------------------------------------------

@incident_bp.route(
    "/teacher/tests/<int:contest_id>/incidents/<int:incident_id>/decide",
    methods=["POST"]
)
@require_role("teacher")
def decide_incident(contest_id, incident_id):
    conn = cur = None

    teacher_id = request.user["user_id"]
    data = request.get_json(silent=True) or {}

    decision = str(data.get("decision") or "").lower()
    note = str(data.get("note") or "").strip()[:MAX_NOTE_CHARS]

    if decision not in ("allow", "freeze", "reject"):
        return jsonify({
            "error": "Decision must be allow, freeze or reject"
        }), 400

    try:
        conn = get_connection()
        cur = conn.cursor()

        if not teacher_owns_contest(cur, contest_id, teacher_id):
            return jsonify({
                "error": "Test not found or access denied"
            }), 404

        cur.execute(
            """
            SELECT user_id, kind, status
            FROM ProctorIncidents
            WHERE incident_id = %s AND contest_id = %s
            FOR UPDATE
            """,
            (incident_id, contest_id)
        )
        row = cur.fetchone()

        if not row:
            return jsonify({"error": "Incident not found"}), 404

        student_id, kind, status = row

        if status != "pending":
            return jsonify({
                "error": "This incident has already been reviewed"
            }), 409

        # ---------- DISMISS / ALLOW ----------
        if decision == "allow":
            cur.execute(
                """
                UPDATE ProctorIncidents
                SET status = 'allowed', note = %s,
                    decided_by = %s, decided_at = NOW()
                WHERE incident_id = %s
                """,
                (note, teacher_id, incident_id)
            )

            # Frozen ho to unlock (tab count bhi 0); warna sirf camera alerts clear
            cur.execute(
                """
                UPDATE TestSessions
                SET tab_switch_count = CASE
                        WHEN status = 'frozen' THEN 0
                        ELSE tab_switch_count
                    END,
                    unlock_count = CASE
                        WHEN status = 'frozen' THEN unlock_count + 1
                        ELSE unlock_count
                    END,
                    unlocked_by = CASE
                        WHEN status = 'frozen' THEN %s
                        ELSE unlocked_by
                    END,
                    unlocked_at = CASE
                        WHEN status = 'frozen' THEN NOW()
                        ELSE unlocked_at
                    END,
                    freeze_reason = CASE
                        WHEN status = 'frozen' THEN NULL
                        ELSE freeze_reason
                    END,
                    frozen_at = NULL,
                    gaze_warning_count = 0,
                    last_gaze_at = NULL,
                    last_switch_at = NULL,
                    status = 'active'
                WHERE contest_id = %s
                  AND user_id = %s
                  AND cheat_submitted = FALSE
                """,
                (teacher_id, contest_id, student_id)
            )

            log_event(cur, student_id, contest_id, "incident_dismissed")
            message = "Incident dismissed. The student continues the test."

        # ---------- FREEZE ----------
        elif decision == "freeze":
            if attempt_status(cur, contest_id, student_id) != "in_progress":
                return jsonify({
                    "error": "This student's test is already submitted"
                }), 409

            reason = with_note(TEACHER_FREEZE_REASON, note)

            if not freeze_session(cur, contest_id, student_id, reason):
                return jsonify({
                    "error": "This student's test is already frozen or ended"
                }), 409

            # Incident "pending" rehta hai jab tak teacher unlock / end na kare
            cur.execute(
                """
                UPDATE ProctorIncidents
                SET note = %s
                WHERE incident_id = %s
                """,
                (note, incident_id)
            )

            log_event(cur, student_id, contest_id, "teacher_froze_test")
            message = "Student's test is frozen. Unlock it or end it after review."

        # ---------- REJECT = END TEST ----------
        else:
            reason = with_note(TEACHER_END_REASON, note)

            cur.execute(
                """
                UPDATE ProctorIncidents
                SET status = 'rejected', note = %s,
                    decided_by = %s, decided_at = NOW()
                WHERE incident_id = %s
                """,
                (note, teacher_id, incident_id)
            )

            end_attempt(cur, contest_id, student_id, reason)

            log_event(cur, student_id, contest_id, "teacher_ended_test")
            message = "Student's test has been ended and submitted."

        conn.commit()

        return jsonify({"message": message}), 200

    except Exception:
        if conn:
            conn.rollback()
        traceback.print_exc()
        return jsonify({
            "error": "Could not save the decision. Check the backend terminal."
        }), 500

    finally:
        close_db(cur, conn)