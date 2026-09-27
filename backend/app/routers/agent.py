import re
import uuid
import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from app.database import get_db
from app.models.schema import (
    AgentQueryRequest,
    AgentQueryResponse,
    ToolProposal,
    ToolConfirmationRequest
)
from app.services.memory import AgentMemory
from app.services.agent_tools import (
    check_tool_permission,
    execute_agent_tool,
    log_tool_execution
)
from app.services.llm_provider import (
    query_llm,
    parse_tool_proposal_from_response,
    GENERAL_AGENT_SYSTEM_PROMPT
)

router = APIRouter(prefix="/api/agent", tags=["General Agent"])

TOOL_DISPLAY_NAMES = {
    "open_url": "Open Browser URL",
    "web_search": "Search Web",
    "extract_page_content": "Extract Web Page Content",
    "take_screenshot": "Capture Screen",
    "open_application": "Launch OS Application",
    "calculator": "Mathematical Calculation"
}

def detect_tool_intent_from_user_text(text: str) -> Optional[Dict[str, Any]]:
    """Heuristic tool parser to guarantee instant live tool proposals even without an external LLM key."""
    t = text.lower().strip()
    
    # 1. Screenshot
    if any(k in t for k in ["take a screenshot", "capture screen", "screenshot", "screen grab", "snap screen"]):
        return {
            "tool_name": "take_screenshot",
            "arguments": {},
            "reason": "User requested a screenshot of their current display."
        }

    # 2. Open URL
    url_match = re.search(r'(https?://[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.(?:com|org|io|dev|edu|gov|net)[^\s]*)', text)
    if any(w in t for w in ["open", "visit", "go to", "browse"]) and url_match:
        url = url_match.group(1)
        return {
            "tool_name": "open_url",
            "arguments": {"url": url},
            "reason": f"Open the destination webpage '{url}' in your default browser."
        }

    # 3. Extract page content
    if any(w in t for w in ["summarize page", "extract page", "read page", "scrape", "get text from"]) and url_match:
        url = url_match.group(1)
        return {
            "tool_name": "extract_page_content",
            "arguments": {"url": url},
            "reason": f"Fetch and read the readable content from {url}."
        }

    # 4. Open Application
    if any(w in t for w in ["open", "launch", "start"]) and any(app in t for app in ["calc", "calculator", "notepad", "terminal", "powershell", "cmd", "paint", "explorer", "code", "vscode", "chrome"]):
        for app_key in ["calculator", "calc", "notepad", "terminal", "powershell", "cmd", "paint", "explorer", "code", "vscode", "chrome"]:
            if app_key in t:
                return {
                    "tool_name": "open_application",
                    "arguments": {"app_name": app_key},
                    "reason": f"Launch the desktop program '{app_key}' on your computer."
                }

    # 5. Web Search
    if t.startswith("search ") or t.startswith("google ") or t.startswith("lookup ") or "search the web" in t or "find online" in t:
        clean_q = re.sub(r'^(search for|search|google|lookup|find online for|find online)\s*', '', text, flags=re.IGNORECASE).strip()
        if clean_q:
            return {
                "tool_name": "web_search",
                "arguments": {"query": clean_q},
                "reason": f"Search the live web for '{clean_q}' using DuckDuckGo."
            }

    # 6. Math / Calculator
    if (t.startswith("calc ") or t.startswith("calculate ") or re.search(r'^\d+[\s\+\-\*\/\^\%]+[\d\s\+\-\*\/\^\%]+$', t)):
        expr = re.sub(r'^(calc|calculate)\s*', '', text, flags=re.IGNORECASE).strip()
        return {
            "tool_name": "calculator",
            "arguments": {"expression": expr},
            "reason": f"Compute numerical expression '{expr}'."
        }

    return None

