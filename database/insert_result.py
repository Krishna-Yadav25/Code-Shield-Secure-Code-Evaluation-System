
import os
import psycopg2
from dotenv import load_dotenv
load_dotenv()

# DATABASE CONNECTION
def get_connection():
    return psycopg2.connect(
        dbname=os.getenv(
            "DB_NAME",
            "codeshield_db"
        ),

        user=os.getenv(
            "DB_USER",
            "postgres"
        ),

        password=os.getenv(
            "DB_PASSWORD"
        ),

        host=os.getenv(
            "DB_HOST",
            "localhost"
        ),

        port=os.getenv(
            "DB_PORT",
            "5432"
        )
    )

# CREATE SUBMISSION
def create_submission(
    user_id,
    problem_id,
    code,
    language="cpp"
):
    conn = None
    cur = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO Submissions
            (
                user_id,
                problem_id,
                code,
                language,
                status
            )
            VALUES
            (
                %s,
                %s,
                %s,
                %s,
                %s
            )
            RETURNING submission_id
            """,
            (
                user_id,
                problem_id,
                code,
                language,
                "pending"
            )
        )
        submission_id = cur.fetchone()[0]
        conn.commit()
        return submission_id
    except Exception:
        if conn:
            conn.rollback()

        raise
    finally:
        if cur:
            cur.close()

        if conn:
            conn.close()

# UPDATE SUBMISSION STATUS
def update_submission_status(
    submission_id,
    status
):
    conn = None
    cur = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE Submissions
            SET status = %s
            WHERE submission_id = %s
            """,
            (
                status,
                submission_id
            )
        )
        conn.commit()
    except Exception:
        if conn:
            conn.rollback()

        raise
    finally:
        if cur:
            cur.close()

        if conn:
            conn.close()

# SAVE EXECUTION RESULT
def insert_result(
    submission_id,
    verdict,
    execution_time_ms=0,
    memory_used_kb=0,
    test_cases_passed=0,
    test_cases_total=0
):
    conn = None
    cur = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO Results
            (
                submission_id,
                verdict,
                execution_time_ms,
                memory_used_kb,
                test_cases_passed,
                test_cases_total
            )
            VALUES
            (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s
            )
            """,
            (
                submission_id,
                verdict,
                execution_time_ms,
                memory_used_kb,
                test_cases_passed,
                test_cases_total
            )
        )

        conn.commit()
    except Exception:

        if conn:
            conn.rollback()

        raise
    finally:

        if cur:
            cur.close()

        if conn:
            conn.close()