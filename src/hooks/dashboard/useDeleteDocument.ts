'use client';

import { useCallback, useRef, useState } from 'react';
import { deleteDocumentApi, retireFolderApi } from '@/services/dashboardApi';
import { normalizePath, normalizeFolderPath, DEFAULT_FOLDER_NAME } from '@/lib/folder-utils';
import { DeletePhase, DialogKind, type DeleteStatus, type DocItem, type FolderItem, type DialogConfig, type DialogResult } from '@/components/dashboard/types';

interface UseDeleteDocumentOptions {
    docs: DocItem[];
    folders: FolderItem[];
    requestDocsRefresh: (opts?: { force?: boolean }) => Promise<void>;
    closeTabById: (docId: string) => Promise<void>;
    showDialog: (config: DialogConfig) => Promise<DialogResult>;
    setDocs: React.Dispatch<React.SetStateAction<DocItem[]>>;
    workspaceId?: string;
}

interface UseDeleteDocumentResult {
    deleteStatus: DeleteStatus | null;
    deletingIds: Record<string, boolean>;
    deleteDocRecords: (uniqueIds: string[], label: string) => Promise<void>;
    deleteItems: (payload: { docIds: string[]; folderPaths: string[] }) => Promise<void>;
    deleteFolder: (folder: FolderItem) => Promise<void>;
}

