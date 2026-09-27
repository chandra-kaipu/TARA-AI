import React, { useState } from 'react';
import { FileText, ChevronRight, X, ExternalLink, Bookmark } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CitationCard({ citation, index }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs md:text-sm rounded-lg bg-[#EDEAE1] dark:bg-[#383531] border border-[#E3E0D8] dark:border-[#423F3A] text-[#1F1E1D] dark:text-[#F5F4EF] hover:border-[#DA7756] hover:bg-[#F5F4EF] dark:hover:bg-[#2E2C29] transition-all text-left shadow-2xs cursor-pointer group"
      >
        <FileText className="w-4 h-4 text-[#DA7756] shrink-0" />
        <span className="font-semibold truncate max-w-[160px]">{citation.filename}</span>
        <span className="text-[#6B675F] dark:text-[#A39E93] font-medium">p.{citation.page}</span>
        <ChevronRight className="w-3.5 h-3.5 text-[#6B675F] group-hover:translate-x-0.5 transition-transform" />
      </button>

      {/* Modal / Drawer for detailed inspection */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-[#E3E0D8] dark:border-[#423F3A] bg-[#F5F4EF] dark:bg-[#262523]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#DA7756]/10 text-[#DA7756]">
                    <Bookmark className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
                      Source Grounding Citation
                    </h3>
                    <p className="text-xs text-[#6B675F] dark:text-[#A39E93]">
                      Verified document snippet from course vector index
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-[#6B675F] hover:text-[#1F1E1D] dark:hover:text-[#F5F4EF] rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between p-4 rounded-xl bg-[#EDEAE1]/60 dark:bg-[#383531]/60 border border-[#E3E0D8] dark:border-[#423F3A]">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-[#6B675F] dark:text-[#A39E93]">File Source</div>
                    <div className="text-sm md:text-base font-bold text-[#1F1E1D] dark:text-[#F5F4EF] flex items-center gap-2 mt-1">
                      <FileText className="w-4.5 h-4.5 text-[#DA7756]" />
                      {citation.filename}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[#6B675F] dark:text-[#A39E93]">Location</div>
                    <div className="text-sm md:text-base font-bold text-[#DA7756] mt-1">
                      Page {citation.page}
                    </div>
                  </div>
                </div>

                {citation.section && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-[#6B675F] dark:text-[#A39E93] mb-1.5">
                      Section / Heading
                    </div>
                    <div className="text-sm md:text-base text-[#1F1E1D] dark:text-[#F5F4EF] font-semibold">
                      {citation.section}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#6B675F] dark:text-[#A39E93] mb-2">
                    Grounded Text Chunk
                  </div>
                  <div className="p-4 text-xs md:text-sm font-mono leading-relaxed bg-[#F5F4EF] dark:bg-[#262523] border border-[#E3E0D8] dark:border-[#423F3A] rounded-xl text-[#1F1E1D] dark:text-[#F5F4EF] max-h-56 overflow-y-auto whitespace-pre-wrap">
                    {citation.snippet}
                  </div>
                </div>

                {citation.relevance_score !== null && citation.relevance_score !== undefined && (
                  <div className="flex items-center justify-between text-xs md:text-sm text-[#6B675F] dark:text-[#A39E93] pt-1">
                    <span>Semantic Similarity Score:</span>
                    <span className="font-mono font-bold text-[#4F7A5C]">
                      {(citation.relevance_score * 100).toFixed(1)}% match
                    </span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-[#E3E0D8] dark:border-[#423F3A] flex justify-end bg-[#F5F4EF] dark:bg-[#262523]">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-5 py-2 text-sm font-medium bg-[#1F1E1D] dark:bg-[#F5F4EF] text-[#FFFFFF] dark:text-[#1F1E1D] rounded-xl hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
