// ─── A.E.G.I.S. Chat API Client ───

import type {
  GenerationConfig,
  Message,
  ModelCapability,
  TokenUsage,
} from '@/types';

const SYSTEM_PROMPT = `You are A.E.G.I.S., an advanced personal intelligence assistant.

Your personality is calm, precise, intelligent, confident, and approachable.

You communicate naturally and efficiently.

You can explain technical subjects, help with programming, brainstorm ideas, and support learning and productivity.

Avoid exaggerated robotic language.

Do not repeatedly introduce yourself.

Be transparent about your capabilities and limitations.

Never claim to have executed an action unless it was actually performed.

When the user asks technical questions, provide clear and useful explanations.

When the user needs a concise answer, be concise.

Maintain a subtle futuristic personality without sacrificing clarity.`;

const MAX_CONTEXT_MESSAGES = 20;

export interface SendChatOptions {
  signal?: AbortSignal;
  config?: Partial<GenerationConfig>;
  allowFallback?: boolean;
  onModelUsed?: (model: string) => void;
  onUsage?: (usage: TokenUsage) => void;
}

export async function sendChatMessage(
  messages: Message[],
  model: string,
  signalOrOptions?: AbortSignal | SendChatOptions,
  onModelUsedLegacy?: (model: string) => void
): Promise<ReadableStream<string>> {
  const opts: SendChatOptions =
    signalOrOptions && 'aborted' in signalOrOptions
      ? { signal: signalOrOptions, onModelUsed: onModelUsedLegacy }
      : (signalOrOptions as SendChatOptions | undefined) ?? {};

  const { signal, config, allowFallback = true, onModelUsed, onUsage } = opts;

  // Trim context to avoid overly expensive requests
  const contextMessages = messages.slice(-MAX_CONTEXT_MESSAGES).map((m) => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
  }));

  // Prepend system prompt if not already present
  const hasSystem = contextMessages.some((m) => m.role === 'system');
  const apiMessages = hasSystem
    ? contextMessages
    : [{ role: 'system' as const, content: SYSTEM_PROMPT }, ...contextMessages];

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: apiMessages,
      model,
      ...(config ? { config } : {}),
      allowFallback,
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  // Return a stream of text chunks with proper SSE line buffering
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  return new ReadableStream<string>({
    async pull(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Flush any remaining buffered line
            const trimmed = buffer.trim();
            if (trimmed.startsWith('data: ')) {
              const data = trimmed.slice(6);
              if (data !== '[DONE]') {
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.model && onModelUsed) onModelUsed(parsed.model);
                  if (parsed.usage && onUsage) onUsage(parsed.usage);
                  if (parsed.content) controller.enqueue(parsed.content);
                  if (parsed.error) {
                    controller.error(new Error(parsed.error));
                    return;
                  }
                } catch {
                  // Ignore trailing partial JSON
                }
              }
            }
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          let enqueued = false;
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);
            if (data === '[DONE]') {
              controller.close();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.model && onModelUsed) {
                onModelUsed(parsed.model);
              }
              if (parsed.usage && onUsage) {
                onUsage(parsed.usage);
              }
              if (parsed.content) {
                controller.enqueue(parsed.content);
                enqueued = true;
              }
              if (parsed.error) {
                controller.error(new Error(parsed.error));
                return;
              }
            } catch {
              // Skip unparseable chunks
            }
          }

          if (enqueued) {
            return;
          }
        }
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

export async function checkApiStatus(): Promise<{
  connected: boolean;
  provider: string;
  model: string;
}> {
  try {
    const response = await fetch('/api/chat', { method: 'GET' });
    if (response.ok) {
      const data = await response.json();
      return {
        connected: true,
        provider: data.provider || 'gemini',
        model: data.model || 'gemini-3.5-flash-lite',
      };
    }
    return { connected: false, provider: 'gemini', model: 'gemini-3.5-flash-lite' };
  } catch {
    return { connected: false, provider: 'gemini', model: 'gemini-3.5-flash-lite' };
  }
}

export async function fetchAvailableModels(): Promise<ModelCapability[]> {
  try {
    const response = await fetch('/api/models', { method: 'GET' });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.models) ? data.models : [];
  } catch {
    return [];
  }
}

export async function countPromptTokens(
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  model: string
): Promise<number | null> {
  try {
    const response = await fetch('/api/count-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages.slice(-MAX_CONTEXT_MESSAGES),
        ],
        model,
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data.totalTokens === 'number' ? data.totalTokens : null;
  } catch {
    return null;
  }
}
