import { describe, expect, it } from 'vitest';
import {
  createEmptyChatSession,
  deriveChatSessionTitle,
  trimChatSessions,
  upsertChatSession
} from '@/lib/agora-ai/chatHistory';
import {
  analyzeMarkdown,
  compareMarkdownDocuments,
  extractChecklistTasks,
  summarizeMarkdown
} from '@/lib/agora-ai/documentIntelligence';

describe('agora ai chat history helpers', () => {
  it('deriva el título desde el primer mensaje del usuario', () => {
    const title = deriveChatSessionTitle([
      { id: '1', role: 'assistant', content: 'hola' },
      { id: '2', role: 'user', content: 'organiza los documentos del módulo 3 y crea un resumen ejecutivo' }
    ]);

    expect(title).toContain('organiza los documentos');
    expect(title.length).toBeLessThanOrEqual(48);
  });

  it('inserta o actualiza sesiones preservando orden por updatedAt', () => {
    const older = createEmptyChatSession({ workspaceId: 'personal', provider: 'ollama', mode: 'agent', now: 10 });
    const newer = createEmptyChatSession({ workspaceId: 'personal', provider: 'ollama', mode: 'agent', now: 20 });
    const updated = {
      ...older,
      title: 'Sesión útil',
      updatedAt: 50,
      messages: [{ id: 'm1', role: 'user', content: 'hola' }]
    };

    const result = upsertChatSession([older, newer], updated);

    expect(result[0]?.id).toBe(older.id);
    expect(result[0]?.title).toBe('Sesión útil');
    expect(result).toHaveLength(2);
  });

  it('recorta el historial al límite configurado', () => {
    const sessions = Array.from({ length: 55 }, (_, index) => createEmptyChatSession({
      workspaceId: 'personal',
      provider: 'ollama',
      mode: 'agent',
      now: index + 1
    }));

    expect(trimChatSessions(sessions)).toHaveLength(50);
  });
});

describe('agora ai document intelligence helpers', () => {
  const markdown = `# Título\n\nEste documento resume la teoría principal.\n\n## Acciones\n- [ ] Revisar bibliografía\n- [ ] Preparar clase\n\nLa conclusión enfatiza cooperación y evidencia.`;

  it('resume markdown preservando ideas clave', () => {
    const result = summarizeMarkdown(markdown, 2);

    expect(result.summary).toContain('documento resume');
    expect(result.headings).toEqual(['Título', 'Acciones']);
  });

  it('analiza estructura markdown y detecta checklist', () => {
    const result = analyzeMarkdown(markdown);

    expect(result.headingCount).toBe(2);
    expect(result.checklistItems).toBe(2);
    expect(result.wordCount).toBeGreaterThan(10);
  });

  it('compara dos documentos y reporta headings compartidos', () => {
    const comparison = compareMarkdownDocuments(
      '# Título\n\n## Acciones\nTexto sobre cooperación.',
      '# Otro\n\n## Acciones\nTexto sobre cooperación y evidencia.'
    );

    expect(comparison.sharedHeadings).toContain('Acciones');
    expect(comparison.similarity).toBeGreaterThan(0);
  });

  it('extrae pendientes markdown', () => {
    expect(extractChecklistTasks(markdown)).toEqual(['Revisar bibliografía', 'Preparar clase']);
  });
});
