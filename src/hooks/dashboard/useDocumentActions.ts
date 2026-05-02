'use client';

import React, { useCallback } from 'react';
import type { User } from 'firebase/auth';
import {
    createDocumentApi,
    updateDocumentApi,
    fetchDocumentRawApi,
    downloadDocumentBlobApi
} from '@/services/dashboardApi';
import { DEFAULT_FOLDER_NAME, normalizeFolderPath, normalizePath } from '@/lib/folder-utils';
import { ST_RUNTIME_VERSION } from '@/lib/st-runtime-manifest';
import { DialogKind, type DocItem, type FolderItem, type Workspace, type DialogConfig, type DialogResult } from '@/components/dashboard/types';
import { PERSONAL_WORKSPACE_ID } from '@/types/workspace';
import type { TerminalSession } from '@/context/TerminalContext';

const ST_GUIDE_CONTENT = `# ST — Guía actualizada del lenguaje

> Intérprete CLI: \\\`st\\\`
> Paquete npm: \\\`@stevenvo780/st-lang\\\`
> Manual completo dentro de Ágora: \\\`/docs/st\\\`

## Inicio rápido

\\\`\\\`\\\`bash
# Ejecutar un archivo .st
st run archivo.st

# Validar sintaxis y diagnósticos
st check archivo.st

# Evaluar algo puntual
st eval "check valid (P -> P)"

# Ver perfiles disponibles
st profiles

# Abrir REPL
st repl
\\\`\\\`\\\`

## Script mínimo

\\\`\\\`\\\`st
logic classical.propositional

axiom regla : P -> Q
axiom base = P

derive Q from {regla, base}
check valid (P | !P)
countermodel (P -> Q)
\\\`\\\`\\\`

## Núcleo del lenguaje

### Declaraciones y verificaciones

\\\`\\\`\\\`st
logic classical.propositional
axiom a1 : P -> Q
theorem t1 : Q

check valid (P | !P)
check satisfiable (P & Q)
check equivalent (P -> Q), (!P | Q)
derive Q from {a1, base}
prove Q from {a1, base}
truth_table (P -> Q)
countermodel (P -> Q)
refute (P -> Q)
\\\`\\\`\\\`

### Variables, flujo y funciones

\\\`\\\`\\\`st
logic arithmetic

let X = 2 + 3
print X
set X = X * 2

if valid X > 5 {
  print "mayor que cinco"
} else {
  print "cinco o menos"
}

for N in { 1, 2, 3 } {
  print N
}

while satisfiable X > 0 {
  print X
  set X = X - 4
}

fn revisar(V) {
  explain V
  return V
}

revisar(X)
\\\`\\\`\\\`

> En \\\`if\\\` y \\\`while\\\` también puedes usar \\\`invalid\\\` y \\\`unsatisfiable\\\`.

### Prueba estructurada

\\\`\\\`\\\`st
logic classical.propositional

assume h1 : P
show P
qed
\\\`\\\`\\\`

### Módulos, export e import

\\\`\\\`\\\`st
// utilidades.st
export let regla = P -> Q
export fn revisar(X) {
  print X
}
\\\`\\\`\\\`

\\\`\\\`\\\`st
// curso.st
logic classical.propositional
import "utilidades.st"

print regla
revisar(P)
\\\`\\\`\\\`

### Teorías parametrizadas

\\\`\\\`\\\`st
logic classical.propositional

theory Caja(valor) {
  let dato = valor
  fn ver() {
    print dato
  }
}

let caja = Caja("demo")
print caja.dato
caja.ver()
\\\`\\\`\\\`

## Operadores disponibles

### Lógicos

- \\\`!\\\` negación
- \\\`&\\\` conjunción
- \\\`|\\\` disyunción
- \\\`->\\\` implicación
- \\\`<->\\\` bicondicional
- \\\`^\\\` o \\\`⊕\\\` XOR
- \\\`!&\\\` o \\\`↑\\\` NAND
- \\\`!|\\\` o \\\`↓\\\` NOR
- \\\`[]\\\` necesidad / siempre / obligación / conocimiento
- \\\`<>\\\` posibilidad / eventualmente / permiso / creencia
- \\\`next\\\` y \\\`until\\\` para temporal
- \\\`forall\\\` y \\\`exists\\\` para cuantificación

### Aritméticos

- \\\`+\\\`, \\\`-\\\`, \\\`*\\\`, \\\`/\\\`, \\\`%\\\`
- \\\`<\\\`, \\\`>\\\`, \\\`<=\\\`, \\\`>=\\\`, \\\`≤\\\`, \\\`≥\\\`

## Funciones nativas del runtime

\\\`\\\`\\\`st
logic arithmetic

print typeof(2 + 3)
print is_valid(2 + 3 < 10)
print is_satisfiable(5 > 3)
print get_atoms((P -> Q) & R)
let nombre = input("Nombre:")
\\\`\\\`\\\`

## Text Layer

\\\`\\\`\\\`st
logic classical.propositional

let p1 = passage([[documento.md#seccion]])
let f1 = formalize p1 as (P & Q)
claim c1 = f1
support c1 <- p1
confidence c1 = 0.85
context c1 = "Lectura conservadora"

render claims
render theory
render all
\\\`\\\`\\\`

## Perfiles incorporados

- \\\`classical.propositional\\\`
- \\\`classical.first_order\\\`
- \\\`modal.k\\\`
- \\\`deontic.standard\\\`
- \\\`epistemic.s5\\\`
- \\\`intuitionistic.propositional\\\`
- \\\`temporal.ltl\\\`
- \\\`arithmetic\\\`
- \\\`aristotelian.syllogistic\\\`
- \\\`paraconsistent.belnap\\\`
- \\\`probabilistic.basic\\\`

## API programática

\\\`\\\`\\\`javascript
const { evaluate, createInterpreter, listProfiles } = require('@/lib/st-api');

const result = evaluate('logic classical.propositional\\ncheck valid (P | !P)');
console.log(result.ok);
console.log(result.results[0].status);

const st = createInterpreter();
st.exec('logic classical.propositional');
st.exec('axiom a1 : P -> Q');
st.exec('axiom a2 : P');
console.log(st.exec('derive Q from {a1, a2}').stdout);
console.log(listProfiles());
\\\`\\\`\\\`

---
*Runtime documentado para EducacionCooperativa con \\\`@stevenvo780/st-lang\\\` ${ST_RUNTIME_VERSION} — https://github.com/stevenvo780/ST*
`;

