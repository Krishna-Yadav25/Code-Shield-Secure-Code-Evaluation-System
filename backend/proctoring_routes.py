# """
# CodeShield Proctoring API (tab-switch + camera alerts + teacher control).

# Rules (light version):
#     - Auto-submit SIRF timer khatam hone par hota hai. Proctoring kabhi
#       test ko apne aap submit nahi karti.
#     - Tab switch: MAX_TAB_SWITCHES (6) tak allowed. 7th switch par test
#       FREEZE ho jata hai; sirf teacher unlock kar sakta hai.
#     - Camera / eye alerts (face nahi dikha, kai faces, nazar hati, camera
#       band): student ko kuch nahi dikhta, sirf teacher ko alert jata hai.
#       Teacher decide karta hai: Freeze test ya End test.

# Student:
#     POST /api/tests/<contest_id>/tab-switch
#     POST /api/tests/<contest_id>/gaze-event
#     GET  /api/tests/<contest_id>/session
#     GET  /api/student/attempts

# Teacher:
#     GET  /api/teacher/tests/<contest_id>/proctoring
#     POST /api/teacher/tests/<contest_id>/sessions/<user_id>/unlock
#     POST /api/teacher/tests/<contest_id>/sessions/<user_id>/freeze
#     POST /api/teacher/tests/<contest_id>/sessions/<user_id>/end
#     POST /api/teacher/tests/<contest_id>/sessions/<user_id>/clear-alerts

# Count server par rakha jata hai, isliye student browser se bypass nahi kar sakta.
# """

# import os
# import sys
# import traceback
# from functools import wraps

# from flask import Blueprint, jsonify, request


# PROJECT_ROOT = os.path.dirname(
#     os.path.dirname(os.path.abspath(__file__))
# )

# if PROJECT_ROOT not in sys.path:
#     sys.path.insert(0, PROJECT_ROOT)

# from database.auth import verify_token, get_connection


# # 6 tab switch tak allowed. 7th switch par freeze.
# MAX_TAB_SWITCHES = 6

# # Itne camera alerts ke baad student teacher ke "needs attention" mein aata hai
# GAZE_ALERT_AT = 3

# # Ek hi tab switch par visibilitychange + blur dono fire hote hain;
# # 2 second ke andar ke events ek hi switch maane jate hain.
# SWITCH_DEBOUNCE_SECONDS = 2

# # Camera alerts ke beech kam se kam itna gap (teacher ko spam na ho)
# GAZE_DEBOUNCE_SECONDS = 10

# GAZE_EVENT_TYPES = (
#     "NO_FACE",
#     "MULTI_FACE",
#     "LOOK_AWAY",
#     "CAMERA_OFF",
#     "FACE_MISMATCH"
# )

# FROZEN_MESSAGE = "Your test is frozen. Ask your teacher to unlock it."

# TEACHER_FREEZE_REASON = (
#     "Your teacher froze your test to review suspicious activity. "
#     "Please wait for your teacher."
# )

# TEACHER_END_REASON = (
#     "Your test was ended by your teacher after reviewing suspicious activity."
# )

# proctoring_bp = Blueprint(
#     "proctoring",
#     __name__,
#     url_prefix="/api"
# )


# # ---------------------------------------------------------
# # AUTH
# # ---------------------------------------------------------

# def require_role(required_role):
#     def decorator(function):
#         @wraps(function)
#         def wrapper(*args, **kwargs):
#             auth_header = request.headers.get("Authorization", "")

#             if not auth_header.startswith("Bearer "):
#                 return jsonify({
#                     "error": "Authorization token required"
#                 }), 401

#             try:
#                 payload = verify_token(auth_header.split(" ", 1)[1].strip())
#             except Exception:
#                 payload = None

#             if not isinstance(payload, dict):
#                 return jsonify({
#                     "error": "Invalid or expired token"
#                 }), 401

#             if payload.get("role") != required_role:
#                 return jsonify({
#                     "error": f"{required_role} role required"
#                 }), 403

#             if payload.get("user_id") is None:
#                 return jsonify({
#                     "error": "Token does not contain user_id"
#                 }), 401

#             request.user = payload
#             return function(*args, **kwargs)

#         return wrapper
#     return decorator


# # ---------------------------------------------------------
# # HELPERS
# # ---------------------------------------------------------

# def close_db(cur, conn):
#     if cur:
#         cur.close()
#     if conn:
#         conn.close()


# def to_iso(value):
#     return value.isoformat() if value else None


# def build_state(status, count, reason, counted=False, gaze=0,
#                 auto_submit=False):
#     """
#     Student ko jaane wala session state.
#     auto_submit / ended = True matlab teacher ne test end kar diya.
#     """

#     count = int(count or 0)
#     gaze = int(gaze or 0)

#     return {
#         "status": status,
#         "frozen": status == "frozen",
#         "tab_switch_count": count,
#         "max_switches": MAX_TAB_SWITCHES,
#         "remaining": max(0, MAX_TAB_SWITCHES - count),
#         "gaze_warning_count": gaze,
#         "ended": bool(auto_submit),
#         "auto_submit": bool(auto_submit),
#         "freeze_reason": reason or "",
#         "counted": counted
#     }


# def read_state(cur, contest_id, user_id):
#     cur.execute(
#         """
#         SELECT status, tab_switch_count, freeze_reason,
#                gaze_warning_count, cheat_submitted
#         FROM TestSessions
#         WHERE contest_id = %s AND user_id = %s
#         """,
#         (contest_id, user_id)
#     )
#     row = cur.fetchone()

#     if not row:
#         return build_state("active", 0, "")

#     return build_state(
#         row[0], row[1], row[2], gaze=row[3], auto_submit=row[4]
#     )


# def log_event(cur, user_id, contest_id, event_type):
#     cur.execute(
#         """
#         INSERT INTO ActivityLog (user_id, contest_id, event_type)
#         VALUES (%s, %s, %s)
#         """,
#         (user_id, contest_id, event_type[:50])
#     )


# def ensure_session(cur, contest_id, user_id):
#     cur.execute(
#         """
#         INSERT INTO TestSessions (contest_id, user_id)
#         VALUES (%s, %s)
#         ON CONFLICT (contest_id, user_id) DO NOTHING
#         """,
#         (contest_id, user_id)
#     )


# def test_is_running_for(cur, contest_id, user_id):
#     """
#     (found, running) deta hai. Running = test ka time chal raha hai
#     aur student ka attempt in_progress hai.
#     """

#     cur.execute(
#         """
#         SELECT start_time <= NOW(), end_time > NOW()
#         FROM Contests
#         WHERE contest_id = %s
#         """,
#         (contest_id,)
#     )
#     timing = cur.fetchone()

#     if not timing:
#         return False, False

#     cur.execute(
#         """
#         SELECT status
#         FROM ContestAttempts
#         WHERE contest_id = %s AND user_id = %s
#         """,
#         (contest_id, user_id)
#     )
#     attempt = cur.fetchone()

#     running = bool(
#         timing[0] and timing[1] and attempt and attempt[0] == "in_progress"
#     )

