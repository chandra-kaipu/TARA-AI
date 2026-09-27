import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  ThumbsUp, 
  ThumbsDown, 
  GraduationCap, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle,
  Loader2, 
  Sparkles, 
  Bookmark, 
  FileText,
  MessageSquare,
  HelpCircle,
  Layers,
  BookOpen,
  Copy,
  Download,
  RefreshCw,
  Check,
  X,
  ArrowLeft,
  ArrowRight,
  Shuffle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';
import { useVoice } from '../context/VoiceContext';
import CitationCard from '../components/CitationCard';
import AudioWaveform from '../components/AudioWaveform';

export default function StudyChat({ 
  selectedCourseId, 
  setSelectedCourseId, 
  setActiveTab 
}) {
  const [courses, setCourses] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  // Active Mode: 'chat' | 'quiz' | 'flashcards' | 'summary'
  const [studyMode, setStudyMode] = useState('chat');

  // Quiz State
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [quizCount, setQuizCount] = useState(5);
  const [quizTopic, setQuizTopic] = useState('');

  // Flashcards State
  const [flashcards, setFlashcards] = useState([]);
  const [cardLoading, setCardLoading] = useState(false);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Exam Summary State
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  
  const messagesEndRef = useRef(null);
  const { 
    isListening, 
    isSpeaking, 
    startManualCapture, 
    stopManualCapture, 
    speak, 
    stopSpeaking,
    registerVoiceQueryHandler,
    unregisterVoiceQueryHandler,
    isWakeWordActive
  } = useVoice();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (studyMode === 'chat') {
      scrollToBottom();
    }
  }, [messages, loading, studyMode]);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await api.listCourses();
        setCourses(res);
        if (!selectedCourseId && res.length > 0) {
          setSelectedCourseId(res[0].id);
        }
      } catch (err) {
        console.error('Error fetching courses:', err);
      }
    };
    fetchCourses();
  }, []);

  useEffect(() => {
    if (!selectedCourseId) return;

    const fetchMessages = async () => {
      try {
        setChatLoading(true);
        const res = await api.getStudyMessages(selectedCourseId);
        setMessages(res);
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        setChatLoading(false);
      }
    };

    fetchMessages();
    // Reset secondary modes when course changes
    setQuizQuestions([]);
    setSelectedAnswers({});
    setFlashcards([]);
    setSummaryData(null);
  }, [selectedCourseId]);

  const handleSubmitQuery = async (queryText) => {
    const q = (queryText || inputQuery).trim();
    if (!q || !selectedCourseId || loading) return;

    setInputQuery('');
    setLoading(true);

    const tempUserMsg = {
      id: 'temp-' + Date.now(),
      course_id: selectedCourseId,
      role: 'user',
      content: q,
      citations: [],
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const res = await api.queryStudy(selectedCourseId, q);
      
      const assistantMsg = {
        id: res.id,
        course_id: selectedCourseId,
        role: 'assistant',
        content: res.answer,
        citations: res.citations || [],
        feedback: null,
        grounded: res.grounded,
        provider_used: res.provider_used,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMsg]);
      speak(res.answer);
    } catch (err) {
      const errorMsg = {
        id: 'err-' + Date.now(),
        course_id: selectedCourseId,
        role: 'assistant',
        content: `Error retrieving grounded answer: ${err.message}`,
        citations: [],
        feedback: null,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    registerVoiceQueryHandler((spokenText) => {
      if (studyMode === 'chat') {
        handleSubmitQuery(spokenText);
      }
    });
    return () => {
      unregisterVoiceQueryHandler();
    };
  }, [selectedCourseId, loading, studyMode]);

  const handleFeedback = async (messageId, feedbackType) => {
    try {
      const current = messages.find(m => m.id === messageId)?.feedback;
      const newFeedback = current === feedbackType ? 'none' : feedbackType;

      await api.submitFeedback(messageId, newFeedback);
      setMessages(prev => prev.map(m => {
        if (m.id === messageId) {
          return { ...m, feedback: newFeedback === 'none' ? null : newFeedback };
        }
        return m;
      }));
    } catch (err) {
      console.error('Feedback error:', err);
    }
  };

  const handleClearChat = async () => {
    if (!selectedCourseId || !confirm('Clear study chat history for this course?')) return;
    try {
      await api.clearStudyChat(selectedCourseId);
      setMessages([]);
    } catch (err) {
      alert(err.message);
    }
  };

  const playGttsAudio = async (text) => {
    try {
      const blob = await api.synthesizeGtts(text);
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audio.play();
    } catch (err) {
      speak(text);
    }
  };

  // ─── QUIZ HANDLERS ───
  const handleGenerateQuiz = async () => {
    if (!selectedCourseId) return;
    try {
      setQuizLoading(true);
      setSelectedAnswers({});
      const res = await api.generateQuiz(selectedCourseId, quizCount, quizTopic);
      setQuizQuestions(res.questions || []);
    } catch (err) {
      alert(`Quiz generation error: ${err.message}`);
    } finally {
      setQuizLoading(false);
    }
  };

  const handleSelectAnswer = (questionId, optionIdx) => {
    if (selectedAnswers[questionId] !== undefined) return; // already answered
    setSelectedAnswers(prev => ({ ...prev, [questionId]: optionIdx }));
  };

  // ─── FLASHCARDS HANDLERS ───
  const handleGenerateFlashcards = async () => {
    if (!selectedCourseId) return;
    try {
      setCardLoading(true);
      setCurrentCardIdx(0);
      setIsFlipped(false);
      const res = await api.generateFlashcards(selectedCourseId, 6);
      setFlashcards(res.flashcards || []);
    } catch (err) {
      alert(`Flashcards error: ${err.message}`);
    } finally {
      setCardLoading(false);
    }
  };

  // ─── SUMMARY HANDLERS ───
  const handleGenerateSummary = async () => {
    if (!selectedCourseId) return;
    try {
      setSummaryLoading(true);
      setCopiedSummary(false);
      const res = await api.generateSummary(selectedCourseId);
      setSummaryData(res);
    } catch (err) {
      alert(`Summary error: ${err.message}`);
    } finally {
      setSummaryLoading(false);
    }
  };

  const copySummaryToClipboard = () => {
    if (!summaryData) return;
    navigator.clipboard.writeText(summaryData.summary_markdown);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const downloadSummaryMarkdown = () => {
    if (!summaryData) return;
    const blob = new Blob([summaryData.summary_markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeCourse?.code || 'Course'}_Exam_Revision_Guide.md`;
    link.click();
  };

  const activeCourse = courses.find(c => c.id === selectedCourseId);

  // Compute Quiz Score
  const totalAnswered = Object.keys(selectedAnswers).length;
  const correctCount = quizQuestions.reduce((acc, q) => {
    return selectedAnswers[q.id] === q.correct_index ? acc + 1 : acc;
  }, 0);

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] max-w-5xl mx-auto px-8 py-5">
      {/* Top Bar: Course Selector & Grounding Notice */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E3E0D8] dark:border-[#423F3A]">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-[#DA7756]/10 text-[#DA7756]">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <label className="text-sm font-semibold text-[#6B675F] dark:text-[#A39E93]">
                Course Knowledge Base:
              </label>
              <select
                value={selectedCourseId || ''}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="text-sm font-bold bg-[#EDEAE1] dark:bg-[#383531] border border-[#E3E0D8] dark:border-[#423F3A] rounded-lg px-3 py-1.5 text-[#1F1E1D] dark:text-[#F5F4EF] focus:outline-none focus:border-[#DA7756] cursor-pointer"
              >
                {courses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.chunk_count} chunks)
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-[#4F7A5C] font-medium flex items-center gap-1.5 mt-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Strict Grounding Active: TARA answers solely from ingested course materials.
            </p>
          </div>
        </div>

        {/* Study Mode Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-[#EDEAE1] dark:bg-[#383531] p-1 rounded-xl border border-[#E3E0D8] dark:border-[#423F3A]">
          <button
            onClick={() => setStudyMode('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${
              studyMode === 'chat'
                ? 'bg-[#FFFFFF] dark:bg-[#262523] text-[#DA7756] shadow-2xs'
                : 'text-[#6B675F] dark:text-[#A39E93] hover:text-[#1F1E1D] dark:hover:text-[#F5F4EF]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Q&A Chat
          </button>

          <button
            onClick={() => {
              setStudyMode('quiz');
              if (quizQuestions.length === 0) handleGenerateQuiz();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${
              studyMode === 'quiz'
                ? 'bg-[#FFFFFF] dark:bg-[#262523] text-[#DA7756] shadow-2xs'
                : 'text-[#6B675F] dark:text-[#A39E93] hover:text-[#1F1E1D] dark:hover:text-[#F5F4EF]'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Practice Quiz
          </button>

          <button
            onClick={() => {
              setStudyMode('flashcards');
              if (flashcards.length === 0) handleGenerateFlashcards();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${
              studyMode === 'flashcards'
                ? 'bg-[#FFFFFF] dark:bg-[#262523] text-[#DA7756] shadow-2xs'
                : 'text-[#6B675F] dark:text-[#A39E93] hover:text-[#1F1E1D] dark:hover:text-[#F5F4EF]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Flashcards
          </button>

          <button
            onClick={() => {
              setStudyMode('summary');
              if (!summaryData) handleGenerateSummary();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${
              studyMode === 'summary'
                ? 'bg-[#FFFFFF] dark:bg-[#262523] text-[#DA7756] shadow-2xs'
                : 'text-[#6B675F] dark:text-[#A39E93] hover:text-[#1F1E1D] dark:hover:text-[#F5F4EF]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Exam Guide
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MODE 1: GROUNDED CONVERSATIONAL CHAT                        */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {studyMode === 'chat' && (
        <>
          <div className="flex-1 overflow-y-auto py-6 space-y-6 pr-2">
            {chatLoading ? (
              <div className="py-24 flex items-center justify-center text-sm text-[#6B675F] dark:text-[#A39E93] gap-2.5">
                <Loader2 className="w-5 h-5 animate-spin text-[#DA7756]" />
                Loading course grounding data...
              </div>
            ) : messages.length === 0 ? (
              <div className="py-16 text-center max-w-lg mx-auto space-y-5">
                <div className="w-14 h-14 rounded-2xl bg-[#DA7756]/10 text-[#DA7756] flex items-center justify-center mx-auto shadow-xs">
                  <Sparkles className="w-7 h-7" />
                </div>
                <h3 className="font-serif-claude text-2xl font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
                  Ask Anything About {activeCourse?.name || 'Your Course'}
                </h3>
                <p className="text-sm leading-relaxed text-[#6B675F] dark:text-[#A39E93]">
                  Every response is strictly verified against your ingested syllabus, textbooks, and notes with exact page and section citations.
                </p>
                <div className="p-4 rounded-xl bg-[#EDEAE1]/60 dark:bg-[#383531]/60 border border-[#E3E0D8] dark:border-[#423F3A] text-sm space-y-2 text-left shadow-xs">
                  <div className="font-semibold text-xs uppercase tracking-wider text-[#6B675F] dark:text-[#A39E93]">
                    Try Asking:
                  </div>
                  <div 
                    onClick={() => handleSubmitQuery("What is the scaled dot-product attention formula?")}
                    className="text-[#DA7756] hover:underline cursor-pointer font-medium"
                  >
                    • "What is the scaled dot-product attention formula?"
                  </div>
                  <div 
                    onClick={() => handleSubmitQuery("Explain model quantization and edge inference.")}
                    className="text-[#DA7756] hover:underline cursor-pointer font-medium"
                  >
                    • "Explain model quantization and edge inference."
                  </div>
                  <div 
                    onClick={() => handleSubmitQuery("What are the prerequisites and grading breakdown for this course?")}
                    className="text-[#DA7756] hover:underline cursor-pointer font-medium"
                  >
                    • "What are the prerequisites and grading breakdown for this course?"
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    <span className="text-xs font-bold text-[#6B675F] dark:text-[#A39E93]">
                      {msg.role === 'user' ? 'You' : 'TARA (Course Assistant)'}
                    </span>
                    {msg.role === 'assistant' && msg.grounded !== false && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4F7A5C] bg-[#4F7A5C]/10 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Grounded
                      </span>
                    )}
                  </div>

                  <div className={`p-4 md:p-5 rounded-2xl max-w-[85%] text-sm md:text-base leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#DA7756] text-white rounded-br-xs shadow-xs font-medium'
                      : 'bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] text-[#1F1E1D] dark:text-[#F5F4EF] rounded-bl-xs shadow-xs'
                  }`}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>

                    {/* Citations List Drawer */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-4 pt-3.5 border-t border-[#E3E0D8] dark:border-[#423F3A]/70">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#6B675F] dark:text-[#A39E93] uppercase tracking-wider mb-2">
                          <Bookmark className="w-3.5 h-3.5 text-[#DA7756]" />
                          Verified Citations ({msg.citations.length})
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {msg.citations.map((c, idx) => (
                            <CitationCard key={idx} citation={c} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Assistant Footer: Voice Readback & Feedback */}
                    {msg.role === 'assistant' && (
                      <div className="mt-3.5 pt-2.5 border-t border-[#E3E0D8]/60 dark:border-[#423F3A]/50 flex items-center justify-between text-xs text-[#6B675F] dark:text-[#A39E93]">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => playGttsAudio(msg.content)}
                            className="flex items-center gap-1 hover:text-[#DA7756] transition-colors cursor-pointer"
                            title="Play server-side gTTS voice"
                          >
                            <Volume2 className="w-3.5 h-3.5 text-[#DA7756]" />
                            <span>Read Aloud</span>
                          </button>
                        </div>

                        {/* Thumbs Up / Down Feedback */}
                        <div className="flex items-center gap-2">
                          <span className="text-[11px]">Helpful?</span>
                          <button
                            onClick={() => handleFeedback(msg.id, 'up')}
                            className={`p-1 rounded hover:bg-[#EDEAE1] dark:hover:bg-[#383531] transition-colors cursor-pointer ${
                              msg.feedback === 'up' ? 'text-[#4F7A5C] font-bold' : 'text-[#6B675F]'
                            }`}
                            title="Thumbs Up"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleFeedback(msg.id, 'down')}
                            className={`p-1 rounded hover:bg-[#EDEAE1] dark:hover:bg-[#383531] transition-colors cursor-pointer ${
                              msg.feedback === 'down' ? 'text-[#D04F4F] font-bold' : 'text-[#6B675F]'
                            }`}
                            title="Thumbs Down"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            )}

            {loading && (
              <div className="flex items-start gap-3">
                <div className="p-4 rounded-2xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] flex items-center gap-3 shadow-xs">
                  <AudioWaveform isActive={true} size="sm" />
                  <span className="text-sm font-medium text-[#6B675F] dark:text-[#A39E93]">
                    Retrieving vector chunks and formulating grounded answer...
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Chat Bar */}
          <div className="pt-3 border-t border-[#E3E0D8] dark:border-[#423F3A]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmitQuery();
              }}
              className="relative flex items-center gap-2.5"
            >
              <button
                type="button"
                onClick={isListening ? stopManualCapture : startManualCapture}
                className={`p-3.5 rounded-xl transition-all cursor-pointer shadow-xs ${
                  isListening
                    ? 'bg-[#D04F4F] text-white animate-pulse'
                    : 'bg-[#EDEAE1] dark:bg-[#383531] text-[#DA7756] hover:bg-[#DA7756] hover:text-white'
                }`}
                title={isListening ? 'Stop recording' : 'Click to talk (or say "TARA")'}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <input
                type="text"
                placeholder={
                  isListening 
                    ? 'Listening to your question...' 
                    : isWakeWordActive 
                    ? 'Ask a question or say "TARA"...' 
                    : 'Ask a question about the course materials...'
                }
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                disabled={loading}
                className="flex-1 px-4 py-3.5 text-sm md:text-base rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#FFFFFF] dark:bg-[#2E2C29] text-[#1F1E1D] dark:text-[#F5F4EF] focus:outline-none focus:border-[#DA7756] shadow-xs"
              />

              <button
                type="submit"
                disabled={!inputQuery.trim() || loading}
                className="p-3.5 rounded-xl bg-[#DA7756] hover:bg-[#C4633F] disabled:opacity-40 text-white transition-all cursor-pointer shadow-xs"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>

            <div className="flex items-center justify-between text-xs text-[#6B675F] dark:text-[#A39E93] pt-2 px-1">
              <span>Hands-free: Say <strong className="text-[#DA7756]">"TARA"</strong> to trigger voice input</span>
              <span>Answers strictly limited to course vector index</span>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MODE 2: INTERACTIVE PRACTICE QUIZ                           */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {studyMode === 'quiz' && (
        <div className="flex-1 overflow-y-auto py-6 space-y-6 pr-2">
          {/* Controls Bar */}
          <div className="p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] flex flex-wrap items-center justify-between gap-4 shadow-xs">
            <div>
              <h3 className="font-serif-claude text-xl font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
                Course Practice Exam Simulator
              </h3>
              <p className="text-xs text-[#6B675F] dark:text-[#A39E93] mt-0.5">
                Questions are synthesized directly from your course vector chunks with full explanations and citations.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={quizCount}
                onChange={(e) => setQuizCount(Number(e.target.value))}
                className="text-xs font-semibold px-3 py-2 rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#F5F4EF] dark:bg-[#262523] text-[#1F1E1D] dark:text-[#F5F4EF]"
              >
                <option value={3}>3 Questions</option>
                <option value={5}>5 Questions</option>
                <option value={10}>10 Questions</option>
              </select>

              <button
                onClick={handleGenerateQuiz}
                disabled={quizLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#DA7756] hover:bg-[#C4633F] text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {quizLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {quizQuestions.length > 0 ? 'Regenerate Quiz' : 'Start Practice Quiz'}
              </button>
            </div>
          </div>

          {/* Running Score Banner */}
          {quizQuestions.length > 0 && totalAnswered > 0 && (
            <div className="p-4 rounded-xl bg-[#4F7A5C]/10 border border-[#4F7A5C]/30 flex items-center justify-between">
              <span className="text-xs md:text-sm font-bold text-[#4F7A5C]">
                Progress: {totalAnswered} of {quizQuestions.length} answered
              </span>
              <span className="text-xs md:text-sm font-bold text-[#4F7A5C] font-mono">
                Current Score: {correctCount} / {totalAnswered} ({Math.round((correctCount / totalAnswered) * 100)}%)
              </span>
            </div>
          )}

          {/* Questions List */}
          {quizLoading ? (
            <div className="py-24 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#DA7756] mx-auto" />
              <p className="text-sm text-[#6B675F] dark:text-[#A39E93]">
                Synthesizing exam questions from lecture notes & textbooks...
              </p>
            </div>
          ) : quizQuestions.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <HelpCircle className="w-12 h-12 text-[#DA7756] mx-auto opacity-70" />
              <p className="text-sm text-[#6B675F] dark:text-[#A39E93]">
                Click "Start Practice Quiz" to generate exam questions from your course materials.
              </p>
            </div>
          ) : (
            quizQuestions.map((q, qIdx) => {
              const selectedOpt = selectedAnswers[q.id];
              const isAnswered = selectedOpt !== undefined;

              return (
                <div
                  key={q.id}
                  className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] space-y-4 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-[#DA7756] px-2.5 py-1 rounded-full bg-[#DA7756]/10">
                      Question {qIdx + 1} of {quizQuestions.length}
                    </span>
                    {isAnswered && (
                      <span className={`text-xs font-bold flex items-center gap-1 ${
                        selectedOpt === q.correct_index ? 'text-[#4F7A5C]' : 'text-[#D04F4F]'
                      }`}>
                        {selectedOpt === q.correct_index ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> Correct!
                          </>
                        ) : (
                          <>
                            <X className="w-3.5 h-3.5" /> Incorrect
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  <h4 className="text-base font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
                    {q.question}
                  </h4>

                  {/* Options */}
                  <div className="space-y-2.5">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = selectedOpt === optIdx;
                      const isCorrect = optIdx === q.correct_index;

                      let btnStyle = 'border-[#E3E0D8] dark:border-[#423F3A] hover:border-[#DA7756] bg-[#F5F4EF] dark:bg-[#262523] text-[#1F1E1D] dark:text-[#F5F4EF]';
                      if (isAnswered) {
                        if (isCorrect) {
                          btnStyle = 'border-[#4F7A5C] bg-[#4F7A5C]/15 text-[#4F7A5C] font-bold';
                        } else if (isSelected && !isCorrect) {
                          btnStyle = 'border-[#D04F4F] bg-[#D04F4F]/15 text-[#D04F4F] line-through';
                        } else {
                          btnStyle = 'opacity-40 border-[#E3E0D8] dark:border-[#423F3A] bg-transparent';
                        }
                      }

                      return (
                        <button
                          key={optIdx}
                          onClick={() => handleSelectAnswer(q.id, optIdx)}
                          disabled={isAnswered}
                          className={`w-full text-left p-3.5 rounded-xl border text-sm transition-all flex items-center gap-3 cursor-pointer ${btnStyle}`}
                        >
                          <span className="w-6 h-6 rounded-lg bg-[#EDEAE1] dark:bg-[#383531] flex items-center justify-center font-bold text-xs shrink-0">
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span className="flex-1">{opt}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation & Citation */}
                  {isAnswered && (
                    <div className="mt-4 pt-4 border-t border-[#E3E0D8] dark:border-[#423F3A] space-y-2 bg-[#F5F4EF]/50 dark:bg-[#262523]/50 p-4 rounded-xl">
                      <div className="text-xs font-bold text-[#4F7A5C] uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Course Grounded Explanation:
                      </div>
                      <p className="text-xs md:text-sm text-[#1F1E1D] dark:text-[#F5F4EF] leading-relaxed">
                        {q.explanation}
                      </p>
                      {q.citation && (
                        <div className="text-[11px] font-mono text-[#6B675F] dark:text-[#A39E93] pt-1">
                          Source: {q.citation.filename} • Page {q.citation.page} ({q.citation.section || 'General'})
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MODE 3: INTERACTIVE FLASHCARDS                              */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {studyMode === 'flashcards' && (
        <div className="flex-1 overflow-y-auto py-6 space-y-6 flex flex-col justify-center items-center">
          {cardLoading ? (
            <div className="py-24 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#DA7756] mx-auto" />
              <p className="text-sm text-[#6B675F] dark:text-[#A39E93]">
                Extracting core definitions and formulas into flashcards...
              </p>
            </div>
          ) : flashcards.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <Layers className="w-12 h-12 text-[#DA7756] mx-auto opacity-70" />
              <p className="text-sm text-[#6B675F] dark:text-[#A39E93]">
                No flashcards generated yet. Click below to synthesize review cards.
              </p>
              <button
                onClick={handleGenerateFlashcards}
                className="px-5 py-2.5 rounded-xl bg-[#DA7756] hover:bg-[#C4633F] text-white font-bold text-sm shadow-xs cursor-pointer"
              >
                Generate Course Flashcards
              </button>
            </div>
          ) : (
            <div className="w-full max-w-xl space-y-6">
              {/* Card Indicator */}
              <div className="flex items-center justify-between text-xs font-mono font-bold text-[#6B675F] dark:text-[#A39E93]">
                <span>Flashcard {currentCardIdx + 1} of {flashcards.length}</span>
                <span className="text-[#DA7756]">Click card to flip</span>
              </div>

              {/* Flip Card Container */}
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="w-full h-80 rounded-3xl p-8 bg-[#FFFFFF] dark:bg-[#2E2C29] border-2 border-[#E3E0D8] dark:border-[#423F3A] hover:border-[#DA7756] shadow-lg flex flex-col justify-between cursor-pointer transition-all duration-300"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#DA7756] px-3 py-1 rounded-full bg-[#DA7756]/10">
                    {isFlipped ? 'Answer & Explanation' : 'Key Concept / Prompt'}
                  </span>
                  <span className="text-xs text-[#6B675F] dark:text-[#A39E93]">
                    {isFlipped ? 'Tap to view prompt' : 'Tap to reveal answer'}
                  </span>
                </div>

                <div className="my-auto text-center">
                  {!isFlipped ? (
                    <h3 className="font-serif-claude text-2xl md:text-3xl font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
                      {flashcards[currentCardIdx]?.front}
                    </h3>
                  ) : (
                    <p className="text-base md:text-lg leading-relaxed text-[#1F1E1D] dark:text-[#F5F4EF] font-medium">
                      {flashcards[currentCardIdx]?.back}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-[#E3E0D8]/60 dark:border-[#423F3A]/60 flex items-center justify-between text-xs text-[#6B675F] dark:text-[#A39E93]">
                  <span>Source: {flashcards[currentCardIdx]?.citation?.filename}</span>
                  <span>Page {flashcards[currentCardIdx]?.citation?.page}</span>
                </div>
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={() => {
                    setIsFlipped(false);
                    setCurrentCardIdx(prev => (prev > 0 ? prev - 1 : flashcards.length - 1));
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#FFFFFF] dark:bg-[#2E2C29] hover:bg-[#F5F4EF] dark:hover:bg-[#383531] text-xs font-bold text-[#1F1E1D] dark:text-[#F5F4EF] transition-all cursor-pointer shadow-xs"
                >
                  <ArrowLeft className="w-4 h-4" /> Previous
                </button>

                <button
                  onClick={handleGenerateFlashcards}
                  className="p-2.5 rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#FFFFFF] dark:bg-[#2E2C29] hover:bg-[#F5F4EF] dark:hover:bg-[#383531] text-[#6B675F] hover:text-[#DA7756] transition-colors cursor-pointer shadow-xs"
                  title="Generate fresh flashcards"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    setIsFlipped(false);
                    setCurrentCardIdx(prev => (prev < flashcards.length - 1 ? prev + 1 : 0));
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#DA7756] hover:bg-[#C4633F] text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MODE 4: EXAM REVISION GUIDE / CHEAT SHEET                   */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {studyMode === 'summary' && (
        <div className="flex-1 overflow-y-auto py-6 space-y-6 pr-2">
          {/* Header Action Bar */}
          <div className="p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] flex flex-wrap items-center justify-between gap-4 shadow-xs">
            <div>
              <h3 className="font-serif-claude text-xl font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
                Course Exam Revision Guide & Cheat Sheet
              </h3>
              <p className="text-xs text-[#6B675F] dark:text-[#A39E93] mt-0.5">
                AI-synthesized high-yield summary extracted from all ingested documents and notes.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={copySummaryToClipboard}
                disabled={!summaryData}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#F5F4EF] dark:bg-[#262523] hover:bg-[#EDEAE1] dark:hover:bg-[#383531] text-xs font-bold text-[#1F1E1D] dark:text-[#F5F4EF] transition-all cursor-pointer disabled:opacity-40"
              >
                {copiedSummary ? <Check className="w-3.5 h-3.5 text-[#4F7A5C]" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSummary ? 'Copied!' : 'Copy Guide'}
              </button>

              <button
                onClick={downloadSummaryMarkdown}
                disabled={!summaryData}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#DA7756] hover:bg-[#C4633F] text-white text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                Download .md
              </button>

              <button
                onClick={handleGenerateSummary}
                disabled={summaryLoading}
                className="p-2 rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] text-[#6B675F] hover:text-[#DA7756] cursor-pointer"
                title="Regenerate revision guide"
              >
                <RefreshCw className={`w-4 h-4 ${summaryLoading ? 'animate-spin text-[#DA7756]' : ''}`} />
              </button>
            </div>
          </div>

          {/* Guide Content */}
          {summaryLoading ? (
            <div className="py-24 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#DA7756] mx-auto" />
              <p className="text-sm text-[#6B675F] dark:text-[#A39E93]">
                Analyzing course vectors and formatting comprehensive cheat sheet...
              </p>
            </div>
          ) : !summaryData ? (
            <div className="py-16 text-center space-y-4">
              <BookOpen className="w-12 h-12 text-[#DA7756] mx-auto opacity-70" />
              <p className="text-sm text-[#6B675F] dark:text-[#A39E93]">
                Click "Regenerate revision guide" to build your course cheat sheet.
              </p>
            </div>
          ) : (
            <div className="p-8 rounded-3xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] shadow-sm space-y-6">
              {/* Key Concept Badges */}
              {summaryData.key_concepts && summaryData.key_concepts.length > 0 && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-[#DA7756] mb-2.5">
                    Core Exam Topics:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {summaryData.key_concepts.map((concept, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 rounded-full bg-[#EDEAE1] dark:bg-[#383531] text-xs font-semibold text-[#1F1E1D] dark:text-[#F5F4EF]"
                      >
                        {concept}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Formatted Markdown Body */}
              <div className="text-sm md:text-base leading-relaxed text-[#1F1E1D] dark:text-[#F5F4EF] whitespace-pre-wrap font-sans space-y-4 border-t border-[#E3E0D8] dark:border-[#423F3A] pt-6">
                {summaryData.summary_markdown}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
