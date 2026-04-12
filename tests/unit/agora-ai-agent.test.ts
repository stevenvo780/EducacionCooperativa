import { describe, expect, it } from 'vitest';
import { buildAgoraSystemPrompt, extractThinkingSegments } from '@/lib/agora-ai/systemPrompt';
import { collectAgentWorkspaceEffects } from '@/lib/agora-ai/uiEvents';
import {
  AGORA_AGENT_TOOLS,
  AGORA_AGENT_TOOL_NAMES,
  toAnthropicTools,
  toGeminiTools,
  toOllamaTools,
  toOpenAITools
} from '@/lib/agora-ai/toolDefinitions';
import { DocumentType } from '@/types/documents';

describe('agora ai agent prompt', () => {
  it('incluye instrucciones agénticas y contexto del workspace', () => {
    const prompt = buildAgoraSystemPrompt({
      mode: 'agent',
      workspaceId: 'workspace-demo',
      contextPrompt: '# Contexto\nDocumento importante'
    });

    expect(prompt).toContain('MODO AGENTE');
    expect(prompt).toContain('Workspace activo: workspace-demo');
    expect(prompt).toContain('Nunca elimines documentos sin confirmación explícita');
    expect(prompt).toContain('Documento importante');
  });

  it('reduce capacidades en modo chat', () => {
    const prompt = buildAgoraSystemPrompt({ mode: 'chat', workspaceId: 'personal' });
    expect(prompt).toContain('MODO CHAT');
    expect(prompt).not.toContain('Nunca elimines documentos');
  });

  it('extrae bloques thinking sin contaminar la respuesta visible', () => {
    const parsed = extractThinkingSegments('<thinking>1. Buscar docs\n2. Crear resumen</thinking>\n\nResumen listo');
    expect(parsed.thinking).toContain('Buscar docs');
    expect(parsed.visible).toBe('Resumen listo');
  });
});

describe('agora ai tools', () => {
  it('expone un catálogo de tools único y completo', () => {
    const uniqueNames = new Set(AGORA_AGENT_TOOL_NAMES);
    expect(uniqueNames.size).toBe(AGORA_AGENT_TOOL_NAMES.length);
    expect(AGORA_AGENT_TOOLS.length).toBeGreaterThanOrEqual(15);
    expect(AGORA_AGENT_TOOL_NAMES).toEqual(expect.arrayContaining([
      'list_documents',
      'read_document',
      'create_document',
      'update_document',
      'move_document',
      'delete_document',
      'search_documents',
      'create_snippet',
      'formalize_text'
    ]));
  });

  it('genera formatos compatibles para todos los proveedores', () => {
    const openAiTools = toOpenAITools();
    const anthropicTools = toAnthropicTools();
    const geminiTools = toGeminiTools();
    const ollamaTools = toOllamaTools();

    expect(openAiTools[0]).toHaveProperty('type', 'function');
    expect(openAiTools[0]?.function?.name).toBe(AGORA_AGENT_TOOL_NAMES[0]);
    expect(anthropicTools[0]?.name).toBe(AGORA_AGENT_TOOL_NAMES[0]);
    expect(geminiTools[0]?.functionDeclarations?.length).toBe(AGORA_AGENT_TOOLS.length);
    // Ollama uses the same OpenAI-compatible format
    expect(ollamaTools[0]).toHaveProperty('type', 'function');
    expect(ollamaTools[0]?.function?.name).toBe(AGORA_AGENT_TOOL_NAMES[0]);
  });
});

describe('agora ai workspace ui events', () => {
  it('extrae documentos abribles y mutaciones desde el agent run', () => {
    const effects = collectAgentWorkspaceEffects({
      mode: 'agent',
      provider: 'openai',
      iterations: 2,
      finalReply: 'Hecho',
      rollback: [],
      steps: [
        {
          id: 'result-1',
          type: 'tool_result',
          title: 'Resultado',
          startedAt: Date.now(),
          result: {
            ok: true,
            name: 'create_document',
            callId: 'call-1',
            summary: 'Creado',
            data: {
              document: {
                id: 'doc-1',
                name: 'Resumen.md',
                type: DocumentType.Text,
                folder: 'clase-1',
                content: '# Hola'
              }
            }
          }
        }
      ]
    }, 'workspace-1');

    expect(effects.openDocumentsEvent?.documents).toHaveLength(1);
    expect(effects.openDocumentsEvent?.documents[0]?.id).toBe('doc-1');
    expect(effects.openDocumentsEvent?.focusFolder).toBe('clase-1');
    expect(effects.mutatedEvent?.mutations).toHaveLength(1);
    expect(effects.mutatedEvent?.mutations[0]?.action).toBe('create_document');
  });

  it('no intenta abrir carpetas, pero sí enfoca la ruta creada', () => {
    const effects = collectAgentWorkspaceEffects({
      mode: 'agent',
      provider: 'openai',
      iterations: 1,
      finalReply: 'Listo',
      rollback: [],
      steps: [
        {
          id: 'result-folder',
          type: 'tool_result',
          title: 'Carpeta creada',
          startedAt: Date.now(),
          result: {
            ok: true,
            name: 'create_document',
            callId: 'call-folder',
            summary: 'Carpeta creada',
            data: {
              document: {
                id: 'folder-1',
                name: 'Tareas',
                type: DocumentType.Folder,
                folder: 'curso/Tareas'
              }
            }
          }
        }
      ]
    }, 'workspace-1');

    expect(effects.openDocumentsEvent).toBeNull();
    expect(effects.mutatedEvent?.mutations).toHaveLength(1);
  });
});
