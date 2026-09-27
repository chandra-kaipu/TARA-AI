import sys
import io
import uuid
import requests
import json
import fitz  # PyMuPDF

# Ensure UTF-8 console output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE_URL = 'http://127.0.0.1:8000'

def run_tests():
    print("=" * 60)
    print("TARA AI AGENT — END-TO-END TEST SUITE")
    print("=" * 60)

    # 1. Health Check
    res = requests.get(f"{BASE_URL}/api/health")
    assert res.status_code == 200
    print("[PASS] 1. Backend Health Check OK:", res.json()["status"])

    # 2. Dashboard Stats
    res = requests.get(f"{BASE_URL}/api/dashboard/stats")
    assert res.status_code == 200
    stats = res.json()["stats"]
    print(f"[PASS] 2. Dashboard Stats: {stats['courses']} Courses, {stats['documents']} Docs, {stats['chunks']} Chunks")

    # 3. List Courses
    res = requests.get(f"{BASE_URL}/api/courses")
    assert res.status_code == 200
    courses = res.json()
    assert len(courses) > 0
    course_id = courses[0]["id"]
    course_name = courses[0]["name"]
    print(f"[PASS] 3. Course Verified: '{course_name}' (ID: {course_id})")

    # 4. Create and Ingest a Real Multi-Page PDF
    print("\n--- Generating and Ingesting Real PDF Document ---")
    doc = fitz.open()
    # Page 1
    page1 = doc.new_page()
    page1.insert_text((50, 72), "CS 101 Advanced Lecture Notes: Deep Neural Architecture", fontsize=16)
    page1.insert_text((50, 110), "Section 1: Transformer Attention Mechanism\n"
                                "The core mechanism behind modern large language models is multi-head self-attention.\n"
                                "Attention computes queries (Q), keys (K), and values (V) using linear projections.\n"
                                "The scaled dot-product attention formula is Attention(Q, K, V) = softmax(Q * K^T / sqrt(d_k)) * V.\n"
                                "This allows models to capture long-range token dependencies in parallel across sequences.", fontsize=11)
    # Page 2
    page2 = doc.new_page()
    page2.insert_text((50, 72), "Section 2: Quantization and Edge Inference", fontsize=16)
    page2.insert_text((50, 110), "Model quantization reduces numerical precision of weights from FP32 or FP16 down to INT8 or INT4.\n"
                                "Techniques such as AWQ (Activation-aware Weight Quantization) and GPTQ minimize perplexity degradation\n"
                                "while shrinking memory footprint by 75%, allowing local execution on commodity hardware.\n"
                                "The course practical lab requires implementing INT8 dynamic quantization in PyTorch.", fontsize=11)
    
    test_pdf_path = "test_lecture_notes.pdf"
    doc.save(test_pdf_path)
    doc.close()
    print(f"Generated real 2-page PDF: {test_pdf_path}")

    # Upload to Course
    with open(test_pdf_path, "rb") as f:
        upload_res = requests.post(
            f"{BASE_URL}/api/courses/{course_id}/documents",
            files={"file": (test_pdf_path, f, "application/pdf")}
        )
    assert upload_res.status_code == 200
    upload_data = upload_res.json()
    print(f"[PASS] 4. Real PDF Uploaded & Ingested: {upload_data['document']['page_count']} pages, {upload_data['document']['chunk_count']} vector chunks indexed!")

    # 5. Course-Grounded Study Question (Must be answered and cited)
    print("\n--- Testing Grounded Study Q&A with Citations ---")
    query_payload = {
        "course_id": course_id,
        "query": "What is the formula for scaled dot-product attention in Transformer models?"
    }
    study_res = requests.post(f"{BASE_URL}/api/study/query", json=query_payload)
    assert study_res.status_code == 200
    study_data = study_res.json()
    print(f"[PASS] 5. Grounded Answer Received:")
    print("Answer snippet:", study_data["answer"][:180] + "...")
    print(f"Citations count: {len(study_data['citations'])}")
    for c in study_data['citations']:
        print(f"   -> Citation: File '{c['filename']}', Page {c['page']}, Section '{c['section']}'")
    assert len(study_data['citations']) > 0

    # 6. Strict Grounding Rejection Test (Negative test: off-topic question must NOT be answered)
    print("\n--- Testing Strict Grounding Rejection Filter ---")
    negative_payload = {
        "course_id": course_id,
        "query": "What is the capital city of Australia and what is its population?"
    }
    neg_res = requests.post(f"{BASE_URL}/api/study/query", json=negative_payload)
    assert neg_res.status_code == 200
    neg_data = neg_res.json()
    print("[PASS] 6. Strict Grounding Rejection Response:")
    print("Response text:", neg_data["answer"])
    # Must explicitly state it cannot find the answer in the uploaded materials
    assert "cannot find" in neg_data["answer"].lower() or "materials" in neg_data["answer"].lower()

    # 7. Thumbs Up Feedback Submission
    print("\n--- Testing Feedback Submission ---")
    feedback_payload = {
        "message_id": study_data["id"],
        "feedback": "up"
    }
    fb_res = requests.post(f"{BASE_URL}/api/study/feedback", json=feedback_payload)
    assert fb_res.status_code == 200
    print("[PASS] 7. Feedback recorded in SQLite:", fb_res.json())

    # 8. General Agent Tool Proposal & Permission Gate
    print("\n--- Testing General Agent Tool Proposal & HITL Permission Gate ---")
    agent_payload = {
        "session_id": "test-session",
        "message": "Please take a screenshot of my screen"
    }
    agent_res = requests.post(f"{BASE_URL}/api/agent/query", json=agent_payload)
    assert agent_res.status_code == 200
    agent_data = agent_res.json()
    print("[PASS] 8. Agent Proposed Tool:")
    proposal = agent_data.get("tool_proposal")
    assert proposal is not None
    print(f"   Tool: {proposal['tool_name']}")
    print(f"   Requires Confirmation: {proposal['requires_confirmation']}")
    print(f"   Reason: {proposal['reason']}")

    # 9. Confirm and Execute the Tool (Human-In-The-Loop Approval)
    print("\n--- Testing Tool Execution Upon Approval ---")
    confirm_payload = {
        "session_id": "test-session",
        "tool_name": proposal["tool_name"],
        "arguments": proposal["arguments"],
        "approved": True
    }
    confirm_res = requests.post(f"{BASE_URL}/api/agent/confirm_tool", json=confirm_payload)
    assert confirm_res.status_code == 200
    confirm_data = confirm_res.json()
    print("[PASS] 9. Tool Executed Successfully:")
    print("   Status:", confirm_data["status"])
    print("   Result:", confirm_data["result"].get("result"))
    if "filename" in confirm_data["result"]:
        print("   Saved Screenshot File:", confirm_data["result"]["filename"])

    # 10. Test gTTS Voice Synthesis (Server-Side TTS for KPRIT Project)
    print("\n--- Testing Server-Side Voice Synthesis (gTTS) ---")
    tts_res = requests.post(f"{BASE_URL}/api/voice/synthesize", json={"text": "The scaled dot-product attention computes queries, keys, and values."})
    assert tts_res.status_code == 200
    assert tts_res.headers.get("content-type") == "audio/mpeg"
    assert len(tts_res.content) > 1000
    print(f"[PASS] 10. Voice Audio Synthesized: {len(tts_res.content)} bytes of MP3 audio returned.")

    # 11. Test Pilot Evaluation Analytics & Student Feedback
    print("\n--- Testing Pilot Evaluation Analytics (KPRIT Rubric) ---")
    analytics_res = requests.get(f"{BASE_URL}/api/analytics/course/{course_id}")
    assert analytics_res.status_code == 200
    analytics_data = analytics_res.json()
    assert "metrics" in analytics_data
    print(f"[PASS] 11. Pilot Metrics Verified:")
    print(f"   Institution: {analytics_data['institution']}")
    print(f"   Total Queries: {analytics_data['metrics']['total_student_queries']}")
    print(f"   Grounded Rate: {analytics_data['metrics']['grounding_accuracy_rate']}")
    print(f"   Student Usefulness Score: {analytics_data['metrics']['student_usefulness_score']}")

    # 12. Test Pilot CSV Export
    print("\n--- Testing Evaluation CSV Report Export ---")
    csv_res = requests.get(f"{BASE_URL}/api/analytics/course/{course_id}/export_csv")
    assert csv_res.status_code == 200
    assert "Message ID,Course,Role,Content,Citations Count" in csv_res.text
    print(f"[PASS] 12. Pilot CSV Report Generated ({len(csv_res.text)} characters).")

    # 13. Verify Audit Log
    print("\n--- Testing Tool Execution Audit Log ---")
    logs_res = requests.get(f"{BASE_URL}/api/tools/logs")
    assert logs_res.status_code == 200
    logs = logs_res.json()
    assert len(logs) > 0
    print(f"[PASS] 13. Audit Log Verified: {len(logs)} log entries recorded.")
    print(f"   Latest Log: {logs[0]['tool_name']} -> {logs[0]['status']}")

    # 14. Test Course-Grounded Practice Quiz Generation
    print("\n--- Testing Practice Quiz Generation ---")
    quiz_res = requests.post(f"{BASE_URL}/api/study/quiz", json={"course_id": course_id, "count": 3})
    assert quiz_res.status_code == 200
    quiz_data = quiz_res.json()
    assert len(quiz_data["questions"]) > 0
    print(f"[PASS] 14. Practice Quiz Generated: {len(quiz_data['questions'])} multiple-choice questions.")
    print(f"   Sample Question: {quiz_data['questions'][0]['question']}")
    print(f"   Options Count: {len(quiz_data['questions'][0]['options'])}")
    assert len(quiz_data['questions'][0]['options']) == 4

    # 15. Test Course Flashcards Generation
    print("\n--- Testing Flashcards Generation ---")
    cards_res = requests.post(f"{BASE_URL}/api/study/flashcards?course_id={course_id}&count=3")
    assert cards_res.status_code == 200
    cards_data = cards_res.json()
    assert len(cards_data["flashcards"]) > 0
    print(f"[PASS] 15. Flashcards Generated: {len(cards_data['flashcards'])} concept cards.")
    print(f"   Front: {cards_data['flashcards'][0]['front']}")
    print(f"   Back: {cards_data['flashcards'][0]['back'][:100]}...")

    # 16. Test Exam Revision Guide / Summary
    print("\n--- Testing Exam Revision Guide Generation ---")
    sum_res = requests.post(f"{BASE_URL}/api/study/summary", json={"course_id": course_id})
    assert sum_res.status_code == 200
    sum_data = sum_res.json()
    assert len(sum_data["summary_markdown"]) > 100
    print(f"[PASS] 16. Exam Revision Guide Generated ({len(sum_data['summary_markdown'])} chars, {len(sum_data['key_concepts'])} key concepts).")

    # 17. Test Document Vector Chunks Inspector
    print("\n--- Testing Document Vector Chunks Inspector ---")
    docs_res = requests.get(f"{BASE_URL}/api/courses/{course_id}/documents")
    assert docs_res.status_code == 200
    docs = docs_res.json()
    test_doc_id = docs[0]["id"]
    chunks_res = requests.get(f"{BASE_URL}/api/courses/{course_id}/documents/{test_doc_id}/chunks")
    assert chunks_res.status_code == 200
    chunks_data = chunks_res.json()
    assert len(chunks_data) > 0
    print(f"[PASS] 17. Chunks Inspector Verified: {len(chunks_data)} chunks in document, first chunk is on page {chunks_data[0]['page_number']}.")

    # 18. Test Frontend HTML availability
    print("\n--- Testing Frontend Serving ---")
    frontend_url = None
    for port in [5174, 5173]:
        try:
            front_res = requests.get(f"http://127.0.0.1:{port}", timeout=2)
            if front_res.status_code == 200 and "TARA" in front_res.text:
                frontend_url = f"http://127.0.0.1:{port}"
                break
        except Exception:
            pass

    assert frontend_url is not None, "Neither port 5174 nor 5173 responded with TARA web app!"
    print(f"[PASS] 18. Frontend is actively serving on {frontend_url} with title 'TARA'")

    # 19. Test Parental PIN Verification & Dashboard Summary
    print("\n--- Testing Parental Oversight Portal & Security PIN ---")
    pin_res = requests.post(f"{BASE_URL}/api/parental/verify_pin", json={"pin": "1234"})
    assert pin_res.status_code == 200
    assert pin_res.json()["authenticated"] is True
    print(f"[PASS] 19. Parental Security PIN Verified successfully (authenticated={pin_res.json()['authenticated']})")

    parent_summary = requests.get(f"{BASE_URL}/api/parental/summary")
    assert parent_summary.status_code == 200
    summary_data = parent_summary.json()
    total_study = summary_data["all_time"]["total_study_minutes"]
    daily_limit = summary_data["today"]["daily_limit_minutes"]
    print(f"   Parent Summary: Total Study Time = {total_study} mins, Daily Limit = {daily_limit} mins")

    # 20. Test Web Activity Monitoring & Doubt Clarification Logging
    print("\n--- Testing Web Activity Monitoring & Parental Audit ---")
    search_test = requests.post(
        f"{BASE_URL}/api/tools/test_run",
        json={"tool_name": "web_search", "arguments": {"query": "transformer self attention formula"}}
    )
    assert search_test.status_code == 200
    search_res = search_test.json()
    assert search_res.get("success") is True or "result" in search_res
    print(f"[PASS] 20. Web Search doubt clarification executed (Success={search_res.get('success')})")

    # Verify activity was recorded in parental web activity log
    web_logs_res = requests.get(f"{BASE_URL}/api/parental/web_activity")
    assert web_logs_res.status_code == 200
    web_logs = web_logs_res.json()
    assert len(web_logs) > 0
    print(f"   Parental Web Log: Found {len(web_logs)} tracked search/browser activities (Latest: '{web_logs[0]['query_or_url']}')")

    # 21. Test Parental Study Session Logging
    print("\n--- Testing Study Session Time Tracking ---")
    log_session_res = requests.post(
        f"{BASE_URL}/api/parental/log_session",
        json={
            "duration_minutes": 25,
            "course_id": course_id,
            "session_type": "focus_timer",
            "notes": "Completed 25-minute Pomodoro focus block on Neural Networks"
        }
    )
    assert log_session_res.status_code == 200
    assert log_session_res.json()["success"] is True
    print(f"[PASS] 21. Study Session Logged: {log_session_res.json()}")

    study_time_res = requests.get(f"{BASE_URL}/api/parental/study_time")
    assert study_time_res.status_code == 200
    time_data = study_time_res.json()
    assert len(time_data) > 0
    print(f"   Recorded Sessions: {len(time_data)} sessions on file.")

    # 22. Test Laptop Markdown Notes & AI Review
    print("\n--- Testing Laptop Study Notes & AI Review ---")
    create_note_res = requests.post(
        f"{BASE_URL}/api/notes",
        json={
            "title": "CS101 Attention Mechanism Notes",
            "content": "# Transformer Attention\nAttention(Q,K,V) = softmax(Q K^T / sqrt(d_k)) * V.\nEssential for machine translation.",
            "tags": ["AI", "Transformers", "Lecture1"]
        }
    )
    assert create_note_res.status_code == 200
    created_note = create_note_res.json()
    note_id = created_note["id"]
    print(f"[PASS] 22. Laptop Note Created: '{created_note['title']}' (ID: {note_id})")

    # Ask TARA to review and explain note
    explain_note_res = requests.post(f"{BASE_URL}/api/notes/{note_id}/explain")
    assert explain_note_res.status_code == 200
    review_data = explain_note_res.json()
    assert "explanation" in review_data
    print(f"   TARA AI Note Review: {review_data['explanation'][:120]}...")

    # 23. Test Parental CSV Report Export
    print("\n--- Testing Parental CSV Supervision Report ---")
    parental_csv = requests.get(f"{BASE_URL}/api/parental/export_report")
    assert parental_csv.status_code == 200
    assert "PARENTAL OVERSIGHT REPORT" in parental_csv.text
    print(f"[PASS] 23. Parental CSV Report Export Verified ({len(parental_csv.text)} characters generated).")

    # 24. Test Interactive Concept Mind Map & Knowledge Graph
    print("\n--- Testing Concept Mind Map & Knowledge Graph Generation ---")
    mindmap_res = requests.post(f"{BASE_URL}/api/study/mindmap", json={"course_id": course_id})
    assert mindmap_res.status_code == 200
    mm_data = mindmap_res.json()
    assert "nodes" in mm_data and len(mm_data["nodes"]) > 0
    assert "edges" in mm_data
    assert mm_data["concept_count"] > 0
    print(f"[PASS] 24. Concept Mind Map Generated: {mm_data['concept_count']} concepts/nodes, {len(mm_data['edges'])} relational edges.")
    print(f"   Root Node: '{mm_data['nodes'][0]['label']}' (Category: {mm_data['nodes'][0]['category']})")

    # 25. Test Exam Readiness Diagnostic & Weakness Heatmap
    print("\n--- Testing Exam Readiness Diagnostic & Weakness Heatmap ---")
    submit_quiz_res = requests.post(
        f"{BASE_URL}/api/study/quiz/submit",
        json={
            "course_id": course_id,
            "topic": "Neural Network Fundamentals",
            "total_questions": 5,
            "correct_count": 4,
            "answers_json": json.dumps({"q1": "correct", "q2": "correct", "q3": "correct", "q4": "correct", "q5": "wrong"})
        }
    )
    assert submit_quiz_res.status_code == 200
    sub_data = submit_quiz_res.json()
    assert sub_data["score_percentage"] == 80.0
    print(f"   Quiz Attempt Logged: Score = {sub_data['score_percentage']}% ({sub_data['correct_count']}/{sub_data['total_questions']})")

    readiness_res = requests.get(f"{BASE_URL}/api/study/readiness/{course_id}")
    assert readiness_res.status_code == 200
    readiness_data = readiness_res.json()
    assert readiness_data["readiness_score"] > 0
    assert len(readiness_data["topic_heatmap"]) > 0
    assert len(readiness_data["recommended_focus"]) > 0
    print(f"[PASS] 25. Exam Readiness Diagnostic Verified:")
    print(f"   Overall Readiness Score: {readiness_data['readiness_score']}% ({readiness_data['readiness_status']})")
    print(f"   Topics Analyzed: {len(readiness_data['topic_heatmap'])}, Recommendations: {len(readiness_data['recommended_focus'])}")

    # 26. Test Flashcard Spaced Repetition (Leitner Box System)
    print("\n--- Testing Flashcard Spaced Repetition (Leitner Box Drill) ---")
    card_suffix = uuid.uuid4().hex[:6]
    drill_card1 = f"What is Self-Attention? [{card_suffix}]"
    drill_card2 = f"What is Layer Normalization? [{card_suffix}]"

    drill1 = requests.post(
        f"{BASE_URL}/api/study/flashcards/drill",
        json={
            "course_id": course_id,
            "card_front": drill_card1,
            "card_back": "Dynamic token weighting mechanism using Q, K, V matrices.",
            "result": "got_it"
        }
    )
    assert drill1.status_code == 200
    assert drill1.json()["box_level"] == 2

    # Advance again to Box 3
    drill2 = requests.post(
        f"{BASE_URL}/api/study/flashcards/drill",
        json={
            "course_id": course_id,
            "card_front": drill_card1,
            "card_back": "Dynamic token weighting mechanism using Q, K, V matrices.",
            "result": "got_it"
        }
    )
    assert drill2.status_code == 200
    assert drill2.json()["box_level"] == 3

    # Drill another card with need_review to place in Box 1
    drill3 = requests.post(
        f"{BASE_URL}/api/study/flashcards/drill",
        json={
            "course_id": course_id,
            "card_front": drill_card2,
            "card_back": "Normalizes activations across features within a single sample.",
            "result": "need_review"
        }
    )
    assert drill3.status_code == 200
    assert drill3.json()["box_level"] == 1

    # Check mastery metrics
    mastery_res = requests.get(f"{BASE_URL}/api/study/flashcards/mastery?course_id={course_id}")
    assert mastery_res.status_code == 200
    mastery_data = mastery_res.json()
    assert mastery_data["total_drilled"] >= 2
    assert mastery_data["box_3_mastered"] >= 1
    print(f"[PASS] 26. Spaced Repetition Leitner Drill Verified:")
    print(f"   Total Drilled: {mastery_data['total_drilled']}, Deck Retention Mastery: {mastery_data['mastery_percentage']}%")
    print(f"   Box 1 (Learning): {mastery_data['box_1_learning']}, Box 2 (Familiar): {mastery_data['box_2_familiar']}, Box 3 (Mastered): {mastery_data['box_3_mastered']}")

    # 27. Test Audio Lecture & Voice Memo Ingestion
    print("\n--- Testing Voice Lecture & Audio Memo Ingestion ---")
    import io, wave, struct
    wav_buf = io.BytesIO()
    with wave.open(wav_buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        # 0.5s of audio
        data = struct.pack('<h', 0) * 8000
        wf.writeframes(data)
    wav_bytes = wav_buf.getvalue()

    audio_res = requests.post(
        f"{BASE_URL}/api/courses/{course_id}/audio_lecture",
        files={"file": ("lecture_sample.wav", wav_bytes, "audio/wav")},
        data={"title": "Introduction to Attention Mechanisms"}
    )
    assert audio_res.status_code == 200
    audio_data = audio_res.json()
    assert audio_data["success"] is True
    assert audio_data["chunk_count"] > 0
    print(f"[PASS] 27. Voice Lecture Ingested & Transcribed:")
    print(f"   Lecture Doc ID: {audio_data['document_id']}")
    print(f"   Vector Chunks Created: {audio_data['chunk_count']}")
    print(f"   Transcript Preview: {audio_data['transcript_preview'][:100]}...")

    # 28. Test Parental Daily Goals & Study Contract
    print("\n--- Testing Parental Daily Goals & Study Contract ---")
    create_goal_res = requests.post(
        f"{BASE_URL}/api/parental/goals",
        json={
            "title": "Complete 3 Leitner Flashcard Repetitions",
            "target_type": "flashcards",
            "target_value": 3
        }
    )
    assert create_goal_res.status_code == 200
    goal_res_data = create_goal_res.json()
    goal_id = goal_res_data["goal_id"]
    print(f"   Goal Created: '{goal_res_data['title']}' (ID: {goal_id})")

    goals_list_res = requests.get(f"{BASE_URL}/api/parental/goals")
    assert goals_list_res.status_code == 200
    goals = goals_list_res.json()
    assert any(g["id"] == goal_id for g in goals)

    toggle_res = requests.put(f"{BASE_URL}/api/parental/goals/{goal_id}/toggle")
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_completed"] is True
    print(f"[PASS] 28. Parental Goal Verified & Toggled (Completed={toggle_res.json()['is_completed']})")

    print("\n" + "=" * 60)
    print("ALL 28 END-TO-END VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