@router.post("/query", response_model=AgentQueryResponse)
async def query_general_agent(req: AgentQueryRequest):
    session_id = req.session_id or "default"
    user_msg = req.message.strip()
    if not user_msg:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Save user message to persistent memory
    AgentMemory.add_message(session_id, "user", user_msg)

    # Check for direct tool intent
    tool_data = detect_tool_intent_from_user_text(user_msg)
    provider_used = "TARA Agent Engine"
    model_used = "tara-agent-v1"

    if not tool_data:
        # Format history context
        past_history = AgentMemory.format_history_for_prompt(session_id, limit=8)
        prompt = f"CONVERSATION HISTORY:\n{past_history}\n\nUSER MESSAGE:\n{user_msg}"

        llm_response, provider_used, model_used = await query_llm(
            prompt=prompt,
            system_prompt=GENERAL_AGENT_SYSTEM_PROMPT,
            provider=req.provider,
            model=req.model
        )

        if llm_response:
            cleaned_text, parsed_tool = parse_tool_proposal_from_response(llm_response)
            content_text = cleaned_text
            tool_data = parsed_tool
        else:
            content_text = f"I am ready to help you. You can ask me general questions, research topics, or ask me to perform desktop actions like taking a screenshot, opening an app (calculator, notepad), searching the web, or opening links."
    else:
        content_text = f"I can execute that for you using the **{TOOL_DISPLAY_NAMES.get(tool_data['tool_name'], tool_data['tool_name'])}** tool."

    tool_proposal = None
    tool_executed = None

    if tool_data:
        tool_name = tool_data.get("tool_name")
        args = tool_data.get("arguments", {})
        reason = tool_data.get("reason", f"Execute {tool_name}")
        auto_approve, requires_confirmation = check_tool_permission(tool_name)

        if auto_approve:
            # Execute immediately without modal
            exec_result = execute_agent_tool(tool_name, args)
            tool_executed = {
                "tool_name": tool_name,
                "display_name": TOOL_DISPLAY_NAMES.get(tool_name, tool_name),
                "arguments": args,
                "result": exec_result
            }
            content_text += f"\n\n**Action Result:**\n{exec_result.get('result') or exec_result.get('error')}"
            AgentMemory.add_message(session_id, "assistant", content_text, tool_call=tool_data, tool_result=exec_result)
        else:
            # Propose tool to user for visible permission step
            tool_proposal = ToolProposal(
                tool_name=tool_name,
                display_name=TOOL_DISPLAY_NAMES.get(tool_name, tool_name),
                arguments=args,
                reason=reason,
                requires_confirmation=True
            )
            content_text += f"\n\nPlease review and confirm permission to execute `{tool_name}`."
            AgentMemory.add_message(session_id, "assistant", content_text, tool_call=tool_data)
    else:
        AgentMemory.add_message(session_id, "assistant", content_text)

    msg_id = str(uuid.uuid4())
    return AgentQueryResponse(
        message_id=msg_id,
        session_id=session_id,
        role="assistant",
        content=content_text,
        tool_proposal=tool_proposal,
        tool_executed=tool_executed,
        provider_used=provider_used
    )

@router.post("/confirm_tool")
async def confirm_tool_execution(req: ToolConfirmationRequest):
    session_id = req.session_id
    tool_name = req.tool_name
    args = req.arguments
    approved = req.approved

    if not approved:
        # User rejected the action
        log_tool_execution(tool_name, args, "rejected", result="User denied execution permission.")
        reject_msg = f"Execution of `{tool_name}` was cancelled by the user."
        AgentMemory.add_message(session_id, "assistant", reject_msg)
        return {
            "success": False,
            "message": reject_msg,
            "status": "rejected"
        }

    # User approved action -> execute!
    result = execute_agent_tool(tool_name, args)
    
    if result.get("success"):
        summary_msg = f"Executed `{tool_name}` successfully:\n\n{result.get('result')}"
    else:
        summary_msg = f"Failed executing `{tool_name}`: {result.get('error')}"

    AgentMemory.add_message(
        session_id,
        "assistant",
        summary_msg,
        tool_call={"tool_name": tool_name, "arguments": args},
        tool_result=result
    )

    return {
        "success": result.get("success", False),
        "status": "executed",
        "result": result,
        "message": summary_msg
    }

@router.get("/{session_id}/messages")
def get_agent_history(session_id: str):
    return AgentMemory.get_history(session_id)

@router.delete("/{session_id}/messages")
def clear_agent_history(session_id: str):
    AgentMemory.clear_history(session_id)
    return {"message": "Agent history cleared"}
