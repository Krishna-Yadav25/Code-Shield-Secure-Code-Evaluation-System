#result
import psycopg2
DB_CONFIG = {
    "dbname": "codeshield_db",
    "user": "postgres",
    "password": "codeshield123",
    "host": "localhost",
    "port": "5432"
}
def save_submission_result(submission_id, verdict, exec_time_ms, memory_kb,passed, total):
    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        cur.execute(
            "UPDATE Submissions SET status = %s WHERE submission_id = %s",
            ("completed", submission_id)
        )
        cur.execute("""INSERT INTO Results(submission_id, verdict, execution_time_ms, memory_used_kb,test_cases_passed, test_cases_total)
                    VALUES (%s, %s, %s, %s, %s, %s)""",(submission_id, verdict, exec_time_ms, memory_kb, passed, total)
        )
        conn.commit()
        print(f"Submission {submission_id}: verdict={verdict} saved atomically.")
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Transaction failed, rolled back: {e}")
    finally:
        if conn:
            conn.close()
if __name__ == "__main__":
    save_submission_result(
        submission_id=1,
        verdict="AC",
        exec_time_ms=45,
        memory_kb=14000,
        passed=3,
        total=3
    )