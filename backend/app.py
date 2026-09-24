






import os
import uuid
import queue
import threading
import subprocess

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv


# ============================================================
# LOAD ENVIRONMENT
# ============================================================

load_dotenv()


# ============================================================
# AUTH IMPORTS
# ============================================================

from auth_routes import auth_bp
from oauth_routes import oauth_bp, init_oauth
from dashboard_routes import dashboard_bp
from coding_routes import coding_bp


# ============================================================
# FLASK APP
# ============================================================

app = Flask(__name__)


# Secret key required by Flask sessions
app.secret_key = os.getenv(
    "FLASK_SECRET_KEY",
    "codeshield_flask_dev_secret"
)


# ============================================================
# CORS
# ============================================================

CORS(app)


# ============================================================
# REGISTER BLUEPRINTS
# ============================================================

app.register_blueprint(
    auth_bp
)

init_oauth(app)

app.register_blueprint(
    oauth_bp
)

app.register_blueprint(
    dashboard_bp
)
app.register_blueprint(
    coding_bp
    )

# ============================================================
# JOB QUEUE
# ============================================================

job_queue = queue.Queue()


# ============================================================
# RESULT STORAGE
# ============================================================

results = {}


# ============================================================
# SANDBOX EXECUTOR
# ============================================================

SANDBOX_EXECUTOR_PATH = (
    "../sandbox/sandbox_executor"
)


# ============================================================
# WORKER
# ============================================================

def worker():

    while True:

        job = job_queue.get()

        submission_id = job[
            "submission_id"
        ]

        code = job[
            "code"
        ]

        source_path = (
            f"/tmp/submission_"
            f"{submission_id}.py"
        )


        results[
            submission_id
        ] = {
            "status": "running",
            "output": None
        }


        try:

            # ------------------------------------------------
            # WRITE SOURCE FILE
            # ------------------------------------------------

            with open(
                source_path,
                "w"
            ) as f:

                f.write(code)


            os.chmod(
                source_path,
                0o755
            )


            # ------------------------------------------------
            # RUN SANDBOX
            # ------------------------------------------------

            proc = subprocess.run(
                [
                    "sudo",
                    SANDBOX_EXECUTOR_PATH,
                    source_path
                ],
                capture_output=True,
                text=True,
                timeout=10
            )


            output = (
                proc.stdout +
                proc.stderr
            )


            results[
                submission_id
            ] = {
                "status": "completed",
                "output": output
            }


        except subprocess.TimeoutExpired:

            results[
                submission_id
            ] = {
                "status": "completed",
                "output":
                    "VERDICT: Time Limit Exceeded "
                    "(API-level timeout)"
            }


        except Exception as e:

            results[
                submission_id
            ] = {
                "status": "completed",
                "output":
                    f"Execution error: {e}"
            }


        finally:

            # ------------------------------------------------
            # CLEAN TEMP FILE
            # ------------------------------------------------

            try:

                if os.path.exists(
                    source_path
                ):

                    os.remove(
                        source_path
                    )

            except Exception:

                pass


            job_queue.task_done()


# ============================================================
# START WORKER
# ============================================================

threading.Thread(
    target=worker,
    daemon=True
).start()


# ============================================================
# SUBMIT CODE
# ============================================================

@app.route(
    "/submit",
    methods=["POST"]
)
def submit_code():

    data = request.get_json()


    if not data:

        return jsonify({
            "error":
                "Request body is required"
        }), 400


    code = data.get(
        "code",
        ""
    )


    if not code.strip():

        return jsonify({
            "error":
                "Code cannot be empty"
        }), 400


    submission_id = str(
        uuid.uuid4()
    )[:8]


    results[
        submission_id
    ] = {
        "status": "pending",
        "output": None
    }


    job_queue.put({
        "submission_id":
            submission_id,

        "code":
            code
    })


    return jsonify({
        "submission_id":
            submission_id,

        "status":
            "queued"
    })


# ============================================================
# GET RESULT
# ============================================================

@app.route(
    "/result/<submission_id>",
    methods=["GET"]
)
def get_result(
    submission_id
):

    result = results.get(
        submission_id
    )


    if not result:

        return jsonify({
            "error":
                "submission not found"
        }), 404


    return jsonify(
        result
    )


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route(
    "/",
    methods=["GET"]
)
def home():

    return jsonify({

        "project":
            "CodeShield",

        "status":
            "Backend running",

        "authentication":
            "Email/Password + Google OAuth + GitHub OAuth"

    })


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":

    app.run(
        debug=True,
        port=5000
    )