'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, Square, X, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { OrbState } from '@/types';

// ─── Web Speech API Type Definitions ───

interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternativeLike;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  item(index: number): SpeechRecognitionResultLike;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
  readonly message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: ((event: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface SpeechRecognitionWindow {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

// ─── Types ───

export interface UseVoiceOptions {
  onTranscript?: (text: string) => void;
}

export interface UseVoiceReturn {
  isListening: boolean;
  isSupported: boolean;
  startListening: () => Promise<void>;
  stopListening: () => void;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  isSpeaking: boolean;
  transcript: string;
  error: string | null;
  clearError: () => void;
}

export interface VoiceControlsProps {
  onTranscript?: (text: string) => void;
  textToSpeak?: string;
  disabled?: boolean;
  className?: string;
}

// ─── Helpers ───

function getSpeechRecognitionAPI(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as SpeechRecognitionWindow;
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

function selectNeutralEnglishVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const englishVoices = voices.filter((v) =>
    v.lang.toLowerCase().startsWith('en')
  );
  if (englishVoices.length === 0) {
    return voices.find((v) => v.default) || voices[0] || null;
  }

  // Prefer natural, neutral English system/cloud voices
  const preferredPatterns = [
    /google us english/i,
    /samantha/i,
    /daniel/i,
    /alex/i,
    /microsoft aria/i,
    /microsoft guy/i,
    /microsoft jenny/i,
    /natural/i,
    /google uk english/i,
  ];

  for (const pattern of preferredPatterns) {
    const match = englishVoices.find((v) => pattern.test(v.name));
    if (match) return match;
  }

  return (
    englishVoices.find((v) => v.lang.toLowerCase() === 'en-us' && v.default) ||
    englishVoices.find((v) => v.lang.toLowerCase() === 'en-us') ||
    englishVoices[0] ||
    null
  );
}

function mapRecognitionError(errorCode: string): string | null {
  switch (errorCode) {
    case 'aborted':
      return null;
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone permission denied. Please enable mic access.';
    case 'no-speech':
      return 'No speech detected. Please try again.';
    case 'audio-capture':
      return 'No microphone detected on this device.';
    case 'network':
      return 'Network error occurred during speech recognition.';
    default:
      return `Speech recognition error (${errorCode}).`;
  }
}

// ─── useVoice Hook ───

export function useVoice(options?: UseVoiceOptions): UseVoiceReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onTranscriptRef = useRef<((text: string) => void) | undefined>(
    options?.onTranscript
  );
  onTranscriptRef.current = options?.onTranscript;

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const previousListenOrbStateRef = useRef<OrbState>('idle');
  const previousSpeakOrbStateRef = useRef<OrbState>('idle');
  const listenSessionRef = useRef(0);
  const hasSubmittedFinalRef = useRef(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTransientError = useCallback((message: string) => {
    setError(message);
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
    }
    errorTimerRef.current = setTimeout(() => {
      setError(null);
      errorTimerRef.current = null;
    }, 4500);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
  }, []);

  // Check browser support and load speech synthesis voices on mount
  useEffect(() => {
    const recognitionAPI = getSpeechRecognitionAPI();
    setIsSupported(Boolean(recognitionAPI));

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    const synth = window.speechSynthesis;
    const updateVoices = () => {
      try {
        voicesRef.current = synth.getVoices();
      } catch {
        voicesRef.current = [];
      }
    };

    updateVoices();
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', updateVoices);
      return () => {
        synth.removeEventListener('voiceschanged', updateVoices);
      };
    }

    const previousHandler = synth.onvoiceschanged;
    synth.onvoiceschanged = updateVoices;
    return () => {
      synth.onvoiceschanged = previousHandler;
    };
  }, []);

  const restoreOrbFromListening = useCallback(() => {
    const store = useAppStore.getState();
    if (store.orbState === 'listening') {
      store.setOrbState(previousListenOrbStateRef.current);
    }
  }, []);

  const restoreOrbFromSpeaking = useCallback(() => {
    const store = useAppStore.getState();
    if (store.orbState === 'speaking') {
      store.setOrbState(previousSpeakOrbStateRef.current);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    utteranceRef.current = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore synthesis cancel errors in restricted environments
      }
    }
    setIsSpeaking(false);
    restoreOrbFromSpeaking();
  }, [restoreOrbFromSpeaking]);

  const stopListening = useCallback(() => {
    listenSessionRef.current += 1;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;

    if (recognition) {
      try {
        recognition.stop();
      } catch {
        try {
          recognition.abort();
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    setIsListening(false);
    setTranscript('');
    restoreOrbFromListening();
  }, [restoreOrbFromListening]);

  const startListening = useCallback(async () => {
    const SpeechRecognitionAPI = getSpeechRecognitionAPI();
    if (!SpeechRecognitionAPI) {
      showTransientError('Voice not supported in this browser.');
      return;
    }

    if (recognitionRef.current) {
      return;
    }

    // Stop active TTS before capturing mic input
    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      window.speechSynthesis.speaking
    ) {
      stopSpeaking();
    }

    clearError();
    setTranscript('');
    hasSubmittedFinalRef.current = false;

    const sessionId = ++listenSessionRef.current;
    const currentOrb = useAppStore.getState().orbState;
    previousListenOrbStateRef.current =
      currentOrb === 'listening' || currentOrb === 'speaking' ? 'idle' : currentOrb;

    // 1. Request microphone permission explicitly when MediaDevices is available
    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    ) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Release the probe stream immediately so SpeechRecognition has clean access
        stream.getTracks().forEach((track) => track.stop());
      } catch (err) {
        if (listenSessionRef.current !== sessionId) return;
        const message =
          err instanceof DOMException &&
          (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
            ? 'Microphone permission denied. Please allow microphone access.'
            : 'Unable to access microphone. Check your audio device settings.';
        showTransientError(message);
        return;
      }
    }

    // Abort if stopListening was called while waiting for permission
    if (listenSessionRef.current !== sessionId) {
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        if (listenSessionRef.current !== sessionId) return;
        setIsListening(true);
        useAppStore.getState().setOrbState('listening');
      };

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        if (listenSessionRef.current !== sessionId) return;

        let finalText = '';
        let interimText = '';

        for (let i = 0; i < event.results.length; i += 1) {
          const result = event.results[i];
          const text = result[0]?.transcript ?? '';
          if (result.isFinal) {
            finalText += text;
          } else {
            interimText += text;
          }
        }

        const combined = `${finalText}${interimText}`.trim();
        setTranscript(combined);

        const trimmedFinal = finalText.trim();
        if (trimmedFinal && !hasSubmittedFinalRef.current) {
          hasSubmittedFinalRef.current = true;
          // Restore orb state prior to triggering callback so downstream handlers
          // (e.g., chat submission -> 'thinking') are not overwritten
          restoreOrbFromListening();
          onTranscriptRef.current?.(trimmedFinal);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        if (listenSessionRef.current !== sessionId) return;
        const friendlyMessage = mapRecognitionError(event.error);
        if (friendlyMessage) {
          showTransientError(friendlyMessage);
        }
        recognitionRef.current = null;
        setIsListening(false);
        setTranscript('');
        restoreOrbFromListening();
      };

      recognition.onend = () => {
        if (recognitionRef.current === recognition) {
          recognitionRef.current = null;
        }
        if (listenSessionRef.current !== sessionId) return;
        setIsListening(false);
        setTranscript('');
        restoreOrbFromListening();
      };

      recognitionRef.current = recognition;
      useAppStore.getState().setOrbState('listening');
      setIsListening(true);
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setTranscript('');
      restoreOrbFromListening();
      showTransientError('Failed to start speech recognition.');
    }
  }, [clearError, restoreOrbFromListening, showTransientError, stopSpeaking]);

  const speak = useCallback(
    (text: string) => {
      if (
        typeof window === 'undefined' ||
        !('speechSynthesis' in window) ||
        typeof SpeechSynthesisUtterance === 'undefined'
      ) {
        showTransientError('Speech synthesis is not supported in this browser.');
        return;
      }

      const cleanText = text.trim();
      if (!cleanText) return;

      if (recognitionRef.current) {
        stopListening();
      }

      const currentOrb = useAppStore.getState().orbState;
      previousSpeakOrbStateRef.current =
        currentOrb === 'speaking' || currentOrb === 'listening' ? 'idle' : currentOrb;

      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore cancel errors
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utteranceRef.current = utterance;

      let availableVoices = voicesRef.current;
      if (availableVoices.length === 0) {
        try {
          availableVoices = window.speechSynthesis.getVoices();
          voicesRef.current = availableVoices;
        } catch {
          availableVoices = [];
        }
      }

      const preferredVoice = selectNeutralEnglishVoice(availableVoices);
      if (preferredVoice) {
        utterance.voice = preferredVoice;
        utterance.lang = preferredVoice.lang;
      } else {
        utterance.lang = 'en-US';
      }

      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => {
        if (utteranceRef.current !== utterance) return;
        setIsSpeaking(true);
        useAppStore.getState().setOrbState('speaking');
      };

      utterance.onend = () => {
        if (utteranceRef.current !== utterance) return;
        utteranceRef.current = null;
        setIsSpeaking(false);
        restoreOrbFromSpeaking();
      };

      utterance.onerror = () => {
        if (utteranceRef.current !== utterance) return;
        utteranceRef.current = null;
        setIsSpeaking(false);
        restoreOrbFromSpeaking();
      };

      try {
        setIsSpeaking(true);
        useAppStore.getState().setOrbState('speaking');
        window.speechSynthesis.speak(utterance);
      } catch {
        utteranceRef.current = null;
        setIsSpeaking(false);
        restoreOrbFromSpeaking();
        showTransientError('Unable to play voice output.');
      }
    },
    [restoreOrbFromSpeaking, showTransientError, stopListening]
  );

  // Clean up active listeners, recognition, and timers on unmount
  useEffect(() => {
    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore abort errors on unmount
        }
        recognitionRef.current = null;
        const store = useAppStore.getState();
        if (store.orbState === 'listening') {
          store.setOrbState(previousListenOrbStateRef.current);
        }
      }
      if (utteranceRef.current) {
        utteranceRef.current = null;
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          try {
            window.speechSynthesis.cancel();
          } catch {
            // Ignore cancel errors on unmount
          }
        }
        const store = useAppStore.getState();
        if (store.orbState === 'speaking') {
          store.setOrbState(previousSpeakOrbStateRef.current);
        }
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    isSpeaking,
    transcript,
    error,
    clearError,
  };
}

