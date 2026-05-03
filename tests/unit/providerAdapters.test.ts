import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentExecutionContext, AgentToolCall, AgentToolExecutionResult } from '@/lib/agora-ai/types';
import { PERSONAL_WORKSPACE_ID } from '@/types/workspace';

const executorMocks = vi.hoisted(() => ({
  executeAgentTool: vi.fn()
}));

vi.mock('@/lib/agora-ai/toolExecutor', () => ({
  executeAgentTool: executorMocks.executeAgentTool
}));

const ctx: AgentExecutionContext = {
  workspaceId: PERSONAL_WORKSPACE_ID,
  uid: 'u1',
  email: 'u1@example.test',
  origin: 'https://app.test'
};

const okToolResult = (call: AgentToolCall, summary = `ok ${call.name}`): AgentToolExecutionResult => ({
  ok: true,
  name: call.name,
  callId: call.id,
  summary,
  data: { echoed: call.name },
  rollback: [{ action: 'noop', args: { tool: call.name } }]
});

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

describe('runProviderConversation', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    executorMocks.executeAgentTool.mockReset();
    executorMocks.executeAgentTool.mockImplementation(async (call: AgentToolCall) => okToolResult(call));
  });

  it('ejecuta tool calls OpenAI y continua hasta respuesta final', async () => {
    const { runProviderConversation } = await import('@/lib/agora-ai/providerAdapters');
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        choices: [{
          message: {
            content: 'Voy a revisar.',
            tool_calls: [{
              id: 'openai-tool-1',
              function: { name: 'list_documents', arguments: '{"limit":2}' }
            }]
          }
        }]
      }))
      .mockResolvedValueOnce(jsonResponse({
        choices: [{ message: { content: 'Listo con documentos.' } }]
      }));

    const run = await runProviderConversation({
      provider: 'openai',
      apiKey: 'key',
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'lista docs' }],
      mode: 'agent',
      executionContext: ctx
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(executorMocks.executeAgentTool).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'openai-tool-1', name: 'list_documents', args: { limit: 2 } }),
      ctx
    );
    expect(run.finalReply).toBe('Listo con documentos.');
    expect(run.rollback?.[0]?.action).toBe('noop');
    expect(run.steps.some((step) => step.type === 'tool_call')).toBe(true);
    expect(run.steps.some((step) => step.type === 'tool_result')).toBe(true);
  });

  it('aisla fallos individuales de herramientas en ejecucion paralela', async () => {
    const { runProviderConversation } = await import('@/lib/agora-ai/providerAdapters');
    executorMocks.executeAgentTool.mockImplementation(async (call: AgentToolCall) => {
      if (call.name === 'bad_tool') throw new Error('boom');
      return okToolResult(call, 'tool buena');
    });
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        choices: [{
          message: {
            content: '',
            tool_calls: [
              { id: 'good', function: { name: 'list_documents', arguments: '{}' } },
              { id: 'bad', function: { name: 'bad_tool', arguments: '{}' } }
            ]
          }
        }]
      }))
      .mockResolvedValueOnce(jsonResponse({
        choices: [{ message: { content: 'Final pese al fallo.' } }]
      }));

    const run = await runProviderConversation({
      provider: 'openai',
      apiKey: 'key',
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'usa tools' }],
      mode: 'agent',
      executionContext: ctx
    });

    const errorStep = run.steps.find((step) => step.type === 'error');
    expect(errorStep?.result?.ok).toBe(false);
    expect(errorStep?.result?.summary).toContain('boom');
    expect(run.finalReply).toBe('Final pese al fallo.');
  });

  it('propaga errores estructurados del proveedor', async () => {
    const { runProviderConversation } = await import('@/lib/agora-ai/providerAdapters');
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { message: 'quota exceeded' } }, 429));

    await expect(runProviderConversation({
      provider: 'openai',
      apiKey: 'key',
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'hola' }],
      mode: 'chat',
      executionContext: ctx
    })).rejects.toThrow('OpenAI 429: quota exceeded');
  });

  it('soporta tool loop de Anthropic', async () => {
    const { runProviderConversation } = await import('@/lib/agora-ai/providerAdapters');
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        content: [
          { type: 'text', text: 'Uso una herramienta.' },
          { type: 'tool_use', id: 'anthropic-tool-1', name: 'list_documents', input: { limit: 1 } }
        ],
        stop_reason: 'tool_use'
      }))
      .mockResolvedValueOnce(jsonResponse({
        content: [{ type: 'text', text: 'Respuesta Anthropic final.' }],
        stop_reason: 'end_turn'
      }));

    const run = await runProviderConversation({
      provider: 'anthropic',
      apiKey: 'key',
      model: 'claude-haiku-test',
      messages: [{ role: 'user', content: 'lista' }],
      mode: 'agent',
      executionContext: ctx
    });

    expect(executorMocks.executeAgentTool).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'anthropic-tool-1', name: 'list_documents', args: { limit: 1 } }),
      ctx
    );
    expect(run.finalReply).toBe('Respuesta Anthropic final.');
  });

  it('soporta function calls de Gemini', async () => {
    const { runProviderConversation } = await import('@/lib/agora-ai/providerAdapters');
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        candidates: [{
          content: {
            parts: [
              { text: 'Voy.' },
              { functionCall: { name: 'list_documents', args: { limit: 3 } } }
            ]
          }
        }]
      }))
      .mockResolvedValueOnce(jsonResponse({
        candidates: [{ content: { parts: [{ text: 'Respuesta Gemini final.' }] } }]
      }));

    const run = await runProviderConversation({
      provider: 'gemini',
      apiKey: 'key',
      model: 'gemini-test',
      messages: [{ role: 'user', content: 'lista' }],
      mode: 'agent',
      executionContext: ctx
    });

    expect(executorMocks.executeAgentTool).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'list_documents', args: { limit: 3 } }),
      ctx
    );
    expect(run.finalReply).toBe('Respuesta Gemini final.');
  });
});
