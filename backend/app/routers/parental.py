import io
import csv
import json
import uuid
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
from app.database import get_db

router = APIRouter(prefix="/api/parental", tags=["Parental Oversight & Usage Analytics"])

class PinVerifyRequest(BaseModel):
    pin: str

class PinChangeRequest(BaseModel):
    old_pin: str
    new_pin: str

class StudySessionLogRequest(BaseModel):
    course_id: Optional[str] = "general"
    session_type: str = "focus_timer" # "focus_timer", "study_chat", "quiz", "notes"
    duration_minutes: int
    notes: Optional[str] = ""

@router.post("/verify_pin")
def verify_parent_pin(req: PinVerifyRequest):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM parental_settings WHERE key = 'parent_pin'")
        row = cursor.fetchone()
        stored_pin = row["value"] if row else "1234"

    if req.pin.strip() == stored_pin.strip():
        return {"success": True, "authenticated": True, "message": "Access granted"}
    raise HTTPException(status_code=401, detail="Invalid Parent Security PIN. Default is 1234.")

@router.post("/change_pin")
def change_parent_pin(req: PinChangeRequest):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM parental_settings WHERE key = 'parent_pin'")
        row = cursor.fetchone()
        stored_pin = row["value"] if row else "1234"

        if req.old_pin.strip() != stored_pin.strip():
            raise HTTPException(status_code=401, detail="Current PIN is incorrect.")

        if len(req.new_pin.strip()) < 4:
            raise HTTPException(status_code=400, detail="New PIN must be at least 4 digits.")

        cursor.execute("UPDATE parental_settings SET value = ? WHERE key = 'parent_pin'", (req.new_pin.strip(),))
        conn.commit()

    return {"success": True, "message": "PIN updated successfully"}

@router.get("/summary")
def get_parental_summary():
    """
    Computes overall student usage statistics, study time, and web safety for parents.
    """
    today_str = date.today().isoformat()

    with get_db() as conn:
        cursor = conn.cursor()

        # 1. Study time today
        cursor.execute("""
        SELECT SUM(duration_minutes) as today_minutes, COUNT(*) as sessions_today
        FROM study_sessions
        WHERE timestamp LIKE ?
        """, (f"{today_str}%",))
        today_row = cursor.fetchone()
        today_minutes = today_row["today_minutes"] or 0
        sessions_today = today_row["sessions_today"] or 0

        # 2. Total study time all-time
        cursor.execute("SELECT SUM(duration_minutes) as total_minutes, COUNT(*) as total_sessions FROM study_sessions")
        total_row = cursor.fetchone()
        total_minutes = total_row["total_minutes"] or 0
        total_sessions = total_row["total_sessions"] or 0

        # 3. Web activity count today & total
        cursor.execute("SELECT COUNT(*) FROM web_activity_logs WHERE timestamp LIKE ?", (f"{today_str}%",))
        web_queries_today = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM web_activity_logs")
        web_queries_total = cursor.fetchone()[0]

        # 4. Questions asked in Study Chat
        cursor.execute("SELECT COUNT(*) FROM study_messages WHERE role = 'user'")
        questions_asked = cursor.fetchone()[0]

        # 5. Course breakdown
        cursor.execute("""
        SELECT c.name, COUNT(ss.id) as sessions_count, COALESCE(SUM(ss.duration_minutes), 0) as minutes_spent
        FROM courses c
        LEFT JOIN study_sessions ss ON c.id = ss.course_id
        GROUP BY c.id
        """)
        course_breakdown = [dict(r) for r in cursor.fetchall()]

        # 6. Daily limit
        cursor.execute("SELECT value FROM parental_settings WHERE key = 'daily_limit_minutes'")
        limit_row = cursor.fetchone()
        daily_limit = int(limit_row["value"]) if limit_row else 240

    return {
        "today": {
            "date": today_str,
            "study_minutes": today_minutes,
            "study_hours": round(today_minutes / 60, 1),
            "sessions_count": sessions_today,
            "web_queries_count": web_queries_today,
            "daily_limit_minutes": daily_limit,
            "limit_percent_used": round((today_minutes / daily_limit) * 100, 1) if daily_limit > 0 else 0
        },
        "all_time": {
            "total_study_minutes": total_minutes,
            "total_study_hours": round(total_minutes / 60, 1),
            "total_sessions": total_sessions,
            "web_queries_total": web_queries_total,
            "questions_asked": questions_asked
        },
        "course_breakdown": course_breakdown,
        "app_status": "Monitored & Safe"
    }

@router.get("/web_activity")
def get_web_activity_logs(limit: int = 50):
    """
    Returns recent web search queries, URLs opened, and content extracted.
    Allows parents to monitor all Internet browsing conducted through TARA.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT * FROM web_activity_logs
        ORDER BY timestamp DESC
        LIMIT ?
        """, (limit,))
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

@router.get("/study_time")
def get_study_time_logs(limit: int = 50):
    """
    Returns granular study session logs with timestamps, durations, and course references.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT ss.*, COALESCE(c.name, 'General Study Session') as course_name
        FROM study_sessions ss
        LEFT JOIN courses c ON ss.course_id = c.id
        ORDER BY ss.timestamp DESC
        LIMIT ?
        """, (limit,))
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

@router.post("/log_session")
def log_study_session(req: StudySessionLogRequest):
    """
    Logs an active study block or Pomodoro session for parental tracking.
    """
    session_id = str(uuid.uuid4())
    now_iso = datetime.now().isoformat()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO study_sessions (id, course_id, session_type, duration_minutes, notes, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (
            session_id,
            req.course_id,
            req.session_type,
            req.duration_minutes,
            req.notes or "",
            now_iso
        ))
        conn.commit()

    return {"success": True, "session_id": session_id, "duration": req.duration_minutes}

@router.get("/export_report")
def export_parental_report_csv():
    """
    Generates a full parental oversight report in CSV format
    including study hours and web queries accessed.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        # Study sessions
        cursor.execute("""
        SELECT ss.timestamp, COALESCE(c.name, 'General') as course, ss.session_type, ss.duration_minutes, ss.notes
        FROM study_sessions ss
        LEFT JOIN courses c ON ss.course_id = c.id
        ORDER BY ss.timestamp DESC
        """)
        session_rows = cursor.fetchall()

        # Web activity
        cursor.execute("""
        SELECT timestamp, activity_type, query_or_url, summary, safety_flag
        FROM web_activity_logs
        ORDER BY timestamp DESC
        """)
        web_rows = cursor.fetchall()

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["=== TARA AI AGENT - PARENTAL OVERSIGHT REPORT ==="])
    writer.writerow(["Generated At", datetime.now().strftime("%Y-%m-%d %H:%M:%S")])
    writer.writerow([])

    writer.writerow(["--- SECTION 1: STUDY SESSIONS & TIME ON APP ---"])
    writer.writerow(["Timestamp", "Course", "Session Type", "Duration (Minutes)", "Notes"])
    for s in session_rows:
        writer.writerow([s["timestamp"], s["course"], s["session_type"], s["duration_minutes"], s["notes"]])

    writer.writerow([])
    writer.writerow(["--- SECTION 2: WEB ACTIVITIES & ACCESSED CONTENT ---"])
    writer.writerow(["Timestamp", "Activity Type", "Search Query or Web URL", "Content Summary", "Safety Status"])
    for w in web_rows:
        writer.writerow([w["timestamp"], w["activity_type"], w["query_or_url"], w["summary"], w["safety_flag"]])

    csv_data = output.getvalue()
    filename = f"Parental_Supervision_Report_{date.today().isoformat()}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
