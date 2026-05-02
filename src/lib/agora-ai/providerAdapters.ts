import { buildAgoraSystemPrompt, extractThinkingSegments } from '@/lib/agora-ai/systemPrompt';
import { toAnthropicTools, toGeminiTools, toOpenAITools } from '@/lib/agora-ai/toolDefinitions';
import { executeAgentTool } from '@/lib/agora-ai/toolExecutor';
import type {
  AgentExecutionContext,
  AgentMode,
  AgentRun,
  AgentRollbackAction,
  AgentToolCall,
  AgentTraceStep,
  AgentToolExecutionResult,
  AIProvider,
  ChatMessage
} from '@/lib/agora-ai/types';

const MAX_AGENT_ITERATIONS = 10;

interface ProviderRunCallbacks {
  onStep?: (step: AgentTraceStep) => void | Promise<void>;
  onStatus?: (status: string) => void | Promise<void>;
}

interface ProviderRunOptions {
  provider: Exclude<AIProvider, 'ollama'>;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  contextPrompt?: string;
  mode: AgentMode;
  executionContext: AgentExecutionContext;
  callbacks?: ProviderRunCallbacks;
}

type OpenAIToolCall = {
  id: string;
  function?: {
    name?: string;
    arguments?: string;
  };
};

type AnthropicBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

type GeminiPart = {
  text?: string;
  functionCall?: {
    name?: string;
    args?: Record<string, unknown>;
  };
};

const createStep = (step: Omit<AgentTraceStep, 'startedAt'>): AgentTraceStep => ({
  ...step,
  startedAt: Date.now(),
  finishedAt: Date.now()
});

