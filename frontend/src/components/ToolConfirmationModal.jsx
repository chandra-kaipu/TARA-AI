import React, { useState, useEffect } from 'react';
import { ShieldAlert, Check, X, Terminal, Globe, Monitor, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ToolConfirmationModal({
  proposal,
  onConfirm,
  onReject,
  isOpen
}) {
  const [autoApproveNext, setAutoApproveNext] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && proposal) {
        onReject(proposal);
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, proposal, onReject]);

  if (!isOpen || !proposal) return null;

  const getToolIcon = (toolName) => {
    switch (toolName) {
      case 'open_url':
      case 'web_search':
      case 'extract_page_content':
        return <Globe className="w-5 h-5 text-[#DA7756]" />;
      case 'take_screenshot':
      case 'open_application':
        return <Monitor className="w-5 h-5 text-[#4F7A5C]" />;
      default:
        return <Terminal className="w-5 h-5 text-[#B8863A]" />;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity"
      onClick={() => onReject(proposal)}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#DA7756]/30 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Banner */}
        <div className="flex items-center justify-between p-4 bg-[#DA7756]/10 dark:bg-[#DA7756]/20 border-b border-[#DA7756]/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#DA7756] text-white">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
                Permission Confirmation Required
              </h3>
              <p className="text-xs text-[#6B675F] dark:text-[#A39E93]">
                TARA is requesting permission to execute an external tool
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onReject(proposal)}
            className="p-1.5 rounded-lg text-[#6B675F] hover:text-[#1F1E1D] dark:hover:text-white hover:bg-[#DA7756]/15 transition-colors cursor-pointer"
            title="Deny & Cancel (Esc)"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#F5F4EF] dark:bg-[#262523] border border-[#E3E0D8] dark:border-[#423F3A]">
            <div className="flex items-center gap-2.5">
              {getToolIcon(proposal.tool_name)}
              <div>
                <div className="text-xs text-[#6B675F] dark:text-[#A39E93]">Tool Requested</div>
                <div className="text-sm font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
                  {proposal.display_name || proposal.tool_name}
                </div>
              </div>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#EDEAE1] dark:bg-[#383531] text-[#6B675F] dark:text-[#A39E93]">
              HITL Gate
            </span>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[#6B675F] dark:text-[#A39E93] mb-1">
              Purpose & Intent
            </div>
            <p className="text-xs text-[#1F1E1D] dark:text-[#F5F4EF] bg-[#EDEAE1]/50 dark:bg-[#383531]/50 p-2.5 rounded-lg border border-[#E3E0D8] dark:border-[#423F3A]">
              {proposal.reason || 'Requested by agent conversation flow.'}
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[#6B675F] dark:text-[#A39E93] mb-1">
              Execution Arguments
            </div>
            <pre className="text-xs font-mono p-3 rounded-lg bg-[#262523] text-[#F5F4EF] overflow-x-auto max-h-36">
              {JSON.stringify(proposal.arguments, null, 2)}
            </pre>
          </div>

          <label className="flex items-center gap-2 text-xs text-[#6B675F] dark:text-[#A39E93] cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={autoApproveNext}
              onChange={(e) => setAutoApproveNext(e.target.checked)}
              className="rounded border-[#E3E0D8] text-[#DA7756] focus:ring-[#DA7756]"
            />
            <span>Auto-approve future calls for this specific tool</span>
          </label>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between p-4 border-t border-[#E3E0D8] dark:border-[#423F3A] bg-[#F5F4EF] dark:bg-[#262523]">
          <span className="text-xs text-[#6B675F] dark:text-[#A39E93]">
            Press <kbd className="px-1.5 py-0.5 rounded bg-[#EDEAE1] dark:bg-[#383531] font-mono text-[10px]">Esc</kbd> to deny
          </span>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onReject(proposal)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl text-[#6B675F] hover:text-[#D04F4F] hover:bg-[#EDEAE1] dark:hover:bg-[#383531] transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Deny & Cancel (Esc)
            </button>
            <button
              onClick={() => onConfirm(proposal, autoApproveNext)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl text-white bg-[#DA7756] hover:bg-[#C4633F] transition-colors shadow-xs cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              Approve & Execute
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
