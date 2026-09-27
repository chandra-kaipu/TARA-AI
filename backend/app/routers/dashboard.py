import json
from typing import Dict, Any, List
from fastapi import APIRouter
from app.database import get_db
from app.config import settings

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("/stats")
def get_dashboard_summary():
    with get_db() as conn:
        cursor = conn.cursor()

        # Counts
        cursor.execute("SELECT COUNT(*) FROM courses")
        course_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM documents")
        doc_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM document_chunks")
        chunk_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM study_messages WHERE role = 'assistant'")
        study_queries_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM tool_execution_logs WHERE status = 'executed'")
        tools_executed_count = cursor.fetchone()[0]

        # Recent study interactions
        cursor.execute("""
        SELECT sm.id, sm.course_id, c.name as course_name, sm.role, sm.content, sm.citations, sm.feedback, sm.timestamp
        FROM study_messages sm
        JOIN courses c ON sm.course_id = c.id
        WHERE sm.role = 'assistant'
        ORDER BY sm.timestamp DESC
        LIMIT 4
        """)
        study_rows = cursor.fetchall()
        recent_study = []
        for r in study_rows:
            cits = []
            if r["citations"]:
                try:
                    cits = json.loads(r["citations"])
                except Exception:
                    pass
            recent_study.append({
                "id": r["id"],
                "course_id": r["course_id"],
                "course_name": r["course_name"],
                "content": r["content"][:180] + "..." if len(r["content"]) > 180 else r["content"],
                "citation_count": len(cits),
                "feedback": r["feedback"],
                "timestamp": r["timestamp"]
            })

        # Recent tool logs
        cursor.execute("""
        SELECT id, tool_name, status, result, error, executed_at
        FROM tool_execution_logs
        ORDER BY executed_at DESC
        LIMIT 4
        """)
        tool_rows = cursor.fetchall()
        recent_tools = [
            {
                "id": r["id"],
                "tool_name": r["tool_name"],
                "status": r["status"],
                "summary": (r["result"] or r["error"] or "")[:120],
                "executed_at": r["executed_at"]
            }
            for r in tool_rows
        ]

        # Top courses
        cursor.execute("""
        SELECT c.id, c.name, c.color, COUNT(d.id) as doc_count
        FROM courses c
        LEFT JOIN documents d ON c.id = d.course_id
        GROUP BY c.id
        ORDER BY c.created_at DESC
        LIMIT 3
        """)
        course_summaries = [
            {
                "id": r["id"],
                "name": r["name"],
                "color": r["color"],
                "doc_count": r["doc_count"]
            }
            for r in cursor.fetchall()
        ]

    return {
        "stats": {
            "courses": course_count,
            "documents": doc_count,
            "chunks": chunk_count,
            "study_queries": study_queries_count,
            "tools_executed": tools_executed_count
        },
        "recent_study": recent_study,
        "recent_tools": recent_tools,
        "courses": course_summaries,
        "active_provider": settings.DEFAULT_PROVIDER,
        "active_model": settings.DEFAULT_MODEL,
        "system_status": {
            "vector_engine": "FAISS (all-MiniLM-L6-v2)",
            "voice_stt": "Web Speech API (continuous) / Whisper API ready",
            "voice_tts": "Web SpeechSynthesis / ElevenLabs ready",
            "wake_word": "TARA (/ˈtɑːrə/)"
        }
    }