const safeJsonParse = (value: string | undefined): Record<string, unknown> => {
  if (!value?.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

const stringifyToolResult = (result: unknown) => JSON.stringify(result, null, 2);

/**
 * Parse structured error bodies from AI provider APIs and return a
 * user-friendly Spanish message that includes rate-limit / quota hints.
 */
async function parseProviderError(provider: string, status: number, body: string): Promise<string> {
  const hint =
    status === 401 ? ' — API key inválida o expirada.' :
    status === 429 ? ' — límite de peticiones alcanzado, espera unos segundos.' :
    status === 402 || status === 403 ? ' — cuota agotada o sin créditos.' :
    '';
  try {
    const data = JSON.parse(body) as Record<string, unknown>;
    const err = data.error as Record<string, string> | undefined;
    if (err?.message) return `${provider} ${status}: ${err.message}${hint}`;
  } catch { /* not JSON */ }
  return `${provider} ${status}: ${body.slice(0, 300)}${hint}`;
}

function createEmitters(steps: AgentTraceStep[], callbacks?: ProviderRunCallbacks) {
  return {
    emitStatus: async (status: string) => {
      await callbacks?.onStatus?.(status);
    },
    emitStep: async (step: AgentTraceStep) => {
      steps.push(step);
      await callbacks?.onStep?.(step);
    }
  };
}

async function collectTextAndThinking(
  rawContent: string,
  emitStep: (step: AgentTraceStep) => Promise<void>
) {
  const { thinking, visible } = extractThinkingSegments(rawContent || '');
  if (thinking) {
    await emitStep(createStep({
      id: `thinking-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'thinking',
      title: 'Razonamiento del agente',
      content: thinking
    }));
  }
  if (visible) {
    await emitStep(createStep({
      id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'plan',
      title: 'Plan / respuesta intermedia',
      content: visible
    }));
  }
  return visible;
}

/**
 * Execute all tool calls concurrently and return results in the original order.
 * Using Promise.allSettled so an individual tool failure never blocks the others.
 */
async function executeToolsParallel(
  toolCalls: AgentToolCall[],
  executionContext: AgentExecutionContext
): Promise<Array<{ toolCall: AgentToolCall; result: AgentToolExecutionResult }>> {
  const settled = await Promise.allSettled(
    toolCalls.map(tc => executeAgentTool(tc, executionContext))
  );
  return settled.map((item, i) => {
    const toolCall = toolCalls[i];
    if (item.status === 'fulfilled') return { toolCall, result: item.value };
    return {
      toolCall,
      result: {
        ok: false,
        name: toolCall.name,
        callId: toolCall.id,
        summary: `Error inesperado ejecutando ${toolCall.name}: ${String(item.reason)}`,
        error: String(item.reason)
      } as AgentToolExecutionResult
    };
  });
}

async function runOpenAI(options: ProviderRunOptions): Promise<AgentRun> {
  const steps: AgentTraceStep[] = [];
  const rollback: AgentRollbackAction[] = [];
  const { emitStatus, emitStep } = createEmitters(steps, options.callbacks);
  const systemPrompt = buildAgoraSystemPrompt({
    mode: options.mode,
    contextPrompt: options.contextPrompt,
    workspaceId: options.executionContext.workspaceId
  });

  const messages: Array<Record<string, unknown>> = [
    { role: 'system', content: systemPrompt },
    ...options.messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content }))
  ];

  let finalReply = '';
  let iterations = 0;
  let pendingConfirmation: AgentRun['pendingConfirmation'];

  for (iterations = 1; iterations <= MAX_AGENT_ITERATIONS; iterations += 1) {
    await emitStatus(`Consultando ${options.provider} (${iterations}/${MAX_AGENT_ITERATIONS})…`);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.apiKey}`
      },
      body: JSON.stringify({
        model: options.model,
        messages,
        max_tokens: 8192,
        ...(options.mode === 'agent'
          ? { tools: toOpenAITools(), tool_choice: 'auto' }
          : {})
      })
    });

    if (!res.ok) {
      throw new Error(await parseProviderError('OpenAI', res.status, await res.text()));
    }

    const data = await res.json() as {
      choices?: Array<{
        message?: { content?: string | null; tool_calls?: OpenAIToolCall[] };
        finish_reason?: string;
      }>;
    };

    const choice = data.choices?.[0];
    const message = choice?.message;
    const rawContent = message?.content ?? '';
    const visibleContent = await collectTextAndThinking(rawContent, emitStep);
    const toolCalls = (message?.tool_calls ?? []).map((call): AgentToolCall => ({
      id: call.id,
      name: call.function?.name ?? 'unknown_tool',
      args: safeJsonParse(call.function?.arguments)
    }));

    if (choice?.finish_reason === 'length') {
      finalReply = visibleContent || 'La respuesta fue cortada por el límite de tokens. Simplifica tu solicitud.';
      break;
    }
    if (!toolCalls.length || options.mode !== 'agent') {
      finalReply = visibleContent || finalReply || 'Listo.';
      break;
    }

    // Push assistant turn (before executing tools)
    messages.push({
      role: 'assistant',
      content: rawContent || null,
      tool_calls: toolCalls.map(call => ({
        id: call.id,
        type: 'function',
        function: { name: call.name, arguments: JSON.stringify(call.args) }
      }))
    });

    // Announce & execute all tools concurrently
    await emitStatus(
      toolCalls.length > 1
        ? `Ejecutando ${toolCalls.length} herramientas en paralelo…`
        : `Ejecutando ${toolCalls[0].name}…`
    );
    for (const tc of toolCalls) {
      await emitStep(createStep({
        id: `call-${tc.id}`, type: 'tool_call',
        title: `Ejecutando ${tc.name}`, call: tc
      }));
    }

    const toolResults = await executeToolsParallel(toolCalls, options.executionContext);

    for (const { toolCall, result } of toolResults) {
      if (result.rollback?.length) rollback.push(...result.rollback);
      await emitStep(createStep({
        id: `result-${toolCall.id}`,
        type: result.ok ? 'tool_result' : 'error',
        title: result.ok ? `Resultado de ${toolCall.name}` : `Error en ${toolCall.name}`,
        result,
        content: result.summary
      }));
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: stringifyToolResult(result)
      });
      if (result.requiresConfirmation && result.pendingConfirmation && !pendingConfirmation) {
        pendingConfirmation = result.pendingConfirmation;
      }
    }

    if (pendingConfirmation) {
      finalReply = visibleContent || toolResults[0].result.summary;
      return {
        mode: options.mode, provider: options.provider,
        iterations, steps, finalReply, pendingConfirmation, rollback
      };
    }
  }

  if (!finalReply) finalReply = 'Se completó la ejecución del agente.';

  await emitStep(createStep({
    id: `final-${steps.length + 1}`,
    type: 'final', title: 'Respuesta final', content: finalReply
  }));

  return { mode: options.mode, provider: options.provider, iterations, steps, finalReply, rollback };
}

/**
 * Models that support native extended thinking (interleaved with tool calls).
 * Haiku models currently do NOT support it.
 */
const supportsNativeThinking = (model: string) =>
  model.includes('sonnet') || model.includes('opus');

