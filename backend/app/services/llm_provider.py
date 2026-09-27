import json
import logging
import re
from typing import Dict, Any, List, Optional
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

STUDY_GROUNDED_SYSTEM_PROMPT = """You are TARA, an elite, voice-first Course-Grounded Study Assistant.
You have strict instructions:
1. Answer ONLY using the facts and information contained in the provided Course Context.
2. If the context does not contain enough information to answer the question, you MUST explicitly state:
   "I cannot find the answer to that in your uploaded course materials."
   Do NOT attempt to guess, extrapolate, or answer from general outside knowledge.
3. Every factual statement should refer clearly to the source material.
4. Structure your response with clear formatting, concise bullet points where appropriate, and a warm, academic tone suitable for voice readback.
"""

GENERAL_AGENT_SYSTEM_PROMPT = """You are TARA, an autonomous AI productivity agent with access to desktop and browser automation tools.
Your capabilities include:
- web_search(query: str): Search the web for up-to-date information.
- open_url(url: str): Open any webpage in the user's browser.
- extract_page_content(url: str): Extract text and summary from a web page.
- take_screenshot(): Capture an instant screenshot of the user's display.
- open_application(app_name: str): Launch a desktop application (e.g. notepad, calc, terminal, code, chrome).
- calculator(expression: str): Compute mathematical or statistical equations.

CRITICAL INSTRUCTION FOR TOOL USE:
When a user asks you to search, open a link, extract a website, open an app, or take a screenshot, you MUST propose the tool in the following JSON format at the very end of your response:
```json
{
  "tool_name": "name_of_tool",
  "arguments": { "arg_name": "arg_value" },
  "reason": "Brief explanation of why this action is needed"
}
```
State clearly what action you will take once the user approves the permission prompt.
"""

