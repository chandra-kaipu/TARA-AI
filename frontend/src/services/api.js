const API_BASE = '/api';

export const api = {
  // Health
  getHealth: async () => {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  // Dashboard
  getDashboardStats: async () => {
    const res = await fetch(`${API_BASE}/dashboard/stats`);
    if (!res.ok) throw new Error('Failed to load dashboard stats');
    return res.json();
  },

  // Courses
  listCourses: async () => {
    const res = await fetch(`${API_BASE}/courses`);
    if (!res.ok) throw new Error('Failed to list courses');
    return res.json();
  },

  createCourse: async (data) => {
    const res = await fetch(`${API_BASE}/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create course');
    return res.json();
  },

  getCourse: async (courseId) => {
    const res = await fetch(`${API_BASE}/courses/${courseId}`);
    if (!res.ok) throw new Error('Failed to fetch course details');
    return res.json();
  },

  deleteCourse: async (courseId) => {
    const res = await fetch(`${API_BASE}/courses/${courseId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete course');
    return res.json();
  },

  uploadDocument: async (courseId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/courses/${courseId}/documents`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to ingest document');
    }
    return res.json();
  },

  listDocuments: async (courseId) => {
    const res = await fetch(`${API_BASE}/courses/${courseId}/documents`);
    if (!res.ok) throw new Error('Failed to fetch documents');
    return res.json();
  },

  deleteDocument: async (courseId, docId) => {
    const res = await fetch(`${API_BASE}/courses/${courseId}/documents/${docId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete document');
    return res.json();
  },

  // Study
  queryStudy: async (courseId, query, provider, model) => {
    const res = await fetch(`${API_BASE}/study/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_id: courseId,
        query,
        provider,
        model
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to submit study query');
    }
    return res.json();
  },

  getStudyMessages: async (courseId) => {
    const res = await fetch(`${API_BASE}/study/${courseId}/messages`);
    if (!res.ok) throw new Error('Failed to load study chat');
    return res.json();
  },

  submitFeedback: async (messageId, feedback) => {
    const res = await fetch(`${API_BASE}/study/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: messageId, feedback })
    });
    return res.json();
  },

  clearStudyChat: async (courseId) => {
    const res = await fetch(`${API_BASE}/study/${courseId}/messages`, {
      method: 'DELETE'
    });
    return res.json();
  },

  // General Agent
  queryAgent: async (sessionId, message, provider, model) => {
    const res = await fetch(`${API_BASE}/agent/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        message,
        provider,
        model
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to query agent');
    }
    return res.json();
  },

  confirmTool: async (sessionId, toolName, args, approved) => {
    const res = await fetch(`${API_BASE}/agent/confirm_tool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        tool_name: toolName,
        arguments: args,
        approved
      })
    });
    return res.json();
  },

  getAgentHistory: async (sessionId) => {
    const res = await fetch(`${API_BASE}/agent/${sessionId}/messages`);
    return res.json();
  },

  clearAgentHistory: async (sessionId) => {
    const res = await fetch(`${API_BASE}/agent/${sessionId}/messages`, {
      method: 'DELETE'
    });
    return res.json();
  },

  // Tools & Permissions
  listTools: async () => {
    const res = await fetch(`${API_BASE}/tools`);
    return res.json();
  },

  updateToolPermission: async (toolName, autoApprove, requiresConfirmation) => {
    const res = await fetch(`${API_BASE}/tools/permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_name: toolName,
        auto_approve: autoApprove,
        requires_confirmation: requiresConfirmation
      })
    });
    return res.json();
  },

  getToolLogs: async () => {
    const res = await fetch(`${API_BASE}/tools/logs`);
    return res.json();
  },

  clearToolLogs: async () => {
    const res = await fetch(`${API_BASE}/tools/logs`, {
      method: 'DELETE'
    });
    return res.json();
  },

  testRunTool: async (toolName, args) => {
    const res = await fetch(`${API_BASE}/tools/test_run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool_name: toolName, arguments: args })
    });
    return res.json();
  },

  // Voice Engine (gTTS & Whisper)
  synthesizeGtts: async (text) => {
    const res = await fetch(`${API_BASE}/voice/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!res.ok) throw new Error('TTS synthesis failed');
    return res.blob();
  },

  // Evaluation & Feedback Analytics (Major Project Requirement)
  getCourseAnalytics: async (courseId) => {
    const res = await fetch(`${API_BASE}/analytics/course/${courseId}`);
    if (!res.ok) throw new Error('Failed to load evaluation analytics');
    return res.json();
  },

  getExportCsvUrl: (courseId) => `${API_BASE}/analytics/course/${courseId}/export_csv`,

  // Settings
  getSettings: async () => {
    const res = await fetch(`${API_BASE}/settings`);
    return res.json();
  },

  updateSettings: async (data) => {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  saveApiKey: async (provider, apiKey) => {
    const res = await fetch(`${API_BASE}/settings/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, api_key: apiKey })
    });
    return res.json();
  },

  testConnection: async (provider) => {
    const res = await fetch(`${API_BASE}/settings/test_connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider })
    });
    return res.json();
  },

  // Document Vector Chunks Inspector
  getDocumentChunks: async (courseId, docId) => {
    const res = await fetch(`${API_BASE}/courses/${courseId}/documents/${docId}/chunks`);
    if (!res.ok) throw new Error('Failed to fetch document chunks');
    return res.json();
  },

  // Interactive Exam Preparation & Study Tools
  generateQuiz: async (courseId, count = 5, topic = '') => {
    const res = await fetch(`${API_BASE}/study/quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course_id: courseId, count, topic })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to generate practice quiz');
    }
    return res.json();
  },

  generateFlashcards: async (courseId, count = 6) => {
    const res = await fetch(`${API_BASE}/study/flashcards?course_id=${courseId}&count=${count}`, {
      method: 'POST'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to generate flashcards');
    }
    return res.json();
  },

  generateSummary: async (courseId, topic = '') => {
    const res = await fetch(`${API_BASE}/study/summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course_id: courseId, topic })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to generate study summary');
    }
    return res.json();
  },

  // Parental Supervision & Activity Monitoring
  verifyParentPin: async (pin) => {
    const res = await fetch(`${API_BASE}/parental/verify_pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Incorrect PIN');
    }
    return res.json();
  },

  getParentalSummary: async () => {
    const res = await fetch(`${API_BASE}/parental/summary`);
    if (!res.ok) throw new Error('Failed to fetch parental summary');
    return res.json();
  },

  getParentalWebActivity: async () => {
    const res = await fetch(`${API_BASE}/parental/web_activity`);
    if (!res.ok) throw new Error('Failed to fetch web activity logs');
    return res.json();
  },

  getParentalStudyTime: async () => {
    const res = await fetch(`${API_BASE}/parental/study_time`);
    if (!res.ok) throw new Error('Failed to fetch study session logs');
    return res.json();
  },

  logStudySession: async (courseId, sessionType, durationMinutes, notes) => {
    const res = await fetch(`${API_BASE}/parental/log_session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_id: courseId || 'general',
        session_type: sessionType,
        duration_minutes: durationMinutes,
        notes: notes || ''
      })
    });
    return res.json();
  },

  getParentalReportUrl: () => `${API_BASE}/parental/export_report`,

  // Laptop Study Notes & Scratchpad
  listNotes: async (courseId = null) => {
    const url = courseId ? `${API_BASE}/notes?course_id=${courseId}` : `${API_BASE}/notes`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load notes');
    return res.json();
  },

  createNote: async (data) => {
    const res = await fetch(`${API_BASE}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create note');
    return res.json();
  },

  updateNote: async (noteId, data) => {
    const res = await fetch(`${API_BASE}/notes/${noteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update note');
    return res.json();
  },

  deleteNote: async (noteId) => {
    const res = await fetch(`${API_BASE}/notes/${noteId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete note');
    return res.json();
  },

  explainNote: async (noteId) => {
    const res = await fetch(`${API_BASE}/notes/${noteId}/explain`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to generate note explanation');
    return res.json();
  },

  // 1. Concept Mind Map & Knowledge Graph
  generateMindMap: async (courseId) => {
    const res = await fetch(`${API_BASE}/study/mindmap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course_id: courseId })
    });
    if (!res.ok) throw new Error('Failed to generate mind map');
    return res.json();
  },

  // 2. Exam Readiness & Quiz Diagnostic
  submitQuizResults: async (courseId, topic, total, correct, answersJson = {}) => {
    const res = await fetch(`${API_BASE}/study/quiz/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_id: courseId,
        topic: topic || 'General Practice',
        total_questions: total,
        correct_count: correct,
        answers_json: JSON.stringify(answersJson)
      })
    });
    if (!res.ok) throw new Error('Failed to submit quiz results');
    return res.json();
  },

  getExamReadiness: async (courseId) => {
    const res = await fetch(`${API_BASE}/study/readiness/${courseId}`);
    if (!res.ok) throw new Error('Failed to load exam readiness');
    return res.json();
  },

  // 3. Spaced Repetition Leitner Flashcards
  drillFlashcard: async (courseId, front, back, result) => {
    const res = await fetch(`${API_BASE}/study/flashcards/drill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_id: courseId,
        card_front: front,
        card_back: back,
        result
      })
    });
    if (!res.ok) throw new Error('Failed to record flashcard drill');
    return res.json();
  },

  getFlashcardsMastery: async (courseId) => {
    const res = await fetch(`${API_BASE}/study/flashcards/mastery?course_id=${courseId}`);
    if (!res.ok) throw new Error('Failed to load flashcard mastery');
    return res.json();
  },

  // 4. Audio Lecture & Voice Memo Ingestion
  uploadAudioLecture: async (courseId, file, title = 'Recorded Lecture') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);

    const res = await fetch(`${API_BASE}/courses/${courseId}/audio_lecture`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to upload audio lecture');
    }
    return res.json();
  },

  // 5. Parental Study Goals & Target Checklist
  getParentalGoals: async () => {
    const res = await fetch(`${API_BASE}/parental/goals`);
    if (!res.ok) throw new Error('Failed to load parental goals');
    return res.json();
  },

  createParentalGoal: async (title, targetType = 'study_time', targetValue = 50) => {
    const res = await fetch(`${API_BASE}/parental/goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        target_type: targetType,
        target_value: targetValue
      })
    });
    if (!res.ok) throw new Error('Failed to create study goal');
    return res.json();
  },

  toggleParentalGoal: async (goalId) => {
    const res = await fetch(`${API_BASE}/parental/goals/${goalId}/toggle`, {
      method: 'PUT'
    });
    if (!res.ok) throw new Error('Failed to update goal');
    return res.json();
  }
};