interface UseDocumentActionsOptions {
    user: User | null;
    currentWorkspace: Workspace | null;
    docs: DocItem[];
    setDocs: React.Dispatch<React.SetStateAction<DocItem[]>>;
    folders: FolderItem[];
    setFolders: React.Dispatch<React.SetStateAction<FolderItem[]>>;
    setOpenTabs: React.Dispatch<React.SetStateAction<DocItem[]>>;
    activeFolder: string;
    requestDocsRefresh: (opts?: { force?: boolean }) => Promise<void>;
    showDialog: (config: DialogConfig) => Promise<DialogResult>;
    openDocument: (doc: DocItem) => Promise<void>;
    docsRef: { current: DocItem[] };
    foldersRef: { current: FolderItem[] };
    newDocName: string;
    setNewDocName: (name: string) => void;
    setIsCreating: (value: boolean) => void;
    renameSession: (id: string, name: string) => void;
}

interface UseDocumentActionsResult {
    createFolderRecord: (folderName: string, parentOverride?: string) => Promise<boolean>;
    createFolder: (parentFolder?: string) => Promise<void>;
    moveDocumentToFolder: (docId: string, folderPath: string) => Promise<void>;
    renameDocument: (doc: DocItem, nextName: string) => Promise<void>;
    promptRenameDocument: (doc: DocItem) => Promise<void>;
    promptRenameTerminalSession: (session: TerminalSession) => Promise<void>;
    reorderDocsInFolder: (payload: { folderPath: string; orderedIds: string[] }) => Promise<void>;
    reorderFoldersInParent: (payload: { parentPath: string; orderedPaths: string[] }) => Promise<void>;
    copyDocument: (docItem: DocItem) => Promise<void>;
    promptMoveDocument: (docItem: DocItem) => Promise<void>;
    createDoc: (e?: React.FormEvent, folderName?: string) => Promise<void>;
    createStDoc: (folderName?: string) => Promise<void>;
    createStGuide: () => Promise<void>;
    handleDownloadDoc: (doc: DocItem) => Promise<void>;
    handleDownloadFolder: (folderPath: string) => Promise<void>;
}

