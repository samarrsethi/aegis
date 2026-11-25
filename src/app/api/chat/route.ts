import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import type { GenerationConfig, TokenUsage } from '@/types';
import {
  ALLOWED_MODELS_SET,
  FALLBACK_MODEL,
  PRIMARY_MODEL,
  discoverModelCapabilities,
  getCapabilityForModel,
  validateGenerationConfig,
} from '@/lib/gemini-models';

// ─── Configuration ───

const MAX_MESSAGE_LENGTH = 10000;
const MAX_MESSAGES = 50;
const MAX_RETRIES_PER_MODEL = 3; // initial attempt + 2 retries
const BASE_BACKOFF_MS = 600;
const MAX_RETRY_DELAY_MS = 8000;

// ─── Simple In-Memory Rate Limit ───

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 30;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

// ─── Error Classification & Sanitization ───

function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/AIza[0-9A-Za-z_-]+/g, 'AIza***')
    .replace(/AQ\.[0-9A-Za-z_-]+/g, 'AQ.***')
    .replace(/sk-[a-zA-Z0-9_-]+/g, 'sk-***');
}

interface MappedGeminiError {
  status: number;
  userMessage: string;
  logDetail: string;
  retryableSameModel: boolean;
  shouldFallbackModel: boolean;
}

function parseRetryAfterMs(err: unknown): number | null {
  const errObj = err as {
    headers?: Headers | Record<string, string>;
    message?: string;
  };

  let headerVal: string | null = null;
  if (errObj?.headers) {
    if (typeof (errObj.headers as Headers).get === 'function') {
      headerVal = (errObj.headers as Headers).get('retry-after');
    } else {
      const record = errObj.headers as Record<string, string>;
      headerVal = record['retry-after'] || record['Retry-After'] || null;
    }
  }

  if (headerVal) {
    const seconds = Number(headerVal);
    if (!Number.isNaN(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
    }
    const dateMs = Date.parse(headerVal);
    if (!Number.isNaN(dateMs)) {
      const delta = dateMs - Date.now();
      if (delta > 0) return Math.min(delta, MAX_RETRY_DELAY_MS);
    }
  }

  const msg = typeof errObj?.message === 'string' ? errObj.message : '';
  const match = msg.match(/retry in\s+([\d.]+)\s*s/i);
  if (match) {
    const seconds = Number(match[1]);
    if (!Number.isNaN(seconds) && seconds > 0) {
      return Math.min(Math.ceil(seconds * 1000), MAX_RETRY_DELAY_MS);
    }
  }

  return null;
}

function mapGeminiError(err: unknown, selectedModel: string): MappedGeminiError {
  const errObj = err as { status?: number; message?: string };
  const status = typeof errObj?.status === 'number' ? errObj.status : 500;
  const rawMsg = sanitizeErrorMessage(
    err instanceof Error
      ? err.message
      : typeof errObj?.message === 'string'
        ? errObj.message
        : 'Gemini API error'
  );
  const lower = rawMsg.toLowerCase();

  if (
    status === 401 ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('invalid api key') ||
    lower.includes('unauthenticated')
  ) {
    return {
      status: 401,
      userMessage:
        'Gemini authentication failed. Verify that GEMINI_API_KEY in .env.local is valid.',
      logDetail: `401 Invalid Gemini API key: ${rawMsg}`,
      retryableSameModel: false,
      shouldFallbackModel: false,
    };
  }

  if (status === 403 || lower.includes('permission_denied')) {
    return {
      status: 403,
      userMessage:
        'Gemini access denied. Your API key does not have permission for this resource.',
      logDetail: `403 Permission denied: ${rawMsg}`,
      retryableSameModel: false,
      shouldFallbackModel: false,
    };
  }

  if (
    status === 404 ||
    lower.includes('not_found') ||
    lower.includes('is not found') ||
    lower.includes('no longer available')
  ) {
    return {
      status: 404,
      userMessage: `Model "${selectedModel}" is unavailable for your Gemini API key.`,
      logDetail: `404 Model unavailable (${selectedModel}): ${rawMsg}`,
      retryableSameModel: false,
      shouldFallbackModel: true,
    };
  }

  // 429: Distinguish exhausted daily/billing quota (never retry same model) vs transient per-minute rate limit
  if (
    status === 429 ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit')
  ) {
    const isBillingOrZeroLimit =
      lower.includes('billing') ||
      lower.includes('insufficient_quota') ||
      lower.includes('limit: 0');

    const isDailyQuota =
      lower.includes('per day') ||
      lower.includes('per_day') ||
      lower.includes('perday') ||
      lower.includes('daily') ||
      lower.includes('exceeded your current quota') ||
      lower.includes('quota');

    if (isBillingOrZeroLimit) {
      return {
        status: 429,
        userMessage:
          'Gemini API quota exhausted (billing/project limit). Check your Google AI Studio quota.',
        logDetail: `429 Billing/Zero-limit quota (${selectedModel}): ${rawMsg}`,
        retryableSameModel: false,
        shouldFallbackModel: false,
      };
    }

    if (isDailyQuota) {
      return {
        status: 429,
        userMessage: `Daily quota exhausted for ${selectedModel}. Try switching to Gemini 3.5 Flash Lite or Gemini 3.1 Flash Lite.`,
        logDetail: `429 Daily quota exhausted (${selectedModel}): ${rawMsg}`,
        retryableSameModel: false, // Never retry exhausted daily quota on the same model
        shouldFallbackModel: true, // Allow switching once to fallback model
      };
    }

    return {
      status: 429,
      userMessage:
        'Gemini API per-minute rate limit reached. Please wait a moment and try again.',
      logDetail: `429 Rate limit (${selectedModel}): ${rawMsg}`,
      retryableSameModel: true,
      shouldFallbackModel: true,
    };
  }

  if (
    status === 503 ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded')
  ) {
    return {
      status: 503,
      userMessage: `Model "${selectedModel}" is temporarily experiencing high demand. Please try again shortly.`,
      logDetail: `503 Service unavailable (${selectedModel}): ${rawMsg}`,
      retryableSameModel: true,
      shouldFallbackModel: true,
    };
  }

  if (status === 400) {
    return {
      status: 400,
      userMessage: `Parameter or request rejected by ${selectedModel}: ${rawMsg}`,
      logDetail: `400 Bad Request (${selectedModel}): ${rawMsg}`,
      retryableSameModel: false,
      shouldFallbackModel: false,
    };
  }

  return {
    status: status >= 400 && status < 600 ? status : 500,
    userMessage: 'An error occurred while communicating with Gemini. Please try again.',
    logDetail: `${status} Gemini error (${selectedModel}): ${rawMsg}`,
    retryableSameModel: status >= 500,
    shouldFallbackModel: status >= 500,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildModelChain(
  requestedModel: string,
  allowFallback: boolean,
  discoveredMap: Map<string, unknown>
): string[] {
  if (!allowFallback) {
    return [requestedModel];
  }

  // Only fall back across high-RPD free-tier Flash Lite models (avoid burning 20-RPD models automatically)
  const rawChain = [
    requestedModel,
    PRIMARY_MODEL,
    FALLBACK_MODEL,
  ];

  const deduped: string[] = [];
  for (const m of rawChain) {
    if (!deduped.includes(m)) {
      if (discoveredMap.size === 0 || discoveredMap.has(m)) {
        deduped.push(m);
      }
    }
  }

  return deduped.length > 0 ? deduped : [requestedModel];
}

// ─── GET: Health check ───

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { status: 'unconfigured', provider: 'gemini', error: 'GEMINI_API_KEY is not set' },
      { status: 503 }
    );
  }

  return NextResponse.json({
    status: 'ready',
    provider: 'gemini',
    model: PRIMARY_MODEL,
    fallbackModel: FALLBACK_MODEL,
  });
}

