// ─── A.E.G.I.S. Type Definitions ───

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error' | 'offline';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  error?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface AegisSettings {
  voiceEnabled: boolean;
  startupSoundEnabled: boolean;
  autoPlayIntro: boolean;
  reducedMotion: boolean;
  model: string;
  animationQuality: 'low' | 'medium' | 'high';
  voiceOutputEnabled: boolean;
}

export const DEFAULT_SETTINGS: AegisSettings = {
  voiceEnabled: true,
  startupSoundEnabled: true,
  autoPlayIntro: true,
  reducedMotion: false,
  model: 'gemini-3.5-flash-lite',
  animationQuality: 'high',
  voiceOutputEnabled: false,
};

// ─── LLM Parameter Control Lab Types ───

export interface ModelCapability {
  id: string;
  displayName: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
  defaultTemperature: number;
  maxTemperature: number;
  defaultTopP: number;
  supportsTopK: boolean;
  defaultTopK?: number;
  maxTopK?: number;
  supportsCountTokens: boolean;
  supportedActions: string[];
}

export interface GenerationConfig {
  temperature: number;
  maxOutputTokens: number;
  topP: number;
  topK?: number;
}

export const DEFAULT_GENERATION_CONFIG: GenerationConfig = {
  temperature: 0.7,
  maxOutputTokens: 1024,
  topP: 0.95,
  topK: 40,
};

export interface TokenUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  thoughtsTokens?: number | null;
  maxConfiguredOutputTokens: number;
  contextWindow: number | null;
  finishReason: string | null;
  modelUsed: string;
  estimatedPromptTokens?: number | null;
}

export interface ChatRequest {
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
  model?: string;
  config?: Partial<GenerationConfig>;
  allowFallback?: boolean;
}

export interface SystemStatus {
  apiConnected: boolean;
  model: string;
  isReady: boolean;
}
