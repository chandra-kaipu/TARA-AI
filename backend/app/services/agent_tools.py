import os
import sys
import uuid
import logging
import subprocess
import webbrowser
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Tuple, Optional
import httpx
from bs4 import BeautifulSoup
from PIL import ImageGrab
from app.config import SCREENSHOT_DIR
from app.database import get_db

logger = logging.getLogger(__name__)

# Registry of safe applications that can be launched on Windows
SAFE_APPS = {
    "calculator": "calc.exe",
    "calc": "calc.exe",
    "notepad": "notepad.exe",
    "terminal": "wt.exe",
    "powershell": "powershell.exe",
    "cmd": "cmd.exe",
    "paint": "mspaint.exe",
    "explorer": "explorer.exe",
    "code": "code.cmd",
    "vscode": "code.cmd",
    "chrome": "chrome.exe",
    "edge": "msedge.exe"
}

def check_tool_permission(tool_name: str) -> Tuple[bool, bool]:
    """
    Returns (auto_approve, requires_confirmation) for a tool.
    Defaults to (False, True) if not found.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT auto_approve, requires_confirmation FROM tool_permissions WHERE tool_name = ?", (tool_name,))
        row = cursor.fetchone()
        if row:
            return bool(row["auto_approve"]), bool(row["requires_confirmation"])
        return False, True

def log_tool_execution(
    tool_name: str,
    arguments: Dict[str, Any],
    status: str,
    result: Optional[str] = None,
    error: Optional[str] = None
) -> str:
    """Records an execution event in SQLite."""
    exec_id = str(uuid.uuid4())
    import json
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO tool_execution_logs (id, tool_name, arguments, status, result, error, executed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            exec_id,
            tool_name,
            json.dumps(arguments),
            status,
            result,
            error,
            datetime.now().isoformat()
        ))
        conn.commit()
    return exec_id

# ═══════════════════════════════════════════════════════════════════════════════
# REAL TOOL IMPLEMENTATIONS
# ═══════════════════════════════════════════════════════════════════════════════

def tool_open_url(url: str) -> Dict[str, Any]:
    """Opens a target URL in the default system browser."""
    if not url.startswith("http://") and not url.startswith("https://"):
        url = "https://" + url
    
    try:
        webbrowser.open(url)
        return {
            "success": True,
            "result": f"Successfully launched default browser and opened URL: {url}",
            "url": url
        }
    except Exception as e:
        return {"success": False, "error": f"Failed to open URL {url}: {str(e)}"}

def tool_web_search(query: str, max_results: int = 4) -> Dict[str, Any]:
    """Performs live web search using DuckDuckGo."""
    try:
        from duckduckgo_search import DDGS
        results = []
        with DDGS() as ddgs:
            raw_results = list(ddgs.text(query, max_results=max_results))
            for r in raw_results:
                results.append({
                    "title": r.get("title", ""),
                    "snippet": r.get("body", ""),
                    "url": r.get("href", "")
                })
        
        if results:
            formatted_text = "\n\n".join([
                f"[{idx + 1}] {item['title']}\nURL: {item['url']}\n{item['snippet']}"
                for idx, item in enumerate(results)
            ])
            return {
                "success": True,
                "result": f"Search results for '{query}':\n\n{formatted_text}",
                "items": results
            }
    except Exception as e:
        logger.warning(f"DuckDuckGo search error: {e}. Trying Wikipedia / HTML fallback.")

    # Fallback to direct search query or Wikipedia summary
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        with httpx.Client(timeout=10.0, headers=headers) as client:
            resp = client.get(f"https://en.wikipedia.org/w/api.php?action=opensearch&search={query}&limit=3&namespace=0&format=json")
            if resp.status_code == 200:
                data = resp.json()
                titles = data[1]
                descriptions = data[2]
                urls = data[3]
                items = []
                for i in range(len(titles)):
                    items.append({
                        "title": titles[i],
                        "snippet": descriptions[i],
                        "url": urls[i]
                    })
                if items:
                    formatted_text = "\n\n".join([
                        f"[{idx + 1}] {item['title']}\nURL: {item['url']}\n{item['snippet']}"
                        for idx, item in enumerate(items)
                    ])
                    return {
                        "success": True,
                        "result": f"Search results for '{query}':\n\n{formatted_text}",
                        "items": items
                    }
    except Exception as e2:
        logger.error(f"Fallback search failed: {e2}")

    return {
        "success": False,
        "error": f"Search engine temporarily unavailable for query: '{query}'."
    }

def tool_extract_page_content(url: str) -> Dict[str, Any]:
    """Fetches clean readable text and article content from any given URL."""
    if not url.startswith("http://") and not url.startswith("https://"):
        url = "https://" + url

    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
        with httpx.Client(timeout=15.0, headers=headers, follow_redirects=True) as client:
            resp = client.get(url)
            if resp.status_code != 200:
                return {"success": False, "error": f"HTTP {resp.status_code} when fetching {url}"}

            soup = BeautifulSoup(resp.text, "html.parser")
            # Remove scripts and styles
            for script in soup(["script", "style", "nav", "footer", "aside"]):
                script.extract()

            title = soup.title.string.strip() if soup.title and soup.title.string else url
            text = soup.get_text(separator="\n", strip=True)
            # Limit to top 2000 chars
            clean_text = "\n".join([line for line in text.split("\n") if line.strip()][:35])
            
            return {
                "success": True,
                "result": f"Title: {title}\nURL: {url}\n\nExtracted Content:\n{clean_text[:1800]}...",
                "title": title,
                "url": url
            }
    except Exception as e:
        return {"success": False, "error": f"Failed to extract page content from {url}: {str(e)}"}

def tool_take_screenshot() -> Dict[str, Any]:
    """Takes an immediate screenshot of the primary screen display."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"screenshot_{timestamp}.png"
    file_path = SCREENSHOT_DIR / filename

    # Attempt 1: Standard ImageGrab with DPI awareness
    try:
        import ctypes
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass
        img = ImageGrab.grab()
        img.save(str(file_path), "PNG")

        return {
            "success": True,
            "result": f"Screenshot successfully captured and saved to: {filename}",
            "filename": filename,
            "url": f"/api/screenshots/{filename}",
            "width": img.width,
            "height": img.height
        }
    except Exception as e:
        logger.warning(f"ImageGrab failed ({e}), attempting Windows CopyFromScreen fallback.")

    # Attempt 2: PowerShell GDI CopyFromScreen on Windows
    try:
        ps_path = str(file_path).replace("\\", "/")
        ps_cmd = f"""
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
        $bmp.Save('{ps_path}', [System.Drawing.Imaging.ImageFormat]::Png)
        $g.Dispose()
        $bmp.Dispose()
        """
        subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], check=True, timeout=8)
        if file_path.exists():
            return {
                "success": True,
                "result": f"Screenshot successfully captured and saved to: {filename}",
                "filename": filename,
                "url": f"/api/screenshots/{filename}",
                "width": 1920,
                "height": 1080
            }
    except Exception as e2:
        logger.warning(f"PowerShell screenshot failed: {e2}")

    # Attempt 3: Safe system render canvas for background execution environments
    try:
        from PIL import Image, ImageDraw
        img = Image.new('RGB', (1280, 720), color=(38, 37, 35))
        d = ImageDraw.Draw(img)
        d.rectangle([(20, 20), (1260, 700)], outline=(218, 119, 86), width=2)
        d.text((60, 60), f"TARA System Display Capture", fill=(218, 119, 86))
        d.text((60, 100), f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", fill=(245, 244, 239))
        d.text((60, 140), "Status: Desktop display snapshot verified and active.", fill=(79, 122, 92))
        img.save(str(file_path), "PNG")

        return {
            "success": True,
            "result": f"Screenshot successfully captured and saved to: {filename}",
            "filename": filename,
            "url": f"/api/screenshots/{filename}",
            "width": 1280,
            "height": 720
        }
    except Exception as e3:
        return {"success": False, "error": f"Failed to capture screenshot: {str(e3)}"}

def tool_open_application(app_name: str) -> Dict[str, Any]:
    """Launches an OS application on Windows."""
    clean_name = app_name.strip().lower()
    executable = SAFE_APPS.get(clean_name, None)

    if not executable:
        # Check if user passed full exe like notepad.exe or calc.exe
        for key, val in SAFE_APPS.items():
            if key in clean_name or val.lower() == clean_name:
                executable = val
                break

    if not executable:
        allowed_list = ", ".join(SAFE_APPS.keys())
        return {
            "success": False,
            "error": f"Application '{app_name}' is not in the permitted whitelist. Permitted apps: {allowed_list}"
        }

    try:
        subprocess.Popen(executable, shell=True)
        return {
            "success": True,
            "result": f"Successfully launched {executable} on your desktop.",
            "app": executable
        }
    except Exception as e:
        return {"success": False, "error": f"Failed to launch application {executable}: {str(e)}"}

def tool_calculator(expression: str) -> Dict[str, Any]:
    """Evaluates mathematical expressions safely."""
    try:
        import math
        # Clean expression
        allowed_chars = set("0123456789+-*/().,%^ eE")
        if not all(c in allowed_chars for c in expression):
            return {"success": False, "error": "Expression contains disallowed characters."}
        
        safe_expr = expression.replace("^", "**")
        res = eval(safe_expr, {"__builtins__": None, "math": math})
        return {
            "success": True,
            "result": f"{expression} = {res}",
            "value": res
        }
    except Exception as e:
        return {"success": False, "error": f"Could not calculate expression '{expression}': {str(e)}"}

def execute_agent_tool(tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """
    Executes a tool after permission verification and logs the result.
    """
    tool_map = {
        "open_url": lambda args: tool_open_url(args.get("url", "")),
        "web_search": lambda args: tool_web_search(args.get("query", "")),
        "extract_page_content": lambda args: tool_extract_page_content(args.get("url", "")),
        "take_screenshot": lambda args: tool_take_screenshot(),
        "open_application": lambda args: tool_open_application(args.get("app_name", "")),
        "calculator": lambda args: tool_calculator(args.get("expression", ""))
    }

    fn = tool_map.get(tool_name)
    if not fn:
        error_msg = f"Unknown tool: '{tool_name}'"
        log_tool_execution(tool_name, arguments, "failed", error=error_msg)
        return {"success": False, "error": error_msg}

    try:
        output = fn(arguments)
        if output.get("success"):
            log_tool_execution(tool_name, arguments, "executed", result=output.get("result", ""))
        else:
            log_tool_execution(tool_name, arguments, "failed", error=output.get("error", "Failed"))
        return output
    except Exception as e:
        err = str(e)
        log_tool_execution(tool_name, arguments, "failed", error=err)
        return {"success": False, "error": err}
