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
  }
};
