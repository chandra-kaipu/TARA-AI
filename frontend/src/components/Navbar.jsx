import React, { useState, useEffect } from 'react';
import { 
  Mic, 
  MicOff, 
  VolumeX, 
  Sparkles, 
  Radio, 
  Clock, 
  Play, 
  Pause, 
  RotateCcw, 
  Coffee,
  Maximize2,
  Minimize2,
  Keyboard,
  HelpCircle
} from 'lucide-react';
import { api } from '../services/api';
import { useVoice } from '../context/VoiceContext';
import AudioWaveform from './AudioWaveform';

export default function Navbar({ activeTitle, subtitle }) {
  const { 
    isWakeWordActive, 
    isListening, 
    isSpeaking, 
    interimTranscript, 
    wakeWordDetected,
    startManualCapture, 
    stopManualCapture, 
    stopSpeaking,
    toggleWakeWord 
  } = useVoice();

  // Focus Study Timer State
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerMode, setTimerMode] = useState('focus'); // 'focus' (25m), 'shortBreak' (5m), 'longBreak' (15m)
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);

  // PC Study Tools State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.9);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.9);
    } catch (e) {
      console.warn('Audio chime failed:', e);
    }
  };

  useEffect(() => {
    let interval = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      playChime();
      if (timerMode === 'focus') {
        setSessionsCompleted(prev => prev + 1);
        api.logStudySession('general', 'focus_timer', 25, 'Completed 25m Focus Block').catch(() => {});
        setTimerMode('shortBreak');
        setTimerSeconds(5 * 60);
      } else {
        setTimerMode('focus');
        setTimerSeconds(25 * 60);
      }
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds, timerMode]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Shift+F: Fullscreen
      if (e.ctrlKey && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        toggleFullscreen();
      }
      // Ctrl+Space: Play/Pause timer
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        setIsTimerRunning(prev => !prev);
      }
      // ?: Open shortcuts
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const switchMode = (mode, durationMinutes) => {
    setIsTimerRunning(false);
    setTimerMode(mode);
    setTimerSeconds(durationMinutes * 60);
    setShowTimerMenu(false);
  };

  const resetTimer = () => {
    setIsTimerRunning(false);
    const duration = timerMode === 'focus' ? 25 : timerMode === 'shortBreak' ? 5 : 15;
    setTimerSeconds(duration * 60);
  };

  const mins = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
  const secs = String(timerSeconds % 60).padStart(2, '0');

  return (
    <header className="h-18 px-8 border-b border-[#E3E0D8] dark:border-[#423F3A] bg-[#FFFFFF]/90 dark:bg-[#2E2C29]/90 backdrop-blur-md flex items-center justify-between shrink-0 sticky top-0 z-30 transition-colors duration-200">
      {/* Title & Context */}
      <div>
        <h2 className="text-lg md:text-xl font-bold tracking-tight text-[#1F1E1D] dark:text-[#F5F4EF]">
          {activeTitle}
        </h2>
        {subtitle && (
          <p className="text-xs md:text-sm text-[#6B675F] dark:text-[#A39E93] mt-0.5">
            {subtitle}
          </p>
        )}
      </div>

      {/* Center Voice Waveform / Wake Word Indicator */}
      <div className="hidden md:flex items-center gap-3">
        {wakeWordDetected ? (
          <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#DA7756]/15 border border-[#DA7756] text-[#DA7756] text-sm font-semibold animate-bounce">
            <Radio className="w-4 h-4 animate-pulse" />
            Wake Word "TARA" Detected! Listening...
          </div>
        ) : isListening ? (
          <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#4F7A5C]/15 border border-[#4F7A5C] text-[#4F7A5C] text-sm font-medium">
            <AudioWaveform isActive={true} size="sm" />
            <span className="truncate max-w-[260px]">
              {interimTranscript || 'Listening for your question...'}
            </span>
          </div>
        ) : isSpeaking ? (
          <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#DA7756]/15 border border-[#DA7756] text-[#DA7756] text-sm font-medium">
            <AudioWaveform isSpeaking={true} size="sm" />
            <span>Speaking response...</span>
            <button
              onClick={stopSpeaking}
              className="ml-1.5 p-1 rounded hover:bg-[#DA7756]/20 transition-colors cursor-pointer"
              title="Stop speaking"
            >
              <VolumeX className="w-4 h-4" />
            </button>
          </div>
        ) : isWakeWordActive ? (
          <div className="flex items-center gap-2 text-sm text-[#6B675F] dark:text-[#A39E93]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#4F7A5C] inline-block"></span>
            <span>Say <span className="font-semibold text-[#1F1E1D] dark:text-[#F5F4EF]">"TARA"</span> to ask anything</span>
          </div>
        ) : null}
      </div>

      {/* Action Controls & Pomodoro Timer */}
      <div className="flex items-center gap-2.5">
        {/* Fullscreen Focus Toggle for Laptops */}
        <button
          onClick={toggleFullscreen}
          className="p-2.5 rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#F5F4EF] dark:bg-[#262523] text-[#6B675F] hover:text-[#1F1E1D] dark:hover:text-[#F5F4EF] transition-colors cursor-pointer"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Laptop Focus Mode (Ctrl+Shift+F)'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* Keyboard Shortcuts Dialog */}
        <button
          onClick={() => setShowShortcuts(!showShortcuts)}
          className="p-2.5 rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#F5F4EF] dark:bg-[#262523] text-[#6B675F] hover:text-[#1F1E1D] dark:hover:text-[#F5F4EF] transition-colors cursor-pointer"
          title="Laptop Keyboard Shortcuts (?)"
        >
          <Keyboard className="w-4 h-4" />
        </button>

        {/* Focus Study Timer Capsule */}
        <div className="relative">
          <div className="flex items-center rounded-xl border border-[#E3E0D8] dark:border-[#423F3A] bg-[#F5F4EF] dark:bg-[#262523] p-1 shadow-2xs">
            <button
              onClick={() => setShowTimerMenu(!showTimerMenu)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs md:text-sm font-mono font-bold text-[#1F1E1D] dark:text-[#F5F4EF] hover:bg-[#EDEAE1] dark:hover:bg-[#383531] rounded-lg transition-colors cursor-pointer"
              title="Focus Study Timer"
            >
              <Clock className={`w-3.5 h-3.5 ${isTimerRunning ? 'text-[#DA7756] animate-spin' : 'text-[#6B675F]'}`} />
              <span>{mins}:{secs}</span>
              <span className="text-[10px] uppercase tracking-wider text-[#6B675F] font-sans">
                {timerMode === 'focus' ? 'Study' : 'Break'}
              </span>
            </button>

            <button
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className={`p-1.5 rounded-lg text-white transition-colors cursor-pointer ${
                isTimerRunning ? 'bg-[#4F7A5C] hover:bg-[#3D6B4A]' : 'bg-[#DA7756] hover:bg-[#C4633F]'
              }`}
              title={isTimerRunning ? 'Pause timer (Ctrl+Space)' : 'Start focus timer (Ctrl+Space)'}
            >
              {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={resetTimer}
              className="p-1.5 text-[#6B675F] hover:text-[#1F1E1D] dark:hover:text-[#F5F4EF] rounded-lg transition-colors cursor-pointer"
              title="Reset timer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Timer Dropdown Menu */}
          {showTimerMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] p-3 shadow-xl z-50 text-xs">
              <div className="font-bold text-[#1F1E1D] dark:text-[#F5F4EF] mb-2 flex items-center justify-between">
                <span>Focus Intervals</span>
                <span className="text-[10px] text-[#4F7A5C] font-mono">Sessions: {sessionsCompleted}</span>
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => switchMode('focus', 25)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg flex items-center justify-between cursor-pointer ${
                    timerMode === 'focus' ? 'bg-[#DA7756]/15 text-[#DA7756] font-bold' : 'hover:bg-[#F5F4EF] dark:hover:bg-[#383531] text-[#1F1E1D] dark:text-[#F5F4EF]'
                  }`}
                >
                  <span>25m Focus Block</span>
                  <span className="text-[10px] text-[#6B675F]">Standard</span>
                </button>
                <button
                  onClick={() => switchMode('focus', 50)}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-[#F5F4EF] dark:hover:bg-[#383531] text-[#1F1E1D] dark:text-[#F5F4EF] flex items-center justify-between cursor-pointer"
                >
                  <span>50m Deep Session</span>
                  <span className="text-[10px] text-[#6B675F]">Extended</span>
                </button>
                <button
                  onClick={() => switchMode('shortBreak', 5)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg flex items-center justify-between cursor-pointer ${
                    timerMode === 'shortBreak' ? 'bg-[#4F7A5C]/15 text-[#4F7A5C] font-bold' : 'hover:bg-[#F5F4EF] dark:hover:bg-[#383531] text-[#1F1E1D] dark:text-[#F5F4EF]'
                  }`}
                >
                  <span>5m Quick Rest</span>
                  <Coffee className="w-3 h-3 text-[#4F7A5C]" />
                </button>
                <button
                  onClick={() => switchMode('longBreak', 15)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg flex items-center justify-between cursor-pointer ${
                    timerMode === 'longBreak' ? 'bg-[#4F7A5C]/15 text-[#4F7A5C] font-bold' : 'hover:bg-[#F5F4EF] dark:hover:bg-[#383531] text-[#1F1E1D] dark:text-[#F5F4EF]'
                  }`}
                >
                  <span>15m Long Break</span>
                  <Coffee className="w-3 h-3 text-[#4F7A5C]" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Toggle Wake Word */}
        <button
          onClick={toggleWakeWord}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-medium border transition-all cursor-pointer ${
            isWakeWordActive
              ? 'bg-[#EDEAE1] dark:bg-[#383531] border-[#4F7A5C] text-[#4F7A5C]'
              : 'bg-[#F5F4EF] dark:bg-[#262523] border-[#E3E0D8] dark:border-[#423F3A] text-[#6B675F] dark:text-[#A39E93] hover:text-[#1F1E1D] dark:hover:text-[#F5F4EF]'
          }`}
          title="Toggle hands-free passive wake-word detection"
        >
          <span className={`w-2 h-2 rounded-full ${isWakeWordActive ? 'bg-[#4F7A5C]' : 'bg-[#6B675F]'}`} />
          Wake Word: TARA
        </button>

        {/* Manual Press to Talk */}
        <button
          onClick={isListening ? stopManualCapture : startManualCapture}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all shadow-xs cursor-pointer ${
            isListening
              ? 'bg-[#D04F4F] text-white animate-pulse'
              : 'bg-[#DA7756] hover:bg-[#C4633F] text-white'
          }`}
        >
          <Mic className="w-4 h-4" />
          {isListening ? 'Stop Listening' : 'Talk to TARA'}
        </button>
      </div>

      {/* Keyboard Shortcuts Helper Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#FFFFFF] dark:bg-[#2E2C29] border border-[#E3E0D8] dark:border-[#423F3A] rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3E0D8] dark:border-[#423F3A]">
              <div className="flex items-center gap-2 font-bold text-base text-[#1F1E1D] dark:text-[#F5F4EF]">
                <Keyboard className="w-5 h-5 text-[#DA7756]" />
                Laptop Study Shortcuts
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-xs px-2.5 py-1 rounded-lg border border-[#E3E0D8] dark:border-[#423F3A] text-[#6B675F] hover:text-[#1F1E1D] dark:hover:text-[#F5F4EF] cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-2.5 text-xs md:text-sm">
              <div className="flex items-center justify-between py-1 border-b border-[#E3E0D8]/60 dark:border-[#423F3A]/60">
                <span className="text-[#6B675F] dark:text-[#A39E93]">Play / Pause Focus Timer</span>
                <kbd className="px-2 py-1 rounded-md bg-[#EDEAE1] dark:bg-[#383531] font-mono font-bold text-xs">Ctrl + Space</kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#E3E0D8]/60 dark:border-[#423F3A]/60">
                <span className="text-[#6B675F] dark:text-[#A39E93]">Fullscreen Focus Mode</span>
                <kbd className="px-2 py-1 rounded-md bg-[#EDEAE1] dark:bg-[#383531] font-mono font-bold text-xs">Ctrl + Shift + F</kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#E3E0D8]/60 dark:border-[#423F3A]/60">
                <span className="text-[#6B675F] dark:text-[#A39E93]">Open Shortcuts Helper</span>
                <kbd className="px-2 py-1 rounded-md bg-[#EDEAE1] dark:bg-[#383531] font-mono font-bold text-xs">?</kbd>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-[#6B675F] dark:text-[#A39E93]">Passive Wake Word</span>
                <span className="font-semibold text-[#DA7756]">Say "TARA"</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
