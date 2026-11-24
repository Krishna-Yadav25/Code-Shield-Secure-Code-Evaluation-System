
import os
import time
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import errors


# =========================================================
# LOAD ENVIRONMENT FILE
# Supports:
#   codeshield/.env
#   codeshield/backend/.env
# =========================================================

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BACKEND_DIR.parent

backend_env = BACKEND_DIR / ".env"
project_env = PROJECT_DIR / ".env"

if backend_env.exists():
    load_dotenv(backend_env)
elif project_env.exists():
    load_dotenv(project_env)
else:
    raise FileNotFoundError(
        "Could not find .env in backend or project root."
    )


# =========================================================
# API CONFIGURATION
# =========================================================

API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY is missing. Check your .env file."
    )

client = genai.Client(api_key=API_KEY)

MODEL_NAME = "gemini-3.6-flash"

PROMPT = """
Create one simple DSA coding question about arrays.
Keep it under 100 words.
Include the question and a small example.
"""


# =========================================================
# GENERATE RESPONSE WITH RETRIES
# =========================================================

def test_gemini():
    max_attempts = 3

    for attempt in range(1, max_attempts + 1):
        try:
            print(f"Calling Gemini model: {MODEL_NAME}")

            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=PROMPT,
            )

            if not response or not response.text:
                print("Gemini returned an empty response.")
                return

            print("\n" + "=" * 50)
            print("GEMINI CONNECTION SUCCESSFUL")
            print("=" * 50)
            print(response.text)
            print("=" * 50)
            return

        except errors.APIError as exc:
            status_code = getattr(exc, "code", None)

            print(
                f"API request failed "
                f"(attempt {attempt}/{max_attempts})."
            )
            print(f"HTTP status: {status_code}")
            print(f"Error: {exc}")

            temporary_error = (
                status_code in (429, 500, 502, 503, 504)
            )

            if temporary_error and attempt < max_attempts:
                wait_seconds = 2 ** attempt
                print(f"Retrying in {wait_seconds} seconds...")
                time.sleep(wait_seconds)
            else:
                print(
                    "\nGemini test failed. Check model availability, "
                    "API quota, billing and service status."
                )
                return

        except Exception as exc:
            print("Unexpected error:", exc)
            return


# =========================================================
# MAIN
# =========================================================

if __name__ == "__main__":
    print("Gemini API key found:", bool(API_KEY))
    test_gemini()