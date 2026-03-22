/**
 * POST /api/formalize-llm
 *
 * Proxy server-side for Ollama-backed formalization.
 * Calls @stevenvo780/autologic formalizeWithLLM() which needs server-side fetch
 * to reach the Ollama GPU server (no CORS from browser).
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  formalizeWithLLM,
  type FormalizeWithLLMOptions,
  type LogicProfile,
  type LLMConfig
} from '@stevenvo780/autologic';

const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || 'http://10.88.88.1:11434/api/chat';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:14b';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, profile, language } = body as {
      text: string;
      profile: LogicProfile;
      language?: 'es' | 'en';
    };

    if (!text?.trim()) {
      return NextResponse.json({ ok: false, error: 'Text is required' }, { status: 400 });
    }

    const llmConfig: LLMConfig = {
      provider: 'ollama',
      apiKey: '',
      endpoint: OLLAMA_ENDPOINT,
      model: OLLAMA_MODEL
    };

    const opts: FormalizeWithLLMOptions = {
      profile: profile || 'classical.propositional',
      language: language || 'es',
      includeComments: true,
      validateOutput: true,
      llmConfig,
      abortOnLinterErrors: false
    };

    const result = await formalizeWithLLM(text, opts);

    return NextResponse.json({
      ok: result.ok,
      stCode: result.stCode,
      diagnostics: result.diagnostics,
      linterDiagnostics: result.linterDiagnostics,
      axiomCount: result.llmRawAst?.axioms?.length ?? 0,
      conclusionCount: result.llmRawAst?.conclusions?.length ?? 0,
      patterns: ['llm_extracted']
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
