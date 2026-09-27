import React, { useState, useEffect } from 'react';
import { 
  Key, 
  CheckCircle2, 
  AlertTriangle, 
  Volume2, 
  Sparkles, 
  Save, 
  Radio, 
  Sliders, 
  ExternalLink, 
  Play,
  RotateCw,
  Loader2,
  Cpu
} from 'lucide-react';
import { api } from '../services/api';
import { useVoice } from '../context/VoiceContext';
import { soundEffects } from '../services/voice';

export default function Settings() {
  const [settingsData, setSettingsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [keyInputs, setKeyInputs] = useState({});
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState(null);

  const { voiceSettings, setVoiceSettings, speak } = useVoice();

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await api.getSettings();
      setSettingsData(res);
      setVoiceSettings({
        speechRate: res.voice.speech_rate,
        speechPitch: res.voice.speech_pitch,
        autoTts: res.voice.auto_tts
      });
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveKey = async (providerId) => {
    const rawKey = keyInputs[providerId]?.trim();
    if (!rawKey) return;

    try {
      setSavingKey(providerId);
      await api.saveApiKey(providerId, rawKey);
      setKeyInputs(prev => ({ ...prev, [providerId]: '' }));
      await loadSettings();
      alert(`API key for ${providerId} updated successfully.`);
    } catch (err) {
      alert(`Failed to save key: ${err.message}`);
    } finally {
      setSavingKey(null);
    }
  };

  const handleUpdateProvider = async (providerId, modelName) => {
    try {
      await api.updateSettings({
        default_provider: providerId,
        default_model: modelName
      });
      await loadSettings();
    } catch (err) {
      alert(`Failed to update provider: ${err.message}`);
    }
  };

  const handleVoiceChange = async (key, val) => {
    const updated = { ...voiceSettings, [key]: val };
    setVoiceSettings(updated);
    try {
      await api.updateSettings({
        speech_rate: updated.speechRate,
        speech_pitch: updated.speechPitch,
        auto_tts: updated.autoTts
      });
    } catch (err) {
      console.error('Failed to sync voice settings:', err);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    try {
      const res = await api.testConnection(settingsData.active_provider);
      setConnectionResult(res);
    } catch (err) {
      setConnectionResult({
        success: false,
        reply: `Connection error: ${err.message}`
      });
    } finally {
      setTestingConnection(false);
    }
  };

  if (loading || !settingsData) {
    return (
      <div className="py-24 text-center text-sm text-[#6B675F] dark:text-[#A39E93] flex items-center justify-center gap-2.5">
        <Loader2 className="w-5 h-5 animate-spin text-[#DA7756]" />
        Loading system configuration...
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif-claude text-2xl md:text-3xl font-bold tracking-tight text-[#1F1E1D] dark:text-[#F5F4EF]">
          Settings & Provider Architecture
        </h1>
        <p className="text-sm text-[#6B675F] dark:text-[#A39E93] mt-1">
          Configure multi-provider LLM backends, voice synthesis parameters, and phonetic wake-word options.
        </p>
      </div>

      {/* Active Provider Status & Connection Test */}
      <div className="p-7 rounded-2xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-[#6B675F] dark:text-[#A39E93]">Active AI Model Backend</div>
            <div className="text-lg font-bold text-[#1F1E1D] dark:text-[#F5F4EF] flex items-center gap-2.5 mt-1">
              <span className="w-3 h-3 rounded-full bg-[#4F7A5C]" />
              <span className="capitalize">{settingsData.active_provider}</span>
              <span className="font-mono text-sm font-medium px-2.5 py-0.5 rounded-lg bg-[#EDEAE1] dark:bg-[#383531]">
                {settingsData.active_model}
              </span>
            </div>
          </div>

          <button
            onClick={handleTestConnection}
            disabled={testingConnection}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#DA7756] hover:bg-[#C4633F] text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 w-fit"
          >
            {testingConnection ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCw className="w-4 h-4" />
            )}
            Test Active Provider Connection
          </button>
        </div>

        {connectionResult && (
          <div className={`p-4 rounded-xl border text-sm font-mono leading-relaxed ${
            connectionResult.success 
              ? 'bg-[#4F7A5C]/10 border-[#4F7A5C] text-[#1F1E1D] dark:text-[#F5F4EF]'
              : 'bg-[#D04F4F]/10 border-[#D04F4F] text-[#D04F4F]'
          }`}>
            <div className="font-bold mb-1">
              {connectionResult.success ? 'Connection Successful' : 'Connection Notice'}:
            </div>
            {connectionResult.reply}
          </div>
        )}
      </div>

      {/* Multi-Provider Registry */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#6B675F] dark:text-[#A39E93]">
          Configurable AI Providers (Never shows raw key values)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {settingsData.providers.map((p) => {
            const isActive = settingsData.active_provider === p.id;
            return (
              <div
                key={p.id}
                className={`p-6 rounded-2xl border text-sm space-y-3.5 transition-all ${
                  isActive
                    ? 'bg-[#FFFFFF] dark:bg-[#2E2C29] border-[#DA7756] ring-2 ring-[#DA7756]/40'
                    : 'bg-[#FFFFFF] dark:bg-[#2E2C29] border-[#E3E0D8] dark:border-[#423F3A]'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-base text-[#1F1E1D] dark:text-[#F5F4EF]">
                      {p.name}
                    </h3>
                    <p className="text-xs text-[#6B675F] dark:text-[#A39E93] mt-1 leading-relaxed">
                      {p.description}
                    </p>
                  </div>

                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                    p.configured 
                      ? 'bg-[#4F7A5C]/15 text-[#4F7A5C]' 
                      : 'bg-[#B8863A]/15 text-[#B8863A]'
                  }`}>
                    {p.configured ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Configured
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5" /> Missing Key
                      </>
                    )}
                  </span>
                </div>

                {/* Masked Key Display */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#F5F4EF] dark:bg-[#262523] border border-[#E3E0D8] dark:border-[#423F3A] text-sm">
                  <span className="text-[#6B675F] dark:text-[#A39E93]">API Key:</span>
                  <span className="font-mono font-medium text-[#1F1E1D] dark:text-[#F5F4EF]">
                    {p.configured ? p.masked_key || '••••••••••••' : 'None specified'}
                  </span>
                </div>

                {/* Drop-in Key Form */}
                <div className="flex items-center gap-2.5">
                  <input
                    type="password"
                    placeholder={`Paste ${p.name} key...`}
                    value={keyInputs[p.id] || ''}
                    onChange={(e) => setKeyInputs({ ...keyInputs, [p.id]: e.target.value })}
                    className="flex-1 px-3.5 py-2 text-sm rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#F5F4EF] dark:bg-[#262523] text-[#1F1E1D] dark:text-[#F5F4EF] focus:outline-none focus:border-[#DA7756]"
                  />
                  <button
                    onClick={() => handleSaveKey(p.id)}
                    disabled={savingKey === p.id || !keyInputs[p.id]?.trim()}
                    className="px-4 py-2 rounded-xl bg-[#DA7756] hover:bg-[#C4633F] disabled:opacity-40 text-white font-medium transition-colors cursor-pointer shrink-0 text-sm shadow-2xs"
                  >
                    Save
                  </button>
                </div>

                {/* Model Selector & Set Active */}
                <div className="flex items-center justify-between pt-3 border-t border-[#E3E0D8] dark:border-[#423F3A]">
                  <select
                    value={isActive ? settingsData.active_model : p.default_model}
                    onChange={(e) => handleUpdateProvider(p.id, e.target.value)}
                    className="text-xs font-mono bg-[#EDEAE1] dark:bg-[#383531] border border-[#E3E0D8] dark:border-[#423F3A] rounded-lg px-2.5 py-1.5 text-[#1F1E1D] dark:text-[#F5F4EF] focus:outline-none focus:border-[#DA7756] cursor-pointer"
                  >
                    {p.available_models.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleUpdateProvider(p.id, p.default_model)}
                    disabled={isActive}
                    className={`px-4 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#4F7A5C] text-white shadow-xs'
                        : 'bg-[#EDEAE1] dark:bg-[#383531] text-[#6B675F] dark:text-[#A39E93] hover:text-[#1F1E1D] dark:hover:text-[#F5F4EF]'
                    }`}
                  >
                    {isActive ? 'Active Backend' : 'Select Provider'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Voice & Wake Word Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Wake Word Specification */}
        <div className="p-7 rounded-2xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#1F1E1D] dark:text-[#F5F4EF] flex items-center gap-2">
              <Radio className="w-5 h-5 text-[#DA7756]" />
              Wake-Word Engine Specification
            </h3>
            <button
              onClick={() => soundEffects.playWakeChime()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#EDEAE1] dark:bg-[#383531] text-[#DA7756] hover:bg-[#DA7756] hover:text-white transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              Test Chime
            </button>
          </div>

          <p className="text-sm text-[#6B675F] dark:text-[#A39E93] leading-relaxed">
            Continuous acoustic matching for the wake word "TARA". Configured with phonetic standards for custom keyword training:
          </p>

          <div className="p-4 rounded-xl bg-[#F5F4EF] dark:bg-[#262523] border border-[#E3E0D8] dark:border-[#423F3A] font-mono text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-[#6B675F] dark:text-[#A39E93]">Keyword:</span>
              <span className="font-bold text-[#DA7756]">TARA</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B675F] dark:text-[#A39E93]">IPA Notation:</span>
              <span className="text-[#1F1E1D] dark:text-[#F5F4EF]">/ˈtɑːrə/</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B675F] dark:text-[#A39E93]">Syllables:</span>
              <span className="text-[#1F1E1D] dark:text-[#F5F4EF]">TAH-rah</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B675F] dark:text-[#A39E93]">ARPAbet:</span>
              <span className="text-[#1F1E1D] dark:text-[#F5F4EF]">T AA1 R AH0</span>
            </div>
          </div>

          <div className="text-xs text-[#6B675F] dark:text-[#A39E93] leading-relaxed">
            Default: Web Speech API continuous keyword-spotting fallback. Fully operational with zero keys required.
          </div>
        </div>

        {/* Text to Speech Voice Settings */}
        <div className="p-7 rounded-2xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#1F1E1D] dark:text-[#F5F4EF] flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-[#DA7756]" />
              Speech Synthesis (TTS) Controls
            </h3>
            <button
              onClick={() => speak("Hello! I am TARA, your course-grounded study and productivity assistant.")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#EDEAE1] dark:bg-[#383531] text-[#DA7756] hover:bg-[#DA7756] hover:text-white transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              Preview Voice
            </button>
          </div>

          {/* Sliders */}
          <div className="space-y-4 text-sm">
            <div>
              <div className="flex justify-between mb-1.5 text-[#6B675F] dark:text-[#A39E93]">
                <span className="font-medium">Speech Rate:</span>
                <span className="font-mono font-bold">{voiceSettings.speechRate}x</span>
              </div>
              <input
                type="range"
                min="0.75"
                max="1.5"
                step="0.05"
                value={voiceSettings.speechRate}
                onChange={(e) => handleVoiceChange('speechRate', parseFloat(e.target.value))}
                className="w-full accent-[#DA7756] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1.5 text-[#6B675F] dark:text-[#A39E93]">
                <span className="font-medium">Voice Pitch:</span>
                <span className="font-mono font-bold">{voiceSettings.speechPitch}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.3"
                step="0.05"
                value={voiceSettings.speechPitch}
                onChange={(e) => handleVoiceChange('speechPitch', parseFloat(e.target.value))}
                className="w-full accent-[#DA7756] cursor-pointer"
              />
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2.5 text-sm text-[#1F1E1D] dark:text-[#F5F4EF] cursor-pointer">
                <input
                  type="checkbox"
                  checked={voiceSettings.autoTts}
                  onChange={(e) => handleVoiceChange('autoTts', e.target.checked)}
                  className="rounded border-[#E3E0D8] text-[#DA7756] focus:ring-[#DA7756] w-4 h-4 cursor-pointer"
                />
                <span>Automatically read answers aloud via SpeechSynthesis</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
