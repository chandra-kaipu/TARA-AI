/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TARA VOICE & WAKE-WORD SYSTEM
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * PHONETIC SPECIFICATION FOR KEYWORD "TARA":
 * Keyword:   TARA
 * IPA:       /ˈtɑːrə/
 * Syllables: "TAH-rah"
 * ARPAbet:   T AA1 R AH0
 * 
 * This engine operates in two modes:
 * 1. Continuous Keyword Spotting: Passively listens for the phonetic matches of "TARA"
 *    using Web Speech continuous mode (with acoustic variations: "tara", "hey tara",
 *    "tah-rah", "tarah", "terra").
 * 2. Manual Press-to-Talk Fallback: Direct microphone capture for browsers without
 *    always-on listening permission.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export const WAKE_WORD_CONFIG = {
  keyword: 'TARA',
  ipa: '/ˈtɑːrə/',
  syllables: 'TAH-rah',
  arpabet: 'T AA1 R AH0',
  fuzzyMatches: ['tara', 'hey tara', 'ok tara', 'hi tara', 'tah-rah', 'tarah', 'terra', 'tyra', 'tadah']
};

class AudioFeedback {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }

  // Pleasant warm two-tone chime when TARA activates
  playWakeChime() {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      console.warn('Audio chime warning:', e);
    }
  }

  // Soft click confirmation
  playActionChime() {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {
      console.warn('Audio feedback warning:', e);
    }
  }
}

export const soundEffects = new AudioFeedback();

export class TaraVoiceEngine {
  constructor() {
    this.recognition = null;
    this.isSupported = false;
    this.isWakeWordListening = false;
    this.isCapturingQuestion = false;
    this.isSpeaking = false;
    this.currentUtterance = null;
    
    // Callbacks
    this.onWakeWord = null;
    this.onTranscriptUpdate = null;
    this.onQuestionCaptured = null;
    this.onSpeechStart = null;
    this.onSpeechEnd = null;
    this.onError = null;

    this.silenceTimer = null;
    this.activeTranscript = '';

    this.initSpeechRecognition();
  }

  initSpeechRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.isSupported = true;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event) => this.handleRecognitionResult(event);
      this.recognition.onerror = (event) => {
        if (event.error !== 'no-speech') {
          console.warn('Speech recognition status:', event.error);
          if (this.onError) this.onError(event.error);
        }
      };
      this.recognition.onend = () => {
        // Auto-restart if wake-word listening was enabled
        if (this.isWakeWordListening && !this.isCapturingQuestion) {
          try {
            this.recognition.start();
          } catch (e) {
            // Already active
          }
        }
      };
    } else {
      this.isSupported = false;
      console.warn('Web Speech API is not supported in this browser. Manual text mode active.');
    }
  }

  startWakeWordListening() {
    if (!this.isSupported || !this.recognition) return false;
    this.isWakeWordListening = true;
    this.isCapturingQuestion = false;
    try {
      this.recognition.start();
      return true;
    } catch (e) {
      return false;
    }
  }

  stopWakeWordListening() {
    this.isWakeWordListening = false;
    this.isCapturingQuestion = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
  }

  startDirectCapture() {
    soundEffects.playWakeChime();
    this.isCapturingQuestion = true;
    this.activeTranscript = '';
    
    if (this.onSpeechStart) this.onSpeechStart();

    if (this.isSupported && this.recognition) {
      try {
        this.recognition.start();
      } catch (e) {
        // If already running in wake-word mode, it will transition in handleRecognitionResult
      }
    }
  }

  stopDirectCapture() {
    this.isCapturingQuestion = false;
    clearTimeout(this.silenceTimer);
    if (this.onSpeechEnd) this.onSpeechEnd();
  }

  handleRecognitionResult(event) {
    let interimText = '';
    let finalText = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcriptPiece = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalText += transcriptPiece + ' ';
      } else {
        interimText += transcriptPiece;
      }
    }

    const currentSpoken = (finalText + interimText).trim().toLowerCase();

    // Mode 1: Wake-word detection mode
    if (this.isWakeWordListening && !this.isCapturingQuestion) {
      const detected = WAKE_WORD_CONFIG.fuzzyMatches.some(k => currentSpoken.includes(k));
      if (detected) {
        soundEffects.playWakeChime();
        this.isCapturingQuestion = true;
        this.activeTranscript = '';
        if (this.onWakeWord) this.onWakeWord();
        if (this.onSpeechStart) this.onSpeechStart();
        return;
      }
    }

    // Mode 2: Capturing question after wake word or manual click
    if (this.isCapturingQuestion) {
      // Strip wake word from beginning if present
      let cleanQuery = currentSpoken;
      for (const w of WAKE_WORD_CONFIG.fuzzyMatches) {
        if (cleanQuery.startsWith(w)) {
          cleanQuery = cleanQuery.substring(w.length).trim();
        }
      }

      this.activeTranscript = cleanQuery;
      if (this.onTranscriptUpdate) {
        this.onTranscriptUpdate(cleanQuery);
      }

      // Reset auto-submit timer on pause/silence (1.8s)
      clearTimeout(this.silenceTimer);
      if (cleanQuery.length > 2) {
        this.silenceTimer = setTimeout(() => {
          this.isCapturingQuestion = false;
          if (this.onQuestionCaptured) {
            this.onQuestionCaptured(cleanQuery);
          }
          if (this.onSpeechEnd) this.onSpeechEnd();
        }, 1800);
      }
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // TEXT-TO-SPEECH (TTS)
  // ═════════════════════════════════════════════════════════════════════════════

  cleanTextForSpeech(text) {
    if (!text) return '';
    return text
      .replace(/```[\s\S]*?```/g, '') // remove code blocks
      .replace(/`([^`]+)`/g, '$1')     // remove inline code formatting
      .replace(/[*#_~>]/g, '')         // remove markdown symbols
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // link labels only
      .replace(/https?:\/\/[^\s]+/g, 'link')
      .replace(/\n+/g, '. ')
      .trim();
  }

  speak(text, options = {}) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    this.stopSpeaking();

    const spokenText = this.cleanTextForSpeech(text);
    if (!spokenText) return;

    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.rate = options.rate || 1.0;
    utterance.pitch = options.pitch || 1.0;

    // Pick pleasant natural voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      (v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Google UK English Female') || v.name.includes('Google US English')) && v.lang.startsWith('en')
    ) || voices.find(v => v.lang.startsWith('en'));

    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onstart = () => {
      this.isSpeaking = true;
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.currentUtterance = null;
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      this.currentUtterance = null;
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  stopSpeaking() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
      this.currentUtterance = null;
    }
  }
}

export const globalVoice = new TaraVoiceEngine();
