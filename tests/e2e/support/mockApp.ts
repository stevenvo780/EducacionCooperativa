import { expect, Page, Route } from '@playwright/test';

export const TEST_USER = {
  uid: 'user-e2e',
  email: 'operador@cooperativa.test',
  displayName: 'Operador E2E'
};

type WorkspaceTypeId = 'personal' | 'shared';

type MockWorkspace = {
  id: string;
  name: string;
  ownerId: string;
  members: string[];
  type: WorkspaceTypeId;
};

type MockDoc = {
  id: string;
  name: string;
  type: 'text' | 'file' | 'folder' | 'board';
  folder?: string;
  content?: string;
  ownerId: string;
  workspaceId: string;
  mimeType?: string;
  order?: number;
  updatedAt: string;
};

type MockProfile = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
};

type MockBoardColumn = {
  id: string;
  name: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

type MockBoardCard = {
  id: string;
  title: string;
  description?: string;
  columnId: string;
  order: number;
  ownerId?: string | null;
  sourceDocId?: string | null;
  sourceDocName?: string | null;
  sourceFragment?: string | null;
  sourcePath?: string | null;
  createdAt: string;
  updatedAt: string;
};

type MockBoardState = {
  boardId: string;
  workspaceId: string;
  columns: MockBoardColumn[];
  cards: MockBoardCard[];
};

type MockAppState = {
  user: typeof TEST_USER;
  role: string;
  workspaces: MockWorkspace[];
  invites: MockWorkspace[];
  docsByWorkspace: Record<string, MockDoc[]>;
  boardsByWorkspace: Record<string, MockBoardState>;
  userProfiles: Record<string, MockProfile>;
  subscription: {
    userId: string;
    planId: 'basic' | 'free' | 'pro';
    status: 'active' | 'free';
    endDate?: string;
    createdAt: string;
    updatedAt: string;
  };
  storageUsage: {
    usedMB: number;
    limitMB: number;
    planId: 'basic' | 'free' | 'pro';
    usedBytes: number;
    limitBytes: number;
    percentage: number;
  };
  loginShouldFail: boolean;
  registerShouldFail: boolean;
  changePasswordShouldFail: boolean;
  nextWorkspaceId: number;
  nextDocId: number;
  nextBoardId: number;
};

type MockOptions = Partial<Pick<MockAppState, 'loginShouldFail' | 'registerShouldFail' | 'changePasswordShouldFail' | 'role'>> & {
  workspaces?: MockWorkspace[];
  invites?: MockWorkspace[];
  docsByWorkspace?: Record<string, MockDoc[]>;
};

const ISO_DATE = '2030-01-10T12:00:00.000Z';
const PERSONAL_WORKSPACE_ID = 'personal';

const createBaseState = (options: MockOptions = {}): MockAppState => ({
  user: TEST_USER,
  role: options.role ?? 'superadmin',
  workspaces: options.workspaces ?? [
    {
      id: 'ws-shared',
      name: 'Historia Cooperativa',
      ownerId: TEST_USER.uid,
      members: [TEST_USER.uid, 'member-ana'],
      type: 'shared'
    }
  ],
  invites: options.invites ?? [
    {
      id: 'ws-invite',
      name: 'Invitacion Pendiente',
      ownerId: 'owner-invite',
      members: ['owner-invite'],
      type: 'shared'
    }
  ],
  docsByWorkspace: options.docsByWorkspace ?? {
    [PERSONAL_WORKSPACE_ID]: [
      {
        id: 'doc-personal-1',
        name: 'Documento inicial.md',
        type: 'text',
        folder: 'No estructurado',
        content: '# Documento inicial\n\nContenido base del espacio personal.',
        ownerId: TEST_USER.uid,
        workspaceId: PERSONAL_WORKSPACE_ID,
        mimeType: 'text/markdown',
        updatedAt: ISO_DATE
      },
      {
        id: 'doc-personal-2',
        name: 'Archivo cooperativo.md',
        type: 'text',
        folder: 'No estructurado',
        content: '# Archivo cooperativo\n\nNotas del espacio personal.',
        ownerId: TEST_USER.uid,
        workspaceId: PERSONAL_WORKSPACE_ID,
        mimeType: 'text/markdown',
        updatedAt: ISO_DATE
      }
    ],
    'ws-shared': [
      {
        id: 'folder-clase',
        name: 'Clase',
        type: 'folder',
        folder: '',
        ownerId: TEST_USER.uid,
        workspaceId: 'ws-shared',
        updatedAt: ISO_DATE
      },
      {
        id: 'doc-shared-1',
        name: 'Memoria cooperativa.md',
        type: 'text',
        folder: 'Clase',
        content: '# Memoria cooperativa\n\nFragmento relevante para la busqueda semantica.',
        ownerId: TEST_USER.uid,
        workspaceId: 'ws-shared',
        mimeType: 'text/markdown',
        updatedAt: ISO_DATE
      },
      {
        id: 'doc-shared-2',
        name: 'Bibliografia.md',
        type: 'text',
        folder: 'No estructurado',
        content: '# Bibliografia\n\nLista de referencias.',
        ownerId: TEST_USER.uid,
        workspaceId: 'ws-shared',
        mimeType: 'text/markdown',
        updatedAt: ISO_DATE
      }
    ]
  },
  boardsByWorkspace: {},
  userProfiles: {
    [TEST_USER.uid]: {
      uid: TEST_USER.uid,
      email: TEST_USER.email,
      displayName: TEST_USER.displayName
    },
    'member-ana': {
      uid: 'member-ana',
      email: 'ana@cooperativa.test',
      displayName: 'Ana'
    }
  },
  subscription: {
    userId: TEST_USER.uid,
    planId: 'basic',
    status: 'active',
    endDate: '2030-12-31T00:00:00.000Z',
    createdAt: ISO_DATE,
    updatedAt: ISO_DATE
  },
  storageUsage: {
    usedMB: 128,
    limitMB: 1024,
    planId: 'basic',
    usedBytes: 128 * 1024 * 1024,
    limitBytes: 1024 * 1024 * 1024,
    percentage: 12.5
  },
  loginShouldFail: options.loginShouldFail ?? false,
  registerShouldFail: options.registerShouldFail ?? false,
  changePasswordShouldFail: options.changePasswordShouldFail ?? false,
  nextWorkspaceId: 1,
  nextDocId: 1,
  nextBoardId: 1
});

const createDefaultBoardColumns = (state: MockAppState) => ([
  {
    id: `board-col-${state.nextBoardId++}`,
    name: 'Por hacer',
    order: 1000,
    createdAt: ISO_DATE,
    updatedAt: ISO_DATE
  },
  {
    id: `board-col-${state.nextBoardId++}`,
    name: 'En progreso',
    order: 2000,
    createdAt: ISO_DATE,
    updatedAt: ISO_DATE
  },
  {
    id: `board-col-${state.nextBoardId++}`,
    name: 'Hecho',
    order: 3000,
    createdAt: ISO_DATE,
    updatedAt: ISO_DATE
  }
]);

const ensureBoard = (state: MockAppState, workspaceId: string) => {
  if (!state.boardsByWorkspace[workspaceId]) {
    state.boardsByWorkspace[workspaceId] = {
      boardId: `board-${workspaceId}`,
      workspaceId,
      columns: createDefaultBoardColumns(state),
      cards: []
    };
  }

  return state.boardsByWorkspace[workspaceId];
};

const json = async (route: Route, data: unknown, status = 200) => {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(data)
  });
};