export function useDocumentActions({
    user,
    currentWorkspace,
    docs,
    setDocs,
    folders,
    setFolders,
    setOpenTabs,
    activeFolder,
    requestDocsRefresh,
    showDialog,
    openDocument,
    docsRef,
    foldersRef,
    newDocName,
    setNewDocName,
    setIsCreating,
    renameSession
}: UseDocumentActionsOptions): UseDocumentActionsResult {

    const createFolderRecord = async (folderName: string, parentOverride?: string): Promise<boolean> => {
        if (!user) return false;
        const trimmed = folderName.trim();
        if (!trimmed) return false;
        const parentPath = normalizePath(parentOverride ?? activeFolder);
        const fullPath = parentPath ? `${parentPath}/${trimmed}` : trimmed;
        const exists = folders.some(folder => folder.path.toLowerCase() === fullPath.toLowerCase());
        if (exists) return false;

        const workspaceId = currentWorkspace?.id ?? PERSONAL_WORKSPACE_ID;
        const docWorkspaceId = workspaceId === PERSONAL_WORKSPACE_ID ? PERSONAL_WORKSPACE_ID : workspaceId;
        try {
            await createDocumentApi({
                name: trimmed,
                type: 'folder',
                ownerId: user.uid,
                workspaceId: docWorkspaceId,
                folder: parentPath
            });
            await requestDocsRefresh();
            return true;
        } catch (error) {
            console.error('Failed to create folder', error);
            return false;
        }
    };

    const createFolder = async (parentFolder?: string) => {
        const result = await showDialog({
            type: DialogKind.Input,
            title: 'Nueva carpeta',
            message: 'Ingresa el nombre de la carpeta',
            placeholder: 'Nombre de carpeta'
        });
        if (!result.confirmed) return;
        const trimmed = (result.value ?? '').trim();
        if (!trimmed) return;
        const parentPath = normalizePath(parentFolder ?? activeFolder);
        const fullPath = parentPath ? `${parentPath}/${trimmed}` : trimmed;
        const exists = folders.some(folder => folder.path.toLowerCase() === fullPath.toLowerCase());
        if (exists) {
            await showDialog({ type: DialogKind.Info, title: 'La carpeta ya existe', message: fullPath });
            return;
        }
        const created = await createFolderRecord(trimmed, parentPath);
        if (!created) {
            await showDialog({ type: DialogKind.Error, title: 'No se pudo crear la carpeta' });
        }
    };

    const moveDocumentToFolder = async (docId: string, folderPath: string) => {
        const targetPath = normalizeFolderPath(folderPath);

        if (targetPath !== DEFAULT_FOLDER_NAME) {
            const segments = targetPath.split('/');
            const leafName = segments[segments.length - 1];
            const parentPath = segments.slice(0, -1).join('/');
            const exists = folders.some(folder => folder.path.toLowerCase() === targetPath.toLowerCase());
            if (!exists) {
                await createFolderRecord(leafName, parentPath);
            }
        }

        setDocs(prev => prev.map(item => item.id === docId ? { ...item, folder: targetPath } : item));
        setOpenTabs(prev => prev.map(item => item.id === docId ? { ...item, folder: targetPath } : item));

        try {
            await updateDocumentApi(docId, { folder: targetPath });
            await requestDocsRefresh();
        } catch (error) {
            console.error('Error moving document', error);
            await requestDocsRefresh({ force: true });
        }
    };

    const renameDocument = async (doc: DocItem, nextName: string) => {
        const trimmed = (nextName || '').trim();
        if (!trimmed || trimmed === doc.name) return;

        const parentPath = normalizeFolderPath(doc.folder);

        const duplicate = docsRef.current.some(item => (
            item.id !== doc.id
            && normalizeFolderPath(item.folder) === parentPath
            && (item.name || '').toLowerCase() === trimmed.toLowerCase()
            && item.type === doc.type
        ));

        if (duplicate) {
            await showDialog({
                type: DialogKind.Info,
                title: 'Nombre en uso',
                message: `Ya existe un elemento llamado "${trimmed}" en esta ubicación.`
            });
            return;
        }

        let oldFullPath = '';
        let newFullPath = '';
        let childrenToUpdate: DocItem[] = [];

        if (doc.type === 'folder') {
            oldFullPath = parentPath === DEFAULT_FOLDER_NAME ? doc.name : `${parentPath}/${doc.name}`;
            newFullPath = parentPath === DEFAULT_FOLDER_NAME ? trimmed : `${parentPath}/${trimmed}`;

            childrenToUpdate = docsRef.current.filter(d => {
                const f = normalizeFolderPath(d.folder);
                return f === oldFullPath || f.startsWith(`${oldFullPath}/`);
            });
        }

        setDocs(prev => prev.map(item => {
            if (item.id === doc.id) {
                return { ...item, name: trimmed };
            }
            if (doc.type === 'folder' && childrenToUpdate.some(c => c.id === item.id)) {
                const oldFolder = normalizeFolderPath(item.folder);
                let newFolder = oldFolder;
                if (oldFolder === oldFullPath) {
                    newFolder = newFullPath;
                } else if (oldFolder.startsWith(`${oldFullPath}/`)) {
                    newFolder = newFullPath + oldFolder.substring(oldFullPath.length);
                }
                return { ...item, folder: newFolder };
            }
            return item;
        }));

        setOpenTabs(prev => prev.map(item => item.id === doc.id ? { ...item, name: trimmed } : item));

        try {
            await updateDocumentApi(doc.id, { name: trimmed });

            if (doc.type === 'folder' && childrenToUpdate.length > 0) {
                await Promise.all(childrenToUpdate.map(child => {
                    const oldFolder = normalizeFolderPath(child.folder);
                    let newFolder = oldFolder;
                    if (oldFolder === oldFullPath) {
                        newFolder = newFullPath;
                    } else if (oldFolder.startsWith(`${oldFullPath}/`)) {
                        newFolder = newFullPath + oldFolder.substring(oldFullPath.length);
                    }
                    return updateDocumentApi(child.id, { folder: newFolder });
                }));
            }

            await requestDocsRefresh();
        } catch (error) {
            await requestDocsRefresh({ force: true });
            await showDialog({
                type: DialogKind.Error,
                title: 'No se pudo renombrar',
                message: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    const promptRenameDocument = async (doc: DocItem) => {
        const result = await showDialog({
            type: DialogKind.Input,
            title: 'Renombrar archivo',
            message: 'Ingresa el nuevo nombre para el archivo',
            defaultValue: doc.name,
            placeholder: 'Nuevo nombre'
        });

        if (!result.confirmed) return;
        const nextName = (result.value ?? '').trim();
        if (!nextName) return;
        await renameDocument(doc, nextName);
    };

    const promptRenameTerminalSession = useCallback(async (session: TerminalSession) => {
        const result = await showDialog({
            type: DialogKind.Input,
            title: 'Renombrar sesion',
            message: 'Ingresa el nuevo nombre para la sesion',
            defaultValue: session.name ?? '',
            placeholder: 'Nombre de sesion'
        });

        if (!result.confirmed) return;
        const nextName = (result.value ?? '').trim();
        if (!nextName || nextName === (session.name ?? '').trim()) return;

        renameSession(session.id, nextName);
        setOpenTabs(prev => prev.map(tab => (
            tab.type === 'terminal' && tab.sessionId === session.id ? { ...tab, name: nextName } : tab
        )));
    }, [renameSession, showDialog]); // eslint-disable-line react-hooks/exhaustive-deps

    const reorderDocsInFolder = useCallback(async (payload: { folderPath: string; orderedIds: string[] }) => {
        if (!payload.orderedIds.length) return;
        const orderUpdates = payload.orderedIds.map((id, index) => ({ id, order: (index + 1) * 1000 }));
        const updates = orderUpdates.filter(update => {
            const existing = docsRef.current.find(doc => doc.id === update.id);
            return existing?.order !== update.order;
        });
        if (updates.length === 0) return;

        const orderMap = new Map(updates.map(update => [update.id, update.order]));
        setDocs(prev => prev.map(doc => {
            const nextOrder = orderMap.get(doc.id);
            return typeof nextOrder === 'number' ? { ...doc, order: nextOrder } : doc;
        }));

        try {
            await Promise.all(updates.map(update => updateDocumentApi(update.id, { order: update.order })));
            await requestDocsRefresh();
        } catch (error) {
            console.error('Error reordering docs', error);
            await requestDocsRefresh({ force: true });
        }
    }, [requestDocsRefresh]); // eslint-disable-line react-hooks/exhaustive-deps

    const reorderFoldersInParent = useCallback(async (payload: { parentPath: string; orderedPaths: string[] }) => {
        if (!payload.orderedPaths.length) return;
        const folderMap = new Map(foldersRef.current.map(folder => [folder.path, folder]));
        const orderUpdates = payload.orderedPaths.map((path, index) => {
            const folder = folderMap.get(path);
            if (!folder?.docId) return null;
            return { path, docId: folder.docId, order: (index + 1) * 1000, currentOrder: folder.order };
        }).filter(Boolean) as Array<{ path: string; docId: string; order: number; currentOrder?: number }>;

        const updates = orderUpdates.filter(update => update.currentOrder !== update.order);
        if (updates.length === 0) return;

        const orderMap = new Map(orderUpdates.map(update => [update.path, update.order]));
        setFolders(prev => prev.map(folder => {
            const nextOrder = orderMap.get(folder.path);
            return typeof nextOrder === 'number' ? { ...folder, order: nextOrder } : folder;
        }));

        try {
            await Promise.all(updates.map(update => updateDocumentApi(update.docId, { order: update.order })));
            await requestDocsRefresh();
        } catch (error) {
            console.error('Error reordering folders', error);
            await requestDocsRefresh({ force: true });
        }
    }, [requestDocsRefresh]); // eslint-disable-line react-hooks/exhaustive-deps

    const copyDocument = async (docItem: DocItem) => {
        if (!user) return;
        if (docItem.type === 'folder') return;
        const workspaceId = currentWorkspace?.id ?? PERSONAL_WORKSPACE_ID;
        const docWorkspaceId = workspaceId === PERSONAL_WORKSPACE_ID ? PERSONAL_WORKSPACE_ID : workspaceId;
        const newName = `${docItem.name} (copia)`;
        let resolvedContent = '';
        if (docItem.type !== 'file') {
            if (typeof docItem.content === 'string') {
                resolvedContent = docItem.content;
            } else {
                try {
                    resolvedContent = await fetchDocumentRawApi(docItem.id);
                } catch (error) {
                    console.error('Error loading content for copy', error);
                    await showDialog({ type: DialogKind.Error, title: 'No se pudo cargar el contenido para copiar.' });
                    return;
                }
            }
        }
        const payload: Record<string, unknown> = {
            name: newName,
            type: docItem.type || 'text',
            ownerId: user.uid,
            workspaceId: docWorkspaceId,
            folder: normalizeFolderPath(docItem.folder),
            mimeType: docItem.mimeType || null
        };

        if (docItem.type === 'file') {
            payload.url = docItem.url || null;
            payload.storagePath = docItem.storagePath || null;
        } else {
            payload.content = resolvedContent;
        }

        try {
            const data = await createDocumentApi(payload);
            await requestDocsRefresh();
            openDocument({
                id: String(data.id),
                name: newName,
                type: docItem.type || 'text',
                ownerId: user.uid,
                updatedAt: { seconds: Date.now() / 1000 },
                folder: normalizeFolderPath(docItem.folder),
                mimeType: docItem.mimeType,
                url: docItem.url,
                storagePath: docItem.storagePath
            });
        } catch (error) {
            console.error('Error copying document', error);
            await showDialog({ type: DialogKind.Error, title: 'Error al copiar' });
        }
    };

    const promptMoveDocument = async (docItem: DocItem) => {
        const current = normalizeFolderPath(docItem.folder);
        const result = await showDialog({
            type: DialogKind.Input,
            title: 'Mover a carpeta',
            message: 'Ingresa la ruta de destino',
            defaultValue: current,
            placeholder: 'carpeta/subcarpeta'
        });
        if (!result.confirmed) return;
        const target = (result.value ?? '').trim();
        if (!target) return;
        await moveDocumentToFolder(docItem.id, target);
    };

    const createDoc = async (e?: React.FormEvent, folderName?: string) => {
        if (e) e.preventDefault();
        const name = newDocName.trim() || 'Sin título';
        if (!user) return;
        const targetFolder = normalizeFolderPath(folderName ?? activeFolder);
        const workspaceId = currentWorkspace?.id ?? PERSONAL_WORKSPACE_ID;
        const docWorkspaceId = workspaceId === PERSONAL_WORKSPACE_ID ? PERSONAL_WORKSPACE_ID : workspaceId;
        setIsCreating(true);
        try {
            const data = await createDocumentApi({
                name,
                content: `# ${name}`,
                type: 'text',
                ownerId: user.uid,
                workspaceId: docWorkspaceId,
                folder: targetFolder
            });
            const docRef = { id: String(data.id) };

            setNewDocName('');
            await requestDocsRefresh();
            openDocument({
                id: docRef.id,
                name,
                type: 'text',
                ownerId: user.uid,
                updatedAt: { seconds: Date.now() / 1000 },
                folder: targetFolder
            });
        } catch (e) {
            console.error('Error creating doc', e);
        } finally {
            setIsCreating(false);
        }
    };

    const createStDoc = async (folderName?: string) => {
        const baseName = newDocName.trim() || 'Sin título';
        const name = baseName.endsWith('.md.st') ? baseName : `${baseName}.md.st`;
        if (!user) return;
        const targetFolder = normalizeFolderPath(folderName ?? activeFolder);
        const workspaceId = currentWorkspace?.id ?? PERSONAL_WORKSPACE_ID;
        const docWorkspaceId = workspaceId === PERSONAL_WORKSPACE_ID ? PERSONAL_WORKSPACE_ID : workspaceId;
        const stTemplate = `logic classical.propositional\n\n// ${baseName}\n`;
        setIsCreating(true);
        try {
            const data = await createDocumentApi({
                name,
                content: stTemplate,
                type: 'text',
                ownerId: user.uid,
                workspaceId: docWorkspaceId,
                folder: targetFolder
            });
            const docRef = { id: String(data.id) };

            setNewDocName('');
            await requestDocsRefresh();
            openDocument({
                id: docRef.id,
                name,
                type: 'text',
                ownerId: user.uid,
                updatedAt: { seconds: Date.now() / 1000 },
                folder: targetFolder
            });
        } catch (err) {
            console.error('Error creating ST doc', err);
        } finally {
            setIsCreating(false);
        }
    };

    const createStGuide = async () => {
        if (!user) return;
        const name = 'ST_GUIDE.md';
        const targetFolder = DEFAULT_FOLDER_NAME;
        const workspaceId = currentWorkspace?.id ?? PERSONAL_WORKSPACE_ID;
        const docWorkspaceId = workspaceId === PERSONAL_WORKSPACE_ID ? PERSONAL_WORKSPACE_ID : workspaceId;

        // Check if guide already exists in current folder
        const exists = docsRef.current.some(d =>
            d.name === name && normalizeFolderPath(d.folder) === targetFolder
        );
        if (exists) {
            const existing = docsRef.current.find(d =>
                d.name === name && normalizeFolderPath(d.folder) === targetFolder
            );
            if (existing) {
                openDocument(existing);
                return;
            }
        }

        const guideContent = ST_GUIDE_CONTENT;
        setIsCreating(true);
        try {
            const data = await createDocumentApi({
                name,
                content: guideContent,
                type: 'text',
                ownerId: user.uid,
                workspaceId: docWorkspaceId,
                folder: targetFolder
            });
            setNewDocName('');
            await requestDocsRefresh();
            openDocument({
                id: String(data.id),
                name,
                type: 'text',
                ownerId: user.uid,
                updatedAt: { seconds: Date.now() / 1000 },
                folder: targetFolder
            });
        } catch (err) {
            console.error('Error creating ST guide', err);
        } finally {
            setIsCreating(false);
        }
    };

    const handleDownloadDoc = async (doc: DocItem) => {
        if (!doc) return;
        try {
            const { blob } = await downloadDocumentBlobApi(doc.id);
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = doc.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error('Download error:', err);
            showDialog({ type: DialogKind.Error, title: 'Error al descargar', message: 'No se pudo descargar el archivo.' });
        }
    };

    const handleDownloadFolder = async (folderPath: string) => {
        const folderName = folderPath.split('/').pop() || folderPath || 'carpeta';
        const folderDocs = docs.filter(d => {
            const docFolder = normalizeFolderPath(d.folder);
            return docFolder === folderPath || docFolder.startsWith(`${folderPath}/`);
        });
        if (folderDocs.length === 0) {
            showDialog({ type: DialogKind.Info, title: 'Carpeta vacía', message: 'No hay archivos para descargar en esta carpeta.' });
            return;
        }
        try {
            const JSZip = (await import('jszip')).default;
            const zip = new JSZip();
            for (const doc of folderDocs) {
                try {
                    const { blob } = await downloadDocumentBlobApi(doc.id);
                    const docFolder = normalizeFolderPath(doc.folder);
                    const relativePath = docFolder.startsWith(`${folderPath}/`)
                        ? docFolder.slice(folderPath.length + 1)
                        : '';
                    const fullPath = relativePath ? `${relativePath}/${doc.name}` : doc.name;
                    zip.file(fullPath, blob);
                } catch (err) {
                    console.warn(`Skipping ${doc.name}:`, err);
                }
            }
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const blobUrl = URL.createObjectURL(zipBlob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `${folderName}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error('Folder download error:', err);
            showDialog({ type: DialogKind.Error, title: 'Error al descargar', message: 'No se pudo descargar la carpeta.' });
        }
    };

    return {
        createFolderRecord,
        createFolder,
        moveDocumentToFolder,
        renameDocument,
        promptRenameDocument,
        promptRenameTerminalSession,
        reorderDocsInFolder,
        reorderFoldersInParent,
        copyDocument,
        promptMoveDocument,
        createDoc,
        createStDoc,
        createStGuide,
        handleDownloadDoc,
        handleDownloadFolder
    };
}
