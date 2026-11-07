"""
CodeShield Identity (face verification) API.

Student:
    GET  /api/tests/<contest_id>/identity   -> mera status (enrolled / verified / blocked)
    POST /api/tests/<contest_id>/identity   -> face submit karo
         kind = "enroll"   pehli baar face register
         kind = "start"    test shuru hone par match (sirf EK baar, DB mein save)
         kind = "periodic" test ke dauran chupchap match

Teacher:
    GET  /api/teacher/tests/<contest_id>/identity
    POST /api/teacher/tests/<contest_id>/identity/<user_id>/approve
    POST /api/teacher/tests/<contest_id>/identity/<user_id>/reset-face

Matching SERVER par hoti hai: reference face student ke browser ko kabhi
nahi bheja jata. Browser sirf 128 numbers (signature) + chhota snapshot bhejta hai.

Naya behaviour:
  - Periodic check mein dusra insaan mile to ProctorIncidents mein
    FACE_MISMATCH incident photo ke saath banta hai (teacher ko alert).
  - Matched periodic checks ki photo save nahi hoti.
  - Teacher ko har student ki mismatch photos hamesha milti hain.
"""

import json
import math
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
    test_is_running_for
)
from incident_routes import record_incident


# Euclidean distance isse chhota ho to same insaan. Chhota = zyada sakht.
# 0.6 face-api ka default hai; 0.55 thoda sakht hai.
FACE_MATCH_THRESHOLD = 0.55

MAX_START_ATTEMPTS = 3
DESCRIPTOR_SIZE = 128

# Pehle 120_000 tha: badi photo chupchap reject ho jati thi
MAX_PHOTO_CHARS = 400_000

RECENT_CHECKS_PER_STUDENT = 5
MAX_MISMATCH_PHOTOS = 10

GATE_KINDS = ("enroll", "start", "override", "reset")

identity_bp = Blueprint(
    "identity",
    __name__,
    url_prefix="/api"
)


# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------

def clean_descriptor(raw):
    if not isinstance(raw, list) or len(raw) != DESCRIPTOR_SIZE:
        return None

    cleaned = []

    for value in raw:
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None

        if not math.isfinite(number) or abs(number) > 10:
            return None

        cleaned.append(number)

    return cleaned


def clean_photo(raw):
    if not isinstance(raw, str):
        return None

    if not raw.startswith("data:image/jpeg;base64,"):
        return None

    if len(raw) > MAX_PHOTO_CHARS:
        return None

    return raw


