import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { globalVoice, soundEffects, WAKE_WORD_CONFIG } from '../services/voice';

const VoiceContext = createContext();

export function VoiceProvider({ children }) {
  const [isWakeWordActive, setIsWakeWordActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [wakeWordDetected, setWakeWordDetected] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState({
    speechRate: 1.0,
    speechPitch: 1.0,
    autoTts: true
  });

  const queryHandlerRef = useRef(null);

  // Register callback from current active screen (StudyChat or AgentChat)
  const registerVoiceQueryHandler = useCallback((handler) => {
    queryHandlerRef.current = handler;
  }, []);

  const unregisterVoiceQueryHandler = useCallback(() => {
    queryHandlerRef.current = null;
  }, []);

  useEffect(() => {
    globalVoice.onWakeWord = () => {
      setWakeWordDetected(true);
      setTimeout(() => setWakeWordDetected(false), 2500);
    };

    globalVoice.onSpeechStart = () => {
      setIsListening(true);
      setInterimTranscript('');
    };

    globalVoice.onTranscriptUpdate = (text) => {
      setInterimTranscript(text);
    };

    globalVoice.onQuestionCaptured = (capturedText) => {
      setIsListening(false);
      setInterimTranscript('');
      soundEffects.playActionChime();
      
      if (queryHandlerRef.current && capturedText.trim()) {
        queryHandlerRef.current(capturedText.trim());
      }
    };

    globalVoice.onSpeechEnd = () => {
      setIsListening(false);
    };

    return () => {
      globalVoice.stopWakeWordListening();
      globalVoice.stopSpeaking();
    };
  }, []);

  const toggleWakeWord = () => {
    if (isWakeWordActive) {
      globalVoice.stopWakeWordListening();
      setIsWakeWordActive(false);
    } else {
      const ok = globalVoice.startWakeWordListening();
      if (ok) {
        setIsWakeWordActive(true);
        soundEffects.playActionChime();
      } else {
        alert('Always-on microphone access is required for wake-word listening. You can also use the manual Click-to-Talk button.');
      }
    }
  };

  const startManualCapture = () => {
    globalVoice.startDirectCapture();
    setIsListening(true);
  };

  const stopManualCapture = () => {
    globalVoice.stopDirectCapture();
    setIsListening(false);
  };

  const speak = (text) => {
    if (!voiceSettings.autoTts) return;
    setIsSpeaking(true);
    globalVoice.speak(text, {
      rate: voiceSettings.speechRate,
      pitch: voiceSettings.speechPitch
    });
    
    // Poll speaking status
    const interval = setInterval(() => {
      if (!window.speechSynthesis || !window.speechSynthesis.speaking) {
        setIsSpeaking(false);
        clearInterval(interval);
      }
    }, 200);
  };

  const stopSpeaking = () => {
    globalVoice.stopSpeaking();
    setIsSpeaking(false);
  };

  return (
    <VoiceContext.Provider value={{
      isWakeWordActive,
      isListening,
      isSpeaking,
      interimTranscript,
      wakeWordDetected,
      voiceSettings,
      setVoiceSettings,
      toggleWakeWord,
      startManualCapture,
      stopManualCapture,
      speak,
      stopSpeaking,
      registerVoiceQueryHandler,
      unregisterVoiceQueryHandler,
      wakeWordPhonetics: WAKE_WORD_CONFIG
    }}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice() {
  return useContext(VoiceContext);
}
