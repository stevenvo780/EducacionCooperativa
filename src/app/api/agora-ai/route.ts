/**
 * POST /api/agora-ai
 *
 * Multi-provider AI chat/agent proxy with Firebase workspace context injection.
 * Supports: OpenAI (ChatGPT), Anthropic (Claude), Google Gemini.
 * Ollama keeps a direct browser flow because it is commonly deployed locally.
 *
 * API keys are sent from the client (stored in localStorage) and never persisted server-side.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isWorkspaceMember } from '@/lib/server-auth';
import { runProviderConversation } from '@/lib/agora-ai/providerAdapters';
import { buildAgoraWorkspaceContext } from '@/lib/agora-ai/context';
import type { AgentMode, AgentRequestBody } from '@/lib/agora-ai/types';
import { isPersonalWorkspaceId, PERSONAL_WORKSPACE_ID } from '@/types/workspace';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Require authenticated user
    const auth = await requireAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json() as AgentRequestBody;
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

    const contextPrompt = workspaceId ? await buildAgoraWorkspaceContext(workspaceId) : '';
    const defaults: Record<'openai' | 'anthropic' | 'gemini', string> = {
      openai: 'gpt-4o-mini',
      anthropic: 'claude-haiku-4-5-20251001',
      gemini: 'gemini-2.0-flash'
    };

    if (!apiKey) {
      return NextResponse.json({ error: `API key requerida para ${provider}` }, { status: 400 });
    }

    const agentRun = await runProviderConversation({
      provider,
      apiKey,
      model: model || defaults[provider],
      messages: messages.filter(message => message.role !== 'system'),
      contextPrompt,
      mode: effectiveMode,
      executionContext: {
        workspaceId,
        uid: auth.uid,
        email: auth.email,
        origin: request.nextUrl.origin
      }
    });

    return NextResponse.json({ reply: agentRun.finalReply, agentRun });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
