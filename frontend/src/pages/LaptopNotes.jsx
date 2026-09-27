import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Save, 
  Download, 
  Sparkles, 
  Copy, 
  Check, 
  Loader2, 
  BookOpen, 
  Search,
  Monitor,
  Maximize2,
  Minimize2,
  Tag
} from 'lucide-react';
import { api } from '../services/api';

export default function LaptopNotes({ selectedCourseId }) {
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  // Active Note Form
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteCourseId, setNoteCourseId] = useState('general');

  useEffect(() => {
    loadNotesAndCourses();
  }, []);

  const loadNotesAndCourses = async () => {
    try {
      setLoading(true);
      const [notesRes, coursesRes] = await Promise.all([
        api.listNotes(),
        api.listCourses()
      ]);
      setNotes(notesRes);
      setCourses(coursesRes);
      if (notesRes.length > 0) {
        selectNote(notesRes[0]);
      } else {
        handleNewNote();
      }
    } catch (err) {
      console.error('Error loading notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectNote = (note) => {
    setActiveNoteId(note.id);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteCourseId(note.course_id || 'general');
    setExplanation(null);
  };

  const handleNewNote = () => {
    setActiveNoteId('new');
    setNoteTitle('Untitled Study Notes');
    setNoteContent('# Key Concepts\n- Write your lecture summary here...\n\n## Important Formulas\n- e.g. E = mc^2\n');
    setNoteCourseId(selectedCourseId || (courses.length > 0 ? courses[0].id : 'general'));
    setExplanation(null);
  };

  const handleSaveNote = async () => {
    if (!noteTitle.trim()) return;
    try {
      setSaving(true);
      if (activeNoteId === 'new') {
        const created = await api.createNote({
          title: noteTitle,
          content: noteContent,
          course_id: noteCourseId,
          tags: ['pc-notes']
        });
        setNotes([created, ...notes]);
        setActiveNoteId(created.id);
      } else {
        const updated = await api.updateNote(activeNoteId, {
          title: noteTitle,
          content: noteContent,
          course_id: noteCourseId
        });
        setNotes(notes.map(n => n.id === updated.id ? updated : n));
      }
    } catch (err) {
      alert(`Failed to save note: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (id) => {
    if (!confirm('Are you sure you want to delete this study note?')) return;
    try {
      await api.deleteNote(id);
      const remaining = notes.filter(n => n.id !== id);
      setNotes(remaining);
      if (remaining.length > 0) {
        selectNote(remaining[0]);
      } else {
        handleNewNote();
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleExplainNote = async () => {
    if (activeNoteId === 'new' || !activeNoteId) {
      alert('Please save the note before asking TARA to explain it.');
      return;
    }
    try {
      setExplaining(true);
      const res = await api.explainNote(activeNoteId);
      setExplanation(res.explanation);
    } catch (err) {
      alert(`AI review error: ${err.message}`);
    } finally {
      setExplaining(false);
    }
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([noteContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${noteTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
    link.click();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(noteContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredNotes = notes.filter(n => 
    !searchQuery || 
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-4.5rem)] max-w-7xl mx-auto px-8 py-5 gap-6 overflow-hidden">
      {/* Left Sidebar: Notes List */}
      <div className="w-80 shrink-0 flex flex-col h-full bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] rounded-3xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-[#DA7756]" />
            <h3 className="font-serif-claude text-xl font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
              PC Scratchpad
            </h3>
          </div>
          <button
            onClick={handleNewNote}
            className="p-2 rounded-xl bg-[#DA7756] hover:bg-[#C4633F] text-white shadow-2xs transition-colors cursor-pointer"
            title="Create New Note"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search Notes */}
        <div className="mb-4 relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[#6B675F]" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#F5F4EF] dark:bg-[#262523] text-[#1F1E1D] dark:text-[#F5F4EF] focus:outline-none focus:border-[#DA7756]"
          />
        </div>

        {/* Notes Cards */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {loading ? (
            <div className="py-12 flex items-center justify-center text-xs text-[#6B675F] gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#DA7756]" />
              Loading notes...
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#6B675F] dark:text-[#A39E93]">
              No notes found. Click + to create a study note.
            </div>
          ) : (
            filteredNotes.map((note) => {
              const isSelected = activeNoteId === note.id;
              return (
                <div
                  key={note.id}
                  onClick={() => selectNote(note)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-1 ${
                    isSelected
                      ? 'border-[#DA7756] bg-[#DA7756]/10 text-[#DA7756]'
                      : 'border-[#E3E0D8] dark:border-[#423F3A] hover:border-[#DA7756] bg-[#F5F4EF]/50 dark:bg-[#262523]/50 text-[#1F1E1D] dark:text-[#F5F4EF]'
                  }`}
                >
                  <div className="font-bold text-sm truncate">
                    {note.title}
                  </div>
                  <div className="text-xs text-[#6B675F] dark:text-[#A39E93] line-clamp-2">
                    {note.content.replace(/[#*`_]/g, '')}
                  </div>
                  <div className="text-[10px] text-[#6B675F] dark:text-[#A39E93] pt-1 flex justify-between font-mono">
                    <span>{new Date(note.updated_at).toLocaleDateString()}</span>
                    <span>{note.content.length} chars</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Area: Dual-Pane Editor & Markdown Preview */}
      <div className="flex-1 flex flex-col h-full bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] rounded-3xl p-6 shadow-xs overflow-hidden">
        {/* Editor Action Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E3E0D8] dark:border-[#423F3A]">
          <div className="flex-1 min-w-[240px]">
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Note Title..."
              className="w-full text-lg md:text-xl font-bold font-serif-claude text-[#1F1E1D] dark:text-[#F5F4EF] bg-transparent focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveNote}
              disabled={saving}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#4F7A5C] hover:bg-[#3D6B4A] text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </button>

            <button
              onClick={handleExplainNote}
              disabled={explaining}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#DA7756] hover:bg-[#C4633F] text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
              title="Have TARA review and clarify your notes"
            >
              {explaining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Ask TARA to Review
            </button>

            <button
              onClick={handleCopy}
              className="p-2 rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] text-[#6B675F] hover:text-[#1F1E1D] dark:hover:text-[#F5F4EF] transition-colors cursor-pointer"
              title="Copy Note Markdown"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#4F7A5C]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handleDownloadMarkdown}
              className="p-2 rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] text-[#6B675F] hover:text-[#1F1E1D] dark:hover:text-[#F5F4EF] transition-colors cursor-pointer"
              title="Download as .md file"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {activeNoteId !== 'new' && (
              <button
                onClick={() => handleDeleteNote(activeNoteId)}
                className="p-2 rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] text-[#6B675F] hover:text-[#D04F4F] transition-colors cursor-pointer"
                title="Delete note"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Dual Pane: Left Editor, Right Live Rendered Preview */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 overflow-hidden">
          {/* Editor Area */}
          <div className="flex flex-col h-full">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B675F] dark:text-[#A39E93] mb-1.5">
              Markdown Editor
            </span>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Type your lecture notes, key formulas, or questions here..."
              className="flex-1 w-full p-4 rounded-2xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#F5F4EF]/50 dark:bg-[#262523]/50 text-sm md:text-base font-mono text-[#1F1E1D] dark:text-[#F5F4EF] focus:outline-none focus:border-[#DA7756] resize-none leading-relaxed overflow-y-auto"
            />
          </div>

          {/* Rendered Preview / AI Explanation Area */}
          <div className="flex flex-col h-full overflow-hidden">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B675F] dark:text-[#A39E93] mb-1.5 flex items-center justify-between">
              <span>{explanation ? 'TARA Academic Review' : 'Formatted Live Preview'}</span>
              {explanation && (
                <button
                  onClick={() => setExplanation(null)}
                  className="text-[10px] text-[#DA7756] hover:underline cursor-pointer"
                >
                  View Preview
                </button>
              )}
            </span>

            <div className="flex-1 p-5 rounded-2xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#FFFFFF] dark:bg-[#262523] text-[#1F1E1D] dark:text-[#F5F4EF] overflow-y-auto leading-relaxed shadow-inner">
              {explanation ? (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-[#DA7756]/15 border border-[#DA7756]/30 text-xs font-bold text-[#DA7756] flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> AI Academic Review & Nuance Check
                  </div>
                  <div className="text-sm md:text-base whitespace-pre-wrap leading-relaxed">
                    {explanation}
                  </div>
                </div>
              ) : (
                <div className="text-sm md:text-base whitespace-pre-wrap font-sans">
                  {noteContent}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