#     return True, running


# def teacher_owns_contest(cur, contest_id, teacher_id):
#     cur.execute(
#         """
#         SELECT 1 FROM Contests
#         WHERE contest_id = %s AND created_by = %s
#         """,
#         (contest_id, teacher_id)
#     )

#     return cur.fetchone() is not None


# def attempt_status(cur, contest_id, user_id):
#     """Student ke attempt ka status (ya None agar attempt hi nahi)."""

#     cur.execute(
#         """
#         SELECT status
#         FROM ContestAttempts
#         WHERE contest_id = %s AND user_id = %s
#         """,
#         (contest_id, user_id)
#     )
#     row = cur.fetchone()

#     return row[0] if row else None


# # ---------------------------------------------------------
# # TEACHER ACTIONS (incident_routes bhi yahi use karta hai)
# # ---------------------------------------------------------

# def freeze_session(cur, contest_id, user_id, reason):
#     """
#     Student ka test freeze karo. True agar ab freeze hua,
#     False agar pehle se frozen / ended tha.
#     """

#     ensure_session(cur, contest_id, user_id)

#     cur.execute(
#         """
#         UPDATE TestSessions
#         SET status = 'frozen',
#             frozen_at = NOW(),
#             freeze_reason = %s
#         WHERE contest_id = %s
#           AND user_id = %s
#           AND status = 'active'
#           AND cheat_submitted = FALSE
#         RETURNING session_id
#         """,
#         (reason, contest_id, user_id)
#     )

#     return cur.fetchone() is not None


# def end_attempt(cur, contest_id, user_id, reason):
#     """
#     Teacher ne test end kiya: attempt server par hi submit ho jata hai
#     aur student ke browser ko "ended" flag milta hai.
#     True agar attempt ab band hua.
#     """

#     cur.execute(
#         """
#         UPDATE ContestAttempts
#         SET status = 'auto_submitted', submitted_at = NOW()
#         WHERE contest_id = %s
#           AND user_id = %s
#           AND status = 'in_progress'
#         """,
#         (contest_id, user_id)
#     )
#     ended_now = cur.rowcount > 0

#     ensure_session(cur, contest_id, user_id)

#     cur.execute(
#         """
#         UPDATE TestSessions
#         SET status = 'active',
#             frozen_at = NULL,
#             cheat_submitted = TRUE,
#             freeze_reason = %s
#         WHERE contest_id = %s AND user_id = %s
#         """,
#         (reason, contest_id, user_id)
#     )

#     return ended_now


# def with_note(reason, note):
#     note = (note or "").strip()[:300]
#     return f"{reason} Note: {note}" if note else reason


# # ---------------------------------------------------------
# # FREEZE CHECKS (dusri route files yahan se import karti hain)
# # ---------------------------------------------------------

# def is_frozen(cur, contest_id, user_id):
#     """Already khule cursor ke saath check."""

#     cur.execute(
#         """
#         SELECT 1
#         FROM TestSessions
#         WHERE contest_id = %s
#           AND user_id = %s
#           AND status = 'frozen'
#         """,
#         (contest_id, user_id)
#     )

#     return cur.fetchone() is not None


# def _frozen_lookup(query, params):
#     """
#     Apna connection khol ke check karta hai.
#     Error aaye (jaise table abhi bani nahi) to False deta hai,
#     taaki baaki app na tute.
#     """

#     conn = cur = None

#     try:
#         conn = get_connection()
#         cur = conn.cursor()
#         cur.execute(query, params)
#         return cur.fetchone() is not None

#     except Exception as exc:
#         print("FROZEN CHECK ERROR:", exc)
#         return False

#     finally:
#         close_db(cur, conn)


# def is_user_frozen_for_contest(user_id, contest_id):
#     return _frozen_lookup(
#         """
#         SELECT 1
#         FROM TestSessions
#         WHERE contest_id = %s
#           AND user_id = %s
#           AND status = 'frozen'
#         """,
#         (contest_id, user_id)
#     )


# def is_user_frozen_for_problem(user_id, problem_id):
#     return _frozen_lookup(
#         """
#         SELECT 1
#         FROM TestSessions ts
#         JOIN Problems p ON p.contest_id = ts.contest_id
#         WHERE p.problem_id = %s
#           AND ts.user_id = %s
#           AND ts.status = 'frozen'
#         """,
#         (problem_id, user_id)
#     )


# # ---------------------------------------------------------
# # TAB SWITCH
# # ---------------------------------------------------------

# def register_tab_switch(cur, conn, contest_id, user_id, reason_code):
#     """
#     Ek tab switch count karta hai.
#     tabs > MAX_TAB_SWITCHES (yaani 7th switch) par test freeze.
#     Kabhi auto-submit nahi.
#     """

#     ensure_session(cur, contest_id, user_id)

#     # Row lock, taaki do events ek saath aaye to count double na ho
#     cur.execute(
#         """
#         SELECT
#             session_id,
#             status,
#             tab_switch_count,
#             freeze_reason,
#             gaze_warning_count,
#             cheat_submitted,
#             (
#                 last_switch_at IS NOT NULL
#                 AND last_switch_at > NOW() - (%s * INTERVAL '1 second')
#             )
#         FROM TestSessions
#         WHERE contest_id = %s AND user_id = %s
#         FOR UPDATE
#         """,
#         (SWITCH_DEBOUNCE_SECONDS, contest_id, user_id)
#     )
#     session_id, status, tabs, reason, gaze, ended, recent = cur.fetchone()

#     # Pehle se ended / frozen ya abhi-abhi count hua => kuch nahi badalna
#     if ended or status == "frozen" or recent:
#         conn.commit()
#         return build_state(
#             status, tabs, reason, gaze=gaze, auto_submit=bool(ended)
#         )

#     tabs += 1
#     new_status = status

#     if tabs > MAX_TAB_SWITCHES:
#         reason = (
#             f"You switched tabs {tabs} times "
#             f"(only {MAX_TAB_SWITCHES} are allowed). "
#             f"Your teacher must unlock your test."
#         )
#         new_status = "frozen"

#         cur.execute(
#             """
#             UPDATE TestSessions
#             SET tab_switch_count = %s,
#                 last_switch_at = NOW(),
#                 status = 'frozen',
#                 frozen_at = NOW(),
#                 freeze_reason = %s
#             WHERE session_id = %s
#             """,
#             (tabs, reason, session_id)
#         )

#         log_event(cur, user_id, contest_id, f"tab_switch:{reason_code}")
#         log_event(cur, user_id, contest_id, "test_frozen")

#     else:
#         cur.execute(
#             """
#             UPDATE TestSessions
#             SET tab_switch_count = %s,
#                 last_switch_at = NOW()
#             WHERE session_id = %s
#             """,
#             (tabs, session_id)
#         )

#         log_event(cur, user_id, contest_id, f"tab_switch:{reason_code}")

#     conn.commit()

#     return build_state(
#         new_status, tabs, reason, counted=True, gaze=gaze
#     )


# # ---------------------------------------------------------
# # CAMERA / EYE ALERT (sirf teacher ko dikhta hai)
# # ---------------------------------------------------------

