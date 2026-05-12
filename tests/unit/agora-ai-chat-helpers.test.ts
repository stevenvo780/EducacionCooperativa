import { describe, expect, it } from 'vitest';
import {
  PREVIOUS_TURN_CONTEXT_MARKER,
  detectCapabilityBlock,
  extractReferencedDocuments,
  stripPreviousTurnContext
} from '@/lib/agora-ai/chatHelpers';
import type { AgentRun } from '@/lib/agora-ai/types';

describe('AgoraAIChat helpers · Bug 1 (stripPreviousTurnContext)', () => {
  it('devuelve el content tal cual si no contiene el marcador', () => {
    const input = 'Respuesta final del agente.\nSegunda línea.';
    expect(stripPreviousTurnContext(input)).toBe(input);
  });

  it('quita la sección de contexto si está embebida', () => {
    const base = 'Respuesta final del agente.';
    const enriched = `${base}${PREVIOUS_TURN_CONTEXT_MARKER}- read_document: leyó X\n- list_documents: 12 docs`;
    expect(stripPreviousTurnContext(enriched)).toBe(base);
  });

  it('no se rompe con string vacío', () => {
    expect(stripPreviousTurnContext('')).toBe('');
  });
});

describe('AgoraAIChat helpers · Bug 2 (detectCapabilityBlock)', () => {
  function makeRun(steps: AgentRun['steps']): AgentRun {
    return {
      mode: 'agent',
      provider: 'openai',
      iterations: 1,
      steps,
      finalReply: '',
      rollback: []
    };
  }

  it('devuelve null si no hay agentRun', () => {
    expect(detectCapabilityBlock(undefined)).toBeNull();
  });

  it('devuelve null si no hay errores de capability', () => {
    const run = makeRun([
      {
        id: 'r1',
        type: 'tool_result',
        title: 'Resultado de read_document',
        startedAt: 0,
        result: { ok: true, name: 'read_document', callId: 'c1', summary: 'OK' }
      }
    ]);
    expect(detectCapabilityBlock(run)).toBeNull();
  });

  it('detecta error con texto "perfil de acceso"', () => {
    const run = makeRun([
      {
        id: 'e1',
        type: 'error',
        title: 'Error en run_worker_command',
        startedAt: 0,
        content: 'Tool bloqueada por el perfil de acceso "workspace": run_worker_command requiere workerCommand.',
        result: {
          ok: false,
          name: 'run_worker_command',
          callId: 'c1',
          summary: 'capability missing',
          error: 'workerCommand denied'
        }
      }
    ]);
    expect(detectCapabilityBlock(run)).toMatch(/perfil de acceso/i);
  });

  it('detecta error con texto que menciona workerCommand', () => {
    const run = makeRun([
      {
        id: 'e1',
        type: 'error',
        title: 'Error',
        startedAt: 0,
        result: {
          ok: false,
          name: 'run_worker_command',
          callId: 'c1',
          summary: 'requires workerCommand',
          error: 'capability denied'
        }
      }
    ]);
    expect(detectCapabilityBlock(run)).not.toBeNull();
  });
});

describe('AgoraAIChat helpers · Bug 3 (extractReferencedDocuments)', () => {
  function makeRun(steps: AgentRun['steps']): AgentRun {
    return {
      mode: 'agent',
      provider: 'openai',
      iterations: 1,
      steps,
      finalReply: '',
      rollback: []
    };
  }

  it('devuelve array vacío si no hay agentRun', () => {
    expect(extractReferencedDocuments(undefined)).toEqual([]);
  });

  it('extrae documentos de read_document exitoso', () => {
    const run = makeRun([
      {
        id: 's1',
        type: 'tool_result',
        title: 'Resultado de read_document',
        startedAt: 0,
        result: {
          ok: true,
          name: 'read_document',
          callId: 'c1',
          summary: 'OK',
          data: {
            document: {
              id: 'doc-123',
              name: 'deduccion_natural_raa.st',
              folder: 'logica',
              type: 'text',
              mimeType: 'text/plain'
            }
          }
        }
      }
    ]);
    const docs = extractReferencedDocuments(run);
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      id: 'doc-123',
      name: 'deduccion_natural_raa.st',
      folder: 'logica'
    });
  });

  it('deduplica por id de documento', () => {
    const run = makeRun([
      {
        id: 's1',
        type: 'tool_result',
        title: 'r',
        startedAt: 0,
        result: {
          ok: true,
          name: 'read_document',
          callId: 'c1',
          summary: '',
          data: { document: { id: 'doc-1', name: 'A.md' } }
        }
      },
      {
        id: 's2',
        type: 'tool_result',
        title: 'r',
        startedAt: 0,
        result: {
          ok: true,
          name: 'update_document',
          callId: 'c2',
          summary: '',
          data: { document: { id: 'doc-1', name: 'A.md' } }
        }
      }
    ]);
    expect(extractReferencedDocuments(run)).toHaveLength(1);
  });

  it('ignora resultados ok=false', () => {
    const run = makeRun([
      {
        id: 's1',
        type: 'tool_result',
        title: 'r',
        startedAt: 0,
        result: {
          ok: false,
          name: 'read_document',
          callId: 'c1',
          summary: 'err',
          data: { document: { id: 'doc-x', name: 'x' } }
        }
      }
    ]);
    expect(extractReferencedDocuments(run)).toEqual([]);
  });

  it('ignora documentos tipo folder', () => {
    const run = makeRun([
      {
        id: 's1',
        type: 'tool_result',
        title: 'r',
        startedAt: 0,
        result: {
          ok: true,
          name: 'read_document',
          callId: 'c1',
          summary: 'ok',
          data: { document: { id: 'f1', name: 'carpeta', type: 'folder' } }
        }
      }
    ]);
    expect(extractReferencedDocuments(run)).toEqual([]);
  });

  it('ignora tools no openables (p.ej. list_documents)', () => {
    const run = makeRun([
      {
        id: 's1',
        type: 'tool_result',
        title: 'r',
        startedAt: 0,
        result: {
          ok: true,
          name: 'list_documents',
          callId: 'c1',
          summary: 'ok',
          data: { document: { id: 'd1', name: 'X' } }
        }
      }
    ]);
    expect(extractReferencedDocuments(run)).toEqual([]);
  });
});
