import { create } from 'zustand';
import type {
  OrbState,
  Conversation,
  Message,
  AegisSettings,
  SystemStatus,
  GenerationConfig,
  ModelCapability,
  TokenUsage,
} from '@/types';
import { DEFAULT_SETTINGS, DEFAULT_GENERATION_CONFIG } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// ─── Conversation Storage ───

const STORAGE_KEY = 'aegis-conversations';
const SETTINGS_KEY = 'aegis-settings';
const ACTIVE_CONVERSATION_KEY = 'aegis-active-conversation';
const LLM_CONFIG_KEY = 'aegis-llm-config';

function loadLlmConfig(): GenerationConfig {
  if (typeof window === 'undefined') return DEFAULT_GENERATION_CONFIG;
  try {
    const data = localStorage.getItem(LLM_CONFIG_KEY);
    return data
      ? { ...DEFAULT_GENERATION_CONFIG, ...JSON.parse(data) }
      : DEFAULT_GENERATION_CONFIG;
  } catch {
    return DEFAULT_GENERATION_CONFIG;
  }
}

function saveLlmConfig(config: GenerationConfig) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LLM_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // Storage full or unavailable
  }
}

function loadConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveConversations(conversations: Conversation[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    // Storage full or unavailable
  }
}

function loadSettings(): AegisSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: AegisSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or unavailable
  }
}

// ─── App Store ───

interface AppState {
  // Intro
  introComplete: boolean;
  introSkipped: boolean;
  showIntro: boolean;
  setIntroComplete: () => void;
  skipIntro: () => void;
  replayIntro: () => void;

  // Orb State
  orbState: OrbState;
  setOrbState: (state: OrbState) => void;

  // System Status
  systemStatus: SystemStatus;
  setSystemStatus: (status: Partial<SystemStatus>) => void;

