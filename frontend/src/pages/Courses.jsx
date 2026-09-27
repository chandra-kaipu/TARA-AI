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
  Layers
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] rounded-2xl shadow-2xl p-7">
            <h3 className="font-serif-claude text-xl font-bold text-[#1F1E1D] dark:text-[#F5F4EF] mb-1.5">
              Create Course Knowledge Base
            </h3>
            <p className="text-sm text-[#6B675F] dark:text-[#A39E93] mb-5">
              Create an isolated vector index space for your course materials.
            </p>

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

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium rounded-xl text-[#6B675F] hover:bg-[#EDEAE1] dark:hover:bg-[#383531] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold rounded-xl bg-[#DA7756] hover:bg-[#C4633F] text-white transition-colors cursor-pointer shadow-xs"
                >
                  Create Knowledge Base
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Document Chunks Modal */}
      {inspectDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-3xl max-h-[85vh] bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
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
                onClick={() => setInspectDoc(null)}
                className="px-3.5 py-1.5 rounded-lg border border-[#E3E0D8] dark:border-[#423F3A] text-xs font-semibold text-[#6B675F] hover:text-[#1F1E1D] dark:hover:text-[#F5F4EF] hover:bg-[#F5F4EF] dark:hover:bg-[#383531] cursor-pointer"
              >
                Close
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
          </div>
        </div>
      )}
    </div>
  );
}
