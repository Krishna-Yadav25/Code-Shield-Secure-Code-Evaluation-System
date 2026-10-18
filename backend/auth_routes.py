
from flask import Blueprint, request, jsonify
from functools import wraps

import os
import sys
import time
import secrets
import smtplib
import bcrypt

from email.message import EmailMessage
from threading import Lock


from dotenv import load_dotenv

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BACKEND_DIR)
load_dotenv(os.path.join(PROJECT_DIR, ".env"))
load_dotenv(os.path.join(BACKEND_DIR, ".env"))


DATABASE_DIR = os.path.join(PROJECT_DIR, "database")
if DATABASE_DIR not in sys.path:
    sys.path.insert(0, DATABASE_DIR)

from auth import (
    register_user,
    login_user,
    verify_token,
    get_connection
)

auth_bp = Blueprint("auth", __name__)


OTP_EXPIRY_SECONDS = 300
RESET_TOKEN_EXPIRY_SECONDS = 300
MAX_OTP_ATTEMPTS = 5

otp_store = {}
reset_tokens = {}
otp_lock = Lock()


# =========================================================
# SEND OTP EMAIL
# =========================================================

def send_otp_email(email, otp):
    smtp_email = os.getenv("SMTP_EMAIL")
    smtp_password = os.getenv("SMTP_APP_PASSWORD")

    if not smtp_email or not smtp_password:
        raise RuntimeError("SMTP configuration is missing")

    message = EmailMessage()
    message["Subject"] = "CodeShield Password Reset OTP"
    message["From"] = smtp_email
    message["To"] = email

    message.set_content(
        f"""Hello,

Your CodeShield password reset OTP is: {otp}

This OTP expires in 5 minutes.

If you did not request a password reset, ignore this email.

CodeShield Team
"""
    )

    with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as server:
        server.starttls()
        server.login(smtp_email, smtp_password)
        server.send_message(message)


# =========================================================
# REGISTER
# =========================================================

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body is required"}), 400

    username = data.get("username")
    email = data.get("email")
    password = data.get("password")
    role = data.get("role")

    if not all([username, email, password, role]):
        return jsonify({
            "error": "username, email, password, and role are required"
        }), 400

    if role not in ["student", "teacher"]:
        return jsonify({
            "error": "Role must be student or teacher"
        }), 400

    success, message = register_user(
        username, email, password, role
    )

    if success:
        return jsonify({"message": message}), 201

    return jsonify({"error": message}), 400


# =========================================================
# LOGIN
# =========================================================

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body is required"}), 400

    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({
            "error": "email and password are required"
        }), 400

    success, token_or_error, role = login_user(email, password)

    if success:
        return jsonify({
            "token": token_or_error,
            "role": role
        }), 200

    return jsonify({"error": token_or_error}), 401


# =========================================================
# FORGOT PASSWORD - SEND OTP
# =========================================================