  // Conversations
  conversations: Conversation[];
  activeConversationId: string | null;
  createConversation: () => string;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  setActiveConversation: (id: string | null) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, content: string) => void;
  clearHistory: () => void;
  getActiveConversation: () => Conversation | null;

  // Streaming
  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;
  abortController: AbortController | null;
  setAbortController: (controller: AbortController | null) => void;

  // Settings
  settings: AegisSettings;
  updateSettings: (settings: Partial<AegisSettings>) => void;

  // LLM Parameter Control Lab
  llmConfig: GenerationConfig;
  updateLlmConfig: (config: Partial<GenerationConfig>, persist?: boolean) => void;
  saveLlmConfiguration: (config?: GenerationConfig) => void;
  resetLlmConfig: (model?: ModelCapability) => void;
  availableModels: ModelCapability[];
  setAvailableModels: (models: ModelCapability[]) => void;
  lastTokenUsage: TokenUsage | null;
  setLastTokenUsage: (usage: TokenUsage | null) => void;
  neuralConfigOpen: boolean;
  toggleNeuralConfig: () => void;
  setNeuralConfigOpen: (open: boolean) => void;
  activeWorkspaceTab: 'chat' | 'lab';
  setActiveWorkspaceTab: (tab: 'chat' | 'lab') => void;

  // UI
  sidebarOpen: boolean;
  settingsOpen: boolean;
  toggleSidebar: () => void;
  toggleSettings: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;

  // Hydration
  hydrated: boolean;
  hydrate: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // ─── Intro ───
  introComplete: false,
  introSkipped: false,
  showIntro: true,
  setIntroComplete: () => set({ introComplete: true, showIntro: false }),
  skipIntro: () => set({ introComplete: true, introSkipped: true, showIntro: false }),
  replayIntro: () => set({ introComplete: false, introSkipped: false, showIntro: true }),

  // ─── Orb ───
  orbState: 'idle',
  setOrbState: (orbState) => set({ orbState }),

  // ─── System Status ───
  systemStatus: { apiConnected: false, model: 'gemini-3.5-flash-lite', isReady: false },
  setSystemStatus: (status) =>
    set((state) => ({ systemStatus: { ...state.systemStatus, ...status } })),

  // ─── Conversations ───
  conversations: [],
  activeConversationId: null,

  createConversation: () => {
    const id = uuidv4();
    const conversation: Conversation = {
      id,
      title: 'New Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((state) => {
      const conversations = [conversation, ...state.conversations];
      saveConversations(conversations);
      return { conversations, activeConversationId: id };
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_CONVERSATION_KEY, id);
    }
    return id;
  },

  deleteConversation: (id) =>
    set((state) => {
      const conversations = state.conversations.filter((c) => c.id !== id);
      saveConversations(conversations);
      const activeConversationId =
        state.activeConversationId === id
          ? conversations[0]?.id ?? null
          : state.activeConversationId;
      return { conversations, activeConversationId };
    }),

  renameConversation: (id, title) =>
    set((state) => {
      const conversations = state.conversations.map((c) =>
        c.id === id ? { ...c, title, updatedAt: Date.now() } : c
      );
      saveConversations(conversations);
      return { conversations };
    }),

  setActiveConversation: (id) => {
    set({ activeConversationId: id });
    if (typeof window !== 'undefined' && id) {
      localStorage.setItem(ACTIVE_CONVERSATION_KEY, id);
    }
  },

  addMessage: (conversationId, message) =>
    set((state) => {
      const conversations = state.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        const messages = [...c.messages, message];
        // Auto-title on first user message
        const title =
          c.title === 'New Conversation' && message.role === 'user'
            ? message.content.slice(0, 50) + (message.content.length > 50 ? '…' : '')
            : c.title;
        return { ...c, messages, title, updatedAt: Date.now() };
      });
      saveConversations(conversations);
      return { conversations };
    }),

  updateMessage: (conversationId, messageId, content) =>
    set((state) => {
      const conversations = state.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        const messages = c.messages.map((m) =>
          m.id === messageId ? { ...m, content, isStreaming: false } : m
        );
        return { ...c, messages, updatedAt: Date.now() };
      });
      saveConversations(conversations);
      return { conversations };
    }),

  clearHistory: () => {
    saveConversations([]);
    set({ conversations: [], activeConversationId: null });
  },

  getActiveConversation: () => {
    const { conversations, activeConversationId } = get();
    return conversations.find((c) => c.id === activeConversationId) ?? null;
  },

  // ─── Streaming ───
  isStreaming: false,
  setIsStreaming: (isStreaming) => set({ isStreaming }),
  abortController: null,
  setAbortController: (abortController) => set({ abortController }),

  // ─── Settings ───
  settings: DEFAULT_SETTINGS,
  updateSettings: (newSettings) =>
    set((state) => {
      const settings = { ...state.settings, ...newSettings };
      saveSettings(settings);
      return { settings };
    }),

  // ─── LLM Parameter Control Lab ───
  llmConfig: DEFAULT_GENERATION_CONFIG,
  updateLlmConfig: (partial, persist = true) =>
    set((state) => {
      const llmConfig = { ...state.llmConfig, ...partial };
      if (persist) {
        saveLlmConfig(llmConfig);
      }
      return { llmConfig };
    }),
  saveLlmConfiguration: (explicit) =>
    set((state) => {
      const llmConfig = explicit ?? state.llmConfig;
      saveLlmConfig(llmConfig);
      return { llmConfig };
    }),
  resetLlmConfig: (model) =>
    set(() => {
      const llmConfig: GenerationConfig = {
        temperature: model ? Math.min(0.7, model.maxTemperature) : 0.7,
        maxOutputTokens: model
          ? Math.min(1024, model.outputTokenLimit)
          : 1024,
        topP: model?.defaultTopP ?? 0.95,
        ...(model?.supportsTopK
          ? { topK: Math.min(40, model.maxTopK ?? model.defaultTopK ?? 64) }
          : {}),
      };
      saveLlmConfig(llmConfig);
      return { llmConfig };
    }),
  availableModels: [],
  setAvailableModels: (availableModels) => set({ availableModels }),
  lastTokenUsage: null,
  setLastTokenUsage: (lastTokenUsage) => set({ lastTokenUsage }),
  neuralConfigOpen: false,
  toggleNeuralConfig: () =>
    set((state) => ({ neuralConfigOpen: !state.neuralConfigOpen })),
  setNeuralConfigOpen: (neuralConfigOpen) => set({ neuralConfigOpen }),
  activeWorkspaceTab: 'chat',
  setActiveWorkspaceTab: (activeWorkspaceTab) => set({ activeWorkspaceTab }),

  // ─── UI ───
  sidebarOpen: false,
  settingsOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),

  // ─── Hydration ───
  hydrated: false,
  hydrate: () => {
    const conversations = loadConversations();
    const settings = loadSettings();
    const llmConfig = loadLlmConfig();
    const activeId =
      typeof window !== 'undefined'
        ? localStorage.getItem(ACTIVE_CONVERSATION_KEY)
        : null;
    const prefersReducedMotion =
      typeof window !== 'undefined'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

    const freeTierMigrated =
      typeof window !== 'undefined' &&
      localStorage.getItem('aegis-free-tier-migrated') === '1';

    let normalizedModel = settings.model || 'gemini-3.5-flash-lite';
    if (normalizedModel.startsWith('gpt-')) {
      normalizedModel = 'gemini-3.5-flash-lite';
    } else if (!freeTierMigrated && normalizedModel === 'gemini-3.5-flash') {
      normalizedModel = 'gemini-3.5-flash-lite';
      if (typeof window !== 'undefined') {
        localStorage.setItem('aegis-free-tier-migrated', '1');
        saveSettings({ ...settings, model: normalizedModel });
      }
    }

    set({
      conversations,
      settings: {
        ...settings,
        model: normalizedModel,
        reducedMotion: prefersReducedMotion || settings.reducedMotion,
      },
      llmConfig,
      activeConversationId: activeId && conversations.find((c) => c.id === activeId) ? activeId : null,
      hydrated: true,
      showIntro: settings.autoPlayIntro,
    });
  },
}));
