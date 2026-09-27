import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  GraduationCap, 
  Upload, 
  FileText, 
  Trash2, 
  ArrowRight, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  BookOpen,
  Sparkles,
  Layers,
  Mic,
  MicOff,
  Radio,
  Volume2,
  X
} from 'lucide-react';
import { api } from '../services/api';

export default function Courses({ 
  selectedCourseId, 
  setSelectedCourseId, 
  setActiveTab 
}) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Document Vector Chunks Inspector State
  const [inspectDoc, setInspectDoc] = useState(null);
  const [docChunks, setDocChunks] = useState([]);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [chunkSearch, setChunkSearch] = useState('');
  
  const [courseForm, setCourseForm] = useState({
    name: '',
    code: '',
    description: '',
    color: '#DA7756'
  });

  // Audio Lecture Ingestion State
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [audioTitle, setAudioTitle] = useState('');
  const [audioFile, setAudioFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recorderInstance, setRecorderInstance] = useState(null);
  const [audioUploading, setAudioUploading] = useState(false);

  const startRecordingAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/wav' });
        const file = new File([audioBlob], `lecture_record_${Date.now()}.wav`, { type: 'audio/wav' });
        setAudioFile(file);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setRecorderInstance(recorder);
      setIsRecording(true);
    } catch (err) {
      alert(`Microphone access error: ${err.message}`);
    }
  };

  const stopRecordingAudio = () => {
    if (recorderInstance && isRecording) {
      recorderInstance.stop();
      setIsRecording(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowCreateModal(false);
        setInspectDoc(null);
        if (showAudioModal) {
          stopRecordingAudio();
          setShowAudioModal(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAudioModal, isRecording, recorderInstance]);

  const handleAudioUpload = async (e) => {
    e.preventDefault();
    if (!audioFile || !selectedCourseId) return;

    try {
      setAudioUploading(true);
      await api.uploadAudioLecture(selectedCourseId, audioFile, audioTitle || 'Recorded Lecture');
      setShowAudioModal(false);
      setAudioFile(null);
      setAudioTitle('');
      await loadDocuments(selectedCourseId);
      await loadCourses();
      alert('Audio lecture transcribed and indexed into FAISS vector database successfully!');
    } catch (err) {
      alert(`Audio upload failed: ${err.message}`);
    } finally {
      setAudioUploading(false);
    }
  };

  const loadCourses = async () => {
    try {
      setLoading(true);
      const res = await api.listCourses();
      setCourses(res);
      if (!selectedCourseId && res.length > 0) {
        setSelectedCourseId(res[0].id);
      }
    } catch (err) {
      console.error('Error loading courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async (courseId) => {
    if (!courseId) return;
    try {
      setLoadingDocs(true);
      const res = await api.listDocuments(courseId);
      setDocuments(res);
    } catch (err) {
      console.error('Error loading documents:', err);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    if (selectedCourseId) {
      loadDocuments(selectedCourseId);
    }
  }, [selectedCourseId]);

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!courseForm.name.trim()) return;
    try {
      const created = await api.createCourse(courseForm);
      setCourses([created, ...courses]);
      setSelectedCourseId(created.id);
      setShowCreateModal(false);
      setCourseForm({ name: '', code: '', description: '', color: '#DA7756' });
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteCourse = async (courseId) => {
    if (!confirm('Are you sure you want to delete this course and all its vector indexes?')) return;
    try {
      await api.deleteCourse(courseId);
      const updated = courses.filter(c => c.id !== courseId);
      setCourses(updated);
      if (selectedCourseId === courseId) {
        setSelectedCourseId(updated.length > 0 ? updated[0].id : null);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedCourseId) return;

    try {
      setUploading(true);
      setUploadProgress('Extracting pages and segmenting chunks with PyMuPDF...');
      
      const res = await api.uploadDocument(selectedCourseId, file);
      setUploadProgress('Generating 384-dimensional dense embeddings & indexing FAISS...');
      
      await loadDocuments(selectedCourseId);
      await loadCourses();
      event.target.value = '';
    } catch (err) {
      alert(`Ingestion failed: ${err.message}`);
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!confirm('Delete this document and re-index vector store?')) return;
    try {
      await api.deleteDocument(selectedCourseId, docId);
      await loadDocuments(selectedCourseId);
      await loadCourses();
    } catch (err) {
      alert(err.message);
    }
  };

  const openInspectChunks = async (doc) => {
    setInspectDoc(doc);
    setLoadingChunks(true);
    setChunkSearch('');
    try {
      const chunks = await api.getDocumentChunks(selectedCourseId, doc.id);
      setDocChunks(chunks);
    } catch (err) {
      alert(`Failed to load chunks: ${err.message}`);
    } finally {
      setLoadingChunks(false);
    }
  };

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif-claude text-2xl md:text-3xl font-bold tracking-tight text-[#1F1E1D] dark:text-[#F5F4EF]">
            Course Vector Knowledge Bases
          </h1>
          <p className="text-sm text-[#6B675F] dark:text-[#A39E93] mt-1">
            Every course maintains its own isolated FAISS vector index. Ingested notes never bleed across courses.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#DA7756] hover:bg-[#C4633F] text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer w-fit"
        >
          <Plus className="w-4 h-4" />
          Create New Course
        </button>
      </div>

      {/* Course Cards Carousel / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {courses.map((c) => {
          const isSelected = c.id === selectedCourseId;
          return (
            <div
              key={c.id}
              onClick={() => setSelectedCourseId(c.id)}
              className={`p-6 rounded-2xl border text-left transition-all cursor-pointer relative shadow-xs ${
                isSelected
                  ? 'bg-[#FFFFFF] dark:bg-[#2E2C29] border-[#DA7756] ring-2 ring-[#DA7756]/40'
                  : 'bg-[#FFFFFF] dark:bg-[#2E2C29] border-[#E3E0D8] dark:border-[#423F3A] hover:border-[#6B675F]'
              }`}
            >
              <div className="flex items-start justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: c.color || '#DA7756' }}
                  />
                  <span className="text-xs font-mono font-bold uppercase text-[#6B675F] dark:text-[#A39E93]">
                    {c.code || 'COURSE'}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCourse(c.id);
                  }}
                  className="p-1.5 text-[#6B675F] hover:text-[#D04F4F] transition-colors rounded-lg cursor-pointer"
                  title="Delete Course"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <h3 className="text-base font-bold text-[#1F1E1D] dark:text-[#F5F4EF] line-clamp-1 mb-1.5">
                {c.name}
              </h3>
              <p className="text-sm text-[#6B675F] dark:text-[#A39E93] line-clamp-2 mb-4 leading-relaxed h-10">
                {c.description || 'No description provided.'}
              </p>

              <div className="flex items-center justify-between text-xs text-[#6B675F] dark:text-[#A39E93] pt-3 border-t border-[#E3E0D8] dark:border-[#423F3A]">
                <span className="font-medium">{c.doc_count || 0} Docs • {c.chunk_count || 0} Chunks</span>
                {isSelected && (
                  <span className="font-semibold text-[#DA7756] flex items-center gap-1">
                    Selected
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Course Document Ingestion Manager */}
      {selectedCourse ? (
        <div className="p-8 rounded-2xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] shadow-xs space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E3E0D8] dark:border-[#423F3A]">
            <div>
              <div className="flex items-center gap-2.5">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedCourse.color }}
                />
                <h2 className="text-xl font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
                  {selectedCourse.name}
                </h2>
                {selectedCourse.code && (
                  <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-[#EDEAE1] dark:bg-[#383531] text-[#6B675F] dark:text-[#A39E93]">
                    {selectedCourse.code}
                  </span>
                )}
              </div>
              <p className="text-sm text-[#6B675F] dark:text-[#A39E93] mt-1.5 leading-relaxed">
                {selectedCourse.description || 'Ingest syllabus, lecture slides, and textbook chapters for this course.'}
              </p>
            </div>

            <button
              onClick={() => setActiveTab('study')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#DA7756] hover:bg-[#C4633F] text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              Start Voice Study Chat
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Drag & Drop Upload Zone */}
          <div className="relative border-2 border-dashed border-[#E3E0D8] dark:border-[#423F3A] hover:border-[#DA7756] rounded-2xl p-10 text-center transition-colors bg-[#F5F4EF]/50 dark:bg-[#262523]/50">
            <input
              type="file"
              accept=".pdf,.txt,.md"
              onChange={handleFileUpload}
              disabled={uploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="p-4 rounded-2xl bg-[#EDEAE1] dark:bg-[#383531] text-[#DA7756]">
                {uploading ? (
                  <Loader2 className="w-7 h-7 animate-spin text-[#DA7756]" />
                ) : (
                  <Upload className="w-7 h-7" />
                )}
              </div>
              <div className="text-sm md:text-base font-semibold text-[#1F1E1D] dark:text-[#F5F4EF]">
                {uploading ? 'Ingesting Document...' : 'Click or drag PDF, TXT, or MD files to ingest'}
              </div>
              <p className="text-xs text-[#6B675F] dark:text-[#A39E93] max-w-md">
                {uploadProgress || 'Files are chunked, embedded via all-MiniLM-L6-v2, and stored in isolated FAISS index.'}
              </p>
            </div>
          </div>

          {/* Audio Lecture Ingestion Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#EDEAE1]/70 dark:bg-[#383531]/70 border border-[#E3E0D8] dark:border-[#423F3A]">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-[#DA7756]/15 text-[#DA7756] shrink-0">
                <Radio className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
                  Voice Lecture & Audio Memo Ingestion
                </h4>
                <p className="text-xs text-[#6B675F] dark:text-[#A39E93] mt-0.5">
                  Record live lectures or upload audio files (.wav, .mp3, .m4a). Automatically transcribed into structured notes & indexed in FAISS.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAudioModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#DA7756] hover:bg-[#C4633F] text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
            >
              <Mic className="w-4 h-4" />
              Record / Ingest Audio Lecture
            </button>
          </div>

          {/* Ingested Documents List */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B675F] dark:text-[#A39E93] mb-4">
              Ingested Course Documents ({documents.length})
            </h3>

            {loadingDocs ? (
              <div className="py-12 text-center text-sm text-[#6B675F] dark:text-[#A39E93] flex items-center justify-center gap-2.5">
                <Loader2 className="w-5 h-5 animate-spin text-[#DA7756]" />
                Loading documents...
              </div>
            ) : documents.length > 0 ? (
              <div className="divide-y divide-[#E3E0D8] dark:divide-[#423F3A] border border-[#E3E0D8] dark:border-[#423F3A] rounded-2xl overflow-hidden shadow-xs">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-5 flex items-center justify-between bg-[#FFFFFF] dark:bg-[#2E2C29] hover:bg-[#F5F4EF] dark:hover:bg-[#262523] transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 rounded-xl bg-[#EDEAE1] dark:bg-[#383531] text-[#DA7756]">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm md:text-base font-bold text-[#1F1E1D] dark:text-[#F5F4EF] flex items-center gap-2">
                          {doc.filename}
                          {doc.status === 'ready' ? (
                            <span className="inline-flex items-center gap-1 text-xs text-[#4F7A5C] font-mono font-medium">
                              <CheckCircle className="w-3.5 h-3.5" /> Ready
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-[#D04F4F] font-mono font-medium">
                              <AlertCircle className="w-3.5 h-3.5" /> Error
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#6B675F] dark:text-[#A39E93] mt-1">
                          {doc.page_count} page{doc.page_count !== 1 ? 's' : ''} • {doc.chunk_count} vector chunks • {(doc.file_size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openInspectChunks(doc)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E3E0D8] dark:border-[#423F3A] bg-[#F5F4EF] dark:bg-[#262523] hover:bg-[#EDEAE1] dark:hover:bg-[#383531] text-xs font-semibold text-[#1F1E1D] dark:text-[#F5F4EF] transition-colors cursor-pointer"
                        title="Inspect vectorized text chunks"
                      >
                        <Layers className="w-3.5 h-3.5 text-[#DA7756]" />
                        Inspect Chunks
                      </button>

                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-2 text-[#6B675F] hover:text-[#D04F4F] rounded-lg transition-colors cursor-pointer"
                        title="Remove document"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-[#6B675F] dark:text-[#A39E93] border border-[#E3E0D8] dark:border-[#423F3A] rounded-2xl">
                No documents uploaded for this course yet. Upload a syllabus or textbook PDF above.
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Create Course Modal */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity"
          onClick={() => setShowCreateModal(false)}
        >
          <div 
            className="w-full max-w-lg bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] rounded-2xl shadow-2xl p-7 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E3E0D8] dark:border-[#423F3A]">
              <div>
                <h3 className="font-serif-claude text-xl font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
                  Create Course Knowledge Base
                </h3>
                <p className="text-xs text-[#6B675F] dark:text-[#A39E93] mt-0.5">
                  Create an isolated vector index space for your course materials.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] text-[#6B675F] hover:text-[#1F1E1D] dark:hover:text-[#F5F4EF] hover:bg-[#F5F4EF] dark:hover:bg-[#383531] transition-colors cursor-pointer"
                title="Cancel / Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#1F1E1D] dark:text-[#F5F4EF] mb-1.5">
                  Course Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. CS 101: Artificial Intelligence"
                  value={courseForm.name}
                  onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#F5F4EF] dark:bg-[#262523] text-[#1F1E1D] dark:text-[#F5F4EF] focus:outline-none focus:border-[#DA7756]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#1F1E1D] dark:text-[#F5F4EF] mb-1.5">
                    Course Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CS-101"
                    value={courseForm.code}
                    onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#F5F4EF] dark:bg-[#262523] text-[#1F1E1D] dark:text-[#F5F4EF] focus:outline-none focus:border-[#DA7756]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#1F1E1D] dark:text-[#F5F4EF] mb-1.5">
                    Theme Color
                  </label>
                  <select
                    value={courseForm.color}
                    onChange={(e) => setCourseForm({ ...courseForm, color: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#F5F4EF] dark:bg-[#262523] text-[#1F1E1D] dark:text-[#F5F4EF] focus:outline-none focus:border-[#DA7756]"
                  >
                    <option value="#DA7756">Terracotta (Claude)</option>
                    <option value="#4F7A5C">Sage Green</option>
                    <option value="#B8863A">Warm Gold</option>
                    <option value="#6B675F">Charcoal Slate</option>
                    <option value="#3B82F6">Cobalt Blue</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#1F1E1D] dark:text-[#F5F4EF] mb-1.5">
                  Description / Topic Focus
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Neural networks, vector spaces, and exam review notes."
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#F5F4EF] dark:bg-[#262523] text-[#1F1E1D] dark:text-[#F5F4EF] focus:outline-none focus:border-[#DA7756]"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#E3E0D8]/70 dark:border-[#423F3A]/70">
                <span className="text-xs text-[#6B675F] dark:text-[#A39E93]">Press <kbd className="px-1 py-0.5 rounded bg-[#EDEAE1] dark:bg-[#383531] font-mono text-[10px]">Esc</kbd> to cancel</span>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-sm font-medium rounded-xl text-[#6B675F] hover:bg-[#EDEAE1] dark:hover:bg-[#383531] transition-colors cursor-pointer"
                  >
                    Cancel (Esc)
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-sm font-semibold rounded-xl bg-[#DA7756] hover:bg-[#C4633F] text-white transition-colors cursor-pointer shadow-xs"
                  >
                    Create Knowledge Base
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Document Chunks Modal */}
      {inspectDoc && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity"
          onClick={() => setInspectDoc(null)}
        >
          <div 
            className="w-full max-w-3xl max-h-[85vh] bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-[#E3E0D8] dark:border-[#423F3A] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[#DA7756]" />
                  <h3 className="font-serif-claude text-xl font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
                    Vector Chunks: {inspectDoc.filename}
                  </h3>
                </div>
                <p className="text-xs text-[#6B675F] dark:text-[#A39E93] mt-1">
                  {docChunks.length} chunks indexed in FAISS (384-dim dense vectors)
                </p>
              </div>

              <button
                type="button"
                onClick={() => setInspectDoc(null)}
                className="p-2 rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] text-[#6B675F] hover:text-[#1F1E1D] dark:hover:text-[#F5F4EF] hover:bg-[#F5F4EF] dark:hover:bg-[#383531] transition-colors cursor-pointer"
                title="Cancel / Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Filter */}
            <div className="px-6 py-3 border-b border-[#E3E0D8] dark:border-[#423F3A] bg-[#F5F4EF]/50 dark:bg-[#262523]/50 flex items-center gap-3">
              <input
                type="text"
                placeholder="Search across vector chunks..."
                value={chunkSearch}
                onChange={(e) => setChunkSearch(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#FFFFFF] dark:bg-[#2E2C29] text-[#1F1E1D] dark:text-[#F5F4EF] focus:outline-none focus:border-[#DA7756]"
              />
            </div>

            {/* Chunks List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingChunks ? (
                <div className="py-16 flex items-center justify-center gap-2 text-sm text-[#6B675F] dark:text-[#A39E93]">
                  <Loader2 className="w-4 h-4 animate-spin text-[#DA7756]" />
                  Retrieving chunks from SQLite store...
                </div>
              ) : docChunks.length === 0 ? (
                <div className="py-12 text-center text-sm text-[#6B675F]">
                  No chunks generated for this file.
                </div>
              ) : (
                docChunks
                  .filter(c => !chunkSearch || c.content.toLowerCase().includes(chunkSearch.toLowerCase()) || (c.section_title && c.section_title.toLowerCase().includes(chunkSearch.toLowerCase())))
                  .map((chunk, idx) => (
                    <div 
                      key={chunk.id || idx}
                      className="p-4 rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#F5F4EF]/40 dark:bg-[#262523]/40 space-y-2 hover:border-[#DA7756] transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-[#6B675F] dark:text-[#A39E93]">
                        <span className="font-mono text-[#DA7756]">Chunk #{chunk.chunk_index + 1}</span>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-[#EDEAE1] dark:bg-[#383531] text-[11px]">
                            Page {chunk.page_number}
                          </span>
                          <span className="text-[11px] font-mono">
                            {chunk.char_count} chars
                          </span>
                        </div>
                      </div>

                      {chunk.section_title && (
                        <div className="text-xs font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
                          Section: {chunk.section_title}
                        </div>
                      )}

                      <div className="text-xs leading-relaxed text-[#1F1E1D] dark:text-[#F5F4EF] font-mono whitespace-pre-wrap bg-[#FFFFFF] dark:bg-[#2E2C29] p-3 rounded-lg border border-[#E3E0D8]/60 dark:border-[#423F3A]/60">
                        {chunk.content}
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* Modal Footer with Close Action */}
            <div className="p-4 border-t border-[#E3E0D8] dark:border-[#423F3A] flex items-center justify-between bg-[#F5F4EF]/50 dark:bg-[#262523]/50">
              <span className="text-xs text-[#6B675F] dark:text-[#A39E93]">Press <kbd className="px-1.5 py-0.5 rounded bg-[#EDEAE1] dark:bg-[#383531] font-mono text-[10px]">Esc</kbd> to dismiss</span>
              <button
                type="button"
                onClick={() => setInspectDoc(null)}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-[#1F1E1D] dark:bg-[#F5F4EF] text-white dark:text-[#1F1E1D] hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
              >
                Close Inspector (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audio Lecture Ingestion Modal */}
      {showAudioModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity"
          onClick={() => {
            stopRecordingAudio();
            setShowAudioModal(false);
          }}
        >
          <div 
            className="w-full max-w-lg bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] rounded-3xl p-6 md:p-7 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3.5 border-b border-[#E3E0D8] dark:border-[#423F3A]">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-[#DA7756]/15 text-[#DA7756]">
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif-claude text-xl font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
                    Ingest Audio Lecture
                  </h3>
                  <p className="text-xs text-[#6B675F] dark:text-[#A39E93] font-sans font-normal">
                    Record microphone or upload spoken lecture audio
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopRecordingAudio();
                  setShowAudioModal(false);
                }}
                className="p-2 rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] text-[#6B675F] hover:text-[#1F1E1D] dark:hover:text-[#F5F4EF] hover:bg-[#F5F4EF] dark:hover:bg-[#383531] transition-colors cursor-pointer"
                title="Cancel / Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAudioUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#6B675F] dark:text-[#A39E93] mb-1">
                  Lecture Title
                </label>
                <input
                  type="text"
                  placeholder="e.g., Lecture 4: Multi-Head Attention & KV Cache"
                  value={audioTitle}
                  onChange={(e) => setAudioTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#F5F4EF] dark:bg-[#262523] text-[#1F1E1D] dark:text-[#F5F4EF] focus:outline-none focus:border-[#DA7756]"
                />
              </div>

              {/* Record Microphone Section */}
              <div className="p-4 rounded-2xl bg-[#F5F4EF]/60 dark:bg-[#262523]/60 border border-[#E3E0D8] dark:border-[#423F3A] text-center space-y-3">
                <div className="text-xs font-semibold text-[#6B675F] dark:text-[#A39E93]">
                  Option 1: Record from Microphone
                </div>
                {isRecording ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#D04F4F] animate-pulse">
                      <span className="w-3 h-3 rounded-full bg-[#D04F4F]" /> Recording live audio...
                    </div>
                    <button
                      type="button"
                      onClick={stopRecordingAudio}
                      className="px-4 py-2 rounded-xl bg-[#D04F4F] hover:bg-[#B83E3E] text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      <MicOff className="w-4 h-4 inline mr-1.5" /> Stop & Keep Recording
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={startRecordingAudio}
                    className="px-4 py-2 rounded-xl bg-[#EDEAE1] dark:bg-[#383531] hover:bg-[#DA7756] hover:text-white text-xs font-bold text-[#DA7756] transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                  >
                    <Mic className="w-4 h-4" /> Start Microphone Recording
                  </button>
                )}
                {audioFile && (
                  <div className="text-xs text-[#4F7A5C] font-semibold flex items-center justify-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Audio Ready: {audioFile.name} ({Math.round(audioFile.size / 1024)} KB)
                  </div>
                )}
              </div>

              {/* Upload Audio File Section */}
              <div className="p-4 rounded-2xl bg-[#F5F4EF]/60 dark:bg-[#262523]/60 border border-[#E3E0D8] dark:border-[#423F3A] space-y-2">
                <div className="text-xs font-semibold text-[#6B675F] dark:text-[#A39E93]">
                  Option 2: Upload Audio File (.wav, .mp3, .m4a, .webm)
                </div>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setAudioFile(e.target.files[0]);
                      if (!audioTitle) {
                        setAudioTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ""));
                      }
                    }
                  }}
                  className="w-full text-xs text-[#6B675F] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#DA7756] file:text-white hover:file:bg-[#C4633F] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#E3E0D8]/70 dark:border-[#423F3A]/70">
                <span className="text-xs text-[#6B675F] dark:text-[#A39E93]">Press <kbd className="px-1 py-0.5 rounded bg-[#EDEAE1] dark:bg-[#383531] font-mono text-[10px]">Esc</kbd> to cancel</span>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      stopRecordingAudio();
                      setShowAudioModal(false);
                    }}
                    className="px-4 py-2 text-xs font-medium rounded-xl text-[#6B675F] hover:bg-[#EDEAE1] dark:hover:bg-[#383531] transition-colors cursor-pointer"
                  >
                    Cancel (Esc)
                  </button>
                  <button
                    type="submit"
                    disabled={!audioFile || audioUploading}
                    className="px-5 py-2 text-xs font-bold rounded-xl bg-[#DA7756] hover:bg-[#C4633F] text-white transition-colors cursor-pointer shadow-xs disabled:opacity-40 flex items-center gap-1.5"
                  >
                    {audioUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {audioUploading ? 'Transcribing & Indexing...' : 'Ingest into FAISS Index'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
