import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import {
  ALLOWED_MODELS_SET,
  PRIMARY_MODEL,
  discoverModelCapabilities,
  getCapabilityForModel,
} from '@/lib/gemini-models';

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not configured.' },
      { status: 503 }
    );
  }

  let body: {
    messages?: { role: string; content: string }[];
    model?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { messages, model } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
  }

  const selectedModel = model || PRIMARY_MODEL;
  if (!ALLOWED_MODELS_SET.has(selectedModel)) {
    return NextResponse.json(
      { error: `Model "${selectedModel}" is not in the approved allowlist.` },
      { status: 400 }
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const { map } = await discoverModelCapabilities(ai);
  const capability = getCapabilityForModel(selectedModel, map);

  if (!capability.supportsCountTokens) {
    return NextResponse.json(
      { error: `Model "${selectedModel}" does not support countTokens.` },
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
    return NextResponse.json({ totalTokens: 0, model: selectedModel });
  }

  // Gemini Developer API countTokens does not support config.systemInstruction;
  // include system instructions as a leading text part for accurate token counting.
  const countContents = systemInstruction
    ? [{ role: 'user', parts: [{ text: systemInstruction }] }, ...contents]
    : contents;

  try {
    const result = await ai.models.countTokens({
      model: selectedModel,
      contents: countContents,
    });

    return NextResponse.json({
      totalTokens: result.totalTokens ?? null,
      model: selectedModel,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to count tokens';
    return NextResponse.json(
      { error: msg.replace(/AIza[0-9A-Za-z_-]+/g, 'AIza***').replace(/AQ\.[0-9A-Za-z_-]+/g, 'AQ.***') },
      { status: 500 }
    );
  }
}