def extract_grounded_answer_from_chunks(query: str, chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Local extractive QA engine when no third-party API key is configured.
    Provides 100% genuine grounding from the uploaded document chunks without hallucinating.
    """
    if not chunks:
        return {
            "answer": "I cannot find the answer to that in your uploaded course materials. Please upload relevant course documents or check your query.",
            "grounded": False
        }

    # Extract keywords from query
    query_words = set(re.findall(r'\b[a-zA-Z0-9]{3,}\b', query.lower()))
    stop_words = {
        "what", "when", "where", "which", "who", "whom", "whose", "why", "how",
        "does", "explain", "describe", "tell", "about", "your", "this", "that",
        "with", "from", "and", "the", "its", "for", "are", "was", "were", "been",
        "have", "has", "had", "will", "would", "could", "should", "may", "might",
        "can", "into", "onto", "then", "than", "more", "some", "such", "other",
        "each", "every", "all", "any", "both", "give", "list", "show", "find"
    }
    keywords = {w for w in query_words if w not in stop_words and len(w) >= 3}

    matched_sentences = []
    for chunk in chunks:
        content = chunk.get("content", "")
        filename = chunk.get("filename", "Course Document")
        page = chunk.get("page_number", 1)
        
        sentences = re.split(r'(?<=[.!?])\s+', content)
        for s in sentences:
            s_clean = s.strip()
            if len(s_clean) < 20:
                continue
            s_words = set(re.findall(r'\b[a-zA-Z0-9]{3,}\b', s_clean.lower()))
            overlap = keywords.intersection(s_words)
            if overlap:
                matched_sentences.append({
                    "sentence": s_clean,
                    "score": len(overlap),
                    "filename": filename,
                    "page": page
                })

    # If no informative query keywords matched any sentence in the retrieved chunks
    if not matched_sentences or len(matched_sentences) == 0:
        return {
            "answer": "I cannot find the answer to that in your uploaded course materials. As a strict course-grounded study assistant, I only answer from your ingested notes and textbooks.",
            "grounded": False
        }

    # Filter for top matches having genuine overlap
    matched_sentences.sort(key=lambda x: x["score"], reverse=True)
    if matched_sentences[0]["score"] == 0:
        return {
            "answer": "I cannot find the answer to that in your uploaded course materials. None of the ingested notes or textbooks contain information answering this query.",
            "grounded": False
        }

    top_matches = matched_sentences[:4]
    unique_sentences = []
    seen = set()
    for m in top_matches:
        if m["sentence"] not in seen:
            seen.add(m["sentence"])
            unique_sentences.append(f"• {m['sentence']} (Source: {m['filename']}, Page {m['page']})")

    answer_text = (
        f"Based on your uploaded course documents:\n\n" +
        "\n\n".join(unique_sentences) +
        "\n\n*(Extracted directly from indexed course pages. Configure an AI provider in Settings for expanded generative answers.)*"
    )
    return {
        "answer": answer_text,
        "grounded": True
    }


async def call_gemini(prompt: str, system_prompt: str, model_name: str) -> Optional[str]:
    api_key = settings.GEMINI_API_KEY.strip()
    if not api_key:
        return None

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name=model_name or "gemini-1.5-flash",
            system_instruction=system_prompt
        )
        response = await model.generate_content_async(prompt)
        if response and response.text:
            return response.text
    except Exception as e:
        logger.error(f"Gemini API call failed: {e}")
        # Try direct REST fallback
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name or 'gemini-1.5-flash'}:generateContent?key={api_key}"
            payload = {
                "contents": [{"parts": [{"text": f"System: {system_prompt}\n\nUser: {prompt}"}]}],
                "generationConfig": {"temperature": 0.2, "maxOutputTokens": 1024}
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            return parts[0].get("text", "")
        except Exception as e2:
            logger.error(f"Gemini REST fallback failed: {e2}")
    return None

async def call_openai(prompt: str, system_prompt: str, model_name: str) -> Optional[str]:
    api_key = settings.OPENAI_API_KEY.strip()
    if not api_key:
        return None

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)
        response = await client.chat.completions.create(
            model=model_name or "gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"OpenAI API call failed: {e}")
        return None

async def call_anthropic(prompt: str, system_prompt: str, model_name: str) -> Optional[str]:
    api_key = settings.ANTHROPIC_API_KEY.strip()
    if not api_key:
        return None

    try:
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        payload = {
            "model": model_name or "claude-3-5-sonnet-20241022",
            "max_tokens": 1024,
            "system": system_prompt,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
            if res.status_code == 200:
                data = res.json()
                content = data.get("content", [])
                if content and content[0].get("text"):
                    return content[0]["text"]
            else:
                logger.error(f"Anthropic returned error: {res.status_code} - {res.text}")
    except Exception as e:
        logger.error(f"Anthropic call failed: {e}")
    return None

async def call_groq(prompt: str, system_prompt: str, model_name: str) -> Optional[str]:
    api_key = settings.GROQ_API_KEY.strip()
    if not api_key:
        return None

    try:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": model_name or "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.2
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
            if res.status_code == 200:
                data = res.json()
                return data["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error(f"Groq call failed: {e}")
    return None

async def call_ollama(prompt: str, system_prompt: str, model_name: str) -> Optional[str]:
    base_url = settings.OLLAMA_BASE_URL.rstrip("/")
    try:
        payload = {
            "model": model_name or settings.OLLAMA_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "stream": False
        }
        async with httpx.AsyncClient(timeout=45.0) as client:
            res = await client.post(f"{base_url}/api/chat", json=payload)
            if res.status_code == 200:
                data = res.json()
                return data.get("message", {}).get("content", "")
    except Exception as e:
        logger.warning(f"Ollama call failed (is Ollama running at {base_url}?): {e}")
    return None

async def query_llm(
    prompt: str,
    system_prompt: str,
    provider: Optional[str] = None,
    model: Optional[str] = None
) -> (str, str, str):
    """
    Dispatches prompt to selected or fallback provider.
    Returns: (response_text, provider_used, model_used)
    """
    settings.reload_env()
    selected_provider = (provider or settings.DEFAULT_PROVIDER or "gemini").lower()
    selected_model = model or settings.DEFAULT_MODEL

    response_text = None

    if selected_provider == "gemini" and settings.GEMINI_API_KEY:
        response_text = await call_gemini(prompt, system_prompt, selected_model)
        if response_text:
            return response_text, "Google Gemini", selected_model

    elif selected_provider == "openai" and settings.OPENAI_API_KEY:
        response_text = await call_openai(prompt, system_prompt, selected_model)
        if response_text:
            return response_text, "OpenAI", selected_model

    elif selected_provider == "anthropic" and settings.ANTHROPIC_API_KEY:
        response_text = await call_anthropic(prompt, system_prompt, selected_model)
        if response_text:
            return response_text, "Anthropic", selected_model

    elif selected_provider == "groq" and settings.GROQ_API_KEY:
        response_text = await call_groq(prompt, system_prompt, selected_model)
        if response_text:
            return response_text, "Groq", selected_model

    elif selected_provider == "ollama":
        response_text = await call_ollama(prompt, system_prompt, selected_model)
        if response_text:
            return response_text, "Ollama", selected_model

    # Cascade to any configured key if preferred failed
    if not response_text:
        if settings.GEMINI_API_KEY:
            res = await call_gemini(prompt, system_prompt, "gemini-1.5-flash")
            if res:
                return res, "Google Gemini", "gemini-1.5-flash"
        if settings.OPENAI_API_KEY:
            res = await call_openai(prompt, system_prompt, "gpt-4o-mini")
            if res:
                return res, "OpenAI", "gpt-4o-mini"
        if settings.GROQ_API_KEY:
            res = await call_groq(prompt, system_prompt, "llama-3.3-70b-versatile")
            if res:
                return res, "Groq", "llama-3.3-70b-versatile"
        if settings.ANTHROPIC_API_KEY:
            res = await call_anthropic(prompt, system_prompt, "claude-3-5-sonnet-20241022")
            if res:
                return res, "Anthropic", "claude-3-5-sonnet-20241022"

    return "", "Offline Engine", "extractive-v1"

def parse_tool_proposal_from_response(text: str) -> (str, Optional[Dict[str, Any]]):
    """
    Parses JSON tool proposal block if present in the LLM text.
    """
    json_match = re.search(r'```json\s*(\{[\s\S]*?\})\s*```', text)
    if json_match:
        try:
            tool_data = json.loads(json_match.group(1))
            cleaned_text = text[:json_match.start()].strip()
            return cleaned_text, tool_data
        except Exception:
            pass

    # Direct JSON block match
    json_block = re.search(r'(\{[\s\S]*"tool_name"[\s\S]*\})', text)
    if json_block:
        try:
            tool_data = json.loads(json_block.group(1))
            cleaned_text = text[:json_block.start()].strip()
            return cleaned_text, tool_data
        except Exception:
            pass

    return text, None
