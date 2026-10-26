
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


MAX_TITLE_LENGTH = 150
MAX_MESSAGE_LENGTH = 2000
STUDENT_LIST_LIMIT = 50

notification_bp = Blueprint(
    "notifications",
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


def close_db(cur, conn):
    if cur:
        cur.close()
    if conn:
        conn.close()


def to_iso(value):
    return value.isoformat() if value else None




@notification_bp.route("/teacher/notifications", methods=["POST"])
@require_role("teacher")
def send_notification():
    data = request.get_json(silent=True) or {}

    title = str(data.get("title", "") or "").strip()
    message = str(data.get("message", "") or "").strip()

    if not title:
        return jsonify({"error": "Title is required"}), 400

    if not message:
        return jsonify({"error": "Message is required"}), 400

    if len(title) > MAX_TITLE_LENGTH:
        return jsonify({
            "error": f"Title must be at most {MAX_TITLE_LENGTH} characters"
        }), 400

    if len(message) > MAX_MESSAGE_LENGTH:
        return jsonify({
            "error": f"Message must be at most {MAX_MESSAGE_LENGTH} characters"
        }), 400

    conn = cur = None

    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            INSERT INTO Notifications (created_by, title, message)
            VALUES (%s, %s, %s)
            RETURNING notification_id, created_at
            """,
            (request.user["user_id"], title, message)
        )
        row = cur.fetchone()
        conn.commit()

        return jsonify({
            "message": "Notification sent to all students",
            "notification": {
                "notification_id": row[0],
                "title": title,
                "message": message,
                "created_at": to_iso(row[1])
            }
        }), 201

    except Exception:
        if conn:
            conn.rollback()
        traceback.print_exc()
        return jsonify({
            "error": "Could not send notification. Check the backend.."
        }), 500

    finally:
        close_db(cur, conn)



@notification_bp.route("/teacher/notifications", methods=["GET"])
@require_role("teacher")
def teacher_notifications():
    conn = cur = None

    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT notification_id, title, message, created_at
            FROM Notifications
            WHERE created_by = %s
            ORDER BY created_at DESC, notification_id DESC
            LIMIT %s
            """,
            (request.user["user_id"], STUDENT_LIST_LIMIT)
        )

        items = [
            {
                "notification_id": r[0],
                "title": r[1],
                "message": r[2],
                "created_at": to_iso(r[3])
            }
            for r in cur.fetchall()
        ]

        return jsonify({"notifications": items}), 200

    except Exception:
        traceback.print_exc()
        return jsonify({
            "error": "Could not load notifications. Check the backend."
        }), 500

    finally:
        close_db(cur, conn)


# ---------------------------------------------------------
# TEACHER: DELETE OWN
# ---------------------------------------------------------

@notification_bp.route(
    "/teacher/notifications/<int:notification_id>",
    methods=["DELETE"]
)
@require_role("teacher")
def delete_notification(notification_id):
    conn = cur = None

    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            DELETE FROM Notifications
            WHERE notification_id = %s AND created_by = %s
            """,
            (notification_id, request.user["user_id"])
        )
        deleted = cur.rowcount
        conn.commit()

        if not deleted:
            return jsonify({
                "error": "Notification not found or access denied"
            }), 404

        return jsonify({"message": "Notification deleted"}), 200

    except Exception:
        if conn:
            conn.rollback()
        traceback.print_exc()
        return jsonify({
            "error": "Could not delete notification. Check the backend terminal."
        }), 500

    finally:
        close_db(cur, conn)


# ---------------------------------------------------------
# STUDENT: LIST
# ---------------------------------------------------------

@notification_bp.route("/student/notifications", methods=["GET"])
@require_role("student")
def student_notifications():
    conn = cur = None
    user_id = request.user["user_id"]

    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
                n.notification_id,
                n.title,
                n.message,
                n.created_at,
                COALESCE(u.username, 'Teacher'),
                (nr.user_id IS NOT NULL) AS is_read
            FROM Notifications n
            LEFT JOIN Users u
                ON u.user_id = n.created_by
            LEFT JOIN NotificationReads nr
                ON nr.notification_id = n.notification_id
               AND nr.user_id = %s
            ORDER BY n.created_at DESC, n.notification_id DESC
            LIMIT %s
            """,
            (user_id, STUDENT_LIST_LIMIT)
        )

        items = [
            {
                "notification_id": r[0],
                "title": r[1],
                "message": r[2],
                "created_at": to_iso(r[3]),
                "teacher": r[4],
                "is_read": bool(r[5])
            }
            for r in cur.fetchall()
        ]

        cur.execute(
            """
            SELECT COUNT(*)
            FROM Notifications n
            WHERE NOT EXISTS (
                SELECT 1 FROM NotificationReads nr
                WHERE nr.notification_id = n.notification_id
                  AND nr.user_id = %s
            )
            """,
            (user_id,)
        )
        unread = cur.fetchone()[0] or 0

        return jsonify({
            "notifications": items,
            "unread_count": unread
        }), 200

    except Exception:
        traceback.print_exc()
        return jsonify({
            "error": "Could not load notifications. Check the backend terminal."
        }), 500

    finally:
        close_db(cur, conn)




@notification_bp.route("/student/notifications/read", methods=["POST"])
@require_role("student")
def mark_notifications_read():
    conn = cur = None

    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            INSERT INTO NotificationReads (notification_id, user_id)
            SELECT notification_id, %s
            FROM Notifications
            ON CONFLICT (notification_id, user_id) DO NOTHING
            """,
            (request.user["user_id"],)
        )
        conn.commit()

        return jsonify({"message": "All notifications marked as read"}), 200

    except Exception:
        if conn:
            conn.rollback()
        traceback.print_exc()
        return jsonify({
            "error": "Could not update notifications. Check the backend terminal."
        }), 500

    finally:
        close_db(cur, conn)