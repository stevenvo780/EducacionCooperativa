import { describe, it, expect } from 'vitest';
import {
  buildEffectiveFolders,
  buildFolderChildrenMap,
  buildDocsByFolder,
  buildWorkspaceTreeModel
} from '@/lib/workspace-tree-model';
import type { DocItem, FolderItem } from '@/types/document-item';

const folder = (path: string, kind: FolderItem['kind'] = 'record', order?: number): FolderItem => ({
  id: `f-${path}`,
  name: path.split('/').pop() ?? path,
  path,
  parentPath: path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '',
  kind,
  ...(typeof order === 'number' ? { order } : {})
});

const doc = (id: string, folderPath: string, name = id, order?: number): DocItem => ({
  id,
  name,
  folder: folderPath,
  type: 'doc',
  updatedAt: 0,
  ...(typeof order === 'number' ? { order } : {})
} as DocItem);

describe('buildEffectiveFolders', () => {
  it('inyecta carpeta virtual para paths sin folder explícito', () => {
    const folders = [folder('Filosofía')];
    const docs = [doc('d1', 'Filosofía/Lógica')];
    const out = buildEffectiveFolders(folders, docs);
    expect(out.map(f => f.path).sort()).toContain('Filosofía/Lógica');
    expect(out.find(f => f.path === 'Filosofía/Lógica')?.kind).toBe('virtual');
  });

  it('sin folders ni docs: no crea ningún nodo (raíz no es un folder)', () => {
    const out = buildEffectiveFolders([], []);
    expect(out).toEqual([]);
  });

  it('preserva folders explícitos sin duplicarlos', () => {
    const folders = [folder('A'), folder('A/B')];
    const docs = [doc('d1', 'A/B')];
    const out = buildEffectiveFolders(folders, docs);
    expect(out.filter(f => f.path === 'A/B')).toHaveLength(1);
    expect(out.find(f => f.path === 'A/B')?.kind).toBe('record');
  });
});

describe('buildFolderChildrenMap', () => {
  it('agrupa por parentPath y ordena system → record → virtual', () => {
    const effective = [
      folder('virt', 'virtual'),
      folder('rec', 'record'),
      folder('sys', 'system')
    ];
    const map = buildFolderChildrenMap(effective);
    expect(map['']?.map(f => f.path)).toEqual(['sys', 'rec', 'virt']);
  });

  it('respeta `order` numérico antes que kind o nombre', () => {
    const effective = [
      folder('z', 'record', 1),
      folder('a', 'record', 2)
    ];
    const map = buildFolderChildrenMap(effective);
    expect(map['']?.map(f => f.path)).toEqual(['z', 'a']);
  });
});

describe('buildDocsByFolder', () => {
  it('ignora docs con type=folder', () => {
    const docs = [
      doc('d1', 'A'),
      { ...doc('f1', 'A'), type: 'folder' } as DocItem
    ];
    const out = buildDocsByFolder(docs);
    expect(out['A']?.map(d => d.id)).toEqual(['d1']);
  });

  it('ordena por order asc, luego updatedAt desc, luego nombre', () => {
    const docs = [
      { ...doc('a', 'F'), order: 2 } as DocItem,
      { ...doc('b', 'F'), order: 1 } as DocItem,
      { ...doc('c', 'F') }
    ];
    const out = buildDocsByFolder(docs);
    expect(out['F']?.map(d => d.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('buildWorkspaceTreeModel', () => {
  it('expone effectiveFolders, folderChildrenMap y docsByFolder coherentes', () => {
    const folders = [folder('A')];
    const docs = [doc('d1', 'A'), doc('d2', 'A/sub')];
    const model = buildWorkspaceTreeModel(folders, docs);
    expect(model.effectiveFolders.find(f => f.path === 'A/sub')?.kind).toBe('virtual');
    expect(model.folderChildrenMap['A']?.map(f => f.path)).toEqual(['A/sub']);
    expect(model.docsByFolder['A']?.map(d => d.id)).toEqual(['d1']);
    expect(model.docsByFolder['A/sub']?.map(d => d.id)).toEqual(['d2']);
  });
});