@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json(silent=True)

    if not data or not isinstance(data.get("email"), str):
        return jsonify({"error": "Email is required"}), 400

    email = data["email"].strip().lower()

    if not email:
        return jsonify({"error": "Email is required"}), 400

    generic_response = {
        "message": "If the account exists, an OTP will be sent."
    }

    conn = None
    cur = None

    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT user_id
            FROM Users
            WHERE LOWER(email) = %s
            """,
            (email,)
        )

        user = cur.fetchone()

        if not user:
            return jsonify(generic_response), 200

        otp = f"{secrets.randbelow(1000000):06d}"

        # Hash OTP before storing it
        otp_hash = bcrypt.hashpw(
            otp.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")

        # Send email before saving the OTP
        send_otp_email(email, otp)

        with otp_lock:
            otp_store[email] = {
                "user_id": user[0],
                "otp_hash": otp_hash,
                "expires_at": time.time() + OTP_EXPIRY_SECONDS,
                "attempts": 0
            }

            # Invalidate previous reset token
            reset_tokens.pop(email, None)

        return jsonify(generic_response), 200

    except Exception as e:
        # Actual exception appears only in the backend terminal
        print("FORGOT PASSWORD ERROR:", repr(e))

        return jsonify({
            "error": "Could not process password reset request"
        }), 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


# =========================================================
# VERIFY OTP
# =========================================================

@auth_bp.route("/verify-otp", methods=["POST"])
def verify_otp():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body is required"}), 400

    email = str(data.get("email", "")).strip().lower()
    otp = str(data.get("otp", "")).strip()

    if not email or not otp:
        return jsonify({
            "error": "Email and OTP are required"
        }), 400

    if not otp.isdigit() or len(otp) != 6:
        return jsonify({"error": "Invalid or expired OTP"}), 400

    with otp_lock:
        record = otp_store.get(email)

        if not record:
            return jsonify({"error": "Invalid or expired OTP"}), 400

        if time.time() > record["expires_at"]:
            otp_store.pop(email, None)
            return jsonify({"error": "Invalid or expired OTP"}), 400

        if record["attempts"] >= MAX_OTP_ATTEMPTS:
            otp_store.pop(email, None)
            return jsonify({
                "error": "Too many attempts. Request a new OTP."
            }), 429

        valid = bcrypt.checkpw(
            otp.encode("utf-8"),
            record["otp_hash"].encode("utf-8")
        )

        if not valid:
            record["attempts"] += 1
            return jsonify({"error": "Invalid or expired OTP"}), 400

        # OTP can only be used once
        otp_store.pop(email, None)

        reset_token = secrets.token_urlsafe(32)

        reset_tokens[email] = {
            "token": reset_token,
            "user_id": record["user_id"],
            "expires_at": time.time() + RESET_TOKEN_EXPIRY_SECONDS
        }

    return jsonify({
        "message": "OTP verified successfully",
        "reset_token": reset_token
    }), 200


# =========================================================
# RESET PASSWORD
# =========================================================

@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body is required"}), 400

    email = str(data.get("email", "")).strip().lower()
    reset_token = str(data.get("reset_token", ""))
    new_password = data.get("new_password", "")

    if not email or not reset_token or not new_password:
        return jsonify({
            "error": "Email, reset_token, and new_password are required"
        }), 400

    if not isinstance(new_password, str) or len(new_password) < 8:
        return jsonify({
            "error": "Password must contain at least 8 characters"
        }), 400

    with otp_lock:
        record = reset_tokens.get(email)

        if (
            not record
            or time.time() > record["expires_at"]
            or not secrets.compare_digest(
                reset_token,
                record["token"]
            )
        ):
            reset_tokens.pop(email, None)
            return jsonify({
                "error": "Invalid or expired reset token"
            }), 400

        user_id = record["user_id"]

        # Token is single-use
        reset_tokens.pop(email, None)

    # Same bcrypt format used by database/auth.py
    password_hash = bcrypt.hashpw(
        new_password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")

    conn = None
    cur = None

    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            UPDATE Users
            SET password_hash = %s
            WHERE user_id = %s
              AND LOWER(email) = %s
            """,
            (password_hash, user_id, email)
        )

        if cur.rowcount != 1:
            conn.rollback()
            return jsonify({
                "error": "Could not reset password"
            }), 400

        conn.commit()

        return jsonify({
            "message": "Password reset successfully. Please log in."
        }), 200

    except Exception as e:
        if conn:
            conn.rollback()

        print("RESET PASSWORD ERROR:", repr(e))

        return jsonify({
            "error": "Could not reset password"
        }), 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


# =========================================================
# AUTHENTICATION DECORATOR
# =========================================================

def require_auth(required_role=None):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            auth_header = request.headers.get("Authorization", "")

            if not auth_header.startswith("Bearer "):
                return jsonify({
                    "error": "Missing or invalid Authorization header"
                }), 401

            token = auth_header.split(" ", 1)[1]

            try:
                payload = verify_token(token)
            except Exception:
                payload = None

            if payload is None:
                return jsonify({
                    "error": "Invalid or expired token"
                }), 401

            if (
                required_role
                and payload.get("role") != required_role
            ):
                return jsonify({
                    "error": f"Requires {required_role} role"
                }), 403

            request.user = payload
            return f(*args, **kwargs)

        return wrapper

    return decorator
