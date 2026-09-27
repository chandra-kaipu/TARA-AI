import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  Mic, 
  MicOff, 
  Trash2, 
  ShieldAlert, 
  Check, 
  X, 
  Terminal, 
  Globe, 
  Monitor, 
  Camera, 
  Sparkles,
  ExternalLink,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import { useVoice } from '../context/VoiceContext';

export default function AgentChat() {
  const [messages, setMessages] = useState([]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingProposal, setPendingProposal] = useState(null);
  
  const messagesEndRef = useRef(null);
  const { 
    isListening, 
    startManualCapture, 
    stopManualCapture, 
    speak, 
    registerVoiceQueryHandler, 
    unregisterVoiceQueryHandler 
  } = useVoice();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, pendingProposal]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const history = await api.getAgentHistory('default');
        setMessages(history);
      } catch (err) {
        console.error('Error fetching agent history:', err);
      }
    };
    fetchHistory();
  }, []);

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputQuery).trim();
    if (!text || loading) return;

    setInputQuery('');
    setLoading(true);

    const userMsg = {
      id: 'usr-' + Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await api.queryAgent('default', text);
      
      const assistantMsg = {
        id: res.message_id,
        role: 'assistant',
        content: res.content,
        tool_call: res.tool_proposal ? {
          tool_name: res.tool_proposal.tool_name,
          arguments: res.tool_proposal.arguments,
          reason: res.tool_proposal.reason
        } : null,
        tool_result: res.tool_executed,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMsg]);

      if (res.tool_proposal && res.tool_proposal.requires_confirmation) {
        setPendingProposal(res.tool_proposal);
      }

      speak(res.content);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: 'err-' + Date.now(),
        role: 'assistant',
        content: `Error contacting agent: ${err.message}`,
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    registerVoiceQueryHandler((spokenText) => {
      handleSendMessage(spokenText);
    });
    return () => {
      unregisterVoiceQueryHandler();
    };
  }, [loading]);

  const handleConfirmTool = async (proposal, approved) => {
    setPendingProposal(null);
    setLoading(true);

    try {
      const res = await api.confirmTool(
        'default',
        proposal.tool_name,
        proposal.arguments,
        approved
      );

      const actionMsg = {
        id: 'action-' + Date.now(),
        role: 'assistant',
        content: res.message,
        tool_result: res.result,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, actionMsg]);
      speak(res.message);
    } catch (err) {
      alert(`Action execution failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Clear conversational memory with TARA?')) return;
    try {
      await api.clearAgentHistory('default');
      setMessages([]);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] max-w-5xl mx-auto px-8 py-5">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#E3E0D8] dark:border-[#423F3A]">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-[#4F7A5C]/15 text-[#4F7A5C]">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
              TARA General Agent & Automation
            </h2>
            <p className="text-xs text-[#6B675F] dark:text-[#A39E93] mt-0.5">
              Autonomous assistant with desktop tools. All system and browser actions require your explicit permission.
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#6B675F] hover:text-[#D04F4F] transition-colors rounded-lg border border-[#E3E0D8] dark:border-[#423F3A] cursor-pointer"
            title="Clear persistent memory"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Memory
          </button>
        )}
      </div>

      {/* Quick Tool Prompts */}
      <div className="flex flex-wrap gap-2.5 py-3 border-b border-[#E3E0D8] dark:border-[#423F3A]">
        {[
          { label: 'Capture Screenshot', cmd: 'Take a screenshot of my screen' },
          { label: 'Open Calculator', cmd: 'Open calculator' },
          { label: 'Open Notepad', cmd: 'Open notepad' },
          { label: 'Search Web: AI Agents', cmd: 'Search the web for autonomous AI agent frameworks' },
          { label: 'Open URL', cmd: 'Open https://github.com' }
        ].map((item, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(item.cmd)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#EDEAE1] dark:bg-[#383531] border border-[#E3E0D8] dark:border-[#423F3A] text-[#1F1E1D] dark:text-[#F5F4EF] hover:border-[#DA7756] transition-all cursor-pointer shadow-2xs"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Messages Timeline */}
      <div className="flex-1 overflow-y-auto py-6 space-y-6 pr-2">
        {messages.length === 0 ? (
          <div className="py-20 text-center max-w-lg mx-auto space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-[#4F7A5C]/15 text-[#4F7A5C] flex items-center justify-center mx-auto shadow-xs">
              <Sparkles className="w-7 h-7" />
            </div>
            <h3 className="font-serif-claude text-2xl font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
              Productivity & OS Automation
            </h3>
            <p className="text-sm leading-relaxed text-[#6B675F] dark:text-[#A39E93]">
              Ask TARA to research topics, open applications, search the web, capture screenshots, or extract web pages. Every tool call includes an explicit human confirmation gate.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              {msg.role === 'user' ? (
                <div className="max-w-xl bg-[#EDEAE1] dark:bg-[#383531] border border-[#E3E0D8] dark:border-[#423F3A] text-[#1F1E1D] dark:text-[#F5F4EF] rounded-2xl rounded-tr-xs px-5 py-3.5 text-sm md:text-[15px] leading-relaxed shadow-xs">
                  {msg.content}
                </div>
              ) : (
                <div className="max-w-2xl w-full bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] rounded-2xl rounded-tl-xs p-6 shadow-xs space-y-3.5">
                  <div className="flex items-center gap-2 text-sm pb-2.5 border-b border-[#E3E0D8] dark:border-[#423F3A]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#4F7A5C]" />
                    <span className="font-serif-claude font-bold text-base text-[#1F1E1D] dark:text-[#F5F4EF]">
                      TARA Agent
                    </span>
                  </div>

                  <div className="text-sm md:text-[15.5px] leading-relaxed text-[#1F1E1D] dark:text-[#F5F4EF] whitespace-pre-wrap">
                    {msg.content}
                  </div>

                  {/* Render Screenshot if returned */}
                  {msg.tool_result && msg.tool_result.url && msg.tool_result.url.includes('/screenshots/') && (
                    <div className="p-4 rounded-xl bg-[#F5F4EF] dark:bg-[#262523] border border-[#E3E0D8] dark:border-[#423F3A]">
                      <div className="text-xs font-semibold text-[#6B675F] dark:text-[#A39E93] mb-2.5 flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-[#DA7756]" />
                        Captured Screenshot
                      </div>
                      <img
                        src={msg.tool_result.url}
                        alt="Desktop Screenshot"
                        className="rounded-lg max-h-80 w-auto border border-[#E3E0D8] dark:border-[#423F3A] shadow-xs"
                      />
                    </div>
                  )}

                  <div className="text-xs text-right font-mono text-[#6B675F] dark:text-[#A39E93]">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {/* Inline Pending Permission Card */}
        {pendingProposal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-xl w-full bg-[#FFFFFF] dark:bg-[#2E2C29] border-2 border-[#DA7756] rounded-2xl p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center gap-3 pb-3 border-b border-[#E3E0D8] dark:border-[#423F3A]">
              <div className="p-2.5 rounded-xl bg-[#DA7756] text-white">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
                  Action Confirmation Required
                </h4>
                <p className="text-xs text-[#6B675F] dark:text-[#A39E93]">
                  Permission gate: approve or deny execution of this tool.
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#F5F4EF] dark:bg-[#262523] border border-[#E3E0D8] dark:border-[#423F3A]">
                <span className="font-semibold text-[#1F1E1D] dark:text-[#F5F4EF]">
                  {pendingProposal.display_name || pendingProposal.tool_name}
                </span>
                <span className="font-mono text-xs px-2.5 py-1 rounded bg-[#EDEAE1] dark:bg-[#383531]">
                  {pendingProposal.tool_name}
                </span>
              </div>

              <div>
                <div className="text-xs font-semibold text-[#6B675F] dark:text-[#A39E93] mb-1">
                  Arguments:
                </div>
                <pre className="text-xs font-mono p-3 rounded-xl bg-[#262523] text-[#F5F4EF] overflow-x-auto">
                  {JSON.stringify(pendingProposal.arguments, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => handleConfirmTool(pendingProposal, false)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl text-[#1F1E1D] dark:text-[#F5F4EF] bg-[#EDEAE1] dark:bg-[#383531] hover:bg-[#E3E0D8] dark:hover:bg-[#423F3A] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
                Deny
              </button>
              <button
                onClick={() => handleConfirmTool(pendingProposal, true)}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-xl bg-[#DA7756] hover:bg-[#C4633F] text-white transition-colors shadow-xs cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Approve & Execute
              </button>
            </div>
          </motion.div>
        )}

        {loading && !pendingProposal && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] max-w-md shadow-xs">
            <Loader2 className="w-5 h-5 animate-spin text-[#4F7A5C]" />
            <span className="text-sm text-[#6B675F] dark:text-[#A39E93]">
              TARA is processing request & verifying tools...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="pt-3.5 border-t border-[#E3E0D8] dark:border-[#423F3A]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative flex items-center gap-2.5"
        >
          <button
            type="button"
            onClick={isListening ? stopManualCapture : startManualCapture}
            className={`p-3.5 rounded-xl transition-all cursor-pointer shadow-xs ${
              isListening
                ? 'bg-[#D04F4F] text-white animate-pulse'
                : 'bg-[#EDEAE1] dark:bg-[#383531] text-[#4F7A5C] hover:bg-[#4F7A5C] hover:text-white'
            }`}
            title="Click to talk"
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <input
            type="text"
            placeholder="Ask TARA to search the web, take a screenshot, open an app, or chat..."
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            disabled={loading}
            className="flex-1 px-4 py-3.5 text-sm md:text-[15px] rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#FFFFFF] dark:bg-[#2E2C29] text-[#1F1E1D] dark:text-[#F5F4EF] focus:outline-none focus:border-[#DA7756] shadow-xs"
          />

          <button
            type="submit"
            disabled={!inputQuery.trim() || loading}
            className="p-3.5 rounded-xl bg-[#DA7756] hover:bg-[#C4633F] disabled:opacity-40 text-white transition-all cursor-pointer shadow-xs"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