# def register_gaze_event(cur, conn, contest_id, user_id, event_type,
#                         duration_ms=0):
#     """
#     Camera alert save karta hai. Student ko koi warning nahi,
#     test freeze / submit nahi hota. Teacher ko dikhta hai.
#     """

#     ensure_session(cur, contest_id, user_id)

#     cur.execute(
#         """
#         SELECT
#             session_id,
#             status,
#             tab_switch_count,
#             freeze_reason,
#             gaze_warning_count,
#             cheat_submitted,
#             (
#                 last_gaze_at IS NOT NULL
#                 AND last_gaze_at > NOW() - (%s * INTERVAL '1 second')
#             )
#         FROM TestSessions
#         WHERE contest_id = %s AND user_id = %s
#         FOR UPDATE
#         """,
#         (GAZE_DEBOUNCE_SECONDS, contest_id, user_id)
#     )
#     session_id, status, tabs, reason, gaze, ended, recent = cur.fetchone()

#     if ended or status == "frozen" or recent:
#         conn.commit()
#         return build_state(
#             status, tabs, reason, gaze=gaze, auto_submit=bool(ended)
#         )

#     cur.execute(
#         """
#         INSERT INTO GazeEvents
#             (contest_id, user_id, event_type, duration_ms)
#         VALUES (%s, %s, %s, %s)
#         """,
#         (contest_id, user_id, event_type, duration_ms)
#     )

#     gaze += 1

#     cur.execute(
#         """
#         UPDATE TestSessions
#         SET gaze_warning_count = %s,
#             last_gaze_at = NOW()
#         WHERE session_id = %s
#         """,
#         (gaze, session_id)
#     )

#     log_event(cur, user_id, contest_id, f"gaze:{event_type}")

#     conn.commit()

#     return build_state(status, tabs, reason, gaze=gaze)


# # ---------------------------------------------------------
# # STUDENT: REPORT A TAB SWITCH
# # ---------------------------------------------------------

# @proctoring_bp.route("/tests/<int:contest_id>/tab-switch", methods=["POST"])
# @require_role("student")
# def report_tab_switch(contest_id):
#     conn = cur = None

#     user_id = request.user["user_id"]
#     data = request.get_json(silent=True) or {}
#     reason = str(data.get("reason") or "tab_hidden")[:30]

#     try:
#         conn = get_connection()
#         cur = conn.cursor()

#         found, running = test_is_running_for(cur, contest_id, user_id)

#         if not found:
#             return jsonify({"error": "Test not found"}), 404

#         # Test chal nahi raha / submit ho chuka => count nahi hota
#         if not running:
#             return jsonify(read_state(cur, contest_id, user_id)), 200

#         state = register_tab_switch(
#             cur, conn, contest_id, user_id, reason
#         )

#         return jsonify(state), 200

#     except Exception:
#         if conn:
#             conn.rollback()
#         traceback.print_exc()
#         return jsonify({
#             "error": "Could not record tab switch. Check the backend terminal."
#         }), 500

#     finally:
#         close_db(cur, conn)


# # ---------------------------------------------------------
# # STUDENT: REPORT A CAMERA ALERT
# # ---------------------------------------------------------

# @proctoring_bp.route("/tests/<int:contest_id>/gaze-event", methods=["POST"])
# @require_role("student")
# def report_gaze_event(contest_id):
#     conn = cur = None

#     user_id = request.user["user_id"]
#     data = request.get_json(silent=True) or {}

#     event_type = str(data.get("event_type") or "").upper()

#     if event_type not in GAZE_EVENT_TYPES:
#         return jsonify({"error": "Invalid event type"}), 400

#     try:
#         duration_ms = int(data.get("duration_ms") or 0)
#     except (TypeError, ValueError):
#         duration_ms = 0

#     duration_ms = max(0, min(duration_ms, 3_600_000))

#     try:
#         conn = get_connection()
#         cur = conn.cursor()

#         found, running = test_is_running_for(cur, contest_id, user_id)

#         if not found:
#             return jsonify({"error": "Test not found"}), 404

#         if not running:
#             return jsonify(read_state(cur, contest_id, user_id)), 200

#         state = register_gaze_event(
#             cur, conn, contest_id, user_id, event_type, duration_ms
#         )

#         return jsonify(state), 200

#     except Exception:
#         if conn:
#             conn.rollback()
#         traceback.print_exc()
#         return jsonify({
#             "error": "Could not record the event. Check the backend terminal."
#         }), 500

#     finally:
#         close_db(cur, conn)


# # ---------------------------------------------------------
# # STUDENT: KAUNSE TESTS SUBMIT / BAND HO CHUKE HAIN
# # ---------------------------------------------------------

# @proctoring_bp.route("/student/attempts", methods=["GET"])
# @require_role("student")
# def my_finished_tests():
#     """
#     Un tests ki contest_id jo ab student dobara nahi de sakta:
#       - attempt in_progress nahi hai (submitted / auto_submitted)
#       - ya teacher ne test end kar diya hai
#     """

#     conn = cur = None
#     user_id = request.user["user_id"]

#     try:
#         conn = get_connection()
#         cur = conn.cursor()

#         cur.execute(
#             """
#             SELECT contest_id
#             FROM ContestAttempts
#             WHERE user_id = %s AND status <> 'in_progress'

#             UNION

#             SELECT contest_id
#             FROM TestSessions
#             WHERE user_id = %s AND cheat_submitted = TRUE
#             """,
#             (user_id, user_id)
#         )

#         return jsonify({
#             "submitted_contest_ids": sorted(r[0] for r in cur.fetchall())
#         }), 200

#     except Exception:
#         traceback.print_exc()
#         return jsonify({
#             "error": "Could not load attempts. Check the backend terminal."
#         }), 500

#     finally:
#         close_db(cur, conn)


# # ---------------------------------------------------------
# # STUDENT: CURRENT SESSION STATUS
# # ---------------------------------------------------------

# @proctoring_bp.route("/tests/<int:contest_id>/session", methods=["GET"])
# @require_role("student")
# def my_session(contest_id):
#     conn = cur = None

#     try:
#         conn = get_connection()
#         cur = conn.cursor()

#         return jsonify(
#             read_state(cur, contest_id, request.user["user_id"])
#         ), 200

#     except Exception:
#         traceback.print_exc()
#         return jsonify({
#             "error": "Could not load session. Check the backend terminal."
#         }), 500

#     finally:
#         close_db(cur, conn)


# # ---------------------------------------------------------
# # TEACHER: LIST SESSIONS
# # ---------------------------------------------------------

# @proctoring_bp.route(
#     "/teacher/tests/<int:contest_id>/proctoring",
#     methods=["GET"]
# )
# @require_role("teacher")
# def teacher_proctoring(contest_id):
#     conn = cur = None

#     try:
#         conn = get_connection()
#         cur = conn.cursor()

#         if not teacher_owns_contest(
#             cur, contest_id, request.user["user_id"]
#         ):
#             return jsonify({
#                 "error": "Test not found or access denied"
#             }), 404

