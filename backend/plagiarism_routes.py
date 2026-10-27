"""
CodeShield Plagiarism Detection API.

Features:
1. Teacher authentication
2. Contest ownership verification
3. Jaccard (token shingle) similarity detection
4. Save plagiarism checks in PostgreSQL
5. Retrieve plagiarism report
6. Side-by-side comparison of two submissions

Routes:
    POST /api/teacher/plagiarism/scan/<contest_id>
    GET  /api/teacher/plagiarism/report/<contest_id>
    GET  /api/teacher/plagiarism/compare/<submission_1>/<submission_2>
"""

import os
import sys
import traceback
from functools import wraps

from flask import Blueprint, jsonify, request
from psycopg2.extras import execute_values


# ---------------------------------------------------------
# PROJECT ROOT PATH
# ---------------------------------------------------------

# Folder structure:
# CodeShield/
#   backend/
#   database/

PROJECT_ROOT = os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))
)

if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)


# ---------------------------------------------------------
# IMPORT DATABASE AND DETECTOR MODULES
# ---------------------------------------------------------

from database.auth import verify_token, get_connection
from plagiarism_detection import (
    DEFAULT_THRESHOLD,
    analyze_code,
    compare_analyzed,
    compare_code,
    matching_lines,
)


# ---------------------------------------------------------
# SETTINGS
# ---------------------------------------------------------

# Isse kam similarity wale pairs database / report mein nahi rakhe
# jate (warna 100 students ke liye hazaaron faltu rows ban jaati hain).
# Flagged pairs hamesha save hote hain.
MIN_STORE_PERCENT = 20.0


# ---------------------------------------------------------
# BLUEPRINT
# ---------------------------------------------------------

plagiarism_bp = Blueprint(
    "plagiarism",
    __name__,
    url_prefix="/api"
)


# ---------------------------------------------------------
# TEACHER AUTHENTICATION
# ---------------------------------------------------------

def require_teacher(function):
    """Allow only authenticated teachers."""

    @wraps(function)
    def wrapper(*args, **kwargs):

        auth_header = request.headers.get(
            "Authorization", ""
        )

        if not auth_header.startswith("Bearer "):
            return jsonify({
                "error": "Authorization token required"
            }), 401

        token = auth_header.split(" ", 1)[1].strip()

        if not token:
            return jsonify({
                "error": "Authorization token required"
            }), 401

        try:
            payload = verify_token(token)
        except Exception:
            payload = None

        if not isinstance(payload, dict):
            return jsonify({
                "error": "Invalid or expired token"
            }), 401

        if payload.get("role") != "teacher":
            return jsonify({
                "error": "Teacher role required"
            }), 403

        if payload.get("user_id") is None:
            return jsonify({
                "error": "Token does not contain user_id"
            }), 401

        request.user = payload

        return function(*args, **kwargs)

    return wrapper


# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------

def close_db(cur, conn):
    if cur:
        cur.close()
    if conn:
        conn.close()


def contest_belongs_to_teacher(cur, contest_id, teacher_id):
    """Check whether the teacher owns the contest."""

    cur.execute(
        """
        SELECT 1
        FROM Contests
        WHERE contest_id = %s
          AND created_by = %s
        """,
        (contest_id, teacher_id)
    )

    return cur.fetchone() is not None


def fetch_report(cur, contest_id):
    """
    Saved plagiarism checks ek contest ke liye.

    Sirf woh pairs aate hain jinke dono submissions abhi bhi
    us student ke latest submission hain (purane submissions ke
    pairs nahi dikhte).
    """

    cur.execute(
        """
        SELECT
            pc.check_id,
            pc.submission_id_1,
            u1.username,
            pc.submission_id_2,
            u2.username,
            pc.similarity_score,
            pc.flagged,
            pc.checked_at,
            p.problem_id,
            p.title,
            s1.language
        FROM PlagrismChecks pc
        JOIN Submissions s1
            ON s1.submission_id = pc.submission_id_1
        JOIN Submissions s2
            ON s2.submission_id = pc.submission_id_2
        JOIN Users u1
            ON u1.user_id = s1.user_id
        JOIN Users u2
            ON u2.user_id = s2.user_id
        JOIN Problems p
            ON p.problem_id = s1.problem_id
        WHERE p.contest_id = %s
          AND s1.problem_id = s2.problem_id
          AND NOT EXISTS (
                SELECT 1 FROM Submissions n
                WHERE n.user_id = s1.user_id
                  AND n.problem_id = s1.problem_id
                  AND n.submission_id > s1.submission_id
          )
          AND NOT EXISTS (
                SELECT 1 FROM Submissions n
                WHERE n.user_id = s2.user_id
                  AND n.problem_id = s2.problem_id
                  AND n.submission_id > s2.submission_id
          )
        ORDER BY
            pc.flagged DESC,
            pc.similarity_score DESC,
            pc.checked_at DESC
        """,
        (contest_id,)
    )

    results = []

    for row in cur.fetchall():
        results.append({
            "check_id": row[0],

            "submission_id_1": row[1],
            "student_1": row[2],

            "submission_id_2": row[3],
            "student_2": row[4],

            "similarity_score": float(row[5]),
            "flagged": bool(row[6]),

            "checked_at": row[7].isoformat() if row[7] else None,

            "problem_id": row[8],
            "problem_title": row[9],
            "language": (row[10] or "").lower()
        })

    return results


