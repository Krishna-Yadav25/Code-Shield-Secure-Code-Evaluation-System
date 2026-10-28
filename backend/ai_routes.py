# from flask import Blueprint, request, jsonify

# from database.auth import get_connection
# from assessment_routes import require_role, close_db

# import ai_service


# ai_bp = Blueprint("ai", __name__, url_prefix="/api")

# MAX_SAVE_AT_ONCE = 20


# def teacher_owns_contest(contest_id, teacher_id):
#     conn = cur = None

#     try:
#         conn = get_connection()
#         cur = conn.cursor()

#         cur.execute(
#             """
#             SELECT 1
#             FROM Contests
#             WHERE contest_id = %s AND created_by = %s
#             """,
#             (contest_id, teacher_id)
#         )

#         return cur.fetchone() is not None

#     finally:
#         close_db(cur, conn)


# # =========================================================
# # Generate draft questions (nothing is saved here)
# # POST /api/teacher/tests/<contest_id>/ai/generate
# # =========================================================

# @ai_bp.route(
#     "/teacher/tests/<int:contest_id>/ai/generate",
#     methods=["POST"]
# )
# @require_role("teacher")
# def ai_generate_questions(contest_id):
#     data = request.get_json(silent=True) or {}

#     topic = str(data.get("topic", "")).strip()
#     notes = str(data.get("notes", "")).strip()
#     difficulty = str(data.get("difficulty", "Easy")).strip().capitalize()

#     try:
#         count = int(data.get("count", 3))
#     except (TypeError, ValueError):
#         return jsonify({"error": "count must be a number"}), 400

#     if len(topic) < 3:
#         return jsonify({"error": "Please describe the topic (at least 3 characters)"}), 400

#     if len(topic) > 500 or len(notes) > 1000:
#         return jsonify({"error": "Topic or notes are too long"}), 400

#     if difficulty not in ai_service.VALID_DIFFICULTIES:
#         return jsonify({"error": "Difficulty must be Easy, Medium or Hard"}), 400

#     if not 1 <= count <= ai_service.MAX_QUESTIONS:
#         return jsonify({
#             "error": f"You can generate 1 to {ai_service.MAX_QUESTIONS} questions at a time"
#         }), 400

#     try:
#         if not teacher_owns_contest(contest_id, request.user["user_id"]):
#             return jsonify({"error": "Test not found or access denied"}), 404

#         questions = ai_service.generate_questions(
#             topic, difficulty, count, notes
#         )

#         return jsonify({"questions": questions}), 200

#     except ai_service.AIServiceError as exc:
#         return jsonify({"error": str(exc)}), 502

#     except Exception as exc:
#         print("AI generate error:", exc)
#         return jsonify({"error": "Could not generate questions"}), 500


# # =========================================================
# # Save the questions the teacher selected
# # POST /api/teacher/tests/<contest_id>/ai/save
# # =========================================================

# @ai_bp.route(
#     "/teacher/tests/<int:contest_id>/ai/save",
#     methods=["POST"]
# )
# @require_role("teacher")
# def ai_save_questions(contest_id):
#     data = request.get_json(silent=True) or {}
#     raw_questions = data.get("questions")

#     if not isinstance(raw_questions, list) or not raw_questions:
#         return jsonify({"error": "Select at least one question"}), 400

#     if len(raw_questions) > MAX_SAVE_AT_ONCE:
#         return jsonify({
#             "error": f"You can add up to {MAX_SAVE_AT_ONCE} questions at once"
#         }), 400

#     # Re-validate on the server: the teacher may have edited the drafts.
#     cleaned = []

#     for raw in raw_questions:
#         try:
#             cleaned.append(ai_service.clean_question(raw))
#         except ValueError as exc:
#             return jsonify({"error": str(exc)}), 400

#     conn = cur = None

#     try:
#         if not teacher_owns_contest(contest_id, request.user["user_id"]):
#             return jsonify({"error": "Test not found or access denied"}), 404

#         conn = get_connection()
#         cur = conn.cursor()

#         created = []

#         for question in cleaned:
#             cur.execute(
#                 """
#                 INSERT INTO Problems
#                 (
#                     contest_id,
#                     title,
#                     statement,
#                     difficulty,
#                     time_limit_ms,
#                     memory_limit_mb,
#                     max_marks
#                 )
#                 VALUES (%s, %s, %s, %s, %s, %s, %s)
#                 RETURNING problem_id
#                 """,
#                 (
#                     contest_id,
#                     question["title"],
#                     question["statement"],
#                     question["difficulty"],
#                     question["time_limit_ms"],
#                     question["memory_limit_mb"],
#                     question["max_marks"],
#                 )
#             )

#             problem_id = cur.fetchone()[0]

#             for case in question["test_cases"]:
#                 cur.execute(
#                     """
#                     INSERT INTO TestCases
#                     (
#                         problem_id,
#                         input,
#                         expected_output,
#                         is_hidden
#                     )
#                     VALUES (%s, %s, %s, %s)
#                     """,
#                     (
#                         problem_id,
#                         case["input"],
#                         case["expected_output"],
#                         case["is_hidden"],
#                     )
#                 )

#             created.append({
#                 "problem_id": problem_id,
#                 "title": question["title"],
#             })

#         # One transaction: either every question is saved or none.
#         conn.commit()

