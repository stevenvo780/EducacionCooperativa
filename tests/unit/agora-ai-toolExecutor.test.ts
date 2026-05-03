import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentExecutionContext, AgentToolCall } from '@/lib/agora-ai/types';
import { PERSONAL_WORKSPACE_ID } from '@/types/workspace';
import { DocumentType } from '@/types/documents';

type FirestoreData = Record<string, unknown>;
type WhereClause = { field: string; op: '==' | '!='; value: unknown };

const firestoreMocks = vi.hoisted(() => {
  type FirestoreDelegate = {
    collection: (path: string) => unknown;
    batch: () => unknown;
  };
  let current: FirestoreDelegate | null = null;

  return {
    setDb(db: FirestoreDelegate) {
      current = db;
    },
    adminDb: {
      collection(path: string) {
        if (!current) throw new Error('Fake Firestore not initialized');
        return current.collection(path);
      },
      batch() {
        if (!current) throw new Error('Fake Firestore not initialized');
        return current.batch();
      }
    }
  };
});

const storageMocks = vi.hoisted(() => ({
  putObject: vi.fn(async () => undefined),
  deleteObject: vi.fn(async () => undefined)
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: firestoreMocks.adminDb
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: () => ({ __type: 'serverTimestamp' })
  },
  FieldPath: {
    documentId: () => '__name__'
  }
}));

vi.mock('@/lib/nas-storage', () => ({
  putObject: storageMocks.putObject,
  deleteObject: storageMocks.deleteObject
}));

class FakeDocSnapshot {
  constructor(
    readonly id: string,
    private readonly payload: FirestoreData | null,
    readonly ref: FakeDocRef
  ) {}

  get exists() {
    return this.payload !== null;
  }

  data() {
    return this.payload ? { ...this.payload } : undefined;
  }
}

class FakeQuerySnapshot {
  constructor(readonly docs: FakeDocSnapshot[]) {}

  get empty() {
    return this.docs.length === 0;
  }
}

class FakeCountSnapshot {
  constructor(private readonly count: number) {}

  data() {
    return { count: this.count };
  }
}

class FakeQuery {
  protected readonly wheres: WhereClause[];
  protected readonly limitValue: number | null;
  protected readonly orderField: string | null;

  constructor(
    protected readonly db: FakeFirestore,
    protected readonly path: string,
    wheres: WhereClause[] = [],
    limitValue: number | null = null,
    orderField: string | null = null
  ) {
    this.wheres = wheres;
    this.limitValue = limitValue;
    this.orderField = orderField;
  }

  where(field: string, op: '==' | '!=', value: unknown) {
    return new FakeQuery(this.db, this.path, [...this.wheres, { field, op, value }], this.limitValue, this.orderField);
  }

  limit(limitValue: number) {
    return new FakeQuery(this.db, this.path, this.wheres, limitValue, this.orderField);
  }

  orderBy(orderField: string) {
    return new FakeQuery(this.db, this.path, this.wheres, this.limitValue, orderField);
  }

  async get() {
    const entries = Array.from(this.db.collectionData(this.path).entries())
      .filter(([id, data]) => this.matches(id, data));

    if (this.orderField) {
      entries.sort((left, right) => Number(left[1][this.orderField ?? ''] ?? 0) - Number(right[1][this.orderField ?? ''] ?? 0));
    }

    const limited = this.limitValue === null ? entries : entries.slice(0, this.limitValue);
    return new FakeQuerySnapshot(
      limited.map(([id, data]) => new FakeDocSnapshot(id, { ...data }, new FakeDocRef(this.db, this.path, id)))
    );
  }

  count() {
    return {
      get: async () => {
        const snap = await this.get();
        return new FakeCountSnapshot(snap.docs.length);
      }
    };
  }

  private matches(id: string, data: FirestoreData) {
    return this.wheres.every(({ field, op, value }) => {
      const actual = field === '__name__' ? id : data[field];
      if (op === '==') return actual === value;
      return actual !== value;
    });
  }
}

class FakeCollectionRef extends FakeQuery {
  doc(id?: string) {
    return new FakeDocRef(this.db, this.path, id ?? this.db.nextId(this.path));
  }

  async add(data: FirestoreData) {
    const ref = this.doc();
    await ref.set(data);
    return ref;
  }
}

class FakeDocRef {
  constructor(
    private readonly db: FakeFirestore,
    private readonly path: string,
    readonly id: string
  ) {}

  async get() {
    return new FakeDocSnapshot(this.id, this.db.getDoc(this.path, this.id), this);
  }

  async set(data: FirestoreData, options?: { merge?: boolean }) {
    this.db.setDoc(this.path, this.id, data, options?.merge === true);
  }

  async update(data: FirestoreData) {
    this.db.setDoc(this.path, this.id, data, true);
  }

  async delete() {
    this.db.deleteDoc(this.path, this.id);
  }

  collection(path: string) {
    return this.db.collection(`${this.path}/${this.id}/${path}`);
  }
}

class FakeBatch {
  private readonly operations: Array<() => void> = [];

  set(ref: FakeDocRef, data: FirestoreData) {
    this.operations.push(() => {
      void ref.set(data);
    });
  }

  delete(ref: FakeDocRef) {
    this.operations.push(() => {
      void ref.delete();
    });
  }

  async commit() {
    for (const operation of this.operations) operation();
  }
}

class FakeFirestore {
  private readonly stores = new Map<string, Map<string, FirestoreData>>();
  private counter = 0;

  collection(path: string) {
    return new FakeCollectionRef(this, path);
  }

  batch() {
    return new FakeBatch();
  }

