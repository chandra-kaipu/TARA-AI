import csv
import io
import json
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, Response
from app.database import get_db

router = APIRouter(prefix="/api/analytics", tags=["Evaluation & Feedback Analytics"])

@router.get("/course/{course_id}")
def get_course_evaluation_metrics(course_id: str):
    """
    Computes pilot evaluation metrics and student feedback analytics
    as required by the 4th Year Major Project rubric.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Verify course
        cursor.execute("SELECT name, code FROM courses WHERE id = ?", (course_id,))
        course_row = cursor.fetchone()
        if not course_row:
            raise HTTPException(status_code=404, detail="Course not found")

        # Total student queries (assistant answers)
        cursor.execute("""
        SELECT id, content, citations, feedback, timestamp
        FROM study_messages
        WHERE course_id = ? AND role = 'assistant'
        ORDER BY timestamp DESC
        """, (course_id,))
        assistant_rows = cursor.fetchall()

        cursor.execute("""
        SELECT content, timestamp
        FROM study_messages
        WHERE course_id = ? AND role = 'user'
        ORDER BY timestamp DESC
        """, (course_id,))
        user_rows = cursor.fetchall()

        total_questions = len(assistant_rows)
        helpful_count = 0
        unhelpful_count = 0
        unrated_count = 0
        grounded_count = 0

        evaluations = []
        for idx, row in enumerate(assistant_rows):
            cits = []
            if row["citations"]:
                try:
                    cits = json.loads(row["citations"])
                except Exception:
                    pass

            is_grounded = len(cits) > 0 and "cannot find the answer" not in row["content"].lower()
            if is_grounded:
                grounded_count += 1

            fb = row["feedback"]
            if fb == "up":
                helpful_count += 1
            elif fb == "down":
                unhelpful_count += 1
            else:
                unrated_count += 1

            # Match corresponding user question if available
            user_question = user_rows[idx]["content"] if idx < len(user_rows) else "Question"

            evaluations.append({
                "message_id": row["id"],
                "question": user_question,
                "answer": row["content"][:240] + ("..." if len(row["content"]) > 240 else ""),
                "citation_count": len(cits),
                "is_grounded": is_grounded,
                "feedback": fb or "Unrated",
                "timestamp": row["timestamp"]
            })

        total_rated = helpful_count + unhelpful_count
        usefulness_score = round((helpful_count / total_rated) * 100, 1) if total_rated > 0 else 100.0
        grounding_accuracy = round((grounded_count / total_questions) * 100, 1) if total_questions > 0 else 100.0

        return {
            "course_id": course_id,
            "course_name": course_row["name"],
            "course_code": course_row["code"],
            "institution": "KPRIT (Kommuri Pratap Reddy Institute of Technology)",
            "project_track": "Major Project 4th Year — Voice-First Course Grounded Assistant",
            "reference_standard": "Lewis et al., NeurIPS 2020 (RAG Grounding)",
            "metrics": {
                "total_student_queries": total_questions,
                "grounded_answers": grounded_count,
                "unanswered_safe_rejections": total_questions - grounded_count,
                "grounding_accuracy_rate": f"{grounding_accuracy}%",
                "student_feedback_total": total_rated,
                "helpful_ratings": helpful_count,
                "unhelpful_ratings": unhelpful_count,
                "unrated_count": unrated_count,
                "student_usefulness_score": f"{usefulness_score}%"
            },
            "recent_evaluations": evaluations[:10]
        }

@router.get("/course/{course_id}/export_csv")
def export_course_feedback_csv(course_id: str):
    """
    Exports student pilot evaluation data to CSV for project review submission.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name, code FROM courses WHERE id = ?", (course_id,))
        course_row = cursor.fetchone()
        if not course_row:
            raise HTTPException(status_code=404, detail="Course not found")

        cursor.execute("""
        SELECT sm.id, sm.role, sm.content, sm.citations, sm.feedback, sm.timestamp
        FROM study_messages sm
        WHERE sm.course_id = ?
        ORDER BY sm.timestamp ASC
        """, (course_id,))
        rows = cursor.fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Message ID", "Course", "Role", "Content", "Citations Count", "Student Feedback", "Timestamp"])

    for r in rows:
        cit_count = 0
        if r["citations"]:
            try:
                cit_count = len(json.loads(r["citations"]))
            except Exception:
                pass
        writer.writerow([r["id"], course_row["name"], r["role"], r["content"], cit_count, r["feedback"] or "none", r["timestamp"]])

    csv_data = output.getvalue()
    filename = f"KPRIT_Evaluation_Report_{course_row['code'] or 'Course'}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