# ---------------------------------------------------------
# POST: SCAN CONTEST FOR PLAGIARISM
# ---------------------------------------------------------

@plagiarism_bp.route(
    "/teacher/plagiarism/scan/<int:contest_id>",
    methods=["POST"]
)
@require_teacher
def scan_contest(contest_id):
    """
    Har problem par har student ke LATEST submission ko baaki sab
    students ke latest submissions se compare karta hai.

    Optional JSON body:
    {
        "threshold": 70
    }
    """

    body = request.get_json(silent=True) or {}

    try:
        threshold_percent = float(
            body.get("threshold", DEFAULT_THRESHOLD * 100)
        )
    except (TypeError, ValueError):
        return jsonify({
            "error": "Threshold must be a number from 0 to 100"
        }), 400

    if not 0 <= threshold_percent <= 100:
        return jsonify({
            "error": "Threshold must be between 0 and 100"
        }), 400

    threshold = threshold_percent / 100.0

    conn = None
    cur = None

    try:
        conn = get_connection()
        cur = conn.cursor()

        teacher_id = request.user["user_id"]

        if not contest_belongs_to_teacher(cur, contest_id, teacher_id):
            return jsonify({
                "error": (
                    "Contest not found or you do not "
                    "have permission to access it"
                )
            }), 404

        # -----------------------------------------------------
        # Har student ka har problem par latest submission
        # -----------------------------------------------------

        cur.execute(
            """
            SELECT
                s.submission_id,
                s.user_id,
                s.problem_id,
                s.code,
                s.language,
                u.username
            FROM Submissions s
            JOIN Problems p
                ON p.problem_id = s.problem_id
            JOIN Users u
                ON u.user_id = s.user_id
            WHERE p.contest_id = %s
              AND s.code IS NOT NULL
              AND LENGTH(TRIM(s.code)) > 0
              AND s.submission_id = (
                    SELECT MAX(s2.submission_id)
                    FROM Submissions s2
                    WHERE s2.user_id = s.user_id
                      AND s2.problem_id = s.problem_id
              )
            ORDER BY s.problem_id, s.submission_id
            """,
            (contest_id,)
        )

        submissions = cur.fetchall()

        # Problem ke hisaab se group karo; code ek hi baar analyze hoga.
        by_problem = {}

        for row in submissions:
            by_problem.setdefault(row[2], []).append({
                "submission_id": row[0],
                "user_id": row[1],
                "language": (row[4] or "").strip().lower(),
                "username": row[5],
                "analysis": analyze_code(row[3]),
            })

        pairs_checked = 0
        flagged_pairs = 0
        rows_to_save = []

        for problem_items in by_problem.values():

            for i in range(len(problem_items)):

                first = problem_items[i]

                for j in range(i + 1, len(problem_items)):

                    second = problem_items[j]

                    # Ek hi student ke code se compare nahi
                    if first["user_id"] == second["user_id"]:
                        continue

                    # Sirf same language compare hogi
                    if first["language"] != second["language"]:
                        continue

                    comparison = compare_analyzed(
                        first["analysis"],
                        second["analysis"],
                        threshold
                    )

                    score = comparison["similarity_score"]
                    flagged = comparison["flagged"]

                    pairs_checked += 1

                    if flagged:
                        flagged_pairs += 1

                    if flagged or score >= MIN_STORE_PERCENT:

                        id_1, id_2 = sorted(
                            (first["submission_id"],
                             second["submission_id"])
                        )

                        rows_to_save.append(
                            (id_1, id_2, score, flagged)
                        )

        # -----------------------------------------------------
        # Is contest ke purane checks hatao, naye bulk mein daalo
        # -----------------------------------------------------

        cur.execute(
            """
            DELETE FROM PlagrismChecks
            WHERE submission_id_1 IN (
                SELECT s.submission_id
                FROM Submissions s
                JOIN Problems p ON p.problem_id = s.problem_id
                WHERE p.contest_id = %s
            )
            """,
            (contest_id,)
        )

        if rows_to_save:
            execute_values(
                cur,
                """
                INSERT INTO PlagrismChecks (
                    submission_id_1,
                    submission_id_2,
                    similarity_score,
                    flagged
                )
                VALUES %s
                """,
                rows_to_save
            )

        conn.commit()

        results = fetch_report(cur, contest_id)

        return jsonify({
            "message": "Plagiarism scan completed",
            "contest_id": contest_id,
            "threshold_percent": threshold_percent,
            "submissions_considered": len(submissions),
            "pairs_checked": pairs_checked,
            "flagged_pairs": flagged_pairs,
            "saved_pairs": len(rows_to_save),
            "min_store_percent": MIN_STORE_PERCENT,
            "results": results,
            "notice": (
                "Flagged results are review signals. "
                "A teacher should review them before "
                "making any misconduct decision."
            )
        }), 200

    except Exception:
        if conn:
            conn.rollback()

        traceback.print_exc()

        return jsonify({
            "error": (
                "Plagiarism scan failed. "
                "Check the backend terminal for details."
            )
        }), 500

    finally:
        close_db(cur, conn)