  collectionData(path: string) {
    let collection = this.stores.get(path);
    if (!collection) {
      collection = new Map<string, FirestoreData>();
      this.stores.set(path, collection);
    }
    return collection;
  }

  nextId(path: string) {
    this.counter += 1;
    return `${path.replace(/\W+/g, '-')}-${this.counter}`;
  }

  getDoc(path: string, id: string) {
    const doc = this.collectionData(path).get(id);
    return doc ? { ...doc } : null;
  }

  setDoc(path: string, id: string, data: FirestoreData, merge: boolean) {
    const previous = merge ? this.collectionData(path).get(id) ?? {} : {};
    this.collectionData(path).set(id, { ...previous, ...data });
  }

  deleteDoc(path: string, id: string) {
    this.collectionData(path).delete(id);
  }

  seed(path: string, id: string, data: FirestoreData) {
    this.collectionData(path).set(id, { ...data });
  }
}

const ctx: AgentExecutionContext = {
  workspaceId: PERSONAL_WORKSPACE_ID,
  uid: 'u1',
  email: 'u1@example.test',
  origin: 'https://app.test'
};

const call = (name: string, args: Record<string, unknown> = {}): AgentToolCall => ({
  id: `call-${name}`,
  name,
  args
});

let db: FakeFirestore;

beforeEach(() => {
  db = new FakeFirestore();
  firestoreMocks.setDb(db);
  storageMocks.putObject.mockClear();
  storageMocks.deleteObject.mockClear();

  db.seed('documents', 'doc-1', {
    name: 'Apuntes.md',
    type: DocumentType.Text,
    folder: 'Clase',
    content: '# Hola\n\n- [ ] Revisar lectura',
    ownerId: 'u1',
    workspaceId: PERSONAL_WORKSPACE_ID,
    mimeType: 'text/markdown',
    updatedAt: '2030-01-01T00:00:00.000Z'
  });
});

describe('executeAgentTool', () => {
  it('lista y lee documentos resolviendo por nombre', async () => {
    const { executeAgentTool } = await import('@/lib/agora-ai/toolExecutor');

    const listed = await executeAgentTool(call('list_documents', { folder: 'Clase' }), ctx);
    expect(listed.ok).toBe(true);
    expect((listed.data?.documents as Array<{ name: string }>)[0]?.name).toBe('Apuntes.md');

    const read = await executeAgentTool(call('read_document', { documentId: 'Apuntes.md' }), ctx);
    expect(read.ok).toBe(true);
    expect((read.data?.document as { content?: string }).content).toContain('# Hola');
  });

  it('crea documentos con storage sync y rollback', async () => {
    const { executeAgentTool } = await import('@/lib/agora-ai/toolExecutor');

    const result = await executeAgentTool(call('create_document', {
      title: 'Nuevo.md',
      folder: 'Clase',
      content: '# Nuevo'
    }), ctx);

    expect(result.ok).toBe(true);
    expect(result.rollback?.[0]?.action).toBe('delete_document');
    expect(storageMocks.putObject).toHaveBeenCalledWith(
      expect.stringContaining('Nuevo.md'),
      '# Nuevo',
      expect.objectContaining({ contentType: 'text/markdown' })
    );
  });

  it('pide confirmacion antes de borrar y reporta tools desconocidas', async () => {
    const { executeAgentTool } = await import('@/lib/agora-ai/toolExecutor');

    const pending = await executeAgentTool(call('delete_document', { documentId: 'doc-1' }), ctx);
    expect(pending.ok).toBe(true);
    expect(pending.requiresConfirmation).toBe(true);
    expect(pending.pendingConfirmation?.toolName).toBe('delete_document');

    const failed = await executeAgentTool(call('nope'), ctx);
    expect(failed.ok).toBe(false);
    expect(failed.error).toContain('Tool desconocida');
  });

  it('crea snippets y tarjetas de tablero', async () => {
    const { executeAgentTool } = await import('@/lib/agora-ai/toolExecutor');
    const boardId = `${PERSONAL_WORKSPACE_ID}:u1`;
    db.seed('boards', boardId, { workspaceId: boardId });
    db.seed(`boards/${boardId}/columns`, 'todo', { name: 'Por hacer', order: 1000 });

    const snippet = await executeAgentTool(call('create_snippet', {
      title: 'Ficha',
      markdown: '## Ficha'
    }), ctx);
    expect(snippet.ok).toBe(true);
    expect(snippet.rollback?.[0]?.action).toBe('delete_snippet');

    const card = await executeAgentTool(call('create_board_card', {
      columnId: 'todo',
      title: 'Revisar lectura',
      sourceDocId: 'doc-1'
    }), ctx);
    expect(card.ok).toBe(true);
    expect((card.data?.card as { columnId?: string }).columnId).toBe('todo');
    expect(card.rollback?.[0]?.action).toBe('delete_board_card');
  });

  it('registra conceptos en el estado semantico', async () => {
    const { executeAgentTool } = await import('@/lib/agora-ai/toolExecutor');

    const result = await executeAgentTool(call('define_concept', {
      title: 'Cooperacion',
      definition: 'Accion colectiva con objetivo comun',
      logicProfile: 'classical.propositional',
      formula: 'C'
    }), ctx);

    expect(result.ok).toBe(true);
    expect((result.data?.concept as { title?: string }).title).toBe('Cooperacion');
    const stored = db.getDoc('workspaceSemanticStates', `${PERSONAL_WORKSPACE_ID}:u1`);
    expect((stored?.concepts as Array<{ title: string }>)[0]?.title).toBe('Cooperacion');
  });
});
