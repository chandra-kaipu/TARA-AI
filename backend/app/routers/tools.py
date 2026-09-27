import json
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
from app.database import get_db
from app.models.schema import (
    ToolPermissionItem,
    ToolPermissionUpdate,
    ToolExecutionLogItem
)
from app.services.agent_tools import execute_agent_tool

router = APIRouter(prefix="/api/tools", tags=["Tools & Permissions"])

@router.get("", response_model=List[ToolPermissionItem])
def list_tool_permissions():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tool_permissions ORDER BY category, display_name")
        rows = cursor.fetchall()
        return [
            ToolPermissionItem(
                tool_name=r["tool_name"],
                display_name=r["display_name"],
                category=r["category"],
                description=r["description"],
                auto_approve=bool(r["auto_approve"]),
                requires_confirmation=bool(r["requires_confirmation"])
            )
            for r in rows
        ]

@router.post("/permissions")
def update_tool_permission(update: ToolPermissionUpdate):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT tool_name FROM tool_permissions WHERE tool_name = ?", (update.tool_name,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Tool not found")

        cursor.execute("""
        UPDATE tool_permissions
        SET auto_approve = ?, requires_confirmation = ?
        WHERE tool_name = ?
        """, (
            1 if update.auto_approve else 0,
            1 if update.requires_confirmation else 0,
            update.tool_name
        ))
        conn.commit()

    return {"success": True, "message": f"Updated permissions for {update.tool_name}"}

@router.get("/logs", response_model=List[ToolExecutionLogItem])
def get_execution_logs(limit: int = 50):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT * FROM tool_execution_logs
        ORDER BY executed_at DESC
        LIMIT ?
        """, (limit,))
        rows = cursor.fetchall()
        
        logs = []
        for r in rows:
            try:
                args = json.loads(r["arguments"])
            except Exception:
                args = {}
            logs.append(ToolExecutionLogItem(
                id=r["id"],
                tool_name=r["tool_name"],
                arguments=args,
                status=r["status"],
                result=r["result"],
                error=r["error"],
                executed_at=r["executed_at"]
            ))
        return logs

@router.delete("/logs")
def clear_execution_logs():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM tool_execution_logs")
        conn.commit()
    return {"message": "Execution logs cleared"}

@router.post("/test_run")
def test_run_tool(payload: Dict[str, Any]):
    tool_name = payload.get("tool_name")
    args = payload.get("arguments", {})
    if not tool_name:
        raise HTTPException(status_code=400, detail="Missing tool_name")

    res = execute_agent_tool(tool_name, args)
    return res