#         cur.execute(
#             """
#             SELECT
#                 u.user_id,
#                 u.username,
#                 ts.status,
#                 ts.tab_switch_count,
#                 ts.frozen_at,
#                 ts.freeze_reason,
#                 ts.unlock_count,
#                 ts.unlocked_at,
#                 ca.status,
#                 ts.gaze_warning_count,
#                 ts.last_gaze_at,
#                 ts.cheat_submitted
#             FROM TestSessions ts
#             JOIN Users u ON u.user_id = ts.user_id
#             LEFT JOIN ContestAttempts ca
#                 ON ca.contest_id = ts.contest_id
#                AND ca.user_id = ts.user_id
#             WHERE ts.contest_id = %s
#             ORDER BY
#                 (ts.status = 'frozen') DESC,
#                 ts.gaze_warning_count DESC,
#                 ts.tab_switch_count DESC,
#                 u.username
#             """,
#             (contest_id,)
#         )

#         sessions = []

#         for r in cur.fetchall():
#             ended = bool(r[11])
#             frozen = (r[2] == "frozen") and not ended
#             attempt_done = r[8] is not None and r[8] != "in_progress"

#             sessions.append({
#                 "user_id": r[0],
#                 "username": r[1],
#                 "status": r[2],
#                 "tab_switch_count": r[3],
#                 "frozen_at": to_iso(r[4]),
#                 "freeze_reason": r[5] or "",
#                 "unlock_count": r[6],
#                 "unlocked_at": to_iso(r[7]),
#                 "attempt_status": r[8],
#                 "gaze_warning_count": r[9],
#                 "last_gaze_at": to_iso(r[10]),
#                 "ended": ended,
#                 "frozen": frozen,
#                 "needs_attention": (
#                     not ended
#                     and not frozen
#                     and not attempt_done
#                     and (r[9] or 0) >= GAZE_ALERT_AT
#                 ),
#                 "gaze_breakdown": {}
#             })

#         # Har student ke camera alerts type ke hisaab se
#         cur.execute(
#             """
#             SELECT user_id, event_type, COUNT(*)
#             FROM GazeEvents
#             WHERE contest_id = %s
#             GROUP BY user_id, event_type
#             """,
#             (contest_id,)
#         )

#         by_user = {}

#         for user_id, event_type, total in cur.fetchall():
#             by_user.setdefault(user_id, {})[event_type] = total

#         for session in sessions:
#             session["gaze_breakdown"] = by_user.get(session["user_id"], {})

#         # Teacher ke decision ka intezaar kar rahe photo incidents
#         pending_incidents = 0

#         cur.execute("SAVEPOINT pending_sp")

#         try:
#             cur.execute(
#                 """
#                 SELECT COUNT(*) FROM ProctorIncidents
#                 WHERE contest_id = %s AND status = 'pending'
#                 """,
#                 (contest_id,)
#             )
#             pending_incidents = cur.fetchone()[0]
#             cur.execute("RELEASE SAVEPOINT pending_sp")
#         except Exception:
#             cur.execute("ROLLBACK TO SAVEPOINT pending_sp")

#         return jsonify({
#             "contest_id": contest_id,
#             "pending_incidents": pending_incidents,
#             "max_switches": MAX_TAB_SWITCHES,
#             "gaze_alert_at": GAZE_ALERT_AT,
#             "frozen_count": sum(1 for s in sessions if s["frozen"]),
#             "alert_count": sum(1 for s in sessions if s["needs_attention"]),
#             "sessions": sessions
#         }), 200

#     except Exception:
#         traceback.print_exc()
#         return jsonify({
#             "error": "Could not load proctoring data. Check the backend terminal."
#         }), 500

#     finally:
#         close_db(cur, conn)


# # ---------------------------------------------------------
# # TEACHER: UNLOCK A STUDENT
# # ---------------------------------------------------------

# @proctoring_bp.route(
#     "/teacher/tests/<int:contest_id>/sessions/<int:student_id>/unlock",
#     methods=["POST"]
# )
# @require_role("teacher")
# def unlock_student(contest_id, student_id):
#     conn = cur = None
#     teacher_id = request.user["user_id"]

#     try:
#         conn = get_connection()
#         cur = conn.cursor()

#         if not teacher_owns_contest(cur, contest_id, teacher_id):
#             return jsonify({
#                 "error": "Test not found or access denied"
#             }), 404

#         cur.execute(
#             """
#             UPDATE TestSessions
#             SET status = 'active',
#                 tab_switch_count = 0,
#                 gaze_warning_count = 0,
#                 last_switch_at = NULL,
#                 last_gaze_at = NULL,
#                 frozen_at = NULL,
#                 freeze_reason = NULL,
#                 unlock_count = unlock_count + 1,
#                 unlocked_by = %s,
#                 unlocked_at = NOW()
#             WHERE contest_id = %s
#               AND user_id = %s
#               AND status = 'frozen'
#               AND cheat_submitted = FALSE
#             RETURNING session_id
#             """,
#             (teacher_id, contest_id, student_id)
#         )

#         if not cur.fetchone():
#             conn.rollback()
#             return jsonify({
#                 "error": "This student's test is not frozen"
#             }), 409

#         log_event(cur, student_id, contest_id, "test_unlocked")

#         # Pending incident ho to use bhi "allowed" mark karo
#         cur.execute("SAVEPOINT incidents_sp")

#         try:
#             cur.execute(
#                 """
#                 UPDATE ProctorIncidents
#                 SET status = 'allowed', decided_by = %s, decided_at = NOW()
#                 WHERE contest_id = %s
#                   AND user_id = %s
#                   AND status = 'pending'
#                 """,
#                 (teacher_id, contest_id, student_id)
#             )
#             cur.execute("RELEASE SAVEPOINT incidents_sp")
#         except Exception:
#             cur.execute("ROLLBACK TO SAVEPOINT incidents_sp")

#         conn.commit()

#         return jsonify({
#             "message": "Student unlocked. They can continue the test."
#         }), 200

#     except Exception:
#         if conn:
#             conn.rollback()
#         traceback.print_exc()
#         return jsonify({
#             "error": "Could not unlock student. Check the backend terminal."
#         }), 500

#     finally:
#         close_db(cur, conn)


# # ---------------------------------------------------------
# # TEACHER: FREEZE A STUDENT'S TEST
# # ---------------------------------------------------------

# @proctoring_bp.route(
#     "/teacher/tests/<int:contest_id>/sessions/<int:student_id>/freeze",
#     methods=["POST"]
# )
# @require_role("teacher")
# def teacher_freeze_student(contest_id, student_id):
#     conn = cur = None
#     teacher_id = request.user["user_id"]

#     data = request.get_json(silent=True) or {}
#     reason = with_note(TEACHER_FREEZE_REASON, data.get("note"))

#     try:
#         conn = get_connection()
#         cur = conn.cursor()

#         if not teacher_owns_contest(cur, contest_id, teacher_id):
#             return jsonify({
#                 "error": "Test not found or access denied"
#             }), 404