// ─── VoiceControls Component ───

export function VoiceControls({
  onTranscript,
  textToSpeak,
  disabled = false,
  className = '',
}: VoiceControlsProps) {
  const settings = useAppStore((s) => s.settings);
  const orbState = useAppStore((s) => s.orbState);
  const {
    isListening,
    isSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    isSpeaking,
    transcript,
    error,
    clearError,
  } = useVoice({ onTranscript });

  const isCurrentlySpeaking = isSpeaking || orbState === 'speaking';
  const isMicDisabled = !isSupported || !settings.voiceEnabled || disabled;

  const handleMicToggle = () => {
    if (!isSupported || !settings.voiceEnabled || disabled) return;
    if (isListening) {
      stopListening();
    } else {
      void startListening();
    }
  };

  const micTooltip = !isSupported
    ? 'Voice not supported in this browser'
    : !settings.voiceEnabled
      ? 'Voice input disabled in settings'
      : isListening
        ? 'Stop listening'
        : 'Start voice input';

  const waveHeights = [0.4, 0.9, 0.6, 1.0, 0.5];

  return (
    <div className={`relative inline-flex items-center gap-2 ${className}`}>
      {/* Floating Interim Transcript Overlay */}
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
            animate={settings.reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: settings.reducedMotion ? 0.01 : 0.18 }}
            role="status"
            aria-live="polite"
            className="absolute bottom-full right-0 mb-3 z-30 w-72 sm:w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-aegis-graphite/95 backdrop-blur-md aegis-border aegis-glow px-4 py-3 shadow-xl"
          >
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 h-3.5" aria-hidden="true">
                  {waveHeights.map((ratio, idx) => (
                    <motion.span
                      key={idx}
                      className="w-0.5 rounded-full bg-aegis-cyan"
                      animate={
                        settings.reducedMotion
                          ? { height: `${Math.round(ratio * 12)}px` }
                          : {
                              height: [
                                `${Math.max(4, Math.round(ratio * 6))}px`,
                                `${Math.round(ratio * 14)}px`,
                                `${Math.max(4, Math.round(ratio * 6))}px`,
                              ],
                            }
                      }
                      transition={
                        settings.reducedMotion
                          ? { duration: 0.01 }
                          : {
                              duration: 0.8,
                              repeat: Infinity,
                              delay: idx * 0.1,
                              ease: 'easeInOut',
                            }
                      }
                    />
                  ))}
                </div>
                <span className="font-mono text-[11px] uppercase tracking-wider text-aegis-cyan">
                  Listening
                </span>
              </div>
              <button
                type="button"
                onClick={stopListening}
                aria-label="Cancel voice input"
                className="p-1 rounded-md text-aegis-text-secondary hover:text-aegis-text hover:bg-aegis-titanium/60 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-sm font-body text-aegis-text leading-relaxed break-words">
              {transcript ? (
                transcript
              ) : (
                <span className="text-aegis-text-secondary italic">Speak now...</span>
              )}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Error Notice */}
      <AnimatePresence>
        {error && !isListening && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: settings.reducedMotion ? 0.01 : 0.15 }}
            role="alert"
            className="absolute bottom-full right-0 mb-3 z-30 w-72 sm:w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-aegis-graphite/95 backdrop-blur-md border border-aegis-amber/30 px-3.5 py-2.5 shadow-xl flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-aegis-amber shrink-0 mt-0.5" />
            <p className="text-xs font-body text-aegis-text flex-1 leading-relaxed">
              {error}
            </p>
            <button
              type="button"
              onClick={clearError}
              aria-label="Dismiss voice error"
              className="p-0.5 rounded text-aegis-text-secondary hover:text-aegis-text transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stop Speaking Button */}
      <AnimatePresence>
        {isCurrentlySpeaking && (
          <motion.button
            type="button"
            initial={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
            animate={settings.reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
            transition={{ duration: settings.reducedMotion ? 0.01 : 0.15 }}
            onClick={stopSpeaking}
            title="Stop speaking"
            aria-label="Stop speaking"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-aegis-graphite/90 border border-aegis-amber/30 text-aegis-amber hover:bg-aegis-titanium transition-colors text-xs font-mono tracking-wide"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Stop</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Optional Speak Button */}
      {textToSpeak && !isCurrentlySpeaking && (
        <button
          type="button"
          onClick={() => speak(textToSpeak)}
          disabled={disabled}
          title="Read aloud"
          aria-label="Read aloud"
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-aegis-graphite/80 hover:bg-aegis-titanium text-aegis-text-secondary hover:text-aegis-cyan aegis-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Volume2 className="w-4 h-4" />
        </button>
      )}

      {/* Microphone Toggle Button with Tooltip */}
      <div className="relative group" title={micTooltip}>
        <button
          type="button"
          onClick={handleMicToggle}
          disabled={isMicDisabled}
          title={micTooltip}
          aria-label={micTooltip}
          aria-pressed={isListening}
          className={`relative inline-flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 ${
            !isSupported
              ? 'bg-aegis-graphite/40 border border-aegis-titanium/50 text-aegis-text-secondary/40 cursor-not-allowed'
              : !settings.voiceEnabled || disabled
                ? 'bg-aegis-graphite/50 aegis-border text-aegis-text-secondary/40 cursor-not-allowed'
                : isListening
                  ? 'bg-aegis-cyan/15 border border-aegis-cyan/40 text-aegis-cyan aegis-glow'
                  : 'bg-aegis-graphite/80 hover:bg-aegis-titanium aegis-border text-aegis-text-secondary hover:text-aegis-cyan'
          }`}
        >
          {isListening && !settings.reducedMotion && (
            <span
              className="absolute inset-0 rounded-lg border border-aegis-cyan/40 animate-ping opacity-30 pointer-events-none"
              aria-hidden="true"
            />
          )}
          {!isSupported || !settings.voiceEnabled ? (
            <MicOff className="w-4 h-4" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </button>

        {/* Custom Hover Tooltip (always visible on hover even when button is disabled) */}
        <div
          role="tooltip"
          className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 absolute bottom-full right-0 mb-2 px-2.5 py-1.5 rounded-md bg-aegis-obsidian/95 aegis-border text-aegis-text text-[11px] font-body whitespace-nowrap shadow-lg z-40"
        >
          {micTooltip}
        </div>
      </div>
    </div>
  );
}

export default VoiceControls;
