'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowUpRight,
  Bug,
  Cpu,
  FlaskConical,
  Lightbulb,
  Menu,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Sliders,
  Square,
  Terminal,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { Message, OrbState } from '@/types';
import {
  checkApiStatus,
  countPromptTokens,
  fetchAvailableModels,
  sendChatMessage,
} from '@/lib/chat';
import { useAppStore } from '@/lib/store';
import AIOrb from '@/components/ai/AIOrb';
import SettingsPanel from '@/components/settings/SettingsPanel';
import { NeuralConfigPanel } from '@/components/lab/NeuralConfigPanel';
import { TokenUsageMonitor } from '@/components/lab/TokenUsageMonitor';
import { LLMLab } from '@/components/lab/LLMLab';
import { useVoice } from '@/components/voice/VoiceControls';
import { ChatSidebar } from './ChatSidebar';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: {
    isFinal: boolean;
    [index: number]: SpeechRecognitionResultItem;
  };
}

interface SpeechRecognitionEventLike {
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface WindowWithSpeech extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

interface StreamingState {
  conversationId: string;
  message: Message;
}

const SUGGESTED_PROMPTS = [
  {
    text: 'Explain quantum computing',
    subtitle: 'Core principles & qubits',
    icon: Cpu,
  },
  {
    text: 'Write a Python script',
    subtitle: 'Clean, idiomatic automation',
    icon: Terminal,
  },
  {
    text: 'Brainstorm startup ideas',
    subtitle: 'Market gaps & product concepts',
    icon: Lightbulb,
  },
  {
    text: 'Debug my code',
    subtitle: 'Trace logic & fix edge cases',
    icon: Bug,
  },
] as const;

function getOrbStatusLabel(orbState: OrbState): string {
  switch (orbState) {
    case 'listening':
      return 'LISTENING';
    case 'thinking':
      return 'PROCESSING';
    case 'speaking':
      return 'RESPONDING';
    case 'error':
      return 'ERROR';
    case 'offline':
      return 'OFFLINE';
    case 'idle':
    default:
      return 'READY';
  }
}

function getOrbIndicatorClass(orbState: OrbState): string {
  switch (orbState) {
    case 'listening':
      return 'bg-aegis-ice animate-pulse';
    case 'thinking':
      return 'bg-aegis-cyan animate-pulse';
    case 'speaking':
      return 'bg-aegis-cyan';
    case 'error':
      return 'bg-aegis-amber';
    case 'offline':
      return 'bg-aegis-text-secondary/50';
    case 'idle':
    default:
      return 'bg-aegis-cyan/80';
  }
}

export function ChatInterface() {
  const conversations = useAppStore((state) => state.conversations);
  const activeConversationId = useAppStore((state) => state.activeConversationId);
  const createConversation = useAppStore((state) => state.createConversation);
  const addMessage = useAppStore((state) => state.addMessage);
  const orbState = useAppStore((state) => state.orbState);
  const setOrbState = useAppStore((state) => state.setOrbState);
  const isStreaming = useAppStore((state) => state.isStreaming);
  const setIsStreaming = useAppStore((state) => state.setIsStreaming);
  const setAbortController = useAppStore((state) => state.setAbortController);
  const settings = useAppStore((state) => state.settings);
  const systemStatus = useAppStore((state) => state.systemStatus);
  const setSystemStatus = useAppStore((state) => state.setSystemStatus);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const toggleNeuralConfig = useAppStore((state) => state.toggleNeuralConfig);
  const setAvailableModels = useAppStore((state) => state.setAvailableModels);
  const setLastTokenUsage = useAppStore((state) => state.setLastTokenUsage);
  const activeWorkspaceTab = useAppStore((state) => state.activeWorkspaceTab);
  const setActiveWorkspaceTab = useAppStore((state) => state.setActiveWorkspaceTab);
  const hydrated = useAppStore((state) => state.hydrated);
  const hydrate = useAppStore((state) => state.hydrate);

  const [isMobile, setIsMobile] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [streamingState, setStreamingState] = useState<StreamingState | null>(null);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  const { speak, stopSpeaking, isSpeaking } = useVoice();

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate client store
  useEffect(() => {
    if (!hydrated) {
      hydrate();
    }
  }, [hydrated, hydrate]);

  // Check API status and discover available Gemini models on mount
  useEffect(() => {
    let active = true;
    if (!useAppStore.getState().systemStatus.isReady) {
      checkApiStatus().then((status) => {
        if (!active) return;
        setSystemStatus({
          apiConnected: status.connected,
          model: status.model,
          isReady: true,
        });
      });
    }
    fetchAvailableModels().then((models) => {
      if (!active || models.length === 0) return;
      setAvailableModels(models);
    });
    return () => {
      active = false;
    };
  }, [setSystemStatus, setAvailableModels]);

  // Track responsive mobile viewport
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateMatch = () => setIsMobile(mediaQuery.matches);
    updateMatch();

    mediaQuery.addEventListener('change', updateMatch);
    return () => mediaQuery.removeEventListener('change', updateMatch);
  }, []);

  // Cleanup active streams and voice recognition on unmount
  useEffect(() => {
    return () => {
      const currentController = useAppStore.getState().abortController;
      if (currentController) {
        currentController.abort();
      }
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (noticeTimeoutRef.current) {
        clearTimeout(noticeTimeoutRef.current);
      }
    };
  }, []);

  const showVoiceNotice = useCallback((message: string) => {
    setVoiceNotice(message);
    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current);
    }
    noticeTimeoutRef.current = setTimeout(() => {
      setVoiceNotice(null);
    }, 4000);
  }, []);

  const activeConversation = useMemo(() => {
    if (!activeConversationId) return null;
    return conversations.find((c) => c.id === activeConversationId) ?? null;
  }, [conversations, activeConversationId]);

  const displayedMessages = useMemo(() => {
    const baseMessages = activeConversation?.messages ?? [];
    if (
      streamingState &&
      activeConversationId &&
      streamingState.conversationId === activeConversationId
    ) {
      return [...baseMessages, streamingState.message];
    }
    return baseMessages;
  }, [activeConversation, activeConversationId, streamingState]);

  // Auto-scroll message container when messages update or stream progresses
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: settings.reducedMotion || isStreaming ? 'auto' : 'smooth',
    });
  }, [displayedMessages, isStreaming, settings.reducedMotion]);

  const handleSendMessage = useCallback(
    async (rawText: string) => {
      const trimmed = rawText.trim();
      if (!trimmed || useAppStore.getState().isStreaming) return;

      // Ensure an active conversation exists
      let convId = useAppStore.getState().activeConversationId;
      const currentConversations = useAppStore.getState().conversations;
      if (!convId || !currentConversations.some((c) => c.id === convId)) {
        convId = createConversation();
      }

      const existingConversation = useAppStore
        .getState()
        .conversations.find((c) => c.id === convId);

      const userMessage: Message = {
        id: uuidv4(),
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      };

      addMessage(convId, userMessage);

      // Prepare context excluding failed/empty entries
      const priorMessages = (existingConversation?.messages ?? []).filter(
        (m) => !m.error && m.content.trim().length > 0
      );
      const contextMessages = [...priorMessages, userMessage];

      const controller = new AbortController();
      setAbortController(controller);
      setIsStreaming(true);
      setOrbState('thinking');

      const assistantId = uuidv4();
      const assistantTimestamp = Date.now();
      let accumulated = '';
      let hasReceivedChunk = false;

      setStreamingState({
        conversationId: convId,
        message: {
          id: assistantId,
          role: 'assistant',
          content: '',
          timestamp: assistantTimestamp,
          isStreaming: true,
        },
      });

      const persistAssistantMessage = (content: string) => {
        const exists = useAppStore
          .getState()
          .conversations.some((c) => c.id === convId);
        if (exists && content.trim().length > 0) {
          addMessage(convId, {
            id: assistantId,
            role: 'assistant',
            content,
            timestamp: assistantTimestamp,
            isStreaming: false,
          });
        }
        return exists;
      };

      try {
        const activeModel = useAppStore.getState().settings.model;
        const activeLlmConfig = useAppStore.getState().llmConfig;

        // Non-blocking prompt token estimate via Gemini countTokens
        countPromptTokens(
          contextMessages.map((m) => ({ role: m.role, content: m.content })),
          activeModel
        ).then((estimated) => {
          if (estimated !== null && useAppStore.getState().abortController === controller) {
            setLastTokenUsage({
              inputTokens: null,
              outputTokens: null,
              totalTokens: null,
              maxConfiguredOutputTokens: activeLlmConfig.maxOutputTokens,
              contextWindow: null,
              finishReason: null,
              modelUsed: activeModel,
              estimatedPromptTokens: estimated,
            });
          }
        });

        const stream = await sendChatMessage(
          contextMessages,
          activeModel,
          {
            signal: controller.signal,
            config: activeLlmConfig,
            allowFallback: true,
            onModelUsed: (actualModel) => setSystemStatus({ model: actualModel }),
            onUsage: (usage) => setLastTokenUsage(usage),
          }
        );

        const reader = stream.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            if (!hasReceivedChunk) {
              hasReceivedChunk = true;
            }
            accumulated += value;
            setStreamingState({
              conversationId: convId,
              message: {
                id: assistantId,
                role: 'assistant',
                content: accumulated,
                timestamp: assistantTimestamp,
                isStreaming: true,
              },
            });
          }
        }

        const stillActiveController =
          useAppStore.getState().abortController === controller;
        if (stillActiveController) {
          setStreamingState(null);
        }

        persistAssistantMessage(accumulated);

        if (stillActiveController) {
          if (useAppStore.getState().settings.voiceOutputEnabled && accumulated.trim()) {
            speak(accumulated);
          } else {
            setOrbState('idle');
          }
        }
      } catch (err) {
        const isAbort =
          controller.signal.aborted ||
          (err instanceof Error && err.name === 'AbortError');
        const stillActiveController =
          useAppStore.getState().abortController === controller;

        if (stillActiveController) {
          setStreamingState(null);
        }

        const conversationExists = persistAssistantMessage(accumulated);

        if (isAbort) {
          if (stillActiveController) {
            setOrbState('idle');
          }
        } else {
          const errorMessage =
            err instanceof Error
              ? err.message
              : 'An error occurred while communicating with A.E.G.I.S.';

          if (conversationExists) {
            addMessage(convId, {
              id: uuidv4(),
              role: 'assistant',
              content: errorMessage,
              timestamp: Date.now(),
              isStreaming: false,
              error: true,
            });
          }

          if (stillActiveController) {
            setOrbState('error');
          }
        }
      } finally {
        if (useAppStore.getState().abortController === controller) {
          setIsStreaming(false);
          setAbortController(null);
        }
      }
    },
    [
      addMessage,
      createConversation,
      setAbortController,
      setIsStreaming,
      setLastTokenUsage,
      setOrbState,
      setSystemStatus,
      speak,
    ]
  );

  const handleMicClick = useCallback(() => {
    if (isStreaming) return;

    if (orbState === 'listening' && recognitionRef.current) {
      recognitionRef.current.stop();
      setOrbState('idle');
      return;
    }

    if (!settings.voiceEnabled) {
      showVoiceNotice('Voice input is disabled in settings.');
      return;
    }

    const speechWindow = window as WindowWithSpeech;
    const SpeechRecognitionCtor =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      showVoiceNotice('Voice input is not supported in this browser.');
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        const result = event.results[0];
        const transcript = result?.[0]?.transcript?.trim();
        setOrbState('idle');
        if (transcript) {
          void handleSendMessage(transcript);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        setOrbState('idle');
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          showVoiceNotice(`Voice input error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        if (useAppStore.getState().orbState === 'listening') {
          setOrbState('idle');
        }
      };

      recognitionRef.current = recognition;
      setOrbState('listening');
      recognition.start();
    } catch {
      setOrbState('idle');
      showVoiceNotice('Unable to initialize voice input.');
    }
  }, [
    handleSendMessage,
    isStreaming,
    orbState,
    setOrbState,
    settings.voiceEnabled,
    showVoiceNotice,
  ]);

  const showWelcome = !activeConversation || displayedMessages.length === 0;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-aegis-obsidian text-aegis-text aegis-grid-bg">
      <ChatSidebar isMobile={isMobile} />

      <main className="relative flex h-full min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-aegis-cyan/10 bg-aegis-obsidian/80 px-4 backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-3">
            {isMobile && (
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label="Toggle sidebar"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-aegis-text-secondary aegis-border transition-colors hover:bg-aegis-titanium/60 hover:text-aegis-cyan"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <h1 className="truncate font-heading text-sm font-medium tracking-wide text-aegis-text">
              {activeWorkspaceTab === 'lab'
                ? 'LLM LAB'
                : activeConversation && activeConversation.messages.length > 0
                  ? activeConversation.title
                  : 'A.E.G.I.S.'}
            </h1>

            {/* Workspace Mode Switcher */}
            <div className="ml-2 flex items-center rounded-lg bg-aegis-graphite/80 p-0.5 aegis-border">
              <button
                type="button"
                onClick={() => setActiveWorkspaceTab('chat')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  activeWorkspaceTab === 'chat'
                    ? 'bg-aegis-cyan/15 text-aegis-cyan'
                    : 'text-aegis-text-secondary hover:text-aegis-text'
                }`}
              >
                <MessageSquare className="h-3 w-3" />
                <span>Chat</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveWorkspaceTab('lab')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  activeWorkspaceTab === 'lab'
                    ? 'bg-aegis-cyan/15 text-aegis-cyan'
                    : 'text-aegis-text-secondary hover:text-aegis-text'
                }`}
              >
                <FlaskConical className="h-3 w-3" />
                <span>LLM Lab</span>
              </button>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {isSpeaking && (
              <button
                type="button"
                onClick={stopSpeaking}
                className="inline-flex items-center gap-1.5 rounded-full border border-aegis-amber/35 bg-aegis-amber/10 px-2.5 py-1 font-mono text-[10px] tracking-wider text-aegis-amber transition-colors hover:bg-aegis-amber/20"
              >
                <Square className="h-2.5 w-2.5 fill-current" />
                <span>STOP AUDIO</span>
              </button>
            )}
            <span className="hidden font-mono text-xs text-aegis-text-secondary sm:inline">
              {systemStatus.model || settings.model}
            </span>
            <div className="flex items-center gap-2 rounded-full bg-aegis-graphite/90 px-2.5 py-1 aegis-border">
              <span
                className={`h-1.5 w-1.5 rounded-full ${getOrbIndicatorClass(orbState)}`}
                aria-hidden="true"
              />
              <span className="font-mono text-[10px] tracking-widest text-aegis-text-secondary">
                {getOrbStatusLabel(orbState)}
              </span>
            </div>
            <button
              type="button"
              onClick={toggleNeuralConfig}
              aria-label="Open Neural Configuration"
              title="Neural Configuration"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-aegis-text-secondary aegis-border transition-colors hover:bg-aegis-titanium/60 hover:text-aegis-cyan"
            >
              <Sliders className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setDiagnosticsOpen((prev) => !prev)}
              aria-label="Toggle diagnostics panel"
              title="System diagnostics"
              className="hidden h-8 w-8 items-center justify-center rounded-lg text-aegis-text-secondary aegis-border transition-colors hover:bg-aegis-titanium/60 hover:text-aegis-cyan md:inline-flex"
            >
              {diagnosticsOpen ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
            </button>
          </div>
        </header>

        {activeWorkspaceTab === 'lab' ? (
          <LLMLab />
        ) : (
          <>
            {/* Message List or Welcome View */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-4 py-6"
        >
          {showWelcome ? (
            <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center px-2 py-8 text-center">
              {/* Interactive 3D AI Orb */}
              <motion.div
                initial={settings.reducedMotion ? false : { opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: settings.reducedMotion ? 0 : 0.4,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="relative mb-4 flex items-center justify-center"
              >
                <AIOrb size={isMobile ? 'medium' : 'large'} />
              </motion.div>

              <motion.div
                initial={settings.reducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: settings.reducedMotion ? 0 : 0.35,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="mb-8 flex flex-col items-center gap-2"
              >
                <h2 className="font-heading text-2xl font-semibold tracking-[0.25em] text-aegis-text aegis-glow-text sm:text-3xl">
                  A.E.G.I.S.
                </h2>
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-aegis-cyan/80">
                  PERSONAL INTELLIGENCE SYSTEM
                </p>
                <p className="mt-2 font-body text-sm text-aegis-text-secondary sm:text-base">
                  All systems ready. What can I help you with?
                </p>
              </motion.div>

              {/* 2x2 Suggested Prompts Grid */}
              <motion.div
                initial={settings.reducedMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: settings.reducedMotion ? 0 : 0.35,
                  delay: settings.reducedMotion ? 0 : 0.08,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2"
              >
                {SUGGESTED_PROMPTS.map((prompt) => {
                  const Icon = prompt.icon;
                  return (
                    <button
                      key={prompt.text}
                      type="button"
                      onClick={() => void handleSendMessage(prompt.text)}
                      className="group flex items-start justify-between gap-3 rounded-xl bg-aegis-graphite/75 p-4 text-left aegis-border transition-all duration-150 hover:border-aegis-cyan/35 hover:bg-aegis-titanium/60"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aegis-obsidian/70 text-aegis-cyan aegis-border">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-body text-sm font-medium text-aegis-text transition-colors group-hover:text-aegis-ice">
                            {prompt.text}
                          </p>
                          <p className="mt-0.5 font-mono text-[11px] text-aegis-text-secondary">
                            {prompt.subtitle}
                          </p>
                        </div>
                      </div>
                      <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-aegis-text-secondary/50 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-aegis-cyan" />
                    </button>
                  );
                })}
              </motion.div>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-4">
              {displayedMessages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isLatest={index === displayedMessages.length - 1}
                />
              ))}
            </div>
          )}
        </div>

        {/* Input Dock */}
        <div className="shrink-0 bg-gradient-to-t from-aegis-obsidian via-aegis-obsidian/95 to-transparent px-4 pt-2 pb-4">
          <div className="mx-auto w-full max-w-3xl">
            {voiceNotice && (
              <div className="mb-2 flex items-center justify-between rounded-lg border border-aegis-amber/25 bg-aegis-amber/[0.08] px-3 py-1.5 font-mono text-xs text-aegis-amber">
                <span>{voiceNotice}</span>
                <button
                  type="button"
                  onClick={() => setVoiceNotice(null)}
                  className="ml-3 text-aegis-amber/80 hover:text-aegis-amber"
                >
                  Dismiss
                </button>
              </div>
            )}
            <ChatInput
              onSend={handleSendMessage}
              onMicClick={handleMicClick}
              disabled={!hydrated}
            />
          </div>
        </div>
          </>
        )}
      </main>

      {/* Collapsible Right-Side Diagnostics Panel (Desktop) */}
      {diagnosticsOpen && !isMobile && (
        <aside className="hidden w-64 shrink-0 flex-col border-l border-aegis-cyan/10 bg-aegis-graphite/50 p-4 backdrop-blur-md md:flex">
          <div className="mb-4 flex items-center justify-between border-b border-aegis-cyan/10 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-aegis-cyan" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-aegis-text">
                Diagnostics
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDiagnosticsOpen(false)}
              aria-label="Close diagnostics"
              className="text-aegis-text-secondary hover:text-aegis-cyan"
            >
              <PanelRightClose className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mb-4 flex justify-center">
            <AIOrb size="small" />
          </div>

          <div className="space-y-3 font-mono text-[11px]">
            <div className="rounded-lg bg-aegis-obsidian/60 p-2.5 aegis-border">
              <div className="text-[10px] uppercase tracking-wider text-aegis-text-secondary">
                Core Status
              </div>
              <div className="mt-1 flex items-center gap-2 text-aegis-text">
                <span className={`h-1.5 w-1.5 rounded-full ${getOrbIndicatorClass(orbState)}`} />
                <span>{getOrbStatusLabel(orbState)}</span>
              </div>
            </div>

            <div className="rounded-lg bg-aegis-obsidian/60 p-2.5 aegis-border">
              <div className="text-[10px] uppercase tracking-wider text-aegis-text-secondary">
                Active Model
              </div>
              <div className="mt-1 text-aegis-ice">
                {systemStatus.model || settings.model}
              </div>
            </div>

            <TokenUsageMonitor />

            <div className="rounded-lg bg-aegis-obsidian/60 p-2.5 aegis-border">
              <div className="text-[10px] uppercase tracking-wider text-aegis-text-secondary">
                API Connection
              </div>
              <div
                className={`mt-1 ${
                  systemStatus.apiConnected ? 'text-aegis-cyan' : 'text-aegis-amber'
                }`}
              >
                {systemStatus.apiConnected ? 'CONNECTED' : 'UNCONFIGURED'}
              </div>
            </div>

            <div className="rounded-lg bg-aegis-obsidian/60 p-2.5 aegis-border">
              <div className="text-[10px] uppercase tracking-wider text-aegis-text-secondary">
                Session Info
              </div>
              <div className="mt-1 space-y-1 text-aegis-text-secondary">
                <div className="flex justify-between">
                  <span>Messages</span>
                  <span className="text-aegis-text">{displayedMessages.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Streaming</span>
                  <span className="text-aegis-text">{isStreaming ? 'ACTIVE' : 'IDLE'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Voice Output</span>
                  <span className="text-aegis-text">
                    {settings.voiceOutputEnabled ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Neural Configuration Panel */}
      <NeuralConfigPanel />

      {/* Slide-in Settings Panel */}
      <SettingsPanel />
    </div>
  );
}

export default ChatInterface;