const parseBody = (route: Route) => {
  const raw = route.request().postData() ?? '{}';
  return JSON.parse(raw);
};

const findDoc = (state: MockAppState, docId: string) => {
  for (const docs of Object.values(state.docsByWorkspace)) {
    const doc = docs.find((item) => item.id === docId);
    if (doc) return doc;
  }
  return null;
};

const makeSearchResults = (state: MockAppState, workspaceId: string, query: string) => {
  const docs = (state.docsByWorkspace[workspaceId] ?? []).filter((item) => item.type !== 'folder');
  const normalizedQuery = query.trim().toLowerCase();
  const matchingDocs = docs.filter((doc) => {
    const haystack = `${doc.name} ${doc.content ?? ''}`.toLowerCase();
    return normalizedQuery.length > 0 && haystack.includes(normalizedQuery);
  });

  const results = matchingDocs.map((doc, index) => ({
    id: `document:${doc.id}`,
    kind: 'document',
    title: doc.name,
    subtitle: doc.folder || 'Raiz del espacio',
    preview: doc.content?.slice(0, 120) ?? 'Documento',
    badge: 'DOC',
    score: 10 - index,
    matchedTerms: [normalizedQuery],
    sourceDoc: {
      id: doc.id,
      name: doc.name,
      type: doc.type,
      folder: doc.folder,
      workspaceId: doc.workspaceId,
      mimeType: doc.mimeType,
      ownerId: doc.ownerId,
      updatedAt: doc.updatedAt
    }
  }));

  if (normalizedQuery.includes('memoria') && matchingDocs[0]) {
    results.push({
      id: `concept:${matchingDocs[0].id}`,
      kind: 'concept',
      title: 'Memoria',
      subtitle: `Concepto en ${matchingDocs[0].name}`,
      preview: 'Concepto relacionado con memoria cooperativa',
      badge: 'CON',
      score: 8,
      matchedTerms: ['memoria'],
      sourceDoc: {
        id: matchingDocs[0].id,
        name: matchingDocs[0].name,
        type: matchingDocs[0].type,
        folder: matchingDocs[0].folder,
        workspaceId: matchingDocs[0].workspaceId,
        mimeType: matchingDocs[0].mimeType,
        ownerId: matchingDocs[0].ownerId,
        updatedAt: matchingDocs[0].updatedAt
      }
    });
  }

  return results;
};

