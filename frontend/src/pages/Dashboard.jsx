import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  Bot, 
  ShieldCheck, 
  FileText, 
  Radio, 
  Sparkles, 
  ArrowRight, 
  Search, 
  Camera, 
  CheckCircle,
  ThumbsUp,
  ThumbsDown,
  Clock,
  ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import { useVoice } from '../context/VoiceContext';

export default function Dashboard({ setActiveTab, setSelectedCourseId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isWakeWordActive, isListening, isSpeaking, startManualCapture } = useVoice();

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboardStats();
      setData(res);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const stats = data?.stats || {
    courses: 0,
    documents: 0,
    chunks: 0,
    study_queries: 0,
    tools_executed: 0
  };

  return (
    <div className="p-8 md:p-10 max-w-7xl mx-auto space-y-10">
      {/* Hero Banner with Claude Warm Aesthetic */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#EDEAE1] to-[#F5F4EF] dark:from-[#2E2C29] dark:to-[#242321] border border-[#DDD9D0] dark:border-[#48453F] p-8 md:p-10 shadow-sm">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#DA7756]/15 text-[#DA7756] text-sm font-semibold mb-4">
            <Radio className="w-4.5 h-4.5 animate-pulse" />
            Voice-First AI Study & Productivity Agent
          </div>
          <h1 className="font-serif-claude text-3xl md:text-5xl font-bold tracking-tight text-[#181716] dark:text-[#F8F6F2] mb-4">
            Welcome to TARA
          </h1>
          <p className="text-base md:text-lg leading-relaxed text-[#4A463F] dark:text-[#C8C3B8] mb-8 font-normal">
            Your grounded study companion and autonomous desktop assistant. Ask questions strictly answered by your ingested course notes, or delegate browser and system tasks with visible permission control.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={startManualCapture}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#DA7756] hover:bg-[#C4633F] text-white text-base font-semibold shadow-md transition-all cursor-pointer"
            >
              <Sparkles className="w-5 h-5" />
              Ask TARA Spoken Question
            </button>
            <button
              onClick={() => setActiveTab('courses')}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#FFFFFF] dark:bg-[#363430] border border-[#DDD9D0] dark:border-[#48453F] text-[#181716] dark:text-[#F8F6F2] hover:bg-[#EDEAE1] dark:hover:bg-[#423F3A] text-base font-semibold transition-all cursor-pointer shadow-xs"
            >
              <GraduationCap className="w-5 h-5 text-[#DA7756]" />
              Manage Course Materials
            </button>
          </div>
        </div>

        {/* Ambient Badge */}
        <div className="hidden lg:block absolute right-10 bottom-10 p-6 rounded-2xl bg-[#FFFFFF]/90 dark:bg-[#2C2A27]/90 border border-[#DDD9D0] dark:border-[#48453F] backdrop-blur-md text-base space-y-2.5 shadow-md">
          <div className="font-semibold text-[#181716] dark:text-[#F8F6F2] flex items-center gap-2.5">
            <span className={`w-3 h-3 rounded-full ${isWakeWordActive ? 'bg-[#3D6B4A]' : 'bg-[#6B675F]'}`} />
            Wake Word: <span className="font-mono text-[#DA7756] font-bold text-lg">"TARA"</span>
          </div>
          <div className="text-sm text-[#4A463F] dark:text-[#C8C3B8] font-mono">
            Phonetic: /ˈtɑːrə/ (TAH-rah)
          </div>
          <div className="text-sm text-[#4A463F] dark:text-[#C8C3B8]">
            Engine: {data?.system_status?.vector_engine || 'FAISS (384-dim)'}
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <div className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#2C2A27] border border-[#DDD9D0] dark:border-[#48453F] shadow-xs">
          <div className="flex items-center justify-between text-sm font-bold uppercase tracking-wider text-[#4A463F] dark:text-[#C8C3B8] mb-2">
            <span>Enrolled Courses</span>
            <GraduationCap className="w-5 h-5 text-[#DA7756]" />
          </div>
          <div className="font-serif-claude text-4xl font-bold text-[#181716] dark:text-[#F8F6F2]">
            {stats.courses}
          </div>
          <div className="text-sm text-[#4A463F] dark:text-[#C8C3B8] mt-2 font-medium">
            {stats.documents} documents ingested
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#2C2A27] border border-[#DDD9D0] dark:border-[#48453F] shadow-xs">
          <div className="flex items-center justify-between text-sm font-bold uppercase tracking-wider text-[#4A463F] dark:text-[#C8C3B8] mb-2">
            <span>Vector Chunks</span>
            <FileText className="w-5 h-5 text-[#3D6B4A]" />
          </div>
          <div className="font-serif-claude text-4xl font-bold text-[#181716] dark:text-[#F8F6F2]">
            {stats.chunks}
          </div>
          <div className="text-sm text-[#3D6B4A] dark:text-[#67A87A] font-semibold mt-2">
            Isolated per-course FAISS
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#2C2A27] border border-[#DDD9D0] dark:border-[#48453F] shadow-xs">
          <div className="flex items-center justify-between text-sm font-bold uppercase tracking-wider text-[#4A463F] dark:text-[#C8C3B8] mb-2">
            <span>Study Q&A Sessions</span>
            <Bot className="w-5 h-5 text-[#A6752A]" />
          </div>
          <div className="font-serif-claude text-4xl font-bold text-[#181716] dark:text-[#F8F6F2]">
            {stats.study_queries}
          </div>
          <div className="text-sm text-[#4A463F] dark:text-[#C8C3B8] mt-2 font-medium">
            100% cited responses
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#2C2A27] border border-[#DDD9D0] dark:border-[#48453F] shadow-xs">
          <div className="flex items-center justify-between text-sm font-bold uppercase tracking-wider text-[#4A463F] dark:text-[#C8C3B8] mb-2">
            <span>Verified Tool Actions</span>
            <ShieldCheck className="w-5 h-5 text-[#DA7756]" />
          </div>
          <div className="font-serif-claude text-4xl font-bold text-[#181716] dark:text-[#F8F6F2]">
            {stats.tools_executed}
          </div>
          <div className="text-sm text-[#4A463F] dark:text-[#C8C3B8] mt-2 font-medium">
            Permission gated
          </div>
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div>
        <h2 className="text-base font-bold uppercase tracking-wider text-[#4A463F] dark:text-[#C8C3B8] mb-5">
          Quick Launch Workflows
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button
            onClick={() => {
              if (data?.courses && data.courses.length > 0) {
                setSelectedCourseId(data.courses[0].id);
              }
              setActiveTab('study');
            }}
            className="p-7 text-left rounded-2xl bg-[#FFFFFF] dark:bg-[#2C2A27] border border-[#DDD9D0] dark:border-[#48453F] hover:border-[#DA7756] transition-all shadow-xs cursor-pointer group"
          >
            <div className="p-3.5 w-fit rounded-xl bg-[#DA7756]/10 text-[#DA7756] mb-4 group-hover:bg-[#DA7756] group-hover:text-white transition-colors">
              <GraduationCap className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-[#181716] dark:text-[#F8F6F2] mb-2 flex items-center justify-between">
              Course Study Chat
              <ArrowRight className="w-5 h-5 text-[#6B675F] group-hover:translate-x-1.5 transition-transform" />
            </h3>
            <p className="text-base text-[#4A463F] dark:text-[#C8C3B8] leading-relaxed">
              Ask questions strictly grounded in your syllabus and textbook PDFs with exact citations.
            </p>
          </button>

          <button
            onClick={() => setActiveTab('agent')}
            className="p-7 text-left rounded-2xl bg-[#FFFFFF] dark:bg-[#2C2A27] border border-[#DDD9D0] dark:border-[#48453F] hover:border-[#DA7756] transition-all shadow-xs cursor-pointer group"
          >
            <div className="p-3.5 w-fit rounded-xl bg-[#3D6B4A]/10 text-[#3D6B4A] dark:text-[#67A87A] mb-4 group-hover:bg-[#3D6B4A] group-hover:text-white transition-colors">
              <Bot className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-[#181716] dark:text-[#F8F6F2] mb-2 flex items-center justify-between">
              General Agent & Tools
              <ArrowRight className="w-5 h-5 text-[#6B675F] group-hover:translate-x-1.5 transition-transform" />
            </h3>
            <p className="text-base text-[#4A463F] dark:text-[#C8C3B8] leading-relaxed">
              Delegate browser searches, web page extraction, screenshots, and OS desktop tasks.
            </p>
          </button>

          <button
            onClick={() => setActiveTab('courses')}
            className="p-7 text-left rounded-2xl bg-[#FFFFFF] dark:bg-[#2C2A27] border border-[#DDD9D0] dark:border-[#48453F] hover:border-[#DA7756] transition-all shadow-xs cursor-pointer group"
          >
            <div className="p-3.5 w-fit rounded-xl bg-[#A6752A]/10 text-[#A6752A] dark:text-[#E0A64C] mb-4 group-hover:bg-[#A6752A] group-hover:text-white transition-colors">
              <FileText className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-[#181716] dark:text-[#F8F6F2] mb-2 flex items-center justify-between">
              Ingest New Syllabus / PDF
              <ArrowRight className="w-5 h-5 text-[#6B675F] group-hover:translate-x-1.5 transition-transform" />
            </h3>
            <p className="text-base text-[#4A463F] dark:text-[#C8C3B8] leading-relaxed">
              Upload course slides, syllabus, or lecture notes to build isolated vector knowledge bases.
            </p>
          </button>
        </div>
      </div>

      {/* Two Columns: Recent Study Interactions & Recent Tool Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Study Activity */}
        <div className="p-7 rounded-2xl bg-[#FFFFFF] dark:bg-[#2C2A27] border border-[#DDD9D0] dark:border-[#48453F] shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-[#181716] dark:text-[#F8F6F2] flex items-center gap-2.5">
              <GraduationCap className="w-6 h-6 text-[#DA7756]" />
              Recent Grounded Study Q&A
            </h3>
            <button
              onClick={() => setActiveTab('study')}
              className="text-base text-[#DA7756] hover:underline font-bold cursor-pointer"
            >
              Open Chat
            </button>
          </div>

          {data?.recent_study && data.recent_study.length > 0 ? (
            <div className="space-y-4">
              {data.recent_study.map((item) => (
                <div
                  key={item.id}
                  className="p-5 rounded-xl bg-[#F5F4EF] dark:bg-[#242321] border border-[#DDD9D0] dark:border-[#48453F] text-base space-y-2.5"
                >
                  <div className="flex items-center justify-between text-[#4A463F] dark:text-[#C8C3B8]">
                    <span className="font-bold text-[#DA7756] truncate max-w-[280px]">
                      {item.course_name}
                    </span>
                    <span className="text-xs font-medium">
                      {item.citation_count} citation{item.citation_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-[#181716] dark:text-[#F8F6F2] line-clamp-2 leading-relaxed">
                    {item.content}
                  </p>
                  <div className="flex items-center justify-between pt-1.5 text-xs text-[#4A463F] dark:text-[#C8C3B8]">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {item.feedback && (
                      <span className="flex items-center gap-1.5 font-bold text-[#3D6B4A] dark:text-[#67A87A]">
                        {item.feedback === 'up' ? <ThumbsUp className="w-4 h-4" /> : <ThumbsDown className="w-4 h-4" />}
                        {item.feedback === 'up' ? 'Helpful' : 'Needs Review'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-14 text-center text-base text-[#4A463F] dark:text-[#C8C3B8]">
              No study queries yet. Select a course and ask your first question!
            </div>
          )}
        </div>

        {/* Recent Tool Executions */}
        <div className="p-7 rounded-2xl bg-[#FFFFFF] dark:bg-[#2C2A27] border border-[#DDD9D0] dark:border-[#48453F] shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-[#181716] dark:text-[#F8F6F2] flex items-center gap-2.5">
              <ShieldCheck className="w-6 h-6 text-[#3D6B4A] dark:text-[#67A87A]" />
              Tool Execution Audit Log
            </h3>
            <button
              onClick={() => setActiveTab('tools')}
              className="text-base text-[#DA7756] hover:underline font-bold cursor-pointer"
            >
              View Permissions
            </button>
          </div>

          {data?.recent_tools && data.recent_tools.length > 0 ? (
            <div className="space-y-4">
              {data.recent_tools.map((log) => (
                <div
                  key={log.id}
                  className="p-5 rounded-xl bg-[#F5F4EF] dark:bg-[#242321] border border-[#DDD9D0] dark:border-[#48453F] text-base space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-base text-[#181716] dark:text-[#F8F6F2]">
                      {log.tool_name}
                    </span>
                    <span className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${
                      log.status === 'executed' 
                        ? 'bg-[#3D6B4A]/15 text-[#3D6B4A] dark:text-[#67A87A]' 
                        : log.status === 'rejected'
                        ? 'bg-[#A6752A]/15 text-[#A6752A] dark:text-[#E0A64C]'
                        : 'bg-[#C24343]/15 text-[#C24343] dark:text-[#E57373]'
                    }`}>
                      {log.status}
                    </span>
                  </div>
                  <p className="text-[#4A463F] dark:text-[#C8C3B8] text-sm truncate">
                    {log.summary || 'Executed successfully with human confirmation.'}
                  </p>
                  <div className="text-xs text-[#4A463F] dark:text-[#C8C3B8] pt-1">
                    {new Date(log.executed_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-14 text-center text-base text-[#4A463F] dark:text-[#C8C3B8]">
              No tool executions logged yet. Try asking the agent to search the web or take a screenshot.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