#         status = attempt_status(cur, contest_id, student_id)

#         if status is None:
#             return jsonify({
#                 "error": "This student has not started the test"
#             }), 404

#         if status != "in_progress":
#             return jsonify({
#                 "error": "This student's test is already submitted"
#             }), 409

#         if not freeze_session(cur, contest_id, student_id, reason):
#             conn.rollback()
#             return jsonify({
#                 "error": "This student's test is already frozen or ended"
#             }), 409

#         log_event(cur, student_id, contest_id, "teacher_froze_test")

#         conn.commit()

#         return jsonify({
#             "message": "Student's test is frozen. Unlock it or end it after review."
#         }), 200

#     except Exception:
#         if conn:
#             conn.rollback()
#         traceback.print_exc()
#         return jsonify({
#             "error": "Could not freeze the test. Check the backend terminal."
#         }), 500

#     finally:
#         close_db(cur, conn)


# # ---------------------------------------------------------
# # TEACHER: END A STUDENT'S TEST
# # ---------------------------------------------------------

# @proctoring_bp.route(
#     "/teacher/tests/<int:contest_id>/sessions/<int:student_id>/end",
#     methods=["POST"]
# )
# @require_role("teacher")
# def teacher_end_student_test(contest_id, student_id):
#     conn = cur = None
#     teacher_id = request.user["user_id"]

#     data = request.get_json(silent=True) or {}
#     reason = with_note(TEACHER_END_REASON, data.get("note"))

#     try:
#         conn = get_connection()
#         cur = conn.cursor()

#         if not teacher_owns_contest(cur, contest_id, teacher_id):
#             return jsonify({
#                 "error": "Test not found or access denied"
#             }), 404

#         status = attempt_status(cur, contest_id, student_id)

#         if status is None:
#             return jsonify({
#                 "error": "This student has not started the test"
#             }), 404

#         if status != "in_progress":
#             return jsonify({
#                 "error": "This student's test is already submitted"
#             }), 409

#         end_attempt(cur, contest_id, student_id, reason)

#         # Pending incident ho to use "rejected" mark karo
#         cur.execute("SAVEPOINT end_incidents_sp")

#         try:
#             cur.execute(
#                 """
#                 UPDATE ProctorIncidents
#                 SET status = 'rejected', decided_by = %s, decided_at = NOW()
#                 WHERE contest_id = %s
#                   AND user_id = %s
#                   AND status = 'pending'
#                 """,
#                 (teacher_id, contest_id, student_id)
#             )
#             cur.execute("RELEASE SAVEPOINT end_incidents_sp")
#         except Exception:
#             cur.execute("ROLLBACK TO SAVEPOINT end_incidents_sp")

#         log_event(cur, student_id, contest_id, "teacher_ended_test")

#         conn.commit()

#         return jsonify({
#             "message": "Student's test has been ended and submitted."
#         }), 200

#     except Exception:
#         if conn:
#             conn.rollback()
#         traceback.print_exc()
#         return jsonify({
#             "error": "Could not end the test. Check the backend terminal."
#         }), 500

#     finally:
#         close_db(cur, conn)


# # ---------------------------------------------------------
# # TEACHER: CLEAR CAMERA ALERTS (false alarm)
# # ---------------------------------------------------------

# @proctoring_bp.route(
#     "/teacher/tests/<int:contest_id>/sessions/<int:student_id>/clear-alerts",
#     methods=["POST"]
# )
# @require_role("teacher")
# def teacher_clear_alerts(contest_id, student_id):
#     conn = cur = None
#     teacher_id = request.user["user_id"]

#     try:
#         conn = get_connection()
#         cur = conn.cursor()

#         if not teacher_owns_contest(cur, contest_id, teacher_id):
#             return jsonify({
#                 "error": "Test not found or access denied"
#             }), 404

#         cur.execute(
#             """
#             UPDATE TestSessions
#             SET gaze_warning_count = 0,
#                 last_gaze_at = NULL
#             WHERE contest_id = %s AND user_id = %s
#             RETURNING session_id
#             """,
#             (contest_id, student_id)
#         )

#         if not cur.fetchone():
#             conn.rollback()
#             return jsonify({"error": "Student session not found"}), 404

#         log_event(cur, student_id, contest_id, "alerts_cleared")

#         conn.commit()

#         return jsonify({"message": "Alerts cleared."}), 200

#     except Exception:
#         if conn:
#             conn.rollback()
#         traceback.print_exc()
#         return jsonify({
#             "error": "Could not clear alerts. Check the backend terminal."
#         }), 500

#     finally:
#         close_db(cur, conn)