def distance(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def summarize(gate_rows):
    """
    gate_rows: (kind, matched) newest-first, sirf GATE_KINDS wale.
    Returns (verified, failed_attempts)
    """

    verified = bool(gate_rows and gate_rows[0][1])
    failed = 0

    for kind, matched in gate_rows:
        if matched or kind == "reset":
            break

        if kind == "start":
            failed += 1

    return verified, failed


def student_status(cur, contest_id, user_id):
    cur.execute(
        "SELECT 1 FROM FaceProfiles WHERE user_id = %s",
        (user_id,)
    )
    enrolled = cur.fetchone() is not None

    cur.execute(
        """
        SELECT kind, matched
        FROM FaceChecks
        WHERE contest_id = %s
          AND user_id = %s
          AND kind = ANY(%s)
        ORDER BY created_at DESC, check_id DESC
        """,
        (contest_id, user_id, list(GATE_KINDS))
    )

    verified, failed = summarize(cur.fetchall())

    return {
        "enrolled": enrolled,
        "verified": verified,
        "failed_attempts": failed,
        "max_attempts": MAX_START_ATTEMPTS,
        "blocked": (not verified) and failed >= MAX_START_ATTEMPTS
    }


def teacher_owns_contest(cur, contest_id, teacher_id):
    cur.execute(
        """
        SELECT 1 FROM Contests
        WHERE contest_id = %s AND created_by = %s
        """,
        (contest_id, teacher_id)
    )

    return cur.fetchone() is not None


def student_in_contest(cur, contest_id, user_id):
    cur.execute(
        """
        SELECT 1 FROM ContestAttempts
        WHERE contest_id = %s AND user_id = %s
        UNION
        SELECT 1 FROM FaceChecks
        WHERE contest_id = %s AND user_id = %s
        """,
        (contest_id, user_id, contest_id, user_id)
    )

    return cur.fetchone() is not None


# ---------------------------------------------------------
# STUDENT: STATUS
# ---------------------------------------------------------

@identity_bp.route("/tests/<int:contest_id>/identity", methods=["GET"])
@require_role("student")
def my_identity(contest_id):
    conn = cur = None

    try:
        conn = get_connection()
        cur = conn.cursor()

        return jsonify(
            student_status(cur, contest_id, request.user["user_id"])
        ), 200

    except Exception:
        traceback.print_exc()
        return jsonify({
            "error": "Could not load identity status. Check the backend terminal."
        }), 500

    finally:
        close_db(cur, conn)


# ---------------------------------------------------------
# STUDENT: ENROLL / VERIFY
# ---------------------------------------------------------

@identity_bp.route("/tests/<int:contest_id>/identity", methods=["POST"])
@require_role("student")
def submit_identity(contest_id):
    conn = cur = None

    user_id = request.user["user_id"]
    data = request.get_json(silent=True) or {}

    kind = str(data.get("kind") or "").lower()

    if kind not in ("enroll", "start", "periodic"):
        return jsonify({"error": "Invalid check type"}), 400

    descriptor = clean_descriptor(data.get("descriptor"))
    photo = clean_photo(data.get("photo"))

    if descriptor is None or photo is None:
        return jsonify({"error": "Invalid face data. Please try again."}), 400

    try:
        conn = get_connection()
        cur = conn.cursor()

        found, running = test_is_running_for(cur, contest_id, user_id)

        if not found:
            return jsonify({"error": "Test not found"}), 404

        if not running:
            return jsonify({"error": "This test is not running."}), 409

        cur.execute(
            "SELECT descriptor FROM FaceProfiles WHERE user_id = %s",
            (user_id,)
        )
        profile = cur.fetchone()

        # ---------- ENROLL ----------
        if kind == "enroll":
            if profile:
                return jsonify({
                    "error": "A face is already registered for your account. "
                             "Ask your teacher to reset it."
                }), 409

            cur.execute(
                """
                INSERT INTO FaceProfiles (user_id, descriptor, photo)
                VALUES (%s, %s::jsonb, %s)
                """,
                (user_id, json.dumps(descriptor), photo)
            )

            cur.execute(
                """
                INSERT INTO FaceChecks
                    (contest_id, user_id, kind, distance, matched, photo)
                VALUES (%s, %s, 'enroll', 0, TRUE, %s)
                """,
                (contest_id, user_id, photo)
            )

            conn.commit()

            result = student_status(cur, contest_id, user_id)
            result.update({"matched": True, "distance": 0})

            return jsonify(result), 200

        # ---------- START / PERIODIC ----------
        if not profile:
            return jsonify({
                "error": "Register your face first.",
                "need_enroll": True
            }), 409

        if kind == "start":
            before = student_status(cur, contest_id, user_id)

            # Pehle se verified: dobara verification ki zarurat nahi
            if before["verified"]:
                before.update({"matched": True, "distance": None})
                return jsonify(before), 200

            if before["blocked"]:
                before.update({"matched": False, "distance": None})
                return jsonify(before), 200

        reference = profile[0]

        if isinstance(reference, str):
            reference = json.loads(reference)

        gap = distance(descriptor, reference)
        matched = gap <= FACE_MATCH_THRESHOLD

        # Matched periodic check ki photo store nahi hoti (DB bharta tha).
        # Mismatch aur start check ki photo hamesha save hoti hai.
        stored_photo = photo if (kind != "periodic" or not matched) else None

        cur.execute(
            """
            INSERT INTO FaceChecks
                (contest_id, user_id, kind, distance, matched, photo)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (contest_id, user_id, kind, gap, matched, stored_photo)
        )

        # Test ke dauran dusra insaan: teacher ko photo ke saath alert
        if kind == "periodic" and not matched:
            cur.execute("SAVEPOINT incident_sp")

            try:
                record_incident(
                    cur, contest_id, user_id, "FACE_MISMATCH", photo
                )
                cur.execute("RELEASE SAVEPOINT incident_sp")
            except Exception:
                traceback.print_exc()
                cur.execute("ROLLBACK TO SAVEPOINT incident_sp")

        conn.commit()

        result = student_status(cur, contest_id, user_id)
        result.update({"matched": matched, "distance": round(gap, 3)})

        return jsonify(result), 200

    except Exception:
        if conn:
            conn.rollback()
        traceback.print_exc()
        return jsonify({
            "error": "Could not process the face check. Check the backend terminal."
        }), 500

    finally:
        close_db(cur, conn)


# ---------------------------------------------------------
# TEACHER: LIST
# ---------------------------------------------------------

@identity_bp.route(
    "/teacher/tests/<int:contest_id>/identity",
    methods=["GET"]
)
@require_role("teacher")
def teacher_identity(contest_id):
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
            SELECT u.user_id, u.username, fp.photo, fp.created_at
            FROM Users u
            LEFT JOIN FaceProfiles fp ON fp.user_id = u.user_id
            WHERE u.user_id IN (
                SELECT user_id FROM ContestAttempts WHERE contest_id = %s
                UNION
                SELECT user_id FROM FaceChecks WHERE contest_id = %s
            )
            ORDER BY u.username
            """,
            (contest_id, contest_id)
        )

        students = {
            row[0]: {
                "user_id": row[0],
                "username": row[1],
                "reference_photo": row[2],
                "enrolled_at": to_iso(row[3]),
                "checks": [],
                "total_checks": 0,
                "mismatches": 0,
                "_gate": [],
                "_bad_shown": 0
            }
            for row in cur.fetchall()
        }

        # Photo: har student ke latest N checks + uski saari (max 10) mismatch photos.
        # Pehle sirf latest 5 ki photo aati thi, isliye mismatch photo gayab ho jati thi.
        cur.execute(
            """
            SELECT user_id, check_id, kind, distance, matched, created_at,
                   CASE
                       WHEN rn <= %s THEN photo
                       WHEN NOT matched
                            AND kind IN ('start', 'periodic')
                            AND bad_rn <= %s THEN photo
                   END
            FROM (
                SELECT fc.*,
                       ROW_NUMBER() OVER (
                           PARTITION BY user_id
                           ORDER BY created_at DESC, check_id DESC
                       ) AS rn,
                       ROW_NUMBER() OVER (
                           PARTITION BY user_id, matched
                           ORDER BY created_at DESC, check_id DESC
                       ) AS bad_rn
                FROM FaceChecks fc
                WHERE contest_id = %s
            ) t
            ORDER BY user_id, created_at DESC, check_id DESC
            """,
            (RECENT_CHECKS_PER_STUDENT, MAX_MISMATCH_PHOTOS, contest_id)
        )

        for (user_id, check_id, kind, dist, matched, created_at,
             photo) in cur.fetchall():
            student = students.get(user_id)

            if student is None:
                continue

            student["total_checks"] += 1

            is_bad = kind in ("start", "periodic") and not matched

            if is_bad:
                student["mismatches"] += 1

            if kind in GATE_KINDS:
                student["_gate"].append((kind, matched))

            keep = len(student["checks"]) < RECENT_CHECKS_PER_STUDENT

            if (
                not keep
                and is_bad
                and photo is not None
                and student["_bad_shown"] < MAX_MISMATCH_PHOTOS
            ):
                keep = True

            if keep:
                if is_bad:
                    student["_bad_shown"] += 1

                student["checks"].append({
                    "check_id": check_id,
                    "kind": kind,
                    "distance": None if dist is None else round(dist, 3),
                    "matched": matched,
                    "created_at": to_iso(created_at),
                    "photo": photo
                })

        result = []

        for student in students.values():
            verified, failed = summarize(student.pop("_gate"))
            student.pop("_bad_shown", None)

            student["verified"] = verified
            student["failed_attempts"] = failed
            student["blocked"] = (
                (not verified) and failed >= MAX_START_ATTEMPTS
            )

            result.append(student)

        return jsonify({
            "contest_id": contest_id,
            "match_threshold": FACE_MATCH_THRESHOLD,
            "max_attempts": MAX_START_ATTEMPTS,
            "students": result
        }), 200

    except Exception:
        traceback.print_exc()
        return jsonify({
            "error": "Could not load identity data. Check the backend terminal."
        }), 500

    finally:
        close_db(cur, conn)


# ---------------------------------------------------------
# TEACHER: APPROVE (manual override)
# ---------------------------------------------------------

@identity_bp.route(
    "/teacher/tests/<int:contest_id>/identity/<int:student_id>/approve",
    methods=["POST"]
)
@require_role("teacher")
def approve_identity(contest_id, student_id):
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

        if not student_in_contest(cur, contest_id, student_id):
            return jsonify({
                "error": "This student has not joined the test"
            }), 404

        cur.execute(
            """
            INSERT INTO FaceChecks
                (contest_id, user_id, kind, distance, matched, photo)
            VALUES (%s, %s, 'override', NULL, TRUE, NULL)
            """,
            (contest_id, student_id)
        )

        conn.commit()

        return jsonify({
            "message": "Student approved. They can continue the test."
        }), 200

    except Exception:
        if conn:
            conn.rollback()
        traceback.print_exc()
        return jsonify({
            "error": "Could not approve the student. Check the backend terminal."
        }), 500

    finally:
        close_db(cur, conn)


# ---------------------------------------------------------
# TEACHER: RESET REGISTERED FACE
# ---------------------------------------------------------

@identity_bp.route(
    "/teacher/tests/<int:contest_id>/identity/<int:student_id>/reset-face",
    methods=["POST"]
)
@require_role("teacher")
def reset_face(contest_id, student_id):
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

        if not student_in_contest(cur, contest_id, student_id):
            return jsonify({
                "error": "This student has not joined the test"
            }), 404

        cur.execute(
            "DELETE FROM FaceProfiles WHERE user_id = %s",
            (student_id,)
        )

        # Is test mein dobara gate se guzarna padega
        cur.execute(
            """
            INSERT INTO FaceChecks
                (contest_id, user_id, kind, distance, matched, photo)
            VALUES (%s, %s, 'reset', NULL, FALSE, NULL)
            """,
            (contest_id, student_id)
        )

        conn.commit()

        return jsonify({
            "message": "Registered face removed. The student must register "
                       "their face again."
        }), 200

    except Exception:
        if conn:
            conn.rollback()
        traceback.print_exc()
        return jsonify({
            "error": "Could not reset the face. Check the backend terminal."
        }), 500

    finally:
        close_db(cur, conn)


# =========================================================
# LOGIN-TIME FACE CHECK (test ke bina, login ke turant baad)
# =========================================================
# FaceChecks mein contest_id = 0 ka matlab "login check, koi test nahi".
# Dashboard par ab ye check use nahi hota (LOGIN_FACE_CHECK = "off"),
# endpoints purane code ke liye rakhe gaye hain.

LOGIN_CONTEST_ID = 0
LOGIN_MAX_FAILS = 5
LOGIN_LOCK_MINUTES = 5


def login_status(cur, user_id):
    cur.execute(
        "SELECT 1 FROM FaceProfiles WHERE user_id = %s",
        (user_id,)
    )
    enrolled = cur.fetchone() is not None

    cur.execute(
        """
        SELECT matched
        FROM FaceChecks
        WHERE contest_id = %s
          AND user_id = %s
          AND kind = 'login'
          AND created_at > NOW() - (%s * INTERVAL '1 minute')
        ORDER BY created_at DESC, check_id DESC
        """,
        (LOGIN_CONTEST_ID, user_id, LOGIN_LOCK_MINUTES)
    )

    failed = 0

    for (matched,) in cur.fetchall():
        if matched:
            break
        failed += 1

    return {
        "enrolled": enrolled,
        "verified": False,
        "failed_attempts": failed,
        "max_attempts": LOGIN_MAX_FAILS,
        "blocked": failed >= LOGIN_MAX_FAILS
    }


@identity_bp.route("/identity/status", methods=["GET"])
@require_role("student")
def login_identity_status():
    conn = cur = None

    try:
        conn = get_connection()
        cur = conn.cursor()

        return jsonify(login_status(cur, request.user["user_id"])), 200

    except Exception:
        traceback.print_exc()
        return jsonify({
            "error": "Could not load identity status. Check the backend terminal."
        }), 500

    finally:
        close_db(cur, conn)


@identity_bp.route("/identity/login-check", methods=["POST"])
@require_role("student")
def login_identity_check():
    conn = cur = None

    user_id = request.user["user_id"]
    data = request.get_json(silent=True) or {}

    kind = str(data.get("kind") or "").lower()

    if kind not in ("enroll", "login"):
        return jsonify({"error": "Invalid check type"}), 400

    descriptor = clean_descriptor(data.get("descriptor"))
    photo = clean_photo(data.get("photo"))

    if descriptor is None or photo is None:
        return jsonify({"error": "Invalid face data. Please try again."}), 400

    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            "SELECT descriptor FROM FaceProfiles WHERE user_id = %s",
            (user_id,)
        )
        profile = cur.fetchone()

        if kind == "enroll":
            if profile:
                return jsonify({
                    "error": "A face is already registered for your account. "
                             "Ask your teacher to reset it."
                }), 409

            cur.execute(
                """
                INSERT INTO FaceProfiles (user_id, descriptor, photo)
                VALUES (%s, %s::jsonb, %s)
                """,
                (user_id, json.dumps(descriptor), photo)
            )

            cur.execute(
                """
                INSERT INTO FaceChecks
                    (contest_id, user_id, kind, distance, matched, photo)
                VALUES (%s, %s, 'enroll', 0, TRUE, %s)
                """,
                (LOGIN_CONTEST_ID, user_id, photo)
            )

            conn.commit()

            result = login_status(cur, user_id)
            result.update({"matched": True, "verified": True, "distance": 0})

            return jsonify(result), 200

        if not profile:
            return jsonify({
                "error": "Register your face first.",
                "need_enroll": True
            }), 409

        before = login_status(cur, user_id)

        if before["blocked"]:
            before.update({"matched": False, "distance": None})
            return jsonify(before), 200

        reference = profile[0]

        if isinstance(reference, str):
            reference = json.loads(reference)

        gap = distance(descriptor, reference)
        matched = gap <= FACE_MATCH_THRESHOLD

        cur.execute(
            """
            INSERT INTO FaceChecks
                (contest_id, user_id, kind, distance, matched, photo)
            VALUES (%s, %s, 'login', %s, %s, %s)
            """,
            (LOGIN_CONTEST_ID, user_id, gap, matched, photo)
        )

        conn.commit()

        result = login_status(cur, user_id)
        result.update({
            "matched": matched,
            "verified": matched,
            "distance": round(gap, 3)
        })

        return jsonify(result), 200

    except Exception:
        if conn:
            conn.rollback()
        traceback.print_exc()
        return jsonify({
            "error": "Could not process the face check. Check the backend terminal."
        }), 500

    finally:
        close_db(cur, conn)