import os
import datetime

import psycopg2
import bcrypt
import jwt

from dotenv import load_dotenv

load_dotenv()

# DATABASE CONFIGURATION

DB_CONFIG = {
    "dbname": "codeshield_db",
    "user": "postgres",
    "password": "codeshield123",
    "host": "localhost",
    "port": "5432"
}

# DATABASE CONNECTION

def get_connection():
    return psycopg2.connect(**DB_CONFIG)

# JWT CONFIGURATION

JWT_SECRET = os.getenv(
    "JWT_SECRET_KEY",
    "codeshield_dev_secret_change_this_later"
)

JWT_EXPIRY_HOURS = 24

# CREATE JWT

def create_jwt(user_id, username, role):

    payload = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "exp": datetime.datetime.utcnow()
        + datetime.timedelta(hours=JWT_EXPIRY_HOURS)
    }

    token = jwt.encode(
        payload,
        JWT_SECRET,
        algorithm="HS256"
    )

    return token

# REGISTER USER

def register_user(username, email, password, role):

    if role not in ("student", "teacher"):
        return False, "Role must be 'student' or 'teacher'"

    password_hash = bcrypt.hashpw(
        password.encode(),
        bcrypt.gensalt()
    ).decode()

    conn = None

    try:

        conn = get_connection()

        cur = conn.cursor()

        cur.execute(
            """
            INSERT INTO Users
                (username, email, password_hash, role)
            VALUES
                (%s, %s, %s, %s)
            RETURNING user_id
            """,
            (
                username,
                email,
                password_hash,
                role
            )
        )

        user_id = cur.fetchone()[0]

        conn.commit()

        return True, f"User created with id {user_id}"

    except psycopg2.errors.UniqueViolation:

        if conn:
            conn.rollback()

        return False, "Username or email already exists"

    except Exception as e:

        if conn:
            conn.rollback()

        return False, f"Registration failed: {e}"

    finally:

        if conn:
            conn.close()

# LOGIN USER

def login_user(email, password):

    conn = None

    try:

        conn = get_connection()

        cur = conn.cursor()

        cur.execute(
            """
            SELECT
                user_id,
                username,
                password_hash,
                role
            FROM Users
            WHERE email = %s
            """,
            (email,)
        )

        row = cur.fetchone()

        if row is None:
            return False, "No account found with this email", None

        user_id, username, password_hash, role = row

        if not bcrypt.checkpw(
            password.encode(),
            password_hash.encode()
        ):
            return False, "Incorrect password", None

        token = create_jwt(
            user_id,
            username,
            role
        )

        return True, token, role

    except Exception as e:

        return False, f"Login failed: {e}", None

    finally:

        if conn:
            conn.close()

# GOOGLE USER

def get_or_create_google_user(email, username):

    conn = None

    try:

        conn = get_connection()

        cur = conn.cursor()

        cur.execute(
            """
            SELECT
                user_id,
                username,
                role
            FROM Users
            WHERE email = %s
            """,
            (email,)
        )

        row = cur.fetchone()

        if row:
            user_id, existing_username, role = row
            return True, {
                "user_id": user_id,
                "username": existing_username,
                "role": role
            }

        role = "student"

        random_password = os.urandom(32)

        password_hash = bcrypt.hashpw(
            random_password,
            bcrypt.gensalt()
        ).decode()

        base_username = username.strip().replace(" ", "_")

        if not base_username:
            base_username = "google_user"

        base_username = base_username[:40]

        final_username = base_username

        counter = 1

        while True:

            cur.execute(
                """
                SELECT user_id
                FROM Users
                WHERE username = %s
                """,
                (final_username,)
            )

            existing = cur.fetchone()

            if existing is None:
                break

            suffix = f"_{counter}"

            final_username = (
                base_username[:50 - len(suffix)]
                + suffix
            )

            counter += 1

        cur.execute(
            """
            INSERT INTO Users
                (
                    username,
                    email,
                    password_hash,
                    role
                )
            VALUES
                (%s, %s, %s, %s)
            RETURNING user_id
            """,
            (
                final_username,
                email,
                password_hash,
                role
            )
        )

        user_id = cur.fetchone()[0]

        conn.commit()

        return True, {
            "user_id": user_id,
            "username": final_username,
            "role": role
        }

    except Exception as e:

        if conn:
            conn.rollback()

        print(
            "Google user creation error:",
            e
        )

        return False, str(e)

    finally:

        if conn:
            conn.close()

# GITHUB USER

def get_or_create_github_user(email, username, github_id):

    conn = get_connection()

    cur = conn.cursor()

    try:

        cur.execute(
            """
            SELECT
                user_id,
                username,
                role
            FROM Users
            WHERE email = %s
            """,
            (email,)
        )

        existing_user = cur.fetchone()

        if existing_user:

            return (
                existing_user[0],
                existing_user[1],
                existing_user[2]
            )

        base_username = username or email.split("@")[0]

        new_username = base_username

        counter = 1

        while True:

            cur.execute(
                """
                SELECT user_id
                FROM Users
                WHERE username = %s
                """,
                (new_username,)
            )

            if not cur.fetchone():
                break

            new_username = f"{base_username}{counter}"

            counter += 1

        random_password_hash = bcrypt.hashpw(
            os.urandom(32),
            bcrypt.gensalt()
        ).decode()

        cur.execute(
            """
            INSERT INTO Users
            (
                username,
                email,
                password_hash,
                role
            )
            VALUES (%s, %s, %s, %s)
            RETURNING user_id
            """,
            (
                new_username,
                email,
                random_password_hash,
                "student"
            )
        )

        user_id = cur.fetchone()[0]

        conn.commit()

        return (
            user_id,
            new_username,
            "student"
        )

    except Exception:

        conn.rollback()

        raise

    finally:

        cur.close()
        conn.close()

# VERIFY JWT

def verify_token(token):

    try:

        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=["HS256"]
        )

        return payload

    except jwt.ExpiredSignatureError:

        return None

    except jwt.InvalidTokenError:

        return None

# MANUAL TEST

if __name__ == "__main__":

    ok, msg = register_user(
        "test_student",
        "student@test.com",
        "password123",
        "student"
    )

    print(
        "Register:",
        ok,
        msg
    )

    ok, token_or_error, role = login_user(
        "student@test.com",
        "password123"
    )

    print(
        "Login:",
        ok,
        token_or_error,
        role
    )