async function runAnthropic(options: ProviderRunOptions): Promise<AgentRun> {
  const steps: AgentTraceStep[] = [];
  const rollback: AgentRollbackAction[] = [];
  const { emitStatus, emitStep } = createEmitters(steps, options.callbacks);
  const systemPrompt = buildAgoraSystemPrompt({
    mode: options.mode,
    contextPrompt: options.contextPrompt,
    workspaceId: options.executionContext.workspaceId
  });

  const useNativeThinking = supportsNativeThinking(options.model) && options.mode === 'agent';
  // Sonnet/Opus support up to 64K output; cap at 16K (thinking budget + visible headroom).
  const maxTokens = useNativeThinking ? 16000 : 8192;

  const messages: Array<{ role: 'user' | 'assistant'; content: string | AnthropicBlock[] }> =
    options.messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

  let finalReply = '';
  let iterations = 0;
  let pendingConfirmation: AgentRun['pendingConfirmation'];

  for (iterations = 1; iterations <= MAX_AGENT_ITERATIONS; iterations += 1) {
    await emitStatus(`Consultando ${options.provider} (${iterations}/${MAX_AGENT_ITERATIONS})…`);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': options.apiKey,
        'anthropic-version': '2023-06-01',
        ...(useNativeThinking ? { 'anthropic-beta': 'interleaved-thinking-2025-05-14' } : {})
      },
      body: JSON.stringify({
        model: options.model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
        ...(options.mode === 'agent' ? { tools: toAnthropicTools() } : {}),
        ...(useNativeThinking
          ? { thinking: { type: 'enabled', budget_tokens: 10000 } }
          : {})
      })
    });

    if (!res.ok) {
      throw new Error(await parseProviderError('Anthropic', res.status, await res.text()));
    }

    const data = await res.json() as { content?: AnthropicBlock[]; stop_reason?: string };
    const blocks = data.content ?? [];

    let visibleContent: string;

    if (useNativeThinking) {
      // Native thinking blocks — emit directly without XML tag parsing
      const nativeThinking = blocks
        .filter((b): b is Extract<AnthropicBlock, { type: 'thinking' }> => b.type === 'thinking')
        .map(b => b.thinking)
        .join('\n')
        .trim();
      const text = blocks
        .filter((b): b is Extract<AnthropicBlock, { type: 'text' }> => b.type === 'text')
        .map(b => b.text)
        .join('\n')
        .trim();

      if (nativeThinking) {
        await emitStep(createStep({
          id: `thinking-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: 'thinking', title: 'Razonamiento del agente', content: nativeThinking
        }));
      }
      visibleContent = text;
      if (visibleContent) {
        await emitStep(createStep({
          id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: 'plan', title: 'Plan / respuesta intermedia', content: visibleContent
        }));
      }
    } else {
      // Fallback: parse <thinking>...</thinking> tags from text content
      const text = blocks
        .filter((b): b is Extract<AnthropicBlock, { type: 'text' }> => b.type === 'text')
        .map(b => b.text)
        .join('\n')
        .trim();
      visibleContent = await collectTextAndThinking(text, emitStep);
    }

    if (data.stop_reason === 'max_tokens') {
      finalReply = visibleContent || 'La respuesta fue cortada por el límite de tokens. Simplifica tu solicitud.';
      break;
    }

    const toolCalls = blocks
      .filter((b): b is Extract<AnthropicBlock, { type: 'tool_use' }> => b.type === 'tool_use')
      .map(b => ({ id: b.id, name: b.name, args: b.input }));

    if (!toolCalls.length || options.mode !== 'agent') {
      finalReply = visibleContent || finalReply || 'Listo.';
      break;
    }

    // Push full assistant turn — MUST include thinking blocks verbatim for
    // the model to maintain reasoning continuity across turns.
    messages.push({ role: 'assistant', content: blocks });

    // Announce & execute all tools concurrently
    await emitStatus(
      toolCalls.length > 1
        ? `Ejecutando ${toolCalls.length} herramientas en paralelo…`
        : `Ejecutando ${toolCalls[0].name}…`
    );
    for (const tc of toolCalls) {
      await emitStep(createStep({
        id: `call-${tc.id}`, type: 'tool_call',
        title: `Ejecutando ${tc.name}`, call: tc
      }));
    }

    const toolResults = await executeToolsParallel(toolCalls, options.executionContext);
    const toolResultBlocks: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];

    for (const { toolCall, result } of toolResults) {
      if (result.rollback?.length) rollback.push(...result.rollback);
      await emitStep(createStep({
        id: `result-${toolCall.id}`,
        type: result.ok ? 'tool_result' : 'error',
        title: result.ok ? `Resultado de ${toolCall.name}` : `Error en ${toolCall.name}`,
        result,
        content: result.summary
      }));
      toolResultBlocks.push({
        type: 'tool_result',
        tool_use_id: toolCall.id,
        content: stringifyToolResult(result)
      });
      if (result.requiresConfirmation && result.pendingConfirmation && !pendingConfirmation) {
        pendingConfirmation = result.pendingConfirmation;
      }
    }

    messages.push({ role: 'user', content: toolResultBlocks });

    if (pendingConfirmation) {
      finalReply = visibleContent || toolResults[0].result.summary;
      return {
        mode: options.mode, provider: options.provider,
        iterations, steps, finalReply, pendingConfirmation, rollback
      };
    }
  }

  if (!finalReply) finalReply = 'Se completó la ejecución del agente.';

  await emitStep(createStep({
    id: `final-${steps.length + 1}`,
    type: 'final', title: 'Respuesta final', content: finalReply
  }));

  return { mode: options.mode, provider: options.provider, iterations, steps, finalReply, rollback };
}

async function runGemini(options: ProviderRunOptions): Promise<AgentRun> {
  const steps: AgentTraceStep[] = [];
  const rollback: AgentRollbackAction[] = [];
  const { emitStatus, emitStep } = createEmitters(steps, options.callbacks);
  const systemPrompt = buildAgoraSystemPrompt({
    mode: options.mode,
    contextPrompt: options.contextPrompt,
    workspaceId: options.executionContext.workspaceId
  });

  const contents: Array<{ role: 'user' | 'model'; parts: Array<Record<string, unknown>> }> =
    options.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

  let finalReply = '';
  let iterations = 0;
  let pendingConfirmation: AgentRun['pendingConfirmation'];

  for (iterations = 1; iterations <= MAX_AGENT_ITERATIONS; iterations += 1) {
    await emitStatus(`Consultando ${options.provider} (${iterations}/${MAX_AGENT_ITERATIONS})…`);

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent?key=${options.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: 8192 },
          ...(options.mode === 'agent' ? { tools: toGeminiTools() } : {})
        })
      }
    );

    if (!res.ok) {
      throw new Error(await parseProviderError('Gemini', res.status, await res.text()));
    }

    const data = await res.json() as {
      candidates?: Array<{
        content?: { parts?: GeminiPart[] };
        finishReason?: string;
      }>;
    };

    const candidate = data.candidates?.[0];
    const finishReason = candidate?.finishReason;
    if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
      finalReply = finalReply || 'Respuesta bloqueada por las políticas de seguridad de Gemini.';
      break;
    }

    const parts = candidate?.content?.parts ?? [];
    const text = parts.map(p => p.text || '').join('\n').trim();
    const visibleContent = await collectTextAndThinking(text, emitStep);

    const toolCalls = parts
      .filter(p => p.functionCall?.name)
      .map((p, index): AgentToolCall => ({
        id: `gemini-call-${iterations}-${index + 1}`,
        name: p.functionCall?.name || 'unknown_tool',
        args: p.functionCall?.args || {}
      }));

    if (!toolCalls.length || options.mode !== 'agent') {
      finalReply = visibleContent || finalReply || 'Listo.';
      break;
    }

    // Push model turn (includes function call parts)
    contents.push({ role: 'model', parts: parts as Array<Record<string, unknown>> });

    // Announce & execute all tools concurrently
    await emitStatus(
      toolCalls.length > 1
        ? `Ejecutando ${toolCalls.length} herramientas en paralelo…`
        : `Ejecutando ${toolCalls[0].name}…`
    );
    for (const tc of toolCalls) {
      await emitStep(createStep({
        id: `call-${tc.id}`, type: 'tool_call',
        title: `Ejecutando ${tc.name}`, call: tc
      }));
    }

    const toolResults = await executeToolsParallel(toolCalls, options.executionContext);
    const functionResponses: Array<Record<string, unknown>> = [];

    for (const { toolCall, result } of toolResults) {
      if (result.rollback?.length) rollback.push(...result.rollback);
      await emitStep(createStep({
        id: `result-${toolCall.id}`,
        type: result.ok ? 'tool_result' : 'error',
        title: result.ok ? `Resultado de ${toolCall.name}` : `Error en ${toolCall.name}`,
        result,
        content: result.summary
      }));
      functionResponses.push({
        functionResponse: { name: toolCall.name, response: result }
      });
      if (result.requiresConfirmation && result.pendingConfirmation && !pendingConfirmation) {
        pendingConfirmation = result.pendingConfirmation;
      }
    }

    contents.push({ role: 'user', parts: functionResponses });

    if (pendingConfirmation) {
      finalReply = visibleContent || toolResults[0].result.summary;
      return {
        mode: options.mode, provider: options.provider,
        iterations, steps, finalReply, pendingConfirmation, rollback
      };
    }
  }

  if (!finalReply) finalReply = 'Se completó la ejecución del agente.';

  await emitStep(createStep({
    id: `final-${steps.length + 1}`,
    type: 'final', title: 'Respuesta final', content: finalReply
  }));

  return { mode: options.mode, provider: options.provider, iterations, steps, finalReply, rollback };
}

export async function runProviderConversation(options: ProviderRunOptions): Promise<AgentRun> {
  switch (options.provider) {
    case 'openai': return runOpenAI(options);
    case 'anthropic': return runAnthropic(options);
    case 'gemini': return runGemini(options);
    default:
      throw new Error(`Proveedor no soportado por el servidor: ${options.provider}`);
  }
}
