/**
 * POST /api/agora-ai
 *
 * Multi-provider AI chat proxy with Firebase workspace context injection.
 * Supports: OpenAI (ChatGPT), Anthropic (Claude), Ollama (local), Google Gemini.
 *
 * API keys are sent from the client (stored in localStorage) and never persisted server-side.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAuth, isWorkspaceMember } from '@/lib/server-auth';
import { isPersonalWorkspaceId } from '@/types/workspace';

export const maxDuration = 60;

type AIProvider = 'openai' | 'anthropic' | 'ollama' | 'gemini';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface RequestBody {
  messages: ChatMessage[];
  workspaceId?: string;
  provider: AIProvider;
  apiKey?: string;
  model?: string;
}

// ── Context builder ────────────────────────────────────────────────────────

async function buildContextPrompt(workspaceId: string): Promise<string> {
  const parts: string[] = [];

  try {
    const docsSnap = await adminDb
      .collection('documents')
      .where('workspaceId', '==', workspaceId)
      .limit(30)
      .get();

    if (!docsSnap.empty) {
      type FireDoc = { id: string } & Record<string, unknown>;
      const textDocs = docsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }) as FireDoc)
        .filter(d => d['type'] === 'text' && d['content']);

      if (textDocs.length > 0) {
        parts.push('## Documentos del workspace\n');
        for (const doc of textDocs.slice(0, 10)) {
          const raw = String(doc['content'] ?? '');
          const excerpt = raw.length > 1200 ? `${raw.slice(0, 1200)}…` : raw;
          parts.push(`### ${String(doc['name'] || 'Sin título')}\n${excerpt}\n`);
        }
      }
    }
  } catch {
    // non-fatal: context is best-effort
  }

  try {
    const semSnap = await adminDb
      .collection('workspaceSemanticStates')
      .doc(workspaceId)
      .get();

    if (semSnap.exists) {
      const sem = semSnap.data() as Record<string, unknown>;
      const concepts = (sem['concepts'] as Array<Record<string, unknown>> | undefined) ?? [];
      const fragments = (sem['fragments'] as Array<Record<string, unknown>> | undefined) ?? [];

      if (concepts.length > 0) {
        parts.push('\n## Conceptos semánticos del workspace\n');
        for (const c of concepts.slice(0, 25)) {
          const def = String(c['definition'] ?? c['formula'] ?? '');
          parts.push(`- **${String(c['title'] ?? '')}**${def ? `: ${def}` : ''}`);
        }
      }

      if (fragments.length > 0) {
        parts.push('\n## Fragmentos de texto marcados\n');
        for (const f of fragments.slice(0, 20)) {
          const text = String(f['text'] ?? '').slice(0, 250);
          parts.push(`- [${String(f['kind'] ?? '')}] "${text}"`);
        }
      }
    }
  } catch {
    // non-fatal
  }

  if (parts.length === 0) return '';
  return `# Contexto del workspace Agora\n\n${parts.join('\n')}`;
}

// ── Provider callers ───────────────────────────────────────────────────────

async function callOpenAI(messages: ChatMessage[], apiKey: string, model: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: 2048 })
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content ?? '';
}

async function callAnthropic(messages: ChatMessage[], apiKey: string, model: string): Promise<string> {
  const system = messages.find(m => m.role === 'system')?.content;
  const chat = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }));
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({ model, max_tokens: 2048, system, messages: chat })
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json() as { content: Array<{ text: string }> };
  return data.content[0]?.text ?? '';
}

async function callGemini(messages: ChatMessage[], apiKey: string, model: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const system = messages.find(m => m.role === 'system')?.content;
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

  const body: Record<string, unknown> = { contents };
  if (system) body['systemInstruction'] = { parts: [{ text: system }] };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }> };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Require authenticated user
    const auth = await requireAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json() as RequestBody;
    const { messages, workspaceId, provider, apiKey = '', model = '' } = body;

    if (!messages?.length) {
      return NextResponse.json({ error: 'messages is required' }, { status: 400 });
    }
    if (!provider) {
      return NextResponse.json({ error: 'provider is required' }, { status: 400 });
    }
    if (provider === 'ollama') {
      return NextResponse.json({ error: 'Ollama se conecta directamente desde el navegador, no a través del servidor' }, { status: 400 });
    }

    // Verify workspace membership when requesting context
    if (workspaceId && !isPersonalWorkspaceId(workspaceId)) {
      const isMember = await isWorkspaceMember(workspaceId, auth.uid);
      if (!isMember) {
        return NextResponse.json({ error: 'No tienes acceso a este workspace' }, { status: 403 });
      }
    }

    const contextPrompt = workspaceId ? await buildContextPrompt(workspaceId) : '';

    const systemContent = [
      'Eres un asistente inteligente de Agora, una plataforma educativa colaborativa con lógica formal.',
      'Responde de forma clara, concisa y útil. Puedes usar Markdown.',
      contextPrompt
    ].filter(Boolean).join('\n\n');

    const fullMessages: ChatMessage[] = [
      { role: 'system', content: systemContent },
      ...messages.filter(m => m.role !== 'system')
    ];

    let reply = '';

    switch (provider) {
      case 'openai':
        if (!apiKey) return NextResponse.json({ error: 'API key requerida para OpenAI' }, { status: 400 });
        reply = await callOpenAI(fullMessages, apiKey, model || 'gpt-4o-mini');
        break;
      case 'anthropic':
        if (!apiKey) return NextResponse.json({ error: 'API key requerida para Anthropic' }, { status: 400 });
        reply = await callAnthropic(fullMessages, apiKey, model || 'claude-3-5-haiku-20241022');
        break;
      case 'gemini':
        if (!apiKey) return NextResponse.json({ error: 'API key requerida para Gemini' }, { status: 400 });
        reply = await callGemini(fullMessages, apiKey, model || 'gemini-2.0-flash');
        break;
      default:
        return NextResponse.json({ error: `Proveedor desconocido: ${provider}` }, { status: 400 });
    }

    return NextResponse.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
