import { NextRequest } from 'next/server';
import { requireAuth, isWorkspaceMember, getTokenFromRequest } from '@/lib/server-auth';
import { buildAgoraWorkspaceContext } from '@/lib/agora-ai/context';
import { runProviderConversation } from '@/lib/agora-ai/providerAdapters';
import type { AgentMode, AgentRequestBody, AgentStreamEvent, AIProvider } from '@/lib/agora-ai/types';
import { isPersonalWorkspaceId, PERSONAL_WORKSPACE_ID } from '@/types/workspace';

export const runtime = 'nodejs';
export const maxDuration = 60;

const DEFAULT_MODELS: Record<Exclude<AIProvider, 'ollama'>, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5-20251001',
  gemini: 'gemini-2.0-flash',
  deepseek: 'deepseek-v4-flash'
};

function encodeEvent(encoder: TextEncoder, payload: AgentStreamEvent) {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth) {
    return new Response('No autorizado', { status: 401 });
  }

  let body: AgentRequestBody;
  try {
    body = await request.json() as AgentRequestBody;
  } catch {
    return new Response('JSON inválido', { status: 400 });
  }

  const {
    messages,
    workspaceId = PERSONAL_WORKSPACE_ID,
    provider,
    apiKey = '',
    model = '',
    mode = 'agent'
  } = body;

  const effectiveMode: AgentMode = mode === 'chat' ? 'chat' : 'agent';

  if (!messages?.length) {
    return new Response('messages is required', { status: 400 });
  }
  if (!provider) {
    return new Response('provider is required', { status: 400 });
  }
  if (provider === 'ollama') {
    return new Response('Ollama se conecta directamente desde el navegador', { status: 400 });
  }
  if (!apiKey) {
    return new Response(`API key requerida para ${provider}`, { status: 400 });
  }

  if (workspaceId && !isPersonalWorkspaceId(workspaceId)) {
    const isMember = await isWorkspaceMember(workspaceId, auth.uid);
    if (!isMember) {
      return new Response('No tienes acceso a este workspace', { status: 403 });
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (payload: AgentStreamEvent) => {
        if (closed) return;
        controller.enqueue(encodeEvent(encoder, payload));
      };

      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(': keep-alive\n\n'));
      }, 15000);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepAlive);
        controller.close();
      };

      request.signal.addEventListener('abort', close, { once: true });

      void (async () => {
        try {
          send({ type: 'connected' });
          send({ type: 'status', status: 'Preparando contexto del workspace…' });

          const contextPrompt = workspaceId ? await buildAgoraWorkspaceContext(workspaceId) : '';
          const agentRun = await runProviderConversation({
            provider,
            apiKey,
            model: model || DEFAULT_MODELS[provider],
            messages: messages.filter(message => message.role !== 'system'),
            contextPrompt,
            mode: effectiveMode,
            executionContext: {
              workspaceId,
              uid: auth.uid,
              email: auth.email,
              origin: request.nextUrl.origin,
              authToken: getTokenFromRequest(request) ?? undefined
            },
            callbacks: {
              onStatus: async (status) => send({ type: 'status', status }),
              onStep: async (step) => send({ type: 'step', step })
            }
          });

          send({ type: 'complete', reply: agentRun.finalReply, agentRun });
          close();
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          send({ type: 'error', error: message });
          close();
        }
      })();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    }
  });
}