"""
CodeShield Proctoring API (tab-switch + camera alerts + teacher control).

Rules (light version):
    - Auto-submit SIRF timer khatam hone par hota hai. Proctoring kabhi
      test ko apne aap submit nahi karti.
    - Tab switch: MAX_TAB_SWITCHES (6) tak allowed. 7th switch par test
      FREEZE ho jata hai; sirf teacher unlock kar sakta hai.
    - Camera / eye alerts (face nahi dikha, kai faces, nazar hati, camera
      band): student ko kuch nahi dikhta, sirf teacher ko alert jata hai.
      Teacher decide karta hai: Freeze test ya End test.

Student:
    POST /api/tests/<contest_id>/tab-switch
    POST /api/tests/<contest_id>/gaze-event
    GET  /api/tests/<contest_id>/session
    GET  /api/student/attempts

Teacher:
    GET  /api/teacher/tests/<contest_id>/proctoring
    POST /api/teacher/tests/<contest_id>/sessions/<user_id>/unlock
    POST /api/teacher/tests/<contest_id>/sessions/<user_id>/freeze
    POST /api/teacher/tests/<contest_id>/sessions/<user_id>/end
    POST /api/teacher/tests/<contest_id>/sessions/<user_id>/clear-alerts

Count server par rakha jata hai, isliye student browser se bypass nahi kar sakta.
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


# 6 tab switch tak allowed. 7th switch par freeze.
MAX_TAB_SWITCHES = 6

# Itne camera alerts ke baad student teacher ke "needs attention" mein aata hai
GAZE_ALERT_AT = 3

# Ek hi tab switch par visibilitychange + blur dono fire hote hain;
# 2 second ke andar ke events ek hi switch maane jate hain.
SWITCH_DEBOUNCE_SECONDS = 2

# Camera alerts ke beech kam se kam itna gap (teacher ko spam na ho)
GAZE_DEBOUNCE_SECONDS = 10

GAZE_EVENT_TYPES = (
    "NO_FACE",
    "MULTI_FACE",
    "LOOK_AWAY",
    "CAMERA_OFF",
    "FACE_MISMATCH"
)

FROZEN_MESSAGE = "Your test is frozen. Ask your teacher to unlock it."

TEACHER_FREEZE_REASON = (
    "Your teacher froze your test to review suspicious activity. "
    "Please wait for your teacher."
)

TEACHER_END_REASON = (
    "Your test was ended by your teacher after reviewing suspicious activity."
)

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


def build_state(status, count, reason, counted=False, gaze=0,
                auto_submit=False):
    """
    Student ko jaane wala session state.
    auto_submit / ended = True matlab teacher ne test end kar diya.
    """

    count = int(count or 0)
    gaze = int(gaze or 0)

    return {
        "status": status,
        "frozen": status == "frozen",
        "tab_switch_count": count,
        "max_switches": MAX_TAB_SWITCHES,
        "remaining": max(0, MAX_TAB_SWITCHES - count),
        "gaze_warning_count": gaze,
        "ended": bool(auto_submit),
        "auto_submit": bool(auto_submit),
        "freeze_reason": reason or "",
        "counted": counted
    }


def read_state(cur, contest_id, user_id):
    cur.execute(
        """
        SELECT status, tab_switch_count, freeze_reason,
               gaze_warning_count, cheat_submitted
        FROM TestSessions
        WHERE contest_id = %s AND user_id = %s
        """,
        (contest_id, user_id)
    )
    row = cur.fetchone()

    if not row:
        return build_state("active", 0, "")

    return build_state(
        row[0], row[1], row[2], gaze=row[3], auto_submit=row[4]
    )


def log_event(cur, user_id, contest_id, event_type):
    cur.execute(
        """
        INSERT INTO ActivityLog (user_id, contest_id, event_type)
        VALUES (%s, %s, %s)
        """,
        (user_id, contest_id, event_type[:50])
    )


def ensure_session(cur, contest_id, user_id):
    cur.execute(
        """
        INSERT INTO TestSessions (contest_id, user_id)
        VALUES (%s, %s)
        ON CONFLICT (contest_id, user_id) DO NOTHING
        """,
        (contest_id, user_id)
    )


def test_is_running_for(cur, contest_id, user_id):
    """
    (found, running) deta hai. Running = test ka time chal raha hai
    aur student ka attempt in_progress hai.
    """

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
        return False, False

    cur.execute(
        """
        SELECT status
        FROM ContestAttempts
        WHERE contest_id = %s AND user_id = %s
        """,
        (contest_id, user_id)
    )
    attempt = cur.fetchone()

    running = bool(
        timing[0] and timing[1] and attempt and attempt[0] == "in_progress"
    )

    return True, running


def teacher_owns_contest(cur, contest_id, teacher_id):
    cur.execute(
        """
        SELECT 1 FROM Contests
        WHERE contest_id = %s AND created_by = %s
        """,
        (contest_id, teacher_id)
    )

    return cur.fetchone() is not None


def attempt_status(cur, contest_id, user_id):
    """Student ke attempt ka status (ya None agar attempt hi nahi)."""

    cur.execute(
        """
        SELECT status
        FROM ContestAttempts
        WHERE contest_id = %s AND user_id = %s
        """,
        (contest_id, user_id)
    )
    row = cur.fetchone()

    return row[0] if row else None


# ---------------------------------------------------------
# TEACHER ACTIONS (incident_routes bhi yahi use karta hai)
# ---------------------------------------------------------

def freeze_session(cur, contest_id, user_id, reason):
    """
    Student ka test freeze karo. True agar ab freeze hua,
    False agar pehle se frozen / ended tha.
    """

    ensure_session(cur, contest_id, user_id)

    cur.execute(
        """
        UPDATE TestSessions
        SET status = 'frozen',
            frozen_at = NOW(),
            freeze_reason = %s
        WHERE contest_id = %s
          AND user_id = %s
          AND status = 'active'
          AND cheat_submitted = FALSE
        RETURNING session_id
        """,
        (reason, contest_id, user_id)
    )

    return cur.fetchone() is not None


def end_attempt(cur, contest_id, user_id, reason):
    """
    Teacher ne test end kiya: attempt server par hi submit ho jata hai
    aur student ke browser ko "ended" flag milta hai.
    True agar attempt ab band hua.
    """

    cur.execute(
        """
        UPDATE ContestAttempts
        SET status = 'auto_submitted', submitted_at = NOW()
        WHERE contest_id = %s
          AND user_id = %s
          AND status = 'in_progress'
        """,
        (contest_id, user_id)
    )
    ended_now = cur.rowcount > 0

    ensure_session(cur, contest_id, user_id)

    cur.execute(
        """
        UPDATE TestSessions
        SET status = 'active',
            frozen_at = NULL,
            cheat_submitted = TRUE,
            freeze_reason = %s
        WHERE contest_id = %s AND user_id = %s
        """,
        (reason, contest_id, user_id)
    )

    return ended_now


def with_note(reason, note):
    note = (note or "").strip()[:300]
    return f"{reason} Note: {note}" if note else reason


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
# TAB SWITCH
# ---------------------------------------------------------

def add_tab_switch_incident(cur, contest_id, user_id):
    """
    Tab switch teacher ke Incidents tab mein bhi dikhe.
    Ek student ka ek hi pending TAB_SWITCH incident rehta hai
    (card par count update hota rehta hai), jab tak teacher faisla na le.
    Savepoint ki wajah se yahan koi error aaye to tab-switch count nahi tutta.
    """

    cur.execute("SAVEPOINT tab_incident_sp")

    try:
        cur.execute(
            """
            SELECT 1
            FROM ProctorIncidents
            WHERE contest_id = %s
              AND user_id = %s
              AND kind = 'TAB_SWITCH'
              AND status = 'pending'
            """,
            (contest_id, user_id)
        )

        if not cur.fetchone():
            cur.execute(
                """
                INSERT INTO ProctorIncidents
                    (contest_id, user_id, kind, photo)
                VALUES (%s, %s, 'TAB_SWITCH', NULL)
                """,
                (contest_id, user_id)
            )

        cur.execute("RELEASE SAVEPOINT tab_incident_sp")

    except Exception:
        traceback.print_exc()
        cur.execute("ROLLBACK TO SAVEPOINT tab_incident_sp")


def register_tab_switch(cur, conn, contest_id, user_id, reason_code):
    """
    Ek tab switch count karta hai.
    tabs > MAX_TAB_SWITCHES (yaani 7th switch) par test freeze.
    Kabhi auto-submit nahi.
    """

    ensure_session(cur, contest_id, user_id)

    # Row lock, taaki do events ek saath aaye to count double na ho
    cur.execute(
        """
        SELECT
            session_id,
            status,
            tab_switch_count,
            freeze_reason,
            gaze_warning_count,
            cheat_submitted,
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
    session_id, status, tabs, reason, gaze, ended, recent = cur.fetchone()

    # Pehle se ended / frozen ya abhi-abhi count hua => kuch nahi badalna
    if ended or status == "frozen" or recent:
        conn.commit()
        return build_state(
            status, tabs, reason, gaze=gaze, auto_submit=bool(ended)
        )

    tabs += 1
    new_status = status

    if tabs > MAX_TAB_SWITCHES:
        reason = (
            f"You switched tabs {tabs} times "
            f"(only {MAX_TAB_SWITCHES} are allowed). "
            f"Your teacher must unlock your test."
        )
        new_status = "frozen"

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
            (tabs, reason, session_id)
        )

        log_event(cur, user_id, contest_id, f"tab_switch:{reason_code}")
        log_event(cur, user_id, contest_id, "test_frozen")

    else:
        cur.execute(
            """
            UPDATE TestSessions
            SET tab_switch_count = %s,
                last_switch_at = NOW()
            WHERE session_id = %s
            """,
            (tabs, session_id)
        )

        log_event(cur, user_id, contest_id, f"tab_switch:{reason_code}")

    # Teacher ke Incidents tab mein bhi alert
    add_tab_switch_incident(cur, contest_id, user_id)

    conn.commit()

    return build_state(
        new_status, tabs, reason, counted=True, gaze=gaze
    )


