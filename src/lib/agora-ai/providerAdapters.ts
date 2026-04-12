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

async function collectTextAndThinking(rawContent: string, emitStep: (step: AgentTraceStep) => Promise<void>) {
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
    ...options.messages.filter(message => message.role !== 'system').map(message => ({
      role: message.role,
      content: message.content
    }))
  ];

  let finalReply = '';
  let iterations = 0;
  let pendingConfirmation: AgentRun['pendingConfirmation'];

  for (iterations = 1; iterations <= MAX_AGENT_ITERATIONS; iterations += 1) {
    await emitStatus(`Consultando ${options.provider} (${iterations}/${MAX_AGENT_ITERATIONS})…`);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.apiKey}`
      },
      body: JSON.stringify({
        model: options.model,
        messages,
        max_tokens: 2048,
        ...(options.mode === 'agent'
          ? { tools: toOpenAITools(), tool_choice: 'auto' }
          : {})
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
    }

    const data = await response.json() as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: OpenAIToolCall[];
        };
      }>;
    };

    const message = data.choices?.[0]?.message;
    const rawContent = message?.content ?? '';
    const visibleContent = await collectTextAndThinking(rawContent, emitStep);
    const toolCalls = (message?.tool_calls ?? []).map((call): AgentToolCall => ({
      id: call.id,
      name: call.function?.name ?? 'unknown_tool',
      args: safeJsonParse(call.function?.arguments)
    }));

    if (!toolCalls.length || options.mode !== 'agent') {
      finalReply = visibleContent || finalReply || 'Listo.';
      break;
    }

    messages.push({
      role: 'assistant',
      content: rawContent,
      tool_calls: toolCalls.map(call => ({
        id: call.id,
        type: 'function',
        function: {
          name: call.name,
          arguments: JSON.stringify(call.args)
        }
      }))
    });

    for (const toolCall of toolCalls) {
      await emitStatus(`Ejecutando ${toolCall.name}…`);
      await emitStep(createStep({
        id: `call-${toolCall.id}`,
        type: 'tool_call',
        title: `Ejecutando ${toolCall.name}`,
        call: toolCall
      }));
      const result = await executeAgentTool(toolCall, options.executionContext);
      if (result.rollback?.length) {
        rollback.push(...result.rollback);
      }
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
      if (result.requiresConfirmation && result.pendingConfirmation) {
        pendingConfirmation = result.pendingConfirmation;
        finalReply = visibleContent || result.summary;
        return {
          mode: options.mode,
          provider: options.provider,
          iterations,
          steps,
          finalReply,
          pendingConfirmation,
          rollback
        };
      }
    }
  }

  if (!finalReply) {
    finalReply = 'Se completó la ejecución del agente.';
  }

  await emitStep(createStep({
    id: `final-${steps.length + 1}`,
    type: 'final',
    title: 'Respuesta final',
    content: finalReply
  }));

  return {
    mode: options.mode,
    provider: options.provider,
    iterations,
    steps,
    finalReply,
    rollback
  };
}

async function runAnthropic(options: ProviderRunOptions): Promise<AgentRun> {
  const steps: AgentTraceStep[] = [];
  const rollback: AgentRollbackAction[] = [];
  const { emitStatus, emitStep } = createEmitters(steps, options.callbacks);
  const systemPrompt = buildAgoraSystemPrompt({
    mode: options.mode,
    contextPrompt: options.contextPrompt,
    workspaceId: options.executionContext.workspaceId
  });

  const messages: Array<{ role: 'user' | 'assistant'; content: string | AnthropicBlock[] }> = options.messages
    .filter(message => message.role !== 'system')
    .map(message => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: message.content }));

  let finalReply = '';
  let iterations = 0;
  let pendingConfirmation: AgentRun['pendingConfirmation'];

  for (iterations = 1; iterations <= MAX_AGENT_ITERATIONS; iterations += 1) {
    await emitStatus(`Consultando ${options.provider} (${iterations}/${MAX_AGENT_ITERATIONS})…`);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': options.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: options.model,
        max_tokens: 2048,
        system: systemPrompt,
        messages,
        ...(options.mode === 'agent' ? { tools: toAnthropicTools() } : {})
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic ${response.status}: ${await response.text()}`);
    }

    const data = await response.json() as { content?: AnthropicBlock[] };
    const blocks = data.content ?? [];
    const text = blocks
      .filter((block): block is Extract<AnthropicBlock, { type: 'text' }> => block.type === 'text')
      .map(block => block.text)
      .join('\n')
      .trim();
    const visibleContent = await collectTextAndThinking(text, emitStep);
    const toolCalls = blocks
      .filter((block): block is Extract<AnthropicBlock, { type: 'tool_use' }> => block.type === 'tool_use')
      .map(block => ({ id: block.id, name: block.name, args: block.input }));

    if (!toolCalls.length || options.mode !== 'agent') {
      finalReply = visibleContent || finalReply || 'Listo.';
      break;
    }

    messages.push({ role: 'assistant', content: blocks });
    const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];

    for (const toolCall of toolCalls) {
      await emitStatus(`Ejecutando ${toolCall.name}…`);
      await emitStep(createStep({
        id: `call-${toolCall.id}`,
        type: 'tool_call',
        title: `Ejecutando ${toolCall.name}`,
        call: toolCall
      }));
      const result = await executeAgentTool(toolCall, options.executionContext);
      if (result.rollback?.length) {
        rollback.push(...result.rollback);
      }
      await emitStep(createStep({
        id: `result-${toolCall.id}`,
        type: result.ok ? 'tool_result' : 'error',
        title: result.ok ? `Resultado de ${toolCall.name}` : `Error en ${toolCall.name}`,
        result,
        content: result.summary
      }));
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolCall.id,
        content: stringifyToolResult(result)
      });
      if (result.requiresConfirmation && result.pendingConfirmation) {
        pendingConfirmation = result.pendingConfirmation;
        finalReply = visibleContent || result.summary;
        return {
          mode: options.mode,
          provider: options.provider,
          iterations,
          steps,
          finalReply,
          pendingConfirmation,
          rollback
        };
      }
    }

    messages.push({ role: 'user', content: toolResults });
  }

  if (!finalReply) {
    finalReply = 'Se completó la ejecución del agente.';
  }

  await emitStep(createStep({
    id: `final-${steps.length + 1}`,
    type: 'final',
    title: 'Respuesta final',
    content: finalReply
  }));

  return {
    mode: options.mode,
    provider: options.provider,
    iterations,
    steps,
    finalReply,
    rollback
  };
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

  const contents: Array<{ role: 'user' | 'model'; parts: Array<Record<string, unknown>> }> = options.messages
    .filter(message => message.role !== 'system')
    .map(message => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }]
    }));

  let finalReply = '';
  let iterations = 0;
  let pendingConfirmation: AgentRun['pendingConfirmation'];

  for (iterations = 1; iterations <= MAX_AGENT_ITERATIONS; iterations += 1) {
    await emitStatus(`Consultando ${options.provider} (${iterations}/${MAX_AGENT_ITERATIONS})…`);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent?key=${options.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          ...(options.mode === 'agent' ? { tools: toGeminiTools() } : {})
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini ${response.status}: ${await response.text()}`);
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: GeminiPart[];
        };
      }>;
    };

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map(part => part.text || '').join('\n').trim();
    const visibleContent = await collectTextAndThinking(text, emitStep);
    const toolCalls = parts
      .filter(part => part.functionCall?.name)
      .map((part, index): AgentToolCall => ({
        id: `gemini-call-${iterations}-${index + 1}`,
        name: part.functionCall?.name || 'unknown_tool',
        args: part.functionCall?.args || {}
      }));

    if (!toolCalls.length || options.mode !== 'agent') {
      finalReply = visibleContent || finalReply || 'Listo.';
      break;
    }

    contents.push({ role: 'model', parts: parts as Array<Record<string, unknown>> });
    const functionResponses: Array<Record<string, unknown>> = [];

    for (const toolCall of toolCalls) {
      await emitStatus(`Ejecutando ${toolCall.name}…`);
      await emitStep(createStep({
        id: `call-${toolCall.id}`,
        type: 'tool_call',
        title: `Ejecutando ${toolCall.name}`,
        call: toolCall
      }));
      const result = await executeAgentTool(toolCall, options.executionContext);
      if (result.rollback?.length) {
        rollback.push(...result.rollback);
      }
      await emitStep(createStep({
        id: `result-${toolCall.id}`,
        type: result.ok ? 'tool_result' : 'error',
        title: result.ok ? `Resultado de ${toolCall.name}` : `Error en ${toolCall.name}`,
        result,
        content: result.summary
      }));
      functionResponses.push({
        functionResponse: {
          name: toolCall.name,
          response: result
        }
      });
      if (result.requiresConfirmation && result.pendingConfirmation) {
        pendingConfirmation = result.pendingConfirmation;
        finalReply = visibleContent || result.summary;
        return {
          mode: options.mode,
          provider: options.provider,
          iterations,
          steps,
          finalReply,
          pendingConfirmation,
          rollback
        };
      }
    }

    contents.push({ role: 'user', parts: functionResponses });
  }

  if (!finalReply) {
    finalReply = 'Se completó la ejecución del agente.';
  }

  await emitStep(createStep({
    id: `final-${steps.length + 1}`,
    type: 'final',
    title: 'Respuesta final',
    content: finalReply
  }));

  return {
    mode: options.mode,
    provider: options.provider,
    iterations,
    steps,
    finalReply,
    rollback
  };
}

export async function runProviderConversation(options: ProviderRunOptions): Promise<AgentRun> {
  switch (options.provider) {
    case 'openai':
      return runOpenAI(options);
    case 'anthropic':
      return runAnthropic(options);
    case 'gemini':
      return runGemini(options);
    default:
      throw new Error(`Proveedor no soportado por el servidor: ${options.provider}`);
  }
}