// ─── POST: Streaming chat via Google Gemini SDK with parameter validation, retry & fallback ───

interface GeminiStreamChunk {
  text?: string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
    thoughtsTokenCount?: number;
  };
  candidates?: Array<{
    finishReason?: string;
  }>;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'A.E.G.I.S. requires a Gemini API key. Add GEMINI_API_KEY to your .env.local file.',
      },
      { status: 503 }
    );
  }

  const ip =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      {
        error:
          'Local rate limit exceeded. Please wait a moment before sending another message.',
      },
      { status: 429 }
    );
  }

  let body: {
    messages?: { role: string; content: string }[];
    model?: string;
    config?: Partial<GenerationConfig>;
    allowFallback?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { messages, model, config: rawConfig, allowFallback = true } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
  }

  if (messages.length > MAX_MESSAGES) {
    return NextResponse.json(
      { error: 'Too many messages in context' },
      { status: 400 }
    );
  }

  for (const msg of messages) {
    if (!msg.role || typeof msg.content !== 'string' || !msg.content.trim()) {
      return NextResponse.json(
        { error: 'Each message must have role and non-empty content' },
        { status: 400 }
      );
    }
    if (!['user', 'assistant', 'system'].includes(msg.role)) {
      return NextResponse.json(
        { error: `Invalid message role: ${msg.role}` },
        { status: 400 }
      );
    }
    if (msg.content.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: 'Message too long' }, { status: 400 });
    }
  }

  // Strict server-side allowlist check
  const requestedModel = model || PRIMARY_MODEL;
  if (!ALLOWED_MODELS_SET.has(requestedModel)) {
    return NextResponse.json(
      { error: `Model "${requestedModel}" is not in the approved server allowlist.` },
      { status: 400 }
    );
  }

  const systemInstruction = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');

  const contents = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  if (contents.length === 0) {
    return NextResponse.json(
      { error: 'At least one user message is required' },
      { status: 400 }
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const { map: capabilityMap } = await discoverModelCapabilities(ai);

  // Validate parameters against the requested model's capabilities first
  const initialCap = getCapabilityForModel(requestedModel, capabilityMap);
  const initialValidation = validateGenerationConfig(rawConfig, initialCap);
  if (!initialValidation.ok) {
    return NextResponse.json(
      { error: initialValidation.error },
      { status: 400 }
    );
  }

  const modelChain = buildModelChain(requestedModel, allowFallback, capabilityMap);

  let activeModel = modelChain[0];
  let activeConfig: GenerationConfig = initialValidation.config;
  let activeContextWindow = initialCap.inputTokenLimit;
  let activeIterator: AsyncIterator<GeminiStreamChunk> | null = null;
  let firstChunkText = '';
  let latestUsageMetadata: GeminiStreamChunk['usageMetadata'] | undefined;
  let latestFinishReason: string | undefined;
  let lastMappedError: MappedGeminiError | null = null;

  modelLoop: for (const candidateModel of modelChain) {
    const candidateCap = getCapabilityForModel(candidateModel, capabilityMap);
    const validated = validateGenerationConfig(rawConfig, candidateCap);
    if (!validated.ok) {
      lastMappedError = {
        status: 400,
        userMessage: validated.error,
        logDetail: `400 Config validation (${candidateModel}): ${validated.error}`,
        retryableSameModel: false,
        shouldFallbackModel: false,
      };
      continue;
    }

    for (let attempt = 0; attempt < MAX_RETRIES_PER_MODEL; attempt++) {
      try {
        const stream = await ai.models.generateContentStream({
          model: candidateModel,
          contents,
          config: {
            ...(systemInstruction ? { systemInstruction } : {}),
            temperature: validated.config.temperature,
            topP: validated.config.topP,
            ...(validated.config.topK !== undefined
              ? { topK: validated.config.topK }
              : {}),
            maxOutputTokens: validated.config.maxOutputTokens,
          },
        });

        const iterator = stream[Symbol.asyncIterator]() as AsyncIterator<GeminiStreamChunk>;
        let foundText = '';
        let chunkUsage: GeminiStreamChunk['usageMetadata'] | undefined;
        let chunkFinish: string | undefined;

        while (true) {
          const next = await iterator.next();
          if (next.done) break;
          if (next.value?.usageMetadata) {
            chunkUsage = next.value.usageMetadata;
          }
          const fr = next.value?.candidates?.[0]?.finishReason;
          if (fr) chunkFinish = fr;
          if (next.value?.text) {
            foundText = next.value.text;
            break;
          }
        }

        activeModel = candidateModel;
        activeConfig = validated.config;
        activeContextWindow = candidateCap.inputTokenLimit;
        activeIterator = iterator;
        firstChunkText = foundText;
        latestUsageMetadata = chunkUsage;
        latestFinishReason = chunkFinish;
        break modelLoop;
      } catch (err) {
        const mapped = mapGeminiError(err, candidateModel);
        lastMappedError = mapped;
        console.error(
          `Gemini attempt ${attempt + 1}/${MAX_RETRIES_PER_MODEL} failed:`,
          mapped.logDetail
        );

        if (!mapped.retryableSameModel && !mapped.shouldFallbackModel) {
          return NextResponse.json(
            { error: mapped.userMessage },
            { status: mapped.status }
          );
        }

        if (mapped.retryableSameModel && attempt < MAX_RETRIES_PER_MODEL - 1) {
          const retryAfterMs = parseRetryAfterMs(err);
          const backoffMs = Math.min(
            BASE_BACKOFF_MS * Math.pow(2, attempt) + Math.floor(Math.random() * 150),
            MAX_RETRY_DELAY_MS
          );
          await sleep(retryAfterMs ?? backoffMs);
          continue;
        }

        if (mapped.shouldFallbackModel) {
          break;
        }
      }
    }
  }

  if (!activeIterator) {
    const finalError = lastMappedError ?? {
      status: 503,
      userMessage:
        'All configured Gemini models are currently unavailable. Please try again shortly.',
    };
    return NextResponse.json(
      { error: finalError.userMessage },
      { status: finalError.status }
    );
  }

  const encoder = new TextEncoder();

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ model: activeModel })}\n\n`)
        );

        if (firstChunkText) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ content: firstChunkText })}\n\n`)
          );
        }

        while (true) {
          const next = await activeIterator.next();
          if (next.done) break;
          if (next.value?.usageMetadata) {
            latestUsageMetadata = next.value.usageMetadata;
          }
          const fr = next.value?.candidates?.[0]?.finishReason;
          if (fr) latestFinishReason = fr;

          if (next.value?.text) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ content: next.value.text })}\n\n`
              )
            );
          }
        }

        const usagePayload: TokenUsage = {
          inputTokens: latestUsageMetadata?.promptTokenCount ?? null,
          outputTokens: latestUsageMetadata?.candidatesTokenCount ?? null,
          totalTokens: latestUsageMetadata?.totalTokenCount ?? null,
          thoughtsTokens: latestUsageMetadata?.thoughtsTokenCount ?? null,
          maxConfiguredOutputTokens: activeConfig.maxOutputTokens,
          contextWindow: activeContextWindow,
          finishReason: latestFinishReason ?? null,
          modelUsed: activeModel,
        };

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ usage: usagePayload })}\n\n`)
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err) {
        const mapped = mapGeminiError(err, activeModel);
        console.error('Gemini mid-stream error:', mapped.logDetail);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: mapped.userMessage })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Aegis-Model': activeModel,
    },
  });
}
