import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Play, 
  Trash2, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Terminal,
  Globe,
  Monitor,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { api } from '../services/api';

export default function ToolsPermissions() {
  const [tools, setTools] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testingTool, setTestingTool] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [toolsRes, logsRes] = await Promise.all([
        api.listTools(),
        api.getToolLogs()
      ]);
      setTools(toolsRes);
      setLogs(logsRes);
    } catch (err) {
      console.error('Failed to load tools and permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTogglePermission = async (tool, autoApprove) => {
    try {
      await api.updateToolPermission(
        tool.tool_name,
        autoApprove,
        !autoApprove
      );
      setTools(prev => prev.map(t => {
        if (t.tool_name === tool.tool_name) {
          return {
            ...t,
            auto_approve: autoApprove,
            requires_confirmation: !autoApprove
          };
        }
        return t;
      }));
    } catch (err) {
      alert(`Failed to update permission: ${err.message}`);
    }
  };

  const handleTestRun = async (toolName) => {
    setTestingTool(toolName);
    setTestResult(null);

    let testArgs = {};
    if (toolName === 'open_url') testArgs = { url: 'https://news.ycombinator.com' };
    else if (toolName === 'web_search') testArgs = { query: 'latest breakthroughs in AI research 2026' };
    else if (toolName === 'extract_page_content') testArgs = { url: 'https://en.wikipedia.org/wiki/Artificial_intelligence' };
    else if (toolName === 'take_screenshot') testArgs = {};
    else if (toolName === 'open_application') testArgs = { app_name: 'calc' };
    else if (toolName === 'calculator') testArgs = { expression: '128 * 16 + 256' };

    try {
      const res = await api.testRunTool(toolName, testArgs);
      setTestResult({ toolName, ...res });
      const updatedLogs = await api.getToolLogs();
      setLogs(updatedLogs);
    } catch (err) {
      setTestResult({ toolName, success: false, error: err.message });
    } finally {
      setTestingTool(null);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('Clear all execution audit logs?')) return;
    try {
      await api.clearToolLogs();
      setLogs([]);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif-claude text-2xl md:text-3xl font-bold tracking-tight text-[#1F1E1D] dark:text-[#F5F4EF]">
            Tools & Permission Governance
          </h1>
          <p className="text-sm text-[#6B675F] dark:text-[#A39E93] mt-1">
            Configure human-in-the-loop (HITL) approval rules. Tools marked "Always Confirm" will never execute without an explicit approval prompt.
          </p>
        </div>
        <button
          onClick={loadData}
          className="p-2.5 rounded-xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] text-[#6B675F] hover:text-[#1F1E1D] dark:hover:text-[#F5F4EF] transition-colors cursor-pointer shadow-2xs"
          title="Refresh Data"
        >
          <RefreshCw className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* Permissions Table */}
      <div className="p-7 rounded-2xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] shadow-xs">
        <h2 className="text-base font-bold text-[#1F1E1D] dark:text-[#F5F4EF] mb-5 flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-[#DA7756]" />
          Available Tools & Policy Matrix
        </h2>

        <div className="divide-y divide-[#E3E0D8] dark:divide-[#423F3A] border border-[#E3E0D8] dark:border-[#423F3A] rounded-2xl overflow-hidden shadow-xs">
          {tools.map((tool) => (
            <div
              key={tool.tool_name}
              className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FFFFFF] dark:bg-[#2E2C29] hover:bg-[#F5F4EF] dark:hover:bg-[#262523] transition-colors"
            >
              <div className="space-y-1.5 max-w-xl">
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-sm md:text-base text-[#1F1E1D] dark:text-[#F5F4EF]">
                    {tool.display_name}
                  </span>
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-[#EDEAE1] dark:bg-[#383531] text-[#6B675F] dark:text-[#A39E93]">
                    {tool.tool_name}
                  </span>
                  <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-[#DA7756]/10 text-[#DA7756]">
                    {tool.category}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-[#6B675F] dark:text-[#A39E93]">
                  {tool.description}
                </p>
              </div>

              {/* Action Toggles & Test Button */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1.5 bg-[#EDEAE1] dark:bg-[#383531] p-1.5 rounded-xl text-sm">
                  <button
                    onClick={() => handleTogglePermission(tool, false)}
                    className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all cursor-pointer ${
                      tool.requires_confirmation
                        ? 'bg-[#DA7756] text-white shadow-xs font-semibold'
                        : 'text-[#6B675F] dark:text-[#A39E93]'
                    }`}
                  >
                    Always Confirm
                  </button>
                  <button
                    onClick={() => handleTogglePermission(tool, true)}
                    className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all cursor-pointer ${
                      tool.auto_approve
                        ? 'bg-[#4F7A5C] text-white shadow-xs font-semibold'
                        : 'text-[#6B675F] dark:text-[#A39E93]'
                    }`}
                  >
                    Auto-Approve
                  </button>
                </div>

                <button
                  onClick={() => handleTestRun(tool.tool_name)}
                  disabled={testingTool === tool.tool_name}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#FFFFFF] dark:bg-[#2E2C29] hover:border-[#DA7756] text-xs md:text-sm font-medium text-[#1F1E1D] dark:text-[#F5F4EF] transition-all cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {testingTool === tool.tool_name ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#DA7756]" />
                  ) : (
                    <Play className="w-4 h-4 text-[#DA7756]" />
                  )}
                  Test Run
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Test Run Output Drawer/Alert */}
      {testResult && (
        <div className="p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#DA7756]/40 shadow-md space-y-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-[#1F1E1D] dark:text-[#F5F4EF] flex items-center gap-2">
              {testResult.success ? (
                <CheckCircle className="w-4.5 h-4.5 text-[#4F7A5C]" />
              ) : (
                <XCircle className="w-4.5 h-4.5 text-[#D04F4F]" />
              )}
              Test Run Result for `{testResult.toolName}`
            </span>
            <button
              onClick={() => setTestResult(null)}
              className="text-[#6B675F] hover:text-[#1F1E1D] text-xs font-semibold"
            >
              Dismiss
            </button>
          </div>
          <pre className="text-xs font-mono p-3.5 rounded-xl bg-[#262523] text-[#F5F4EF] overflow-x-auto max-h-52 whitespace-pre-wrap leading-relaxed">
            {testResult.result || testResult.error || JSON.stringify(testResult, null, 2)}
          </pre>
        </div>
      )}

      {/* Execution Audit Log */}
      <div className="p-7 rounded-2xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-[#1F1E1D] dark:text-[#F5F4EF]">
              Tool Execution Audit Logs ({logs.length})
            </h2>
            <p className="text-xs text-[#6B675F] dark:text-[#A39E93] mt-0.5">
              Every tool invocation is tracked here with its parameters and resolution status.
            </p>
          </div>
          {logs.length > 0 && (
            <button
              onClick={handleClearLogs}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs text-[#6B675F] hover:text-[#D04F4F] transition-colors rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Clear Logs
            </button>
          )}
        </div>

        {logs.length > 0 ? (
          <div className="divide-y divide-[#E3E0D8] dark:divide-[#423F3A] border border-[#E3E0D8] dark:border-[#423F3A] rounded-2xl overflow-hidden max-h-96 overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm bg-[#FFFFFF] dark:bg-[#2E2C29] hover:bg-[#F5F4EF] dark:hover:bg-[#262523] transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-sm text-[#1F1E1D] dark:text-[#F5F4EF]">
                      {log.tool_name}
                    </span>
                    <span className={`text-xs font-semibold uppercase px-2.5 py-0.5 rounded-full ${
                      log.status === 'executed'
                        ? 'bg-[#4F7A5C]/15 text-[#4F7A5C]'
                        : log.status === 'rejected'
                        ? 'bg-[#B8863A]/15 text-[#B8863A]'
                        : 'bg-[#D04F4F]/15 text-[#D04F4F]'
                    }`}>
                      {log.status}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-[#6B675F] dark:text-[#A39E93] truncate max-w-xl">
                    Args: {JSON.stringify(log.arguments)}
                  </div>
                  <div className="text-xs text-[#1F1E1D] dark:text-[#F5F4EF] truncate max-w-xl">
                    Result: {log.result || log.error || 'N/A'}
                  </div>
                </div>

                <div className="text-xs font-mono text-[#6B675F] dark:text-[#A39E93] shrink-0">
                  {new Date(log.executed_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-[#6B675F] dark:text-[#A39E93] border border-[#E3E0D8] dark:border-[#423F3A] rounded-2xl">
            No audit logs recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}
