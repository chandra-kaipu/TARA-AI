import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Unlock, 
  Clock, 
  Globe, 
  BookOpen, 
  Download, 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  ExternalLink,
  Calendar,
  Layers,
  Search,
  Eye,
  Activity,
  Target,
  Plus,
  CheckSquare
} from 'lucide-react';
import { api } from '../services/api';

export default function ParentalPortal() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const [summary, setSummary] = useState(null);
  const [webLogs, setWebLogs] = useState([]);
  const [studyLogs, setStudyLogs] = useState([]);
  const [goals, setGoals] = useState([]);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalType, setNewGoalType] = useState('study_time');
  const [newGoalValue, setNewGoalValue] = useState(50);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'web' | 'study_time' | 'goals'
  const [loadingData, setLoadingData] = useState(false);

  const handleVerifyPin = async (e) => {
    e.preventDefault();
    setPinError('');
    if (!pinInput.trim()) return;

    try {
      setVerifying(true);
      await api.verifyParentPin(pinInput);
      setIsAuthenticated(true);
      loadPortalData();
    } catch (err) {
      setPinError(err.message || 'Incorrect PIN. Default is 1234.');
    } finally {
      setVerifying(false);
    }
  };

  const loadPortalData = async () => {
    try {
      setLoadingData(true);
      const [sumRes, webRes, studyRes, goalsRes] = await Promise.all([
        api.getParentalSummary(),
        api.getParentalWebActivity(),
        api.getParentalStudyTime(),
        api.getParentalGoals()
      ]);
      setSummary(sumRes);
      setWebLogs(webRes);
      setStudyLogs(studyRes);
      setGoals(goalsRes || []);
    } catch (err) {
      console.error('Error loading parental data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleCreateGoal = async (e) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;
    try {
      await api.createParentalGoal(newGoalTitle, newGoalType, Number(newGoalValue));
      setNewGoalTitle('');
      const updated = await api.getParentalGoals();
      setGoals(updated);
    } catch (err) {
      alert(`Error creating goal: ${err.message}`);
    }
  };

  const handleToggleGoal = async (goalId) => {
    try {
      await api.toggleParentalGoal(goalId);
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, is_completed: !g.is_completed } : g));
    } catch (err) {
      console.error('Toggle error:', err);
    }
  };

  const handleDownloadCsv = () => {
    window.open(api.getParentalReportUrl(), '_blank');
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-5rem)] px-6 py-12">
        <div className="w-full max-w-md p-8 rounded-3xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] shadow-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-[#DA7756]/15 text-[#DA7756] flex items-center justify-center mx-auto shadow-xs">
            <Lock className="w-8 h-8" />
          </div>

          <div>
            <h2 className="font-serif-claude text-2xl font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
              Parent & Guardian Portal
            </h2>
            <p className="text-xs md:text-sm text-[#6B675F] dark:text-[#A39E93] mt-1.5 leading-relaxed">
              Enter your parental security PIN to view daily study time, app usage, and monitored web activities.
            </p>
          </div>

          <form onSubmit={handleVerifyPin} className="space-y-4">
            <div>
              <input
                type="password"
                maxLength={8}
                placeholder="Enter 4-digit PIN (Default: 1234)"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                autoFocus
                className="w-full text-center text-xl tracking-widest font-mono py-3.5 px-4 rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#F5F4EF] dark:bg-[#262523] text-[#1F1E1D] dark:text-[#F5F4EF] focus:outline-none focus:border-[#DA7756]"
              />
              {pinError && (
                <p className="text-xs text-[#D04F4F] font-semibold mt-2 flex items-center justify-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {pinError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={verifying || !pinInput}
              className="w-full py-3 px-4 rounded-xl bg-[#DA7756] hover:bg-[#C4633F] text-white font-bold text-sm shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
              {verifying ? 'Unlocking...' : 'Unlock Parental Dashboard'}
            </button>
          </form>

          <div className="pt-4 border-t border-[#E3E0D8] dark:border-[#423F3A] text-[11px] text-[#6B675F] dark:text-[#A39E93]">
            Default security PIN is set to <strong className="font-mono text-[#DA7756]">1234</strong>. Can be customized in Settings.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-[#4F7A5C]/15 text-[#4F7A5C]">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif-claude text-2xl font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
                Parental Supervision & Web Oversight
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#4F7A5C]/10 text-[#4F7A5C] text-xs font-bold font-mono">
                Active & Monitored
              </span>
            </div>
            <p className="text-xs md:text-sm text-[#6B675F] dark:text-[#A39E93] mt-1">
              Review real-time study hours, focus intervals, and internet contents accessed by the student.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadCsv}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#DA7756] hover:bg-[#C4633F] text-white text-xs md:text-sm font-bold shadow-xs transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export Oversight Report (CSV)
          </button>

          <button
            onClick={() => {
              setIsAuthenticated(false);
              setPinInput('');
            }}
            className="p-2.5 rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] text-[#6B675F] hover:text-[#1F1E1D] dark:hover:text-[#F5F4EF] hover:bg-[#F5F4EF] dark:hover:bg-[#383531] transition-colors cursor-pointer"
            title="Lock Parental Portal"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Card 1: Today's Study Time */}
          <div className="p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#6B675F] dark:text-[#A39E93]">
              <span>Study Time Today</span>
              <Clock className="w-4 h-4 text-[#DA7756]" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#1F1E1D] dark:text-[#F5F4EF]">
              {summary.today.study_minutes} mins
            </div>
            <div className="w-full bg-[#EDEAE1] dark:bg-[#383531] h-2 rounded-full overflow-hidden">
              <div 
                className="bg-[#DA7756] h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, summary.today.limit_percent_used)}%` }}
              />
            </div>
            <div className="text-[11px] text-[#6B675F] dark:text-[#A39E93] flex justify-between">
              <span>{summary.today.study_hours} hrs studied</span>
              <span>Limit: {summary.today.daily_limit_minutes}m</span>
            </div>
          </div>

          {/* Card 2: Focus Sessions */}
          <div className="p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#6B675F] dark:text-[#A39E93]">
              <span>Focus Sessions Today</span>
              <Activity className="w-4 h-4 text-[#4F7A5C]" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#1F1E1D] dark:text-[#F5F4EF]">
              {summary.today.sessions_count} sessions
            </div>
            <p className="text-xs text-[#6B675F] dark:text-[#A39E93]">
              Completed timed Pomodoro / study intervals
            </p>
          </div>

          {/* Card 3: Web Queries Monitored */}
          <div className="p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#6B675F] dark:text-[#A39E93]">
              <span>Web Searches Monitored</span>
              <Globe className="w-4 h-4 text-[#3B82F6]" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#1F1E1D] dark:text-[#F5F4EF]">
              {summary.today.web_queries_count} searches
            </div>
            <p className="text-xs text-[#6B675F] dark:text-[#A39E93]">
              Total all-time: {summary.all_time.web_queries_total} monitored queries
            </p>
          </div>

          {/* Card 4: Study Chat Queries */}
          <div className="p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#6B675F] dark:text-[#A39E93]">
              <span>Questions Asked</span>
              <BookOpen className="w-4 h-4 text-[#B8863A]" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#1F1E1D] dark:text-[#F5F4EF]">
              {summary.all_time.questions_asked}
            </div>
            <p className="text-xs text-[#6B675F] dark:text-[#A39E93]">
              Academic inquiries across course PDFs
            </p>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E3E0D8] dark:border-[#423F3A] pb-3">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-[#DA7756] text-white shadow-xs'
              : 'text-[#6B675F] dark:text-[#A39E93] hover:text-[#1F1E1D] dark:hover:text-[#F5F4EF]'
          }`}
        >
          <Layers className="w-4 h-4" />
          Course Breakdown
        </button>

        <button
          onClick={() => setActiveTab('web')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'web'
              ? 'bg-[#DA7756] text-white shadow-xs'
              : 'text-[#6B675F] dark:text-[#A39E93] hover:text-[#1F1E1D] dark:hover:text-[#F5F4EF]'
          }`}
        >
          <Globe className="w-4 h-4" />
          Web Access & Searches ({webLogs.length})
        </button>

        <button
          onClick={() => setActiveTab('study_time')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'study_time'
              ? 'bg-[#DA7756] text-white shadow-xs'
              : 'text-[#6B675F] dark:text-[#A39E93] hover:text-[#1F1E1D] dark:hover:text-[#F5F4EF]'
          }`}
        >
          <Clock className="w-4 h-4" />
          Detailed Study Sessions ({studyLogs.length})
        </button>

        <button
          onClick={() => setActiveTab('goals')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'goals'
              ? 'bg-[#DA7756] text-white shadow-xs'
              : 'text-[#6B675F] dark:text-[#A39E93] hover:text-[#1F1E1D] dark:hover:text-[#F5F4EF]'
          }`}
        >
          <Target className="w-4 h-4" />
          Daily Goals & Contract ({goals.filter(g => g.is_completed).length}/{goals.length})
        </button>
      </div>

      {/* Tab 1: Course Breakdown */}
      {activeTab === 'overview' && summary && (
        <div className="p-6 rounded-3xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] shadow-xs space-y-4">
          <h3 className="font-serif-claude text-lg font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
            Time Invested Across Enrolled Courses
          </h3>

          <div className="divide-y divide-[#E3E0D8] dark:divide-[#423F3A]">
            {summary.course_breakdown.map((c, idx) => (
              <div key={idx} className="py-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm md:text-base text-[#1F1E1D] dark:text-[#F5F4EF]">
                    {c.name}
                  </div>
                  <div className="text-xs text-[#6B675F] dark:text-[#A39E93] mt-0.5">
                    {c.sessions_count} logged focus blocks
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-base text-[#DA7756]">
                    {c.minutes_spent} minutes
                  </div>
                  <div className="text-xs text-[#6B675F]">
                    {roundHours(c.minutes_spent)} hours
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Monitored Web Access Logs */}
      {activeTab === 'web' && (
        <div className="p-6 rounded-3xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] shadow-xs space-y-4">
          <div>
            <h3 className="font-serif-claude text-lg font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
              Monitored Student Internet Browsing
            </h3>
            <p className="text-xs text-[#6B675F] dark:text-[#A39E93] mt-0.5">
              Live record of every search term queried, external URL visited, and web article extracted.
            </p>
          </div>

          {webLogs.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#6B675F] dark:text-[#A39E93]">
              No external web searches or browsing activity recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {webLogs.map((log) => (
                <div 
                  key={log.id} 
                  className="p-4 rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#F5F4EF]/40 dark:bg-[#262523]/40 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold uppercase tracking-wider text-[#DA7756] flex items-center gap-1.5">
                      {log.activity_type === 'search' ? <Search className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                      {log.activity_type}
                    </span>
                    <span className="text-[#6B675F] dark:text-[#A39E93] font-mono">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <div className="font-semibold text-sm text-[#1F1E1D] dark:text-[#F5F4EF]">
                    {log.query_or_url}
                  </div>

                  {log.summary && (
                    <div className="text-xs text-[#6B675F] dark:text-[#A39E93] line-clamp-2">
                      {log.summary}
                    </div>
                  )}

                  <div className="pt-1 flex items-center justify-between text-[11px]">
                    <span className="inline-flex items-center gap-1 text-[#4F7A5C] font-semibold">
                      <CheckCircle className="w-3 h-3" /> Educational & Safe
                    </span>
                    <span className="text-[#6B675F] font-mono">Logged by TARA Engine</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Detailed Study Sessions */}
      {activeTab === 'study_time' && (
        <div className="p-6 rounded-3xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] shadow-xs space-y-4">
          <div>
            <h3 className="font-serif-claude text-lg font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
              Logged Study Sessions & Focus History
            </h3>
            <p className="text-xs text-[#6B675F] dark:text-[#A39E93] mt-0.5">
              Exact timetable of when the student studied and which courses they focused on.
            </p>
          </div>

          {studyLogs.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#6B675F] dark:text-[#A39E93]">
              No study sessions logged yet.
            </div>
          ) : (
            <div className="space-y-3">
              {studyLogs.map((sess) => (
                <div 
                  key={sess.id}
                  className="p-4 rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#F5F4EF]/40 dark:bg-[#262523]/40 flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
                      {sess.course_name}
                    </div>
                    <div className="text-xs text-[#6B675F] dark:text-[#A39E93]">
                      Type: <span className="font-mono text-[#DA7756]">{sess.session_type}</span> • {sess.notes || 'Productive study interval'}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-bold text-base text-[#4F7A5C]">
                      +{sess.duration_minutes} mins
                    </div>
                    <div className="text-[11px] text-[#6B675F] font-mono">
                      {new Date(sess.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(sess.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Daily Goals & Contract */}
      {activeTab === 'goals' && (
        <div className="space-y-6">
          {/* Add New Goal Card */}
          <div className="p-6 rounded-3xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-[#DA7756]" />
              <h3 className="font-serif-claude text-lg font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
                Set Daily Study Goal & Academic Target
              </h3>
            </div>
            <form onSubmit={handleCreateGoal} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="e.g., Complete 30 min focus session or score 85%+ on Quiz"
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
                className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#F5F4EF] dark:bg-[#262523] text-[#1F1E1D] dark:text-[#F5F4EF] focus:outline-none focus:border-[#DA7756]"
              />
              <select
                value={newGoalType}
                onChange={(e) => setNewGoalType(e.target.value)}
                className="px-3 py-2.5 text-xs rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#F5F4EF] dark:bg-[#262523] text-[#1F1E1D] dark:text-[#F5F4EF] font-semibold"
              >
                <option value="study_time">Study Time (Mins)</option>
                <option value="quiz_score">Quiz Score (%)</option>
                <option value="focus_blocks">Focus Intervals</option>
              </select>
              <input
                type="number"
                value={newGoalValue}
                onChange={(e) => setNewGoalValue(e.target.value)}
                className="w-20 px-3 py-2.5 text-xs text-center font-mono rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#F5F4EF] dark:bg-[#262523] text-[#1F1E1D] dark:text-[#F5F4EF]"
              />
              <button
                type="submit"
                className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#DA7756] hover:bg-[#C4633F] text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" /> Add Goal
              </button>
            </form>
          </div>

          {/* Active Goals Checklist */}
          <div className="p-6 rounded-3xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3E0D8] dark:border-[#423F3A]">
              <h3 className="font-serif-claude text-lg font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
                Daily Study Checklist ({goals.filter(g => g.is_completed).length} / {goals.length} Completed)
              </h3>
              <span className="text-xs text-[#4F7A5C] font-semibold font-mono">
                {goals.length > 0 ? Math.round((goals.filter(g => g.is_completed).length / goals.length) * 100) : 0}% Target Met
              </span>
            </div>

            {goals.length === 0 ? (
              <div className="py-12 text-center text-sm text-[#6B675F]">
                No goals added yet. Set a goal above to guide the student's study habits.
              </div>
            ) : (
              <div className="space-y-3">
                {goals.map((goal) => (
                  <div
                    key={goal.id}
                    onClick={() => handleToggleGoal(goal.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between shadow-xs ${
                      goal.is_completed
                        ? 'border-[#4F7A5C]/40 bg-[#4F7A5C]/10 text-[#4F7A5C]'
                        : 'border-[#E3E0D8] dark:border-[#423F3A] bg-[#F5F4EF]/40 dark:bg-[#262523]/40 text-[#1F1E1D] dark:text-[#F5F4EF]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center border ${
                        goal.is_completed ? 'bg-[#4F7A5C] border-[#4F7A5C] text-white' : 'border-[#6B675F]'
                      }`}>
                        {goal.is_completed && <CheckCircle className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className={`text-sm font-bold ${goal.is_completed ? 'line-through opacity-80' : ''}`}>
                          {goal.title}
                        </div>
                        <div className="text-xs text-[#6B675F] dark:text-[#A39E93]">
                          Target: {goal.target_value} ({goal.target_type.replace('_', ' ')})
                        </div>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono ${
                      goal.is_completed ? 'bg-[#4F7A5C]/20 text-[#4F7A5C]' : 'bg-[#DA7756]/15 text-[#DA7756]'
                    }`}>
                      {goal.is_completed ? 'Completed' : 'In Progress'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function roundHours(mins) {
  return (mins / 60).toFixed(1);
}
