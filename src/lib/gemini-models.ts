import { GoogleGenAI } from '@google/genai';
import type { GenerationConfig, ModelCapability } from '@/types';

export const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
export const FALLBACK_MODEL =
  process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.1-flash-lite';

// Server-side allowlist of approved Gemini Flash model IDs (ordered by free-tier reliability)
export const APPROVED_MODEL_IDS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
] as const;

export const ALLOWED_MODELS_SET = new Set<string>([
  PRIMARY_MODEL,
  FALLBACK_MODEL,
  ...APPROVED_MODEL_IDS,
]);

// Conservative fallback metadata only used if models.list() is temporarily unreachable
const FALLBACK_CAPABILITIES: Record<string, ModelCapability> = {
  'gemini-3.5-flash': {
    id: 'gemini-3.5-flash',
    displayName: 'Gemini 3.5 Flash',
    inputTokenLimit: 1048576,
    outputTokenLimit: 65536,
    defaultTemperature: 1,
    maxTemperature: 2,
    defaultTopP: 0.95,
    supportsTopK: true,
    defaultTopK: 64,
    maxTopK: 64,
    supportsCountTokens: true,
    supportedActions: ['generateContent', 'countTokens'],
  },
  'gemini-3.5-flash-lite': {
    id: 'gemini-3.5-flash-lite',
    displayName: 'Gemini 3.5 Flash Lite',
    inputTokenLimit: 1048576,
    outputTokenLimit: 65536,
    defaultTemperature: 1,
    maxTemperature: 2,
    defaultTopP: 0.95,
    supportsTopK: true,
    defaultTopK: 64,
    maxTopK: 64,
    supportsCountTokens: true,
    supportedActions: ['generateContent', 'countTokens'],
  },
  'gemini-3.6-flash': {
    id: 'gemini-3.6-flash',
    displayName: 'Gemini 3.6 Flash',
    inputTokenLimit: 1048576,
    outputTokenLimit: 65536,
    defaultTemperature: 1,
    maxTemperature: 2,
    defaultTopP: 0.95,
    supportsTopK: true,
    defaultTopK: 64,
    maxTopK: 64,
    supportsCountTokens: true,
    supportedActions: ['generateContent', 'countTokens'],
  },
  'gemini-3.1-flash-lite': {
    id: 'gemini-3.1-flash-lite',
    displayName: 'Gemini 3.1 Flash Lite',
    inputTokenLimit: 1048576,
    outputTokenLimit: 65536,
    defaultTemperature: 1,
    maxTemperature: 2,
    defaultTopP: 0.95,
    supportsTopK: true,
    defaultTopK: 64,
    maxTopK: 64,
    supportsCountTokens: true,
    supportedActions: ['generateContent', 'countTokens'],
  },
  'gemini-3.8-flash': {
    id: 'gemini-3.8-flash',
    displayName: 'Gemini 3.8 Flash',
    inputTokenLimit: 1048576,
    outputTokenLimit: 65536,
    defaultTemperature: 1,
    maxTemperature: 2,
    defaultTopP: 0.95,
    supportsTopK: true,
    defaultTopK: 64,
    maxTopK: 64,
    supportsCountTokens: true,
    supportedActions: ['generateContent', 'countTokens'],
  },
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedCapabilities: {
  list: ModelCapability[];
  map: Map<string, ModelCapability>;
  expiresAt: number;
} | null = null;

export async function discoverModelCapabilities(
  ai: GoogleGenAI
): Promise<{ list: ModelCapability[]; map: Map<string, ModelCapability> }> {
  const now = Date.now();
  if (cachedCapabilities && now < cachedCapabilities.expiresAt) {
    return { list: cachedCapabilities.list, map: cachedCapabilities.map };
  }

  try {
    const pager = await ai.models.list();
    const map = new Map<string, ModelCapability>();

    for await (const raw of pager) {
      const id = raw.name?.replace(/^models\//, '');
      if (!id || !ALLOWED_MODELS_SET.has(id)) continue;

      const m = raw as {
        displayName?: string;
        inputTokenLimit?: number;
        outputTokenLimit?: number;
        temperature?: number;
        maxTemperature?: number;
        topP?: number;
        topK?: number;
        supportedActions?: string[];
      };

      const actions = Array.isArray(m.supportedActions) ? m.supportedActions : [];
      const supportsTopK = typeof m.topK === 'number' && m.topK > 0;

      map.set(id, {
        id,
        displayName: m.displayName || id,
        inputTokenLimit: m.inputTokenLimit ?? 1048576,
        outputTokenLimit: m.outputTokenLimit ?? 65536,
        defaultTemperature: typeof m.temperature === 'number' ? m.temperature : 1,
        maxTemperature: typeof m.maxTemperature === 'number' ? m.maxTemperature : 2,
        defaultTopP: typeof m.topP === 'number' ? m.topP : 0.95,
        supportsTopK,
        ...(supportsTopK
          ? { defaultTopK: m.topK, maxTopK: m.topK }
          : {}),
        supportsCountTokens:
          actions.length === 0 || actions.includes('countTokens'),
        supportedActions: actions,
      });
    }

    if (map.size > 0) {
      // Order by APPROVED_MODEL_IDS preference
      const ordered: ModelCapability[] = [];
      for (const id of APPROVED_MODEL_IDS) {
        const cap = map.get(id);
        if (cap) ordered.push(cap);
      }
      for (const [id, cap] of Array.from(map.entries())) {
        if (!ordered.some((o) => o.id === id)) {
          ordered.push(cap);
        }
      }

      cachedCapabilities = {
        list: ordered,
        map,
        expiresAt: now + CACHE_TTL_MS,
      };
      return { list: ordered, map };
    }
  } catch {
    // Non-fatal fallback
  }

  const fallbackList = APPROVED_MODEL_IDS.map((id) => FALLBACK_CAPABILITIES[id]).filter(Boolean);
  const fallbackMap = new Map(fallbackList.map((c) => [c.id, c]));
  return { list: fallbackList, map: fallbackMap };
}

export function getCapabilityForModel(
  modelId: string,
  map: Map<string, ModelCapability>
): ModelCapability {
  return (
    map.get(modelId) ||
    FALLBACK_CAPABILITIES[modelId] ||
    FALLBACK_CAPABILITIES[PRIMARY_MODEL]
  );
}

export function validateGenerationConfig(
  rawConfig: Partial<GenerationConfig> | undefined,
  capability: ModelCapability
): { ok: true; config: GenerationConfig } | { ok: false; error: string } {
  const temperature =
    rawConfig?.temperature !== undefined ? rawConfig.temperature : 0.7;
  if (
    typeof temperature !== 'number' ||
    !Number.isFinite(temperature) ||
    temperature < 0 ||
    temperature > capability.maxTemperature
  ) {
    return {
      ok: false,
      error: `Invalid temperature (${String(temperature)}). ${capability.id} supports temperature between 0 and ${capability.maxTemperature}.`,
    };
  }

  const topP = rawConfig?.topP !== undefined ? rawConfig.topP : capability.defaultTopP;
  if (
    typeof topP !== 'number' ||
    !Number.isFinite(topP) ||
    topP < 0 ||
    topP > 1
  ) {
    return {
      ok: false,
      error: `Invalid topP (${String(topP)}). Top-P must be between 0 and 1.`,
    };
  }

  const maxOutputTokens =
    rawConfig?.maxOutputTokens !== undefined
      ? Math.floor(rawConfig.maxOutputTokens)
      : Math.min(1024, capability.outputTokenLimit);
  if (
    typeof maxOutputTokens !== 'number' ||
    !Number.isFinite(maxOutputTokens) ||
    maxOutputTokens < 1 ||
    maxOutputTokens > capability.outputTokenLimit
  ) {
    return {
      ok: false,
      error: `Invalid maxOutputTokens (${String(rawConfig?.maxOutputTokens)}). ${capability.id} supports 1 to ${capability.outputTokenLimit} output tokens.`,
    };
  }

  let topK: number | undefined;
  if (rawConfig?.topK !== undefined) {
    if (!capability.supportsTopK) {
      return {
        ok: false,
        error: `Model ${capability.id} does not support configurable Top-K.`,
      };
    }
    const maxTopK = capability.maxTopK ?? 64;
    const roundedTopK = Math.floor(rawConfig.topK);
    if (
      typeof roundedTopK !== 'number' ||
      !Number.isFinite(roundedTopK) ||
      roundedTopK < 1 ||
      roundedTopK > maxTopK
    ) {
      return {
        ok: false,
        error: `Invalid topK (${String(rawConfig.topK)}). ${capability.id} supports Top-K between 1 and ${maxTopK}.`,
      };
    }
    topK = roundedTopK;
  }

  return {
    ok: true,
    config: {
      temperature,
      topP,
      maxOutputTokens,
      ...(topK !== undefined ? { topK } : {}),
    },
  };
}