# ---------------------------------------------------------
# CAMERA / EYE ALERT (sirf teacher ko dikhta hai)
# ---------------------------------------------------------

def register_gaze_event(cur, conn, contest_id, user_id, event_type,
                        duration_ms=0):
    """
    Camera alert save karta hai. Student ko koi warning nahi,
    test freeze / submit nahi hota. Teacher ko dikhta hai.
    """

    ensure_session(cur, contest_id, user_id)

    cur.execute(
        """
        SELECT
            session_id,
            status,
            tab_switch_count,
            freeze_reason,
            gaze_warning_count,
            cheat_submitted,
            (
                last_gaze_at IS NOT NULL
                AND last_gaze_at > NOW() - (%s * INTERVAL '1 second')
            )
        FROM TestSessions
        WHERE contest_id = %s AND user_id = %s
        FOR UPDATE
        """,
        (GAZE_DEBOUNCE_SECONDS, contest_id, user_id)
    )
    session_id, status, tabs, reason, gaze, ended, recent = cur.fetchone()

    if ended or status == "frozen" or recent:
        conn.commit()
        return build_state(
            status, tabs, reason, gaze=gaze, auto_submit=bool(ended)
        )

    cur.execute(
        """
        INSERT INTO GazeEvents
            (contest_id, user_id, event_type, duration_ms)
        VALUES (%s, %s, %s, %s)
        """,
        (contest_id, user_id, event_type, duration_ms)
    )

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

    log_event(cur, user_id, contest_id, f"gaze:{event_type}")

    conn.commit()

    return build_state(status, tabs, reason, gaze=gaze)


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

        found, running = test_is_running_for(cur, contest_id, user_id)

        if not found:
            return jsonify({"error": "Test not found"}), 404

        # Test chal nahi raha / submit ho chuka => count nahi hota
        if not running:
            return jsonify(read_state(cur, contest_id, user_id)), 200

        state = register_tab_switch(
            cur, conn, contest_id, user_id, reason
        )

        return jsonify(state), 200

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
# STUDENT: REPORT A CAMERA ALERT
# ---------------------------------------------------------

@proctoring_bp.route("/tests/<int:contest_id>/gaze-event", methods=["POST"])
@require_role("student")
def report_gaze_event(contest_id):
    conn = cur = None

    user_id = request.user["user_id"]
    data = request.get_json(silent=True) or {}

    event_type = str(data.get("event_type") or "").upper()

    if event_type not in GAZE_EVENT_TYPES:
        return jsonify({"error": "Invalid event type"}), 400

    try:
        duration_ms = int(data.get("duration_ms") or 0)
    except (TypeError, ValueError):
        duration_ms = 0

    duration_ms = max(0, min(duration_ms, 3_600_000))

    try:
        conn = get_connection()
        cur = conn.cursor()

        found, running = test_is_running_for(cur, contest_id, user_id)

        if not found:
            return jsonify({"error": "Test not found"}), 404

        if not running:
            return jsonify(read_state(cur, contest_id, user_id)), 200

        state = register_gaze_event(
            cur, conn, contest_id, user_id, event_type, duration_ms
        )

        return jsonify(state), 200

    except Exception:
        if conn:
            conn.rollback()
        traceback.print_exc()
        return jsonify({
            "error": "Could not record the event. Check the backend terminal."
        }), 500

    finally:
        close_db(cur, conn)


# ---------------------------------------------------------
# STUDENT: KAUNSE TESTS SUBMIT / BAND HO CHUKE HAIN
# ---------------------------------------------------------

