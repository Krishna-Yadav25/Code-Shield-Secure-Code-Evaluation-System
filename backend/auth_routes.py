
from flask import Blueprint, request, jsonify
from functools import wraps

import os
import sys

sys.path.append(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "database"
    )
)

from auth import (
    register_user,
    login_user,
    verify_token
)


auth_bp = Blueprint("auth", __name__)


# =========================================================
# REGISTER
# =========================================================

@auth_bp.route("/register", methods=["POST"])
def register():

    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Request body is required"
        }), 400

    username = data.get("username")
    email = data.get("email")
    password = data.get("password")
    role = data.get("role")

    if not all([username, email, password, role]):
        return jsonify({
            "error": "username, email, password, and role are all required"
        }), 400

    if role not in ["student", "teacher"]:
        return jsonify({
            "error": "Role must be student or teacher"
        }), 400

    success, message = register_user(
        username,
        email,
        password,
        role
    )

    if success:
        return jsonify({
            "message": message
        }), 201

    return jsonify({
        "error": message
    }), 400


# =========================================================
# LOGIN
# =========================================================

@auth_bp.route("/login", methods=["POST"])
def login():

    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Request body is required"
        }), 400

    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({
            "error": "email and password are required"
        }), 400

    success, token_or_error, role = login_user(
        email,
        password
    )

    if success:
        return jsonify({
            "token": token_or_error,
            "role": role
        }), 200

    return jsonify({
        "error": token_or_error
    }), 401


# =========================================================
# AUTHENTICATION DECORATOR
# =========================================================

def require_auth(required_role=None):

    def decorator(f):

        @wraps(f)
        def wrapper(*args, **kwargs):

            auth_header = request.headers.get(
                "Authorization",
                ""
            )

            if not auth_header.startswith("Bearer "):
                return jsonify({
                    "error": "Missing or invalid Authorization header"
                }), 401

            token = auth_header.split(" ", 1)[1]

            payload = verify_token(token)

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