export function useDeleteDocument({
    docs,
    folders,
    requestDocsRefresh,
    closeTabById,
    showDialog,
    setDocs,
    workspaceId
}: UseDeleteDocumentOptions): UseDeleteDocumentResult {
    const [deleteStatus, setDeleteStatus] = useState<DeleteStatus | null>(null);
    const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});
    const deleteStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const scheduleDeleteStatusClear = useCallback(() => {
        if (deleteStatusTimer.current) {
            clearTimeout(deleteStatusTimer.current);
        }
        deleteStatusTimer.current = setTimeout(() => setDeleteStatus(null), 2000);
    }, []);

    const deleteDocRecords = useCallback(async (uniqueIds: string[], label: string) => {
        setDeletingIds(prev => {
            const next = { ...prev };
            uniqueIds.forEach(id => { next[id] = true; });
            return next;
        });

        try {
            if (deleteStatusTimer.current) {
                clearTimeout(deleteStatusTimer.current);
            }
            setDeleteStatus({ phase: DeletePhase.Deleting, name: label });

            const results = await Promise.all(
                uniqueIds.map(async id => {
                    try {
                        const ok = await deleteDocumentApi(id);
                        return { id, ok };
                    } catch {
                        return { id, ok: false };
                    }
                })
            );

            const failed = results.filter(result => !result.ok).map(result => result.id);
            const succeeded = results.filter(result => result.ok).map(result => result.id);

            if (succeeded.length > 0) {
                const succeededSet = new Set(succeeded);
                setDocs(prev => prev.filter(item => !succeededSet.has(item.id)));
                succeeded.forEach(id => closeTabById(id));
            }
            await requestDocsRefresh({ force: true });

            if (failed.length > 0) {
                console.error('Error deleting', failed);
                setDeleteStatus({ phase: DeletePhase.Error, name: label, error: 'Error al eliminar' });
                await showDialog({ type: DialogKind.Error, title: 'Error al eliminar' });
            } else {
                setDeleteStatus({ phase: DeletePhase.Done, name: label });
            }
            scheduleDeleteStatusClear();
        } catch {
            setDeleteStatus({ phase: DeletePhase.Error, name: label, error: 'Error al eliminar' });
            scheduleDeleteStatusClear();
        } finally {
            setDeletingIds(prev => {
                const next = { ...prev };
                uniqueIds.forEach(id => { delete next[id]; });
                return next;
            });
        }
    }, [closeTabById, requestDocsRefresh, scheduleDeleteStatusClear, setDocs, showDialog]);

    const deleteItems = useCallback(async ({ docIds, folderPaths }: { docIds: string[]; folderPaths: string[] }) => {
        const filteredFolderPaths = folderPaths
            .map(path => normalizePath(path))
            .filter(path => path && path !== DEFAULT_FOLDER_NAME);

        if (filteredFolderPaths.length !== folderPaths.length) {
            await showDialog({ type: DialogKind.Info, title: 'No se puede eliminar la carpeta raíz.' });
        }

        const folderPathSet = new Set(filteredFolderPaths);
        const folderDocIds = new Set<string>();
        const docIdsFromFolders = new Set<string>();

        const isPathInTargets = (path: string): boolean => {
            if (!path) return false;
            if (folderPathSet.has(path)) return true;
            let cursor = path;
            while (cursor.includes('/')) {
                cursor = cursor.slice(0, cursor.lastIndexOf('/'));
                if (folderPathSet.has(cursor)) return true;
            }
            return false;
        };

        folders.forEach(folder => {
            if (folder.docId && isPathInTargets(folder.path)) {
                folderDocIds.add(folder.docId);
            }
        });
        docs.forEach(doc => {
            const docFolder = normalizeFolderPath(doc.folder);
            if (isPathInTargets(docFolder)) {
                docIdsFromFolders.add(doc.id);
            }
        });

        const allDocIds = Array.from(new Set([...docIds, ...folderDocIds, ...docIdsFromFolders]));

        if (allDocIds.length === 0 && filteredFolderPaths.length === 0) return;

        if (allDocIds.length === 0) {
            const confirmResult = await showDialog({
                type: DialogKind.Confirm,
                title: 'Confirmar eliminación',
                message: '¿Eliminar la carpeta vacía? Esta acción no se puede deshacer.',
                confirmLabel: 'Eliminar',
                cancelLabel: 'Cancelar',
                danger: true
            });
            if (!confirmResult.confirmed) return;
            await requestDocsRefresh({ force: true });
            setDeleteStatus({ phase: DeletePhase.Done, name: 'Carpeta eliminada' });
            scheduleDeleteStatusClear();
            return;
        }

        const label = allDocIds.length === 1 ? 'Elemento' : `${allDocIds.length} elementos`;
        const confirmResult = await showDialog({
            type: DialogKind.Confirm,
            title: 'Confirmar eliminación',
            message: `¿Eliminar ${label}? Esta acción no se puede deshacer.`,
            confirmLabel: 'Eliminar',
            cancelLabel: 'Cancelar',
            danger: true
        });
        if (!confirmResult.confirmed) return;
        await deleteDocRecords(allDocIds, label);
    }, [deleteDocRecords, docs, folders, requestDocsRefresh, scheduleDeleteStatusClear, showDialog]);

    const deleteFolder = useCallback(async (folder: FolderItem) => {
        if (folder.path === DEFAULT_FOLDER_NAME || folder.kind === 'system') {
            await showDialog({ type: DialogKind.Info, title: 'No se puede eliminar la carpeta raíz.' });
            return;
        }
        // Sin workspaceId no podemos usar la ruta con respaldo; caemos al
        // borrado por-doc (sigue limpiando docs+blobs, sin recycle).
        if (!workspaceId) {
            await deleteItems({ docIds: [], folderPaths: [folder.path] });
            return;
        }
        // Retirar de la nube CON respaldo: el backend mueve los blobs del
        // subárbol a recycle/ (recuperable) y borra los docs.
        const folderLabel = folder.path.split('/').filter(Boolean).pop() || folder.path;
        const confirmResult = await showDialog({
            type: DialogKind.Confirm,
            title: `Retirar "${folderLabel}" de la nube`,
            message: 'Se quita la carpeta y todo su contenido del workspace. Los archivos quedan respaldados (recuperables) y dejan de ocupar espacio.',
            confirmLabel: 'Retirar',
            cancelLabel: 'Cancelar',
            danger: true
        });
        if (!confirmResult.confirmed) return;
        if (deleteStatusTimer.current) clearTimeout(deleteStatusTimer.current);
        setDeleteStatus({ phase: DeletePhase.Deleting, name: folderLabel });
        try {
            const r = await retireFolderApi(workspaceId, folder.path);
            await requestDocsRefresh({ force: true });
            setDeleteStatus({ phase: DeletePhase.Done, name: `Retirada (${r.retiredDocs} ítems)` });
        } catch (e) {
            console.error('[retire-folder]', e);
            setDeleteStatus({ phase: DeletePhase.Error, name: folderLabel, error: 'Error al retirar' });
            await showDialog({ type: DialogKind.Error, title: 'Error al retirar la carpeta' });
        }
        scheduleDeleteStatusClear();
    }, [workspaceId, deleteItems, showDialog, requestDocsRefresh, scheduleDeleteStatusClear]);

    return { deleteStatus, deletingIds, deleteDocRecords, deleteItems, deleteFolder };
}