# ---------------------------------------------------------
# GET: FETCH SAVED PLAGIARISM REPORT
# ---------------------------------------------------------

@plagiarism_bp.route(
    "/teacher/plagiarism/report/<int:contest_id>",
    methods=["GET"]
)
@require_teacher
def get_plagiarism_report(contest_id):
    """Retrieve saved plagiarism checks for a contest."""

    conn = None
    cur = None

    try:
        conn = get_connection()
        cur = conn.cursor()

        teacher_id = request.user["user_id"]

        if not contest_belongs_to_teacher(cur, contest_id, teacher_id):
            return jsonify({
                "error": (
                    "Contest not found or you do not "
                    "have permission to access it"
                )
            }), 404

        results = fetch_report(cur, contest_id)

        last_scanned = max(
            (r["checked_at"] for r in results if r["checked_at"]),
            default=None
        )

        return jsonify({
            "contest_id": contest_id,
            "total_pairs": len(results),
            "flagged_pairs": sum(1 for r in results if r["flagged"]),
            "last_scanned_at": last_scanned,
            "min_store_percent": MIN_STORE_PERCENT,
            "results": results
        }), 200

    except Exception:
        if conn:
            conn.rollback()

        traceback.print_exc()

        return jsonify({
            "error": (
                "Could not load plagiarism report. "
                "Check the backend terminal for details."
            )
        }), 500

    finally:
        close_db(cur, conn)


# ---------------------------------------------------------
# GET: COMPARE TWO SUBMISSIONS SIDE BY SIDE
# ---------------------------------------------------------

@plagiarism_bp.route(
    "/teacher/plagiarism/compare/<int:submission_1>/<int:submission_2>",
    methods=["GET"]
)
@require_teacher
def compare_submissions(submission_1, submission_2):
    """
    Dono submissions ka code, similarity aur woh lines jo doosre code
    mein bhi milti hain (highlight karne ke liye).
    """

    if submission_1 == submission_2:
        return jsonify({
            "error": "Choose two different submissions"
        }), 400

    conn = None
    cur = None

    try:
        conn = get_connection()
        cur = conn.cursor()

        teacher_id = request.user["user_id"]

        # Dono submissions is teacher ke tests ki honi chahiye
        cur.execute(
            """
            SELECT
                s.submission_id,
                s.code,
                s.language,
                s.problem_id,
                u.username,
                p.title,
                s.submitted_at
            FROM Submissions s
            JOIN Problems p ON p.problem_id = s.problem_id
            JOIN Contests c ON c.contest_id = p.contest_id
            JOIN Users u ON u.user_id = s.user_id
            WHERE s.submission_id IN (%s, %s)
              AND c.created_by = %s
            """,
            (submission_1, submission_2, teacher_id)
        )

        rows = {row[0]: row for row in cur.fetchall()}

        if submission_1 not in rows or submission_2 not in rows:
            return jsonify({
                "error": "Submissions not found or access denied"
            }), 404

        first = rows[submission_1]
        second = rows[submission_2]

        if first[3] != second[3]:
            return jsonify({
                "error": "Both submissions must belong to the same problem"
            }), 400

        code_1 = first[1] or ""
        code_2 = second[1] or ""

        comparison = compare_code(code_1, code_2)
        lines_1, lines_2 = matching_lines(code_1, code_2)

        return jsonify({
            "problem_id": first[3],
            "problem_title": first[5],
            "language": (first[2] or "").lower(),

            "similarity_score": comparison["similarity_score"],

            "submission_1": {
                "submission_id": first[0],
                "student": first[4],
                "code": code_1,
                "submitted_at": (
                    first[6].isoformat() if first[6] else None
                ),
                "matching_lines": lines_1
            },

            "submission_2": {
                "submission_id": second[0],
                "student": second[4],
                "code": code_2,
                "submitted_at": (
                    second[6].isoformat() if second[6] else None
                ),
                "matching_lines": lines_2
            }
        }), 200

    except Exception:
        traceback.print_exc()

        return jsonify({
            "error": (
                "Could not compare submissions. "
                "Check the backend terminal for details."
            )
        }), 500

    finally:
        close_db(cur, conn)