#         return jsonify({
#             "message": f"{len(created)} question(s) added to the test",
#             "created": created,
#         }), 201

#     except Exception as exc:
#         if conn:
#             conn.rollback()
#         print("AI save error:", exc)
#         return jsonify({"error": "Could not save the questions"}), 500

#     finally:
#         close_db(cur, conn)



from flask import Blueprint, request, jsonify

from database.auth import get_connection
from assessment_routes import require_role, close_db
import ai_service

ai_bp = Blueprint("ai", __name__, url_prefix="/api")

MAX_SAVE_AT_ONCE = 20


def teacher_owns_contest(contest_id, teacher_id):
    conn = cur = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT 1 FROM Contests
            WHERE contest_id = %s AND created_by = %s
            """,
            (contest_id, teacher_id),
        )
        return cur.fetchone() is not None
    finally:
        close_db(cur, conn)


def validate_generation(data):
    topic = str(data.get("topic", "")).strip()
    notes = str(data.get("notes", "")).strip()
    difficulty = str(data.get("difficulty", "Easy")).strip().capitalize()

    try:
        count = int(data.get("count", 3))
    except (TypeError, ValueError):
        return None, (jsonify({"error": "Count must be a number"}), 400)

    if len(topic) < 3:
        return None, (jsonify({"error": "Topic must contain at least 3 characters"}), 400)

    if len(topic) > 500 or len(notes) > 1000:
        return None, (jsonify({"error": "Topic or notes are too long"}), 400)

    if difficulty not in ai_service.VALID_DIFFICULTIES:
        return None, (jsonify({"error": "Difficulty must be Easy, Medium or Hard"}), 400)

    if not 1 <= count <= ai_service.MAX_QUESTIONS:
        return None, (
            jsonify({
                "error": f"Generate between 1 and {ai_service.MAX_QUESTIONS} questions"
            }),
            400,
        )

    return (topic, notes, difficulty, count), None


def generate_response(data):
    values, error_response = validate_generation(data)
    if error_response:
        return error_response

    topic, notes, difficulty, count = values

    try:
        questions = ai_service.generate_questions(
            topic, difficulty, count, notes
        )
        return jsonify({"questions": questions}), 200
    except ai_service.AIServiceError as exc:
        return jsonify({"error": str(exc)}), 502
    except Exception as exc:
        print("AI generate error:", exc)
        return jsonify({"error": "Could not generate questions"}), 500


# Generate questions before creating a test.
# POST /api/teacher/ai/generate
@ai_bp.route("/teacher/ai/generate", methods=["POST"])
@require_role("teacher")
def ai_generate_without_test():
    data = request.get_json(silent=True) or {}
    return generate_response(data)


# Existing compatible route for a test that already exists.
# POST /api/teacher/tests/<contest_id>/ai/generate
@ai_bp.route(
    "/teacher/tests/<int:contest_id>/ai/generate",
    methods=["POST"],
)
@require_role("teacher")
def ai_generate_questions(contest_id):
    if not teacher_owns_contest(contest_id, request.user["user_id"]):
        return jsonify({"error": "Test not found or access denied"}), 404

    data = request.get_json(silent=True) or {}
    return generate_response(data)


# Save selected questions to an existing test.
# POST /api/teacher/tests/<contest_id>/ai/save
@ai_bp.route(
    "/teacher/tests/<int:contest_id>/ai/save",
    methods=["POST"],
)
@require_role("teacher")
def ai_save_questions(contest_id):
    data = request.get_json(silent=True) or {}
    raw_questions = data.get("questions")

    if not isinstance(raw_questions, list) or not raw_questions:
        return jsonify({"error": "Select at least one question"}), 400

    if len(raw_questions) > MAX_SAVE_AT_ONCE:
        return jsonify({
            "error": f"You can add up to {MAX_SAVE_AT_ONCE} questions at once"
        }), 400

    cleaned = []
    for raw in raw_questions:
        try:
            cleaned.append(ai_service.clean_question(raw))
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    conn = cur = None
    try:
        if not teacher_owns_contest(contest_id, request.user["user_id"]):
            return jsonify({"error": "Test not found or access denied"}), 404

        conn = get_connection()
        cur = conn.cursor()
        created = []

        for question in cleaned:
            cur.execute(
                """
                INSERT INTO Problems
                    (contest_id, title, statement, difficulty,
                     time_limit_ms, memory_limit_mb, max_marks)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING problem_id
                """,
                (
                    contest_id,
                    question["title"],
                    question["statement"],
                    question["difficulty"],
                    question["time_limit_ms"],
                    question["memory_limit_mb"],
                    question["max_marks"],
                ),
            )

            problem_id = cur.fetchone()[0]

            for case in question["test_cases"]:
                cur.execute(
                    """
                    INSERT INTO TestCases
                        (problem_id, input, expected_output, is_hidden)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (
                        problem_id,
                        case["input"],
                        case["expected_output"],
                        case["is_hidden"],
                    ),
                )

            created.append({
                "problem_id": problem_id,
                "title": question["title"],
            })

        conn.commit()
        return jsonify({
            "message": f"{len(created)} question(s) added to the test",
            "created": created,
        }), 201

    except Exception as exc:
        if conn:
            conn.rollback()
        print("AI save error:", exc)
        return jsonify({"error": "Could not save the questions"}), 500
    finally:
        close_db(cur, conn)
