import {
  getDocBadge,
  getFileExtension,
  isDocUploaded,
  isMarkdownConvertibleFile,
  isMarkdownDocItem,
  isMarkdownFile,
  isMarkdownName
} from '@/services/dashboardDocUtils';
import {
  areDocsEquivalent,
  areFoldersEquivalent,
  getUpdatedAtValue,
  normalizeWorkspace
} from '@/services/dashboardUtils';
import { WorkspaceType } from '@/types/workspace';

describe('dashboard data helpers', () => {
  it('normalizes document timestamps', () => {
    const date = new Date('2024-01-02T03:04:05.000Z');

    expect(getUpdatedAtValue(undefined)).toBe(0);
    expect(getUpdatedAtValue(42)).toBe(42);
    expect(getUpdatedAtValue(date)).toBe(date.getTime());
    expect(getUpdatedAtValue('2024-01-02T03:04:05.000Z')).toBe(date.getTime());
    expect(getUpdatedAtValue('not-a-date')).toBe(0);
    expect(getUpdatedAtValue({ seconds: 3 })).toBe(3000);
    expect(getUpdatedAtValue({ toDate: () => date })).toBe(date.getTime());
    expect(getUpdatedAtValue({ toDate: () => 'bad' as unknown as Date })).toBe(0);
  });

  it('compares docs and folders by relevant fields', () => {
    const docs = [{
      id: '1',
      name: 'Nota.md',
      type: 'text',
      folder: 'Curso',
      mimeType: 'text/markdown',
      url: '/nota',
      storagePath: 'users/u1/Curso/Nota.md',
      workspaceId: 'ws',
      ownerId: 'u1',
      size: 10,
      order: 1,
      updatedAt: 100
    }];
    const equalDocs = [{
      ...docs[0],
      updatedAt: { seconds: 0.1 }
    }];
    const changedDocs = [{
      ...docs[0],
      order: 2
    }];

    expect(areDocsEquivalent(docs as never[], equalDocs as never[])).toBe(true);
    expect(areDocsEquivalent(docs as never[], changedDocs as never[])).toBe(false);
    expect(areDocsEquivalent(docs as never[], [] as never[])).toBe(false);

    const folders = [{
      id: 'f1',
      name: 'Curso',
      path: 'Curso',
      parentPath: '',
      kind: 'folder',
      docId: 'd1',
      order: 1
    }];

    expect(areFoldersEquivalent(folders as never[], [{ ...folders[0] }] as never[])).toBe(true);
    expect(areFoldersEquivalent(folders as never[], [{ ...folders[0], path: 'Otro' }] as never[])).toBe(false);
    expect(areFoldersEquivalent(folders as never[], [] as never[])).toBe(false);
  });

  it('normalizes workspace payloads', () => {
    expect(normalizeWorkspace({
      id: 'ws-1',
      name: '  ',
      ownerId: undefined,
      members: undefined,
      pendingInvites: undefined,
      type: WorkspaceType.Personal
    })).toEqual({
      id: 'ws-1',
      name: 'Sin nombre',
      ownerId: '',
      members: [],
      pendingInvites: [],
      type: WorkspaceType.Personal
    });

    expect(normalizeWorkspace({
      id: 'ws-2',
      name: 'Equipo',
      ownerId: 'u1',
      members: ['u1'],
      pendingInvites: ['u2'],
      type: 'otra' as WorkspaceType
    })).toEqual({
      id: 'ws-2',
      name: 'Equipo',
      ownerId: 'u1',
      members: ['u1'],
      pendingInvites: ['u2'],
      type: WorkspaceType.Shared
    });
  });

  it('detects markdown related files and badges', () => {
    const markdownFile = new File(['# Hola'], 'nota.mdown', { type: 'text/plain' });
    const markdownByMime = new File(['# Hola'], 'archivo.bin', { type: 'text/markdown' });
    const pdfFile = new File(['pdf'], 'archivo.pdf', { type: 'application/pdf' });
    const docxFile = new File(['docx'], 'archivo.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    const logFile = new File(['log'], 'archivo.log', { type: '' });
    const unsupportedFile = new File(['bin'], 'archivo.exe', { type: 'application/octet-stream' });

    expect(isMarkdownName('nota.markdown')).toBe(true);
    expect(isMarkdownName('nota.txt')).toBe(false);
    expect(isMarkdownFile(markdownByMime)).toBe(true);
    expect(isMarkdownFile(markdownFile)).toBe(true);

    expect(isMarkdownConvertibleFile(markdownFile)).toBe(true);
    expect(isMarkdownConvertibleFile(pdfFile)).toBe(true);
    expect(isMarkdownConvertibleFile(docxFile)).toBe(true);
    expect(isMarkdownConvertibleFile(logFile)).toBe(true);
    expect(isMarkdownConvertibleFile(unsupportedFile)).toBe(false);

    const markdownDoc = { name: 'nota.md', mimeType: 'text/plain' };
    const markdownMimeDoc = { name: 'nota.bin', mimeType: 'text/markdown' };
    const terminalDoc = { type: 'terminal', name: 'Terminal' };
    const boardDoc = { type: 'board', name: 'Tablero' };
    const binaryDoc = { type: 'file', name: 'presentacion.powerpoint', mimeType: 'application/octet-stream' };
    const plainDoc = { type: 'text', name: 'texto' };

    expect(isMarkdownDocItem(markdownDoc as never)).toBe(true);
    expect(isMarkdownDocItem(markdownMimeDoc as never)).toBe(true);
    expect(getFileExtension('archivo.tar.gz')).toBe('GZ');
    expect(getFileExtension('sin-extension')).toBe('');
    expect(getDocBadge(terminalDoc as never)).toBe('TERM');
    expect(getDocBadge(boardDoc as never)).toBe('TAB');
    expect(getDocBadge({ type: 'file', ...markdownDoc } as never)).toBe('MD');
    expect(getDocBadge(binaryDoc as never)).toBe('POWE');
    expect(getDocBadge({ type: 'file', name: 'archivo', mimeType: '' } as never)).toBe('FILE');
    expect(getDocBadge(plainDoc as never)).toBe('DOC');
    expect(getDocBadge({ name: 'otro.md' } as never)).toBe('MD');

    expect(isDocUploaded({ type: 'file', storagePath: 'a' } as never)).toBe(true);
    expect(isDocUploaded({ type: 'file', url: '/download' } as never)).toBe(true);
    expect(isDocUploaded({ type: 'file' } as never)).toBe(false);
    expect(isDocUploaded({ type: 'text', storagePath: 'a' } as never)).toBe(true);
    expect(isDocUploaded({ type: 'text' } as never)).toBe(false);
    expect(isDocUploaded({ type: 'board' } as never)).toBe(true);
  });
});