export const installBrowserStubs = async (page: Page) => {
  await page.route('https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.min.css', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/css', body: '' });
  });

  await page.route('https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        window.Terminal = class {
          constructor() {
            this.element = document.createElement('div');
            this.rows = 24;
          }
          loadAddon() {}
          onData() {}
          open(container) { container.appendChild(this.element); }
          focus() {}
          refresh() {}
          writeln(text) { this.element.textContent = (this.element.textContent || '') + text; }
        };
      `
    });
  });

  await page.route('https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'window.FitAddon = { FitAddon: class { fit() {} } };'
    });
  });

  await page.route('https://cdn.jsdelivr.net/npm/xterm-addon-web-links@0.9.0/lib/xterm-addon-web-links.min.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'window.WebLinksAddon = { WebLinksAddon: class {} };'
    });
  });

  await page.addInitScript(() => {
    let clipboardValue = '';
    let downloadCounter = 0;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          clipboardValue = String(value);
          (window as Window & { __copiedText?: string }).__copiedText = clipboardValue;
        },
        readText: async () => clipboardValue
      }
    });

    window.open = ((url?: string | URL | undefined) => {
      (window as Window & { __lastOpenedUrl?: string }).__lastOpenedUrl = String(url ?? '');
      return null;
    }) as typeof window.open;

    window.prompt = ((message?: string, defaultValue?: string) => {
      const state = window as Window & {
        __promptResponses?: string[];
        __nextPromptResponse?: string;
      };

      if (Array.isArray(state.__promptResponses) && state.__promptResponses.length > 0) {
        const next = state.__promptResponses.shift();
        return next ?? null;
      }

      if (typeof state.__nextPromptResponse === 'string') {
        const next = state.__nextPromptResponse;
        delete state.__nextPromptResponse;
        return next;
      }

      return defaultValue ?? null;
    }) as typeof window.prompt;

    window.confirm = (() => {
      const state = window as Window & {
        __confirmResponses?: boolean[];
        __nextConfirmResponse?: boolean;
      };

      if (Array.isArray(state.__confirmResponses) && state.__confirmResponses.length > 0) {
        return state.__confirmResponses.shift() ?? true;
      }

      if (typeof state.__nextConfirmResponse === 'boolean') {
        const next = state.__nextConfirmResponse;
        delete state.__nextConfirmResponse;
        return next;
      }

      return true;
    }) as typeof window.confirm;

    URL.createObjectURL = ((blob: Blob | MediaSource) => {
      const fakeUrl = `blob:mock-${downloadCounter++}`;
      const state = window as Window & {
        __blobDownloads?: Array<{ url: string; size?: number }>;
      };
      state.__blobDownloads = state.__blobDownloads ?? [];
      state.__blobDownloads.push({
        url: fakeUrl,
        size: blob instanceof Blob ? blob.size : undefined
      });
      return fakeUrl;
    }) as typeof URL.createObjectURL;

    URL.revokeObjectURL = (() => {}) as typeof URL.revokeObjectURL;

    const originalAnchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function clickPatched() {
      if (this.download || this.href.startsWith('blob:mock-')) {
        const state = window as Window & {
          __downloads?: Array<{ href: string; download: string }>;
        };
        state.__downloads = state.__downloads ?? [];
        state.__downloads.push({
          href: this.href,
          download: this.download
        });
        return;
      }

      return originalAnchorClick.call(this);
    };
  });
};

export const installInsecureAuth = async (page: Page, user = TEST_USER) => {
  await page.addInitScript((value) => {
    window.localStorage.setItem('agora_user', JSON.stringify(value));
    window.localStorage.setItem('agora_user_email', value.email);
  }, user);
};

export const installMockApi = async (page: Page, options: MockOptions = {}) => {
  const state = createBaseState(options);

  await page.route('https://uploads.test/**', async (route) => {
    await route.fulfill({ status: 200, body: '' });
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname, searchParams } = url;
    const method = request.method();

    if (pathname === '/api/auth/login' && method === 'POST') {
      if (state.loginShouldFail) {
        await json(route, { error: 'Credenciales invalidas' }, 401);
        return;
      }
      const body = parseBody(route);
      await json(route, {
        uid: state.user.uid,
        email: body.email,
        displayName: state.user.displayName
      });
      return;
    }

    if (pathname === '/api/auth/register' && method === 'POST') {
      if (state.registerShouldFail) {
        await json(route, { error: 'No se pudo registrar el usuario' }, 400);
        return;
      }
      const body = parseBody(route);
      await json(route, {
        uid: `${state.user.uid}-registered`,
        email: body.email,
        displayName: String(body.email).split('@')[0]
      });
      return;
    }

    if (pathname === '/api/auth/change-password' && method === 'POST') {
      if (state.changePasswordShouldFail) {
        await json(route, { error: 'No se pudo cambiar la contrasena' }, 400);
        return;
      }
      await json(route, { ok: true });
      return;
    }

    if (pathname === '/api/users/me' && method === 'GET') {
      await json(route, { uid: state.user.uid, email: state.user.email, role: state.role });
      return;
    }

    if (pathname === '/api/users/lookup' && method === 'POST') {
      const body = parseBody(route);
      const users = (body.userIds ?? []).map((uid: string) => state.userProfiles[uid] ?? { uid });
      await json(route, { users });
      return;
    }

    if (pathname === '/api/workspaces' && method === 'GET') {
      await json(route, { workspaces: state.workspaces, invites: state.invites });
      return;
    }

    if (pathname === '/api/workspaces' && method === 'POST') {
      const body = parseBody(route);
      const id = `ws-created-${state.nextWorkspaceId++}`;
      const workspace: MockWorkspace = {
        id,
        name: body.name,
        ownerId: body.ownerId,
        members: [body.ownerId],
        type: 'shared'
      };
      state.workspaces.push(workspace);
      state.docsByWorkspace[id] = [];
      ensureBoard(state, id);
      await json(route, workspace);
      return;
    }

    if (pathname.startsWith('/api/workspaces/') && method === 'PATCH') {
      const workspaceId = pathname.split('/').pop() ?? '';
      const body = parseBody(route);
      const workspace = state.workspaces.find((item) => item.id === workspaceId);
      const invite = state.invites.find((item) => item.id === workspaceId);
      if (!workspace && !invite) {
        await json(route, { error: 'Workspace no encontrado' }, 404);
        return;
      }

      if (body.action === 'invite') {
        await json(route, { invited: body.email });
        return;
      }

      if (body.action === 'remove_member') {
        if (!workspace) {
          await json(route, { error: 'Workspace no encontrado' }, 404);
          return;
        }
        workspace.members = workspace.members.filter((memberId) => memberId !== body.userId);
        await json(route, { ok: true });
        return;
      }

      if (body.action === 'accept') {
        if (!invite && !workspace) {
          await json(route, { error: 'Workspace no encontrado' }, 404);
          return;
        }

        const acceptedWorkspace = invite
          ? {
              ...invite,
              members: Array.from(new Set([...invite.members, body.userId]))
            }
          : (() => {
              const currentWorkspace = workspace!;
              return {
                ...currentWorkspace,
                members: Array.from(new Set([...(currentWorkspace.members ?? []), body.userId]))
              };
            })();

        state.invites = state.invites.filter((item) => item.id !== workspaceId);
        if (!state.workspaces.some((item) => item.id === acceptedWorkspace.id)) {
          state.workspaces.push(acceptedWorkspace);
        } else {
          state.workspaces = state.workspaces.map((item) => (
            item.id === acceptedWorkspace.id ? acceptedWorkspace : item
          ));
        }
        if (!state.docsByWorkspace[acceptedWorkspace.id]) {
          state.docsByWorkspace[acceptedWorkspace.id] = [];
        }
        ensureBoard(state, acceptedWorkspace.id);
        await json(route, { ok: true });
        return;
      }
    }

    if (pathname.startsWith('/api/workspaces/') && method === 'DELETE') {
      const workspaceId = pathname.split('/').pop() ?? '';
      state.workspaces = state.workspaces.filter((item) => item.id !== workspaceId);
      delete state.docsByWorkspace[workspaceId];
      delete state.boardsByWorkspace[workspaceId];
      await json(route, { ok: true });
      return;
    }

    if (pathname === '/api/boards' && method === 'GET') {
      const workspaceId = searchParams.get('workspaceId') ?? PERSONAL_WORKSPACE_ID;
      const board = ensureBoard(state, workspaceId);
      const columns = [...board.columns].sort((left, right) => left.order - right.order);
      const cards = [...board.cards].sort((left, right) => left.order - right.order);
      await json(route, { ...board, columns, cards });
      return;
    }

    if (pathname === '/api/boards' && method === 'POST') {
      const body = parseBody(route);
      const workspaceId = body.workspaceId ?? PERSONAL_WORKSPACE_ID;
      const board = ensureBoard(state, workspaceId);

      if (body.type === 'column') {
        const maxOrder = board.columns.reduce((current, column) => Math.max(current, column.order), 0);
        const column: MockBoardColumn = {
          id: `board-col-${state.nextBoardId++}`,
          name: String(body.name ?? '').trim() || 'Sin titulo',
          order: typeof body.order === 'number' ? body.order : maxOrder + 1000,
          createdAt: ISO_DATE,
          updatedAt: ISO_DATE
        };
        board.columns.push(column);
        await json(route, column);
        return;
      }

      if (body.type === 'card') {
        const columnId = String(body.columnId ?? '').trim();
        if (!columnId) {
          await json(route, { error: 'columnId is required' }, 400);
          return;
        }
        const cardsInColumn = board.cards.filter((card) => card.columnId === columnId);
        const maxOrder = cardsInColumn.reduce((current, card) => Math.max(current, card.order), 0);
        const card: MockBoardCard = {
          id: `board-card-${state.nextBoardId++}`,
          title: String(body.title ?? '').trim() || 'Nueva tarjeta',
          description: typeof body.description === 'string' ? body.description : undefined,
          columnId,
          order: typeof body.order === 'number' ? body.order : maxOrder + 1000,
          ownerId: state.user.uid,
          sourceDocId: typeof body.sourceDocId === 'string' ? body.sourceDocId : null,
          sourceDocName: typeof body.sourceDocName === 'string' ? body.sourceDocName : null,
          sourceFragment: typeof body.sourceFragment === 'string' ? body.sourceFragment : null,
          sourcePath: typeof body.sourcePath === 'string' ? body.sourcePath : null,
          createdAt: ISO_DATE,
          updatedAt: ISO_DATE
        };
        board.cards.push(card);
        await json(route, card);
        return;
      }

      await json(route, { error: 'Invalid type' }, 400);
      return;
    }

    if (pathname === '/api/boards' && method === 'PATCH') {
      const body = parseBody(route);
      const workspaceId = body.workspaceId ?? PERSONAL_WORKSPACE_ID;
      const board = ensureBoard(state, workspaceId);
      const id = String(body.id ?? '');
      const data = body.data ?? {};

      if (body.type === 'column') {
        const column = board.columns.find((item) => item.id === id);
        if (!column) {
          await json(route, { error: 'Column not found' }, 404);
          return;
        }
        if (typeof data.name === 'string') column.name = data.name.trim() || column.name;
        if (typeof data.order === 'number') column.order = data.order;
        column.updatedAt = ISO_DATE;
        await json(route, { ok: true });
        return;
      }

      if (body.type === 'card') {
        const card = board.cards.find((item) => item.id === id);
        if (!card) {
          await json(route, { error: 'Card not found' }, 404);
          return;
        }
        if (typeof data.title === 'string') card.title = data.title.trim() || card.title;
        if (typeof data.description === 'string') card.description = data.description;
        if (typeof data.columnId === 'string') card.columnId = data.columnId.trim() || card.columnId;
        if (typeof data.order === 'number') card.order = data.order;
        if (typeof data.sourceDocId === 'string' || data.sourceDocId === null) card.sourceDocId = data.sourceDocId ?? null;
        if (typeof data.sourceDocName === 'string' || data.sourceDocName === null) card.sourceDocName = data.sourceDocName ?? null;
        if (typeof data.sourceFragment === 'string' || data.sourceFragment === null) card.sourceFragment = data.sourceFragment ?? null;
        if (typeof data.sourcePath === 'string' || data.sourcePath === null) card.sourcePath = data.sourcePath ?? null;
        card.updatedAt = ISO_DATE;
        await json(route, { ok: true });
        return;
      }

      await json(route, { error: 'Invalid type' }, 400);
      return;
    }

    if (pathname === '/api/boards' && method === 'DELETE') {
      const body = parseBody(route);
      const workspaceId = body.workspaceId ?? PERSONAL_WORKSPACE_ID;
      const board = ensureBoard(state, workspaceId);
      const id = String(body.id ?? '');

      if (body.type === 'column') {
        board.columns = board.columns.filter((item) => item.id !== id);
        board.cards = board.cards.filter((item) => item.columnId !== id);
        await json(route, { ok: true });
        return;
      }

      if (body.type === 'card') {
        board.cards = board.cards.filter((item) => item.id !== id);
        await json(route, { ok: true });
        return;
      }

      await json(route, { error: 'Invalid type' }, 400);
      return;
    }

    if (pathname === '/api/documents' && method === 'GET') {
      const workspaceId = searchParams.get('workspaceId') ?? PERSONAL_WORKSPACE_ID;
      await json(route, state.docsByWorkspace[workspaceId] ?? []);
      return;
    }

    if (pathname === '/api/documents' && method === 'POST') {
      const body = parseBody(route);
      const workspaceId = body.workspaceId ?? PERSONAL_WORKSPACE_ID;
      const docId = `doc-created-${state.nextDocId++}`;
      const nextDoc: MockDoc = {
        id: docId,
        name: body.name,
        type: body.type,
        folder: body.folder,
        content: body.content,
        ownerId: body.ownerId,
        workspaceId,
        mimeType: body.mimeType ?? (body.type === 'text' ? 'text/markdown' : undefined),
        updatedAt: ISO_DATE
      };
      if (!state.docsByWorkspace[workspaceId]) {
        state.docsByWorkspace[workspaceId] = [];
      }
      state.docsByWorkspace[workspaceId].push(nextDoc);
      await json(route, { id: docId });
      return;
    }

    if (pathname.startsWith('/api/documents/') && pathname.endsWith('/raw') && method === 'GET') {
      const docId = pathname.split('/')[3];
      const doc = findDoc(state, docId);
      if (!doc) {
        await route.fulfill({ status: 404, body: 'No encontrado' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: doc.mimeType ?? 'text/markdown',
        body: doc.content ?? ''
      });
      return;
    }

    if (pathname.startsWith('/api/documents/') && method === 'PUT') {
      const docId = pathname.split('/').pop() ?? '';
      const body = parseBody(route);
      const doc = findDoc(state, docId);
      if (!doc) {
        await json(route, { error: 'Documento no encontrado' }, 404);
        return;
      }
      Object.assign(doc, body, { updatedAt: ISO_DATE });
      await json(route, { ok: true });
      return;
    }

    if (pathname.startsWith('/api/documents/') && method === 'DELETE') {
      const docId = pathname.split('/').pop() ?? '';
      for (const workspaceId of Object.keys(state.docsByWorkspace)) {
        state.docsByWorkspace[workspaceId] = state.docsByWorkspace[workspaceId].filter((doc) => doc.id !== docId);
      }
      await json(route, { ok: true });
      return;
    }

    if (pathname === '/api/search/semantic' && method === 'POST') {
      const body = parseBody(route);
      const results = makeSearchResults(state, body.workspaceId, body.query ?? '');
      await json(route, {
        results,
        meta: {
          query: body.query ?? '',
          workspaceId: body.workspaceId,
          scannedDocuments: (state.docsByWorkspace[body.workspaceId] ?? []).length,
          totalCandidates: results.length,
          offset: 0,
          hasMore: false,
          mode: 'heuristic-v1'
        }
      });
      return;
    }

    if (pathname === '/api/payments/subscription-status' && method === 'GET') {
      await json(route, { subscription: state.subscription });
      return;
    }

    if (pathname === '/api/payments/storage-usage' && method === 'GET') {
      await json(route, state.storageUsage);
      return;
    }

    if (pathname === '/api/payments/verify' && method === 'POST') {
      await json(route, { status: 'active', planId: state.subscription.planId, message: 'ok' });
      return;
    }

    if (pathname === '/api/payments/create-preference' && method === 'POST') {
      await json(route, { checkoutUrl: 'https://checkout.test/mercadopago' });
      return;
    }

    if (pathname === '/api/upload/signed-url' && method === 'POST') {
      const body = parseBody(route);
      await json(route, {
        signedUrl: `https://uploads.test/${encodeURIComponent(body.fileName ?? 'upload.bin')}`,
        storagePath: `uploads/${body.workspaceId}/${body.fileName}`,
        fileName: body.fileName,
        originalName: body.fileName,
        mimeType: body.mimeType,
        workspaceId: body.workspaceId,
        folder: body.folder
      });
      return;
    }

    if (pathname === '/api/upload/register' && method === 'POST') {
      const body = parseBody(route);
      const workspaceId = body.workspaceId ?? PERSONAL_WORKSPACE_ID;
      const docId = `doc-uploaded-${state.nextDocId++}`;
      const uploadedDoc: MockDoc = {
        id: docId,
        name: body.originalName ?? body.fileName ?? `archivo-${state.nextDocId}`,
        type: 'file',
        folder: body.folder ?? 'No estructurado',
        content: '',
        ownerId: state.user.uid,
        workspaceId,
        mimeType: body.mimeType ?? 'application/octet-stream',
        updatedAt: ISO_DATE
      };
      if (!state.docsByWorkspace[workspaceId]) {
        state.docsByWorkspace[workspaceId] = [];
      }
      state.docsByWorkspace[workspaceId].push(uploadedDoc);
      await json(route, uploadedDoc);
      return;
    }

    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: `Unhandled mock route: ${method} ${pathname}` })
    });
  });

  return state;
};

export const gotoDashboard = async (page: Page, workspaceId?: string) => {
  const target = workspaceId ? `/dashboard?workspaceId=${workspaceId}` : '/dashboard';
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await page.goto(target);
    await page.waitForLoadState('domcontentloaded');

    const header = page.locator('header');
    try {
      await expect(header).toBeVisible({ timeout: 10000 });
      return;
    } catch (error) {
      if (attempt === 5) {
        throw error;
      }

      await page.waitForTimeout(500);
    }
  }
};
