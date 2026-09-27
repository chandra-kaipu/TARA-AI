import React, { useState, useEffect } from 'react';
import { 
  Award, 
  Download, 
  CheckCircle2, 
  ThumbsUp, 
  ThumbsDown, 
  FileText, 
  Bookmark, 
  Clock, 
  ExternalLink,
  ShieldCheck,
  GraduationCap,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';

export default function PilotEvaluation({ selectedCourseId, setSelectedCourseId }) {
  const [courses, setCourses] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const courseList = await api.listCourses();
      setCourses(courseList);
      
      const courseToLoad = selectedCourseId || (courseList.length > 0 ? courseList[0].id : null);
      if (courseToLoad) {
        if (!selectedCourseId) setSelectedCourseId(courseToLoad);
        const data = await api.getCourseAnalytics(courseToLoad);
        setAnalytics(data);
      }
    } catch (err) {
      console.error('Failed to load evaluation analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCourseId]);

  const handleExportCsv = () => {
    if (!selectedCourseId) return;
    window.open(api.getExportCsvUrl(selectedCourseId), '_blank');
  };

  return (
    <div className="p-8 md:p-10 max-w-7xl mx-auto space-y-9">
      {/* Academic Project Header (Directly reflecting syllabus specification) */}
      <div className="p-8 md:p-10 rounded-3xl bg-gradient-to-r from-[#EDEAE1] to-[#F5F4EF] dark:from-[#2E2C29] dark:to-[#242321] border border-[#DDD9D0] dark:border-[#48453F] shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2.5 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#DA7756]/15 text-[#DA7756] text-xs font-bold uppercase tracking-wider">
              <Award className="w-4 h-4" />
              Major Project — 4th Year • KPRIT Pilot Deployment
            </div>
            <h1 className="font-serif-claude text-2xl md:text-4xl font-bold tracking-tight text-[#181716] dark:text-[#F8F6F2]">
              LLM-Powered Voice Assistant Grounded in Course Learning Resources
            </h1>
            <p className="text-base leading-relaxed text-[#4A463F] dark:text-[#C8C3B8]">
              A directly deployable voice-first study assistant for <strong>KPRIT (Kommuri Pratap Reddy Institute of Technology)</strong> students. Evaluates answers grounded strictly from syllabus, lecture notes, and reference textbooks.
            </p>
            <div className="pt-2 text-xs md:text-sm font-mono text-[#DA7756] flex items-center gap-2">
              <span>Academic Reference: Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks", NeurIPS 2020.</span>
            </div>
          </div>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#DA7756] hover:bg-[#C4633F] text-white text-base font-semibold shadow-md transition-all cursor-pointer shrink-0"
          >
            <Download className="w-5 h-5" />
            Export Pilot Report (CSV)
          </button>
        </div>
      </div>

      {/* Course Selector & Refresh */}
      <div className="flex items-center justify-between gap-4 p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#2C2A27] border border-[#DDD9D0] dark:border-[#48453F]">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-6 h-6 text-[#DA7756]" />
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-[#4A463F] dark:text-[#C8C3B8]">Piloted Course Track</div>
            <select
              value={selectedCourseId || ''}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="text-base font-bold bg-[#EDEAE1] dark:bg-[#363430] border border-[#DDD9D0] dark:border-[#48453F] rounded-xl px-3.5 py-1.5 text-[#181716] dark:text-[#F8F6F2] mt-1 cursor-pointer focus:outline-none focus:border-[#DA7756]"
            >
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code || 'COURSE'})
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={loadData}
          className="p-2.5 rounded-xl bg-[#EDEAE1] dark:bg-[#363430] text-[#181716] dark:text-[#F8F6F2] hover:bg-[#DDD9D0] dark:hover:bg-[#48453F] transition-colors cursor-pointer"
          title="Refresh metrics"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {loading || !analytics ? (
        <div className="py-20 text-center text-base text-[#4A463F] dark:text-[#C8C3B8] flex items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#DA7756]" />
          Computing pilot evaluation metrics...
        </div>
      ) : (
        <>
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <div className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#2C2A27] border border-[#DDD9D0] dark:border-[#48453F] shadow-xs">
              <div className="text-xs font-bold uppercase tracking-wider text-[#4A463F] dark:text-[#C8C3B8] mb-1.5">
                Total Student Queries
              </div>
              <div className="font-serif-claude text-4xl font-bold text-[#181716] dark:text-[#F8F6F2]">
                {analytics.metrics.total_student_queries}
              </div>
              <div className="text-xs text-[#DA7756] mt-1.5 font-semibold">
                Voice & hands-free sessions
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#2C2A27] border border-[#DDD9D0] dark:border-[#48453F] shadow-xs">
              <div className="text-xs font-bold uppercase tracking-wider text-[#4A463F] dark:text-[#C8C3B8] mb-1.5">
                Grounding Accuracy Rate
              </div>
              <div className="font-serif-claude text-4xl font-bold text-[#3D6B4A] dark:text-[#67A87A]">
                {analytics.metrics.grounding_accuracy_rate}
              </div>
              <div className="text-xs text-[#4A463F] dark:text-[#C8C3B8] mt-1.5 font-medium">
                {analytics.metrics.grounded_answers} verified with citations
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#2C2A27] border border-[#DDD9D0] dark:border-[#48453F] shadow-xs">
              <div className="text-xs font-bold uppercase tracking-wider text-[#4A463F] dark:text-[#C8C3B8] mb-1.5">
                Student Usefulness Score
              </div>
              <div className="font-serif-claude text-4xl font-bold text-[#A6752A] dark:text-[#E0A64C]">
                {analytics.metrics.student_usefulness_score}
              </div>
              <div className="text-xs text-[#4A463F] dark:text-[#C8C3B8] mt-1.5 font-medium">
                Based on student 👍/👎 feedback
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#2C2A27] border border-[#DDD9D0] dark:border-[#48453F] shadow-xs">
              <div className="text-xs font-bold uppercase tracking-wider text-[#4A463F] dark:text-[#C8C3B8] mb-1.5">
                Hallucinations Prevented
              </div>
              <div className="font-serif-claude text-4xl font-bold text-[#DA7756]">
                {analytics.metrics.unanswered_safe_rejections}
              </div>
              <div className="text-xs text-[#3D6B4A] dark:text-[#67A87A] mt-1.5 font-semibold">
                Strict safe out-of-scope rejection
              </div>
            </div>
          </div>

          {/* Student Q&A Evaluation Audit Table */}
          <div className="p-8 rounded-3xl bg-[#FFFFFF] dark:bg-[#2C2A27] border border-[#DDD9D0] dark:border-[#48453F] shadow-xs space-y-5">
            <div>
              <h2 className="text-xl font-bold text-[#181716] dark:text-[#F8F6F2]">
                Piloted Student Q&A and Feedback Audit
              </h2>
              <p className="text-sm text-[#4A463F] dark:text-[#C8C3B8] mt-1">
                Full evaluation log of questions asked by students during the course pilot.
              </p>
            </div>

            {analytics.recent_evaluations && analytics.recent_evaluations.length > 0 ? (
              <div className="divide-y divide-[#DDD9D0] dark:divide-[#48453F] border border-[#DDD9D0] dark:border-[#48453F] rounded-2xl overflow-hidden shadow-xs">
                {analytics.recent_evaluations.map((ev, i) => (
                  <div
                    key={ev.message_id || i}
                    className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-5 bg-[#FFFFFF] dark:bg-[#2C2A27] hover:bg-[#F5F4EF] dark:hover:bg-[#242321] transition-colors"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-serif-claude font-bold text-base text-[#181716] dark:text-[#F8F6F2]">
                          Student Q: "{ev.question}"
                        </span>
                      </div>

                      <p className="text-sm text-[#4A463F] dark:text-[#C8C3B8] leading-relaxed">
                        TARA: {ev.answer}
                      </p>

                      <div className="flex items-center gap-4 text-xs font-semibold">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${
                          ev.is_grounded 
                            ? 'bg-[#3D6B4A]/15 text-[#3D6B4A] dark:text-[#67A87A]'
                            : 'bg-[#A6752A]/15 text-[#A6752A] dark:text-[#E0A64C]'
                        }`}>
                          <CheckCircle2 className="w-4 h-4" />
                          {ev.is_grounded ? `Grounded (${ev.citation_count} citations)` : 'Safely Rejected Off-Topic'}
                        </span>

                        <span className="text-[#4A463F] dark:text-[#C8C3B8] flex items-center gap-1 font-mono">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(ev.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <span className="text-xs uppercase font-bold text-[#4A463F] dark:text-[#C8C3B8]">Rating:</span>
                      <span className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                        ev.feedback === 'up'
                          ? 'bg-[#3D6B4A]/20 text-[#3D6B4A] dark:text-[#67A87A]'
                          : ev.feedback === 'down'
                          ? 'bg-[#C24343]/20 text-[#C24343] dark:text-[#E57373]'
                          : 'bg-[#EDEAE1] dark:bg-[#363430] text-[#6B675F]'
                      }`}>
                        {ev.feedback === 'up' ? <ThumbsUp className="w-4 h-4" /> : ev.feedback === 'down' ? <ThumbsDown className="w-4 h-4" /> : null}
                        {ev.feedback === 'up' ? 'Helpful' : ev.feedback === 'down' ? 'Needs Review' : 'Unrated'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-base text-[#4A463F] dark:text-[#C8C3B8] border border-[#DDD9D0] dark:border-[#48453F] rounded-2xl">
                No evaluations recorded yet for this course. Ask questions in the Study Chat to generate pilot data.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
