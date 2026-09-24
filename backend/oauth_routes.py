# oauth_routes.py
# CodeShield Google + GitHub OAuth

import os
import sys

from flask import Blueprint, redirect, jsonify
from authlib.integrations.flask_client import OAuth
from dotenv import load_dotenv


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv()


# ============================================================
# DATABASE IMPORT
# ============================================================

sys.path.append(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "database"
    )
)

from auth import (
    get_or_create_google_user,
    get_or_create_github_user,
    create_jwt
)


# ============================================================
# BLUEPRINT
# ============================================================

oauth_bp = Blueprint(
    "oauth",
    __name__
)


# ============================================================
# OAUTH OBJECT
# ============================================================

oauth = OAuth()


# ============================================================
# INITIALIZE OAUTH
# ============================================================

def init_oauth(app):

    oauth.init_app(app)


    # ========================================================
    # GOOGLE
    # ========================================================

    oauth.register(
        name="google",

        client_id=os.getenv(
            "GOOGLE_CLIENT_ID"
        ),

        client_secret=os.getenv(
            "GOOGLE_CLIENT_SECRET"
        ),

        server_metadata_url=(
            "https://accounts.google.com/"
            ".well-known/openid-configuration"
        ),

        client_kwargs={
            "scope": "openid email profile"
        }
    )


    # ========================================================
    # GITHUB
    # ========================================================

    oauth.register(
        name="github",

        client_id=os.getenv(
            "GITHUB_CLIENT_ID"
        ),

        client_secret=os.getenv(
            "GITHUB_CLIENT_SECRET"
        ),

        access_token_url=(
            "https://github.com/login/oauth/access_token"
        ),

        authorize_url=(
            "https://github.com/login/oauth/authorize"
        ),

        api_base_url=(
            "https://api.github.com/"
        ),

        client_kwargs={
            "scope": "read:user user:email"
        }
    )


# ============================================================
# GOOGLE LOGIN
# ============================================================

@oauth_bp.route(
    "/auth/google"
)
def google_login():

    redirect_uri = (
        "http://127.0.0.1:5000/"
        "auth/google/callback"
    )

    return oauth.google.authorize_redirect(
        redirect_uri
    )


# ============================================================
# GOOGLE CALLBACK
# ============================================================

@oauth_bp.route(
    "/auth/google/callback"
)
def google_callback():

    try:

        # Get access token
        token = oauth.google.authorize_access_token()


        # Get Google user information
        user_info = token.get("userinfo")


        if not user_info:

            return jsonify({
                "error":
                    "Could not retrieve Google user information"
            }), 400


        email = user_info.get("email")

        email_verified = user_info.get(
            "email_verified",
            False
        )

        name = user_info.get("name")


        # Validate email
        if not email:

            return jsonify({
                "error":
                    "Google account email not available"
            }), 400


        if not email_verified:

            return jsonify({
                "error":
                    "Google email is not verified"
            }), 400


        # Username fallback
        if not name:

            name = email.split("@")[0]


        # Get/Create CodeShield user
        success, user = get_or_create_google_user(
            email,
            name
        )


        if not success:

            return jsonify({
                "error":
                    "Could not create Google user",
                "details":
                    user
            }), 500


        # Create CodeShield JWT
        jwt_token = create_jwt(
            user["user_id"],
            user["username"],
            user["role"]
        )


        # Redirect to React
        frontend_url = (
            "http://localhost:5173"
        )

        return redirect(
            f"{frontend_url}/"
            f"#oauth=google"
            f"&token={jwt_token}"
            f"&role={user['role']}"
        )


    except Exception as e:

        print(
            "Google OAuth error:",
            e
        )

        return jsonify({
            "error":
                    "Google authentication failed",
            "details":
                    str(e)
        }), 500


# ============================================================
# GITHUB LOGIN
# ============================================================

@oauth_bp.route(
    "/auth/github"
)
def github_login():

    redirect_uri = (
        "http://127.0.0.1:5000/"
        "auth/github/callback"
    )

    return oauth.github.authorize_redirect(
        redirect_uri
    )


# ============================================================
# GITHUB CALLBACK
# ============================================================

@oauth_bp.route(
    "/auth/github/callback"
)
def github_callback():

    try:

        # ----------------------------------------------------
        # GET ACCESS TOKEN
        # ----------------------------------------------------

        token = oauth.github.authorize_access_token()


        # ----------------------------------------------------
        # GET GITHUB PROFILE
        # ----------------------------------------------------

        response = oauth.github.get(
            "user"
        )

        github_user = response.json()


        github_id = github_user.get(
            "id"
        )

        username = github_user.get(
            "login"
        )

        email = github_user.get(
            "email"
        )


        # ----------------------------------------------------
        # GITHUB EMAIL MAY BE PRIVATE
        # ----------------------------------------------------

        if not email:

            email_response = oauth.github.get(
                "user/emails"
            )

            emails = email_response.json()


            # Primary + verified email
            for item in emails:

                if (
                    item.get("primary")
                    and item.get("verified")
                ):

                    email = item.get("email")
                    break


            # Any verified email
            if not email:

                for item in emails:

                    if item.get("verified"):

                        email = item.get("email")
                        break


        # ----------------------------------------------------
        # EMAIL VALIDATION
        # ----------------------------------------------------

        if not email:

            return jsonify({
                "error":
                    "No verified email found in GitHub account"
            }), 400


        # ----------------------------------------------------
        # GET / CREATE CODESHIELD USER
        # ----------------------------------------------------

        result = get_or_create_github_user(
            email,
            username,
            github_id
        )


        # Support both possible return formats
        # (success, user)
        # or
        # (user_id, username, role)

        if len(result) == 2:

            success, user = result

            if not success:

                return jsonify({
                    "error":
                        "Could not create GitHub user",
                    "details":
                        user
                }), 500

        else:

            user_id, db_username, role = result

            user = {
                "user_id": user_id,
                "username": db_username,
                "role": role
            }


        # ----------------------------------------------------
        # CREATE CODESHIELD JWT
        # ----------------------------------------------------

        jwt_token = create_jwt(
            user["user_id"],
            user["username"],
            user["role"]
        )


        # ----------------------------------------------------
        # REDIRECT TO REACT
        # ----------------------------------------------------

        frontend_url = (
            "http://localhost:5173"
        )

        return redirect(
            f"{frontend_url}/"
            f"#oauth=github"
            f"&token={jwt_token}"
            f"&role={user['role']}"
        )


    except Exception as e:

        print(
            "GitHub OAuth error:",
            e
        )

        return jsonify({
            "error":
                    "GitHub authentication failed",
            "details":
                    str(e)
        }), 500