# TARA — AI Study & Productivity Agent

> **Voice-first AI study companion and desktop productivity agent with strict document grounding, isolated vector memory, and human-in-the-loop tool governance.**

Built with **FastAPI**, **React + Vite**, **FAISS Vector Storage**, **PyMuPDF**, and styled using Anthropic/Claude's warm oat & terracotta design palette.

---

## 1. What TARA Is

### (A) General Productivity Agent
- **Conversational Memory:** Persistent session memory stored in SQLite.
- **Desktop & Browser Automation Tools:**
  - `web_search`: Live search queries via DuckDuckGo.
  - `open_url`: Opens links in the system's default browser.
  - `extract_page_content`: Scrapes and extracts readable article text.
  - `take_screenshot`: Captures full screen displays instantly.
  - `open_application`: Launches desktop programs (Calculator, Notepad, VS Code, Terminal, etc.).
  - `calculator`: Numerical and statistical solver.
- **Human-In-The-Loop (HITL) Gate:** Every tool call generates a visible permission confirmation card. Actions are never executed until explicitly approved by the user (unless configured to auto-approve in the Governance matrix).

### (B) Course-Grounded Study Assistant
- **Course Knowledge Bases:** Upload syllabus, lecture slides, and textbook PDFs.
- **Per-Course Vector Isolation:** Each course maintains its own isolated FAISS vector index (`sentence-transformers all-MiniLM-L6-v2`, 384-dimensional dense embeddings). Notes never bleed across courses.
- **Strict Grounding:** TARA answers **ONLY** from ingested course material. If an answer is not in the documents, TARA explicitly states so rather than hallucinating from general knowledge (as established in Lewis et al., *Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks*, NeurIPS 2020).
- **Verifiable Citations:** Every answer displays exact citations with source file names, page numbers, and chunk previews.
- **Dual Voice-First Experience:** 
  - **Client-Side:** Hands-free wake-word listening ("TARA") or press-to-talk with Web Speech API.
  - **Server-Side TTS (gTTS):** High-fidelity natural spoken audio generated directly via Google Text-to-Speech (`POST /api/voice/synthesize`).
- **Feedback & Pilot Evaluation Loop:** Student thumbs up / down feedback stored in SQLite, with real-time usefulness analytics and one-click CSV report export for project reviews.

### (C) Laptop & PC Study Workspace
- **Dual-Pane Live Markdown Scratchpad:** Real-time side-by-side editing and formatted preview optimized for laptop screens.
- **AI Notes Reviewer & Explainer:** One-click "Ask TARA to Review" analyzes student notes, explains hard concepts, and suggests revision questions.
- **Auto-Saving & Multi-Format Export:** Notes auto-save to SQLite and can be downloaded as `.md` files.
- **Fullscreen Focus Mode (`Ctrl+Shift+F`):** Eliminates desktop distractions with an integrated 25-minute Pomodoro timer.
- **Keyboard Shortcuts (`?`):** Fast navigation (`Ctrl+1..6`), instant voice toggle (`Ctrl+Space`), search, and full focus toggle.

### (D) Parental Oversight & Web Safety Portal
- **Security PIN Protected (Default: `1234`):** Access control for parents/guardians to supervise learning without interfering with the student's workflow.
- **Daily Study Time Tracking:** Real-time meter comparing daily usage against target limits (e.g., 240 mins) with session breakdown.
- **Real-Time Web Search & URL Audit:** Every external query executed by TARA logs timestamp, query text, destination URL, and safety flag (`educational`).
- **Comprehensive CSV Export:** Parents can download complete oversight reports documenting total study hours, focus intervals completed, and web activities.

### (E) Web Doubt Clarification & 100% Offline Resilience
- **Multi-Tier Search Engine:** DuckDuckGo live search with fallback to Wikipedia API.
- **100% Offline Resilience:** If the laptop is disconnected from the internet, TARA seamlessly falls back to an internal academic dictionary and local FAISS vector store. Zero crashes, zero unhandled errors.

### (F) Academic & Institutional Alignment
- **Institutional Context:** Tailored as a directly deployable study companion for students at **KPRIT (Kommuri Pratap Reddy Institute of Technology)**.
- **Major Project Specification:** Aligned with Item #6: *"LLM-Powered Voice Assistant Grounded in Course Learning Resources"* (4th Year Major Project).
- **Evaluation Rubric:** Includes Pilot Evaluation metrics (total queries, grounding rate, student usefulness score, and exportable CSV audit report).

---

## 2. Wake-Word Engine: "TARA"

TARA actively listens for the wake word **"TARA"** using browser-based continuous recognition, with an instant click-to-talk fallback button for all environments.

### Phonetic Reference
```text
Keyword:   TARA
IPA:       /ˈtɑːrə/
Syllables: "TAH-rah"
ARPAbet:   T AA1 R AH0
```
*Note: Configured in `frontend/src/services/voice.js` and `backend/app/config.py` for keyword-spotting matching and custom wake-word engine training (e.g. Picovoice Porcupine).*

---

## 3. Design System — Claude Palette & Typography

TARA strictly adheres to Anthropic's warm, considered brand palette:

| Token | Hex Value | Usage |
|---|---|---|
| `--background` | `#F5F4EF` | Warm off-white / oat |
| `--surface` | `#FFFFFF` | Cards, modals, chat bubbles |
| `--surface-alt` | `#EDEAE1` | Card panels, input backgrounds |
| `--text-primary` | `#181716` | High-contrast near-black charcoal |
| `--text-secondary` | `#4A463F` | Readable metadata, subtitles, borders |
| `--accent` | `#DA7756` | Claude signature terracotta / coral |
| `--accent-hover` | `#C4633F` | Button active / hover states |
| `--border` | `#DDD9D0` | Structural dividing borders |
| `--success` | `#3D6B4A` | Grounding checks, verified tools |
| `--warning` | `#B8863A` | Alerts and missing keys |

**Typography Standard:** Letters across all panels, cards, inputs, and tables are scaled to normal, highly readable body sizes (17.5px base, 18.5px standard body text) matching the prominence of headings. Dark mode features high-contrast `#F8F6F2` primary text and `#C8C3B8` secondary text against `#242321` background.

---

## 4. Multi-Provider AI Architecture

TARA features a pluggable multi-provider backend configurable in `.env` or through the in-app **Settings** UI:

1. **Google Gemini:** `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0-flash`
2. **OpenAI:** `gpt-4o`, `gpt-4o-mini`
3. **Anthropic (Claude):** `claude-3-5-sonnet-20241022`, `claude-3-haiku-20240307`
4. **Groq:** `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`
5. **Ollama:** Local, 100% offline models (e.g., `llama3.2`)
6. **Local Extractive Study Engine:** If no API keys are supplied, TARA runs out of the box using local sentence embeddings and strict extractive chunk matching — zero paid keys required to run and test!

---

## 5. Quickstart & Setup Guide

### Prerequisites
- **Python 3.10+** (Tested on Python 3.12)
- **Node.js 18+** (Tested on Node v24)

### Step 1: Clone or Navigate to the Project
```bash
cd tara-ai
```

### Step 2: Set Up Backend
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
# Copy .env.example to .env (already populated with safe defaults)
copy .env.example .env

# Start FastAPI server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
*The backend starts at `http://127.0.0.1:8000` with the starter course "CS 101: Artificial Intelligence & Machine Learning" automatically seeded and indexed.*

### Step 3: Set Up Frontend
In a second terminal window:
```bash
cd tara-ai/frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev -- --host 127.0.0.1 --port 5174
```
*Open `http://127.0.0.1:5174` in your browser.*

---

## 6. Automated End-to-End Verification

To run the automated 23-step end-to-end verification suite:
```bash
cd tara-ai/backend
python test_e2e.py
```

This verifies:
1. Backend health check and API readiness
2. Dashboard analytics and statistics
3. Course list and isolated vector metadata
4. Live PDF document generation, text parsing, and FAISS indexing
5. Grounded study Q&A with exact file and page citations
6. Strict rejection filter on off-topic questions
7. Thumbs up / down feedback persistence
8. General agent tool proposal and HITL confirmation card
9. Real execution of desktop actions (e.g., screenshot)
10. Server-side gTTS voice synthesis
11. Pilot evaluation analytics & KPRIT metrics computation
12. Pilot CSV feedback report export
13. Audit log recording in SQLite
14. Interactive practice quiz generation (grounded MCQs)
15. Course concept flashcards generation
16. Exam revision guide / cheat sheet synthesis
17. Document vector chunks inspector
18. Frontend web app serving on port 5174
19. Parental security PIN verification (`1234`) & dashboard summary
20. Real-time web search doubt clarification & parental safety audit logging
21. Study session & Pomodoro focus time tracking
22. Laptop dual-pane Markdown notes & AI reviewer
23. Parental comprehensive CSV report export

---

## 7. Project Structure

```
tara-ai/
├── backend/
│   ├── app/
│   │   ├── config.py             # Settings, .env loader, API key masking
│   │   ├── database.py           # SQLite persistence, parental & notes schemas
│   │   ├── main.py               # FastAPI entry point & starter seeder
│   │   ├── models/
│   │   │   └── schema.py         # Pydantic models for all API contracts
│   │   ├── services/
│   │   │   ├── ingestion.py      # PDF extraction (PyMuPDF) & chunking
│   │   │   ├── vector_store.py   # Isolated per-course FAISS indexes
│   │   │   ├── llm_provider.py   # Multi-provider LLM caller + fallback
│   │   │   ├── agent_tools.py    # OS & browser automation tools with offline fallbacks
│   │   │   └── memory.py         # Conversational memory for agent
│   │   └── routers/
│   │       ├── dashboard.py      # Metrics and recent activity
│   │       ├── courses.py        # Course CRUD & document ingestion
│   │       ├── study.py          # Grounded Q&A, quizzes, flashcards, revision guides
│   │       ├── agent.py          # General agent & tool confirmations
│   │       ├── tools.py          # Policy matrix, test runs, audit logs
│   │       ├── parental.py       # Parental PIN gate, study meters & web logs
│   │       ├── notes.py          # Laptop Markdown scratchpad & AI reviewer
│   │       ├── voice.py          # Server-side gTTS speech synthesis & Whisper
│   │       ├── analytics.py      # KPRIT pilot evaluation metrics & CSV export
│   │       └── settings.py       # API key management & test connection
│   ├── data/
│   │   ├── tara.db               # SQLite database
│   │   ├── uploads/              # Uploaded PDF and markdown documents
│   │   ├── indices/              # Per-course FAISS vector indexes
│   │   └── screenshots/          # Captured agent screenshots
│   ├── requirements.txt
│   ├── .env.example
│   └── test_e2e.py               # Comprehensive 23-step verification suite
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx        # Voice status, wake word, focus mode, shortcuts
│   │   │   ├── Sidebar.jsx       # Claude palette navigation (with Guardian & PC Tool badges)
│   │   │   ├── AudioWaveform.jsx # Animated audio visualizer
│   │   │   ├── CitationCard.jsx  # Source citation inspector drawer
│   │   │   └── ToolConfirmationModal.jsx # HITL permission modal
│   │   ├── context/
│   │   │   ├── ThemeContext.jsx  # Dark/Light oat theme provider
│   │   │   └── VoiceContext.jsx  # Wake-word & speech state manager
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx     # Overview, stats, and quick actions
│   │   │   ├── Courses.jsx       # Course manager, PDF ingestion & chunk inspector
│   │   │   ├── StudyChat.jsx     # Course grounded Q&A, quizzes, flashcards & web clarify
│   │   │   ├── LaptopNotes.jsx   # Dual-pane PC Markdown scratchpad & AI reviewer
│   │   │   ├── ParentalPortal.jsx# PIN-protected guardian usage & web monitoring
│   │   │   ├── AgentChat.jsx     # General agent & tool cards
│   │   │   ├── PilotEvaluation.jsx # KPRIT Major Project evaluation dashboard
│   │   │   ├── ToolsPermissions.jsx # Tool governance & audit logs
│   │   │   └── Settings.jsx      # API key indicators & voice sliders
│   │   ├── services/
│   │   │   ├── api.js            # API client with parental & notes endpoints
│   │   │   └── voice.js          # Web Speech STT/TTS & wake-word engine
│   │   ├── App.jsx               # Router & global keyboard shortcut listener
│   │   ├── main.jsx
│   │   └── index.css             # Claude design tokens & readable typography
│   ├── package.json
│   └── vite.config.js
└── README.md
```
│   │   │   └── VoiceContext.jsx  # Wake-word & speech state manager
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx     # Overview, stats, and quick actions
│   │   │   ├── Courses.jsx       # Course manager & PDF ingestion
│   │   │   ├── StudyChat.jsx     # Course grounded Q&A with citations
│   │   │   ├── AgentChat.jsx     # General agent & tool cards
│   │   │   ├── PilotEvaluation.jsx # KPRIT Major Project evaluation dashboard
│   │   │   ├── ToolsPermissions.jsx # Tool governance & audit logs
│   │   │   └── Settings.jsx      # API key indicators & voice sliders
│   │   ├── services/
│   │   │   ├── api.js            # API client
│   │   │   └── voice.js          # Web Speech STT/TTS & wake-word engine
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css             # Claude design tokens & typography
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## 8. License
Apache 2.0. Built for voice-first agentic learning and productivity.