@proctoring_bp.route("/student/attempts", methods=["GET"])
@require_role("student")
def my_finished_tests():
    """
    Un tests ki contest_id jo ab student dobara nahi de sakta:
      - attempt in_progress nahi hai (submitted / auto_submitted)
      - ya teacher ne test end kar diya hai
    """

    conn = cur = None
    user_id = request.user["user_id"]

    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT contest_id
            FROM ContestAttempts
            WHERE user_id = %s AND status <> 'in_progress'

            UNION

            SELECT contest_id
            FROM TestSessions
            WHERE user_id = %s AND cheat_submitted = TRUE
            """,
            (user_id, user_id)
        )

        return jsonify({
            "submitted_contest_ids": sorted(r[0] for r in cur.fetchall())
        }), 200

    except Exception:
        traceback.print_exc()
        return jsonify({
            "error": "Could not load attempts. Check the backend terminal."
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

        if not teacher_owns_contest(
            cur, contest_id, request.user["user_id"]
        ):
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
                ca.status,
                ts.gaze_warning_count,
                ts.last_gaze_at,
                ts.cheat_submitted
            FROM TestSessions ts
            JOIN Users u ON u.user_id = ts.user_id
            LEFT JOIN ContestAttempts ca
                ON ca.contest_id = ts.contest_id
               AND ca.user_id = ts.user_id
            WHERE ts.contest_id = %s
            ORDER BY
                (ts.status = 'frozen') DESC,
                ts.gaze_warning_count DESC,
                ts.tab_switch_count DESC,
                u.username
            """,
            (contest_id,)
        )

        sessions = []

        for r in cur.fetchall():
            ended = bool(r[11])
            frozen = (r[2] == "frozen") and not ended
            attempt_done = r[8] is not None and r[8] != "in_progress"

            sessions.append({
                "user_id": r[0],
                "username": r[1],
                "status": r[2],
                "tab_switch_count": r[3],
                "frozen_at": to_iso(r[4]),
                "freeze_reason": r[5] or "",
                "unlock_count": r[6],
                "unlocked_at": to_iso(r[7]),
                "attempt_status": r[8],
                "gaze_warning_count": r[9],
                "last_gaze_at": to_iso(r[10]),
                "ended": ended,
                "frozen": frozen,
                "needs_attention": (
                    not ended
                    and not frozen
                    and not attempt_done
                    and (r[9] or 0) >= GAZE_ALERT_AT
                ),
                "gaze_breakdown": {}
            })

        # Har student ke camera alerts type ke hisaab se
        cur.execute(
            """
            SELECT user_id, event_type, COUNT(*)
            FROM GazeEvents
            WHERE contest_id = %s
            GROUP BY user_id, event_type
            """,
            (contest_id,)
        )

        by_user = {}

        for user_id, event_type, total in cur.fetchall():
            by_user.setdefault(user_id, {})[event_type] = total

        for session in sessions:
            session["gaze_breakdown"] = by_user.get(session["user_id"], {})

        # Teacher ke decision ka intezaar kar rahe photo incidents
        pending_incidents = 0

        cur.execute("SAVEPOINT pending_sp")

        try:
            cur.execute(
                """
                SELECT COUNT(*) FROM ProctorIncidents
                WHERE contest_id = %s AND status = 'pending'
                """,
                (contest_id,)
            )
            pending_incidents = cur.fetchone()[0]
            cur.execute("RELEASE SAVEPOINT pending_sp")
        except Exception:
            cur.execute("ROLLBACK TO SAVEPOINT pending_sp")

        return jsonify({
            "contest_id": contest_id,
            "pending_incidents": pending_incidents,
            "max_switches": MAX_TAB_SWITCHES,
            "gaze_alert_at": GAZE_ALERT_AT,
            "frozen_count": sum(1 for s in sessions if s["frozen"]),
            "alert_count": sum(1 for s in sessions if s["needs_attention"]),
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

        if not teacher_owns_contest(cur, contest_id, teacher_id):
            return jsonify({
                "error": "Test not found or access denied"
            }), 404

        cur.execute(
            """
            UPDATE TestSessions
            SET status = 'active',
                tab_switch_count = 0,
                gaze_warning_count = 0,
                last_switch_at = NULL,
                last_gaze_at = NULL,
                frozen_at = NULL,
                freeze_reason = NULL,
                unlock_count = unlock_count + 1,
                unlocked_by = %s,
                unlocked_at = NOW()
            WHERE contest_id = %s
              AND user_id = %s
              AND status = 'frozen'
              AND cheat_submitted = FALSE
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

        # Pending incident ho to use bhi "allowed" mark karo
        cur.execute("SAVEPOINT incidents_sp")

        try:
            cur.execute(
                """
                UPDATE ProctorIncidents
                SET status = 'allowed', decided_by = %s, decided_at = NOW()
                WHERE contest_id = %s
                  AND user_id = %s
                  AND status = 'pending'
                """,
                (teacher_id, contest_id, student_id)
            )
            cur.execute("RELEASE SAVEPOINT incidents_sp")
        except Exception:
            cur.execute("ROLLBACK TO SAVEPOINT incidents_sp")

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


# ---------------------------------------------------------
# TEACHER: FREEZE A STUDENT'S TEST
# ---------------------------------------------------------

@proctoring_bp.route(
    "/teacher/tests/<int:contest_id>/sessions/<int:student_id>/freeze",
    methods=["POST"]
)
@require_role("teacher")
def teacher_freeze_student(contest_id, student_id):
    conn = cur = None
    teacher_id = request.user["user_id"]

    data = request.get_json(silent=True) or {}
    reason = with_note(TEACHER_FREEZE_REASON, data.get("note"))

    try:
        conn = get_connection()
        cur = conn.cursor()

        if not teacher_owns_contest(cur, contest_id, teacher_id):
            return jsonify({
                "error": "Test not found or access denied"
            }), 404

        status = attempt_status(cur, contest_id, student_id)

        if status is None:
            return jsonify({
                "error": "This student has not started the test"
            }), 404

        if status != "in_progress":
            return jsonify({
                "error": "This student's test is already submitted"
            }), 409

        if not freeze_session(cur, contest_id, student_id, reason):
            conn.rollback()
            return jsonify({
                "error": "This student's test is already frozen or ended"
            }), 409

        log_event(cur, student_id, contest_id, "teacher_froze_test")

        conn.commit()

        return jsonify({
            "message": "Student's test is frozen. Unlock it or end it after review."
        }), 200

    except Exception:
        if conn:
            conn.rollback()
        traceback.print_exc()
        return jsonify({
            "error": "Could not freeze the test. Check the backend terminal."
        }), 500

    finally:
        close_db(cur, conn)


# ---------------------------------------------------------
# TEACHER: END A STUDENT'S TEST
# ---------------------------------------------------------

@proctoring_bp.route(
    "/teacher/tests/<int:contest_id>/sessions/<int:student_id>/end",
    methods=["POST"]
)
@require_role("teacher")
def teacher_end_student_test(contest_id, student_id):
    conn = cur = None
    teacher_id = request.user["user_id"]

    data = request.get_json(silent=True) or {}
    reason = with_note(TEACHER_END_REASON, data.get("note"))

    try:
        conn = get_connection()
        cur = conn.cursor()

        if not teacher_owns_contest(cur, contest_id, teacher_id):
            return jsonify({
                "error": "Test not found or access denied"
            }), 404

        status = attempt_status(cur, contest_id, student_id)

        if status is None:
            return jsonify({
                "error": "This student has not started the test"
            }), 404

        if status != "in_progress":
            return jsonify({
                "error": "This student's test is already submitted"
            }), 409

        end_attempt(cur, contest_id, student_id, reason)

        # Pending incident ho to use "rejected" mark karo
        cur.execute("SAVEPOINT end_incidents_sp")

        try:
            cur.execute(
                """
                UPDATE ProctorIncidents
                SET status = 'rejected', decided_by = %s, decided_at = NOW()
                WHERE contest_id = %s
                  AND user_id = %s
                  AND status = 'pending'
                """,
                (teacher_id, contest_id, student_id)
            )
            cur.execute("RELEASE SAVEPOINT end_incidents_sp")
        except Exception:
            cur.execute("ROLLBACK TO SAVEPOINT end_incidents_sp")

        log_event(cur, student_id, contest_id, "teacher_ended_test")

        conn.commit()

        return jsonify({
            "message": "Student's test has been ended and submitted."
        }), 200

    except Exception:
        if conn:
            conn.rollback()
        traceback.print_exc()
        return jsonify({
            "error": "Could not end the test. Check the backend terminal."
        }), 500

    finally:
        close_db(cur, conn)


# ---------------------------------------------------------
# TEACHER: CLEAR CAMERA ALERTS (false alarm)
# ---------------------------------------------------------

@proctoring_bp.route(
    "/teacher/tests/<int:contest_id>/sessions/<int:student_id>/clear-alerts",
    methods=["POST"]
)
@require_role("teacher")
def teacher_clear_alerts(contest_id, student_id):
    conn = cur = None
    teacher_id = request.user["user_id"]

    try:
        conn = get_connection()
        cur = conn.cursor()

        if not teacher_owns_contest(cur, contest_id, teacher_id):
            return jsonify({
                "error": "Test not found or access denied"
            }), 404

        cur.execute(
            """
            UPDATE TestSessions
            SET gaze_warning_count = 0,
                last_gaze_at = NULL
            WHERE contest_id = %s AND user_id = %s
            RETURNING session_id
            """,
            (contest_id, student_id)
        )

        if not cur.fetchone():
            conn.rollback()
            return jsonify({"error": "Student session not found"}), 404

        log_event(cur, student_id, contest_id, "alerts_cleared")

        conn.commit()

        return jsonify({"message": "Alerts cleared."}), 200

    except Exception:
        if conn:
            conn.rollback()
        traceback.print_exc()
        return jsonify({
            "error": "Could not clear alerts. Check the backend terminal."
        }), 500

    finally:
        close_db(cur, conn)