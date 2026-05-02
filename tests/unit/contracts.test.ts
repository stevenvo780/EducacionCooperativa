/**
 * Tests de contrato. Cada test cubre una regresión real de los últimos
 * commits — si vuelven a romper estos parsers, el bug aparece de inmediato
 * en CI en vez de 4 capas adentro en runtime.
 */
import { describe, it, expect } from 'vitest';
import {
  parseWorkerCommitPayload,
  parseWorkerDeletePayload,
  parseWorkerUploadUrlPayload,
  parseDocumentRecord,
  parseSyncEventPayload,
  resolveSyncChannel,
  parseOutboxRecord,
  parseForgejoTokenResponse,
  parseForgejoCommitResponse,
  parseForgejoTreeResponse,
  parseForgejoFileMeta,
  parseSnippetCreatePayload,
  parseDocumentCreatePayload,
  sanitizeRepoPath,
  splitRepoPath
} from '@/lib/contracts';

describe('parseWorkerCommitPayload', () => {
  it('acepta payload mínimo válido', () => {
    const r = parseWorkerCommitPayload({ repoPath: 'docs/note.md', contentHash: 'abc123' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.repoPath).toBe('docs/note.md');
      expect(r.value.size).toBeNull();
      expect(r.value.mimeType).toBeNull();
    }
  });

  it('rechaza repoPath con traversal', () => {
    const r = parseWorkerCommitPayload({ repoPath: '../etc/passwd', contentHash: 'x' });
    expect(r.ok).toBe(false);
  });

  it('rechaza repoPath con doble slash', () => {
    const r = parseWorkerCommitPayload({ repoPath: 'a//b.md', contentHash: 'x' });
    expect(r.ok).toBe(false);
  });

  it('quita slashes iniciales', () => {
    const r = parseWorkerCommitPayload({ repoPath: '///docs/note.md', contentHash: 'x' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.repoPath).toBe('docs/note.md');
  });

  it('rechaza contentHash vacío (regresión: ghost-push)', () => {
    const r = parseWorkerCommitPayload({ repoPath: 'a.pdf', contentHash: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('contentHash');
  });

  it('rechaza size negativo', () => {
    const r = parseWorkerCommitPayload({ repoPath: 'a.md', contentHash: 'x', size: -5 });
    expect(r.ok).toBe(false);
  });

  it('rechaza body no-objeto', () => {
    expect(parseWorkerCommitPayload(null).ok).toBe(false);
    expect(parseWorkerCommitPayload('string').ok).toBe(false);
    expect(parseWorkerCommitPayload([]).ok).toBe(false);
  });
});

describe('parseWorkerDeletePayload', () => {
  it('acepta repoPath limpio', () => {
    expect(parseWorkerDeletePayload({ repoPath: 'a.md' }).ok).toBe(true);
  });
  it('rechaza traversal', () => {
    expect(parseWorkerDeletePayload({ repoPath: '../a' }).ok).toBe(false);
  });
});

describe('parseWorkerUploadUrlPayload', () => {
  it('exige size positivo', () => {
    expect(parseWorkerUploadUrlPayload({ repoPath: 'a.md', size: 0 }).ok).toBe(false);
    expect(parseWorkerUploadUrlPayload({ repoPath: 'a.md', size: 1 }).ok).toBe(true);
  });
});

describe('parseDocumentRecord', () => {
  it('normaliza dotfile legacy con type=file (regresión 0ac1770/7b67d23)', () => {
    const r = parseDocumentRecord('id1', { name: '.gitignore', type: 'file', folder: 'No estructurado' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.type).toBe('text');
  });

  it('mantiene type válido', () => {
    const r = parseDocumentRecord('id1', { name: 'note.md', type: 'text', folder: 'docs' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.type).toBe('text');
  });

  it('infiere text para dotfile sin type', () => {
    const r = parseDocumentRecord('id1', { name: '.env' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.type).toBe('text');
  });

  it('infiere file para nombre normal sin type', () => {
    const r = parseDocumentRecord('id1', { name: 'image.png' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.type).toBe('file');
  });

  it('rechaza doc sin name', () => {
    expect(parseDocumentRecord('id1', { type: 'text' }).ok).toBe(false);
  });

  it('coerce timestamp Firestore (toMillis)', () => {
    const r = parseDocumentRecord('id1', { name: 'a', updatedAt: { toMillis: () => 12345 } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.updatedAtMs).toBe(12345);
  });

  it('storagePath vacío → null', () => {
    const r = parseDocumentRecord('id1', { name: 'a', storagePath: '' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.storagePath).toBeNull();
  });
});

describe('parseSyncEventPayload', () => {
  it('rechaza payload sin timestamp (regresión: cliente filtra por orderByChild timestamp)', () => {
    const r = parseSyncEventPayload({ type: 'updated', source: 'worker', ts: 123 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('timestamp');
  });

  it('rechaza payload sin source', () => {
    const r = parseSyncEventPayload({ type: 'updated', timestamp: 123 });
    expect(r.ok).toBe(false);
  });

  it('rechaza type inválido', () => {
    const r = parseSyncEventPayload({ type: 'bogus', timestamp: 1, source: 'worker' });
    expect(r.ok).toBe(false);
  });

  it('acepta payload completo', () => {
    const r = parseSyncEventPayload({
      type: 'updated', timestamp: 1, source: 'worker',
      path: 'a/b.md', folder: 'a', docId: 'd1', scope: 'document',
      workspaceId: 'ws1', userId: null, version: 2, contentHash: 'h', sender: 'worker:ws1', ts: 1
    });
    expect(r.ok).toBe(true);
  });
});

describe('resolveSyncChannel', () => {
  it('personal con uid → personal_<uid>', () => {
    const r = resolveSyncChannel({ workspaceId: 'personal', userId: 'u1' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('sync-events/personal_u1');
  });

  it('personal:<uid> embebido', () => {
    const r = resolveSyncChannel({ workspaceId: 'personal:u2', userId: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('sync-events/personal_u2');
  });

  it('personal sin uid → falla (regresión: canal "personal" sin uid no es escuchado)', () => {
    const r = resolveSyncChannel({ workspaceId: 'personal', userId: null });
    expect(r.ok).toBe(false);
  });

  it('shared workspace → canal directo', () => {
    const r = resolveSyncChannel({ workspaceId: 'ws-abc', userId: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('sync-events/ws-abc');
  });

  it('sin workspaceId pero con uid → personal_<uid>', () => {
    const r = resolveSyncChannel({ workspaceId: null, userId: 'u3' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('sync-events/personal_u3');
  });

  it('sin nada → global', () => {
    const r = resolveSyncChannel({ workspaceId: null, userId: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('sync-events/global');
  });
});

describe('parseOutboxRecord', () => {
  it('limpia metadata interna del payload', () => {
    const r = parseOutboxRecord('o1', {
      rtdbPath: 'sync-events/ws1',
      type: 'updated',
      timestamp: 100,
      source: 'worker',
      ts: 100,
      published: false,
      createdAt: 'fake',
      retryCount: 2
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.rtdbPath).toBe('sync-events/ws1');
      expect(r.value.retryCount).toBe(2);
      expect('rtdbPath' in r.value.payload).toBe(false);
      expect('published' in r.value.payload).toBe(false);
      expect('retryCount' in r.value.payload).toBe(false);
      expect('createdAt' in r.value.payload).toBe(false);
      expect(r.value.payload.type).toBe('updated');
    }
  });

  it('rechaza outbox sin rtdbPath', () => {
    expect(parseOutboxRecord('o1', { ts: 1 }).ok).toBe(false);
  });
});

describe('parseForgejoTokenResponse', () => {
  it('acepta sha1 válido', () => {
    expect(parseForgejoTokenResponse({ sha1: 'abc' }).ok).toBe(true);
  });
  it('rechaza sha1 vacío', () => {
    expect(parseForgejoTokenResponse({ sha1: '' }).ok).toBe(false);
  });
  it('rechaza body no-objeto', () => {
    expect(parseForgejoTokenResponse(null).ok).toBe(false);
    expect(parseForgejoTokenResponse('abc').ok).toBe(false);
  });
});

describe('parseForgejoCommitResponse', () => {
  it('acepta { commit: { sha } }', () => {
    const r = parseForgejoCommitResponse({ commit: { sha: 'deadbeef' } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.sha).toBe('deadbeef');
  });
  it('rechaza response sin commit', () => {
    expect(parseForgejoCommitResponse({}).ok).toBe(false);
  });
  it('rechaza commit sin sha (regresión db0a123)', () => {
    expect(parseForgejoCommitResponse({ commit: {} }).ok).toBe(false);
  });
});

describe('parseForgejoTreeResponse', () => {
  it('extrae solo entries con shape válido', () => {
    const r = parseForgejoTreeResponse({
      tree: [
        { path: 'a.md', sha: 's1', type: 'blob' },
        { path: 'b', type: 'tree' }, // sha falta — descartado
        { path: 'c.md', sha: 's3', type: 'blob' }
      ],
      truncated: false
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.entries.length).toBe(2);
      expect(r.value.truncated).toBe(false);
    }
  });
  it('preserva truncated=true (regresión cc0e919)', () => {
    const r = parseForgejoTreeResponse({ tree: [], truncated: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.truncated).toBe(true);
  });
  it('rechaza tree no-array', () => {
    expect(parseForgejoTreeResponse({ tree: 'foo' }).ok).toBe(false);
  });
});

describe('parseForgejoFileMeta', () => {
  it('acepta meta válida', () => {
    const r = parseForgejoFileMeta({ path: 'a.md', sha: 's', size: 100, type: 'file' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.size).toBe(100);
  });
  it('rechaza type desconocido', () => {
    expect(parseForgejoFileMeta({ path: 'a', sha: 's', type: 'wat' }).ok).toBe(false);
  });
});

describe('parseSnippetCreatePayload', () => {
  it('acepta payload mínimo', () => {
    const r = parseSnippetCreatePayload({ title: 'X', markdown: '# x' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.title).toBe('X');
      expect(r.value.category).toBe('general');
      expect(r.value.order).toBe(0);
      expect(r.value.workspaceId).toBeNull();
    }
  });
  it('trim title', () => {
    const r = parseSnippetCreatePayload({ title: '  Y  ', markdown: '' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.title).toBe('Y');
  });
  it('rechaza title vacío', () => {
    expect(parseSnippetCreatePayload({ title: '   ', markdown: 'x' }).ok).toBe(false);
  });
  it('rechaza markdown faltante', () => {
    expect(parseSnippetCreatePayload({ title: 'X' }).ok).toBe(false);
  });
});

describe('parseDocumentCreatePayload', () => {
  it('default name "Sin titulo" si no llega', () => {
    const r = parseDocumentCreatePayload({});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.name).toBe('Sin titulo');
  });
  it('default type text', () => {
    const r = parseDocumentCreatePayload({});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.type).toBe('text');
  });
  it('content nullable', () => {
    const r = parseDocumentCreatePayload({ name: 'a', content: 'foo' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.content).toBe('foo');
  });
  it('content no-string → null', () => {
    const r = parseDocumentCreatePayload({ name: 'a', content: 42 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.content).toBeNull();
  });
});

describe('sanitizeRepoPath / splitRepoPath', () => {
  it('sanitizeRepoPath normaliza slashes iniciales', () => {
    expect(sanitizeRepoPath('//a/b.md')).toBe('a/b.md');
  });
  it('sanitizeRepoPath rechaza traversal', () => {
    expect(sanitizeRepoPath('../etc')).toBeNull();
  });
  it('sanitizeRepoPath rechaza no-string', () => {
    expect(sanitizeRepoPath(42)).toBeNull();
    expect(sanitizeRepoPath(null)).toBeNull();
  });
  it('splitRepoPath sin folder → "No estructurado"', () => {
    expect(splitRepoPath('readme.md')).toEqual({ folder: 'No estructurado', name: 'readme.md' });
  });
  it('splitRepoPath con folder anidado', () => {
    expect(splitRepoPath('docs/sub/note.md')).toEqual({ folder: 'docs/sub', name: 'note.md' });
  });
});
