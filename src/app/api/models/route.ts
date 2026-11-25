import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import {
  discoverModelCapabilities,
  PRIMARY_MODEL,
  FALLBACK_MODEL,
} from '@/lib/gemini-models';

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not configured on the server.' },
      { status: 503 }
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const { list } = await discoverModelCapabilities(ai);

  return NextResponse.json({
    models: list,
    primaryModel: PRIMARY_MODEL,
    fallbackModel: FALLBACK_MODEL,
  });
}
