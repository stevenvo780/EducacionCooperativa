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
import { AGENT_UI_PANEL_REGISTRY, AGENT_UI_PANELS, commandTypeForPanel, isAgentUiPanel } from '@/lib/agora-ai/uiPanels';
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
    expect(AGORA_AGENT_TOOLS.length).toBeGreaterThanOrEqual(30);
    expect(AGORA_AGENT_TOOL_NAMES).toEqual(expect.arrayContaining([
      'list_documents',
      'read_document',
      'create_document',
      'update_document',
      'move_document',
      'delete_document',
      'search_documents',
      'inspect_workspace',
      'search_workspace',
      'read_workspace_bundle',
      'get_worker_status',
      'run_worker_command',
      'list_worker_files',
      'sync_status',
      'git_status',
      'git_log',
      'git_commit_workspace',
      'open_app_panel',
      'report_debug',
      'create_snippet',
      'formalize_text',
      'get_board',
      'create_board_card',
      'run_st_program',
      'list_concepts',
      'summarize_document'
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

  it('usa el registry único para el schema de open_app_panel', () => {
    const tool = AGORA_AGENT_TOOLS.find((item) => item.name === 'open_app_panel');
    expect(tool).toBeDefined();
    expect(tool?.parameters.properties.panel?.enum).toEqual([...AGENT_UI_PANELS]);
    expect(tool?.description).toContain(AGENT_UI_PANELS.join(', '));
  });

  it('deriva tipos de comando UI desde el panel', () => {
    expect(commandTypeForPanel('terminal')).toBe('open_terminal');
    expect(commandTypeForPanel('problems')).toBe('open_problems');
    expect(commandTypeForPanel('ai-config')).toBe('open_ai_config');
    expect(commandTypeForPanel('linter-config')).toBe('open_linter_config');
    expect(commandTypeForPanel('board')).toBe('open_panel');
    expect(isAgentUiPanel('settings')).toBe(true);
    expect(isAgentUiPanel('st-runner')).toBe(false);
  });

  it('todo panel permitido tiene estrategia de apertura frontend', () => {
    expect(AGENT_UI_PANEL_REGISTRY.map(entry => entry.panelId)).toEqual([...AGENT_UI_PANELS]);
    for (const panel of AGENT_UI_PANEL_REGISTRY) {
      expect(panel.label).toBeTruthy();
      expect(panel.openAction).toBeTruthy();
      if (panel.openAction === 'mosaic') {
        expect(panel).toHaveProperty('mosaicType');
      }
      if (panel.openAction === 'sidebar') {
        expect(panel).toHaveProperty('sidebarView');
      }
    }
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
    expect(effects.toolEvents).toHaveLength(1);
    expect(effects.shouldRefreshDocuments).toBe(true);
  });

  it('emite eventos de comando worker y marca refresh si pudo cambiar archivos', () => {
    const effects = collectAgentWorkspaceEffects({
      mode: 'agent',
      provider: 'openai',
      iterations: 1,
      finalReply: 'Comando listo',
      rollback: [],
      steps: [
        {
          id: 'worker-result',
          type: 'tool_result',
          title: 'Worker',
          startedAt: Date.now(),
          result: {
            ok: true,
            name: 'run_worker_command',
            callId: 'call-worker',
            summary: 'ok',
            data: {
              command: 'npm test',
              cwd: '.',
              commandOk: true,
              stdout: 'pass',
              stderr: '',
              exitCode: 0,
              mayHaveChangedWorkspace: true
            }
          }
        }
      ]
    }, 'workspace-1');

    expect(effects.workerCommandEvents).toHaveLength(1);
    expect(effects.workerCommandEvents[0]?.command).toBe('npm test');
    expect(effects.workerCommandEvents[0]?.ok).toBe(true);
    expect(effects.shouldRefreshDocuments).toBe(true);
  });

  it('trata write_worker_file como mutación y solicita refresh del workspace', () => {
    const effects = collectAgentWorkspaceEffects({
      mode: 'agent',
      provider: 'openai',
      iterations: 1,
      finalReply: 'Archivo actualizado',
      rollback: [],
      steps: [{
        id: 'worker-write-result',
        type: 'tool_result',
        title: 'Archivo escrito',
        startedAt: Date.now(),
        result: {
          ok: true,
          name: 'write_worker_file',
          callId: 'call-worker-write',
          summary: 'Escribí 12 bytes',
          data: { path: 'notas/resumen.md', bytesWritten: 12 }
        }
      }]
    }, 'workspace-1');

    expect(effects.mutatedEvent?.mutations).toHaveLength(1);
    expect(effects.mutatedEvent?.mutations[0]?.action).toBe('write_worker_file');
    expect(effects.shouldRefreshDocuments).toBe(true);
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

  it('descarta comandos UI con paneles no registrados', () => {
    const effects = collectAgentWorkspaceEffects({
      mode: 'agent',
      provider: 'openai',
      iterations: 1,
      finalReply: 'Intenté abrir panel',
      rollback: [],
      steps: [
        {
          id: 'bad-ui-panel',
          type: 'tool_result',
          title: 'Panel inválido',
          startedAt: Date.now(),
          result: {
            ok: true,
            name: 'open_app_panel',
            callId: 'call-ui',
            summary: 'panel',
            data: {
              uiCommand: {
                type: 'open_panel',
                panel: 'st-runner'
              }
            }
          }
        }
      ]
    }, 'workspace-1');

    expect(effects.uiCommandEvents).toHaveLength(0);
  });
});
