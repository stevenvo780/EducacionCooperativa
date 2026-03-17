'use client';

import { useCallback, useRef, useState } from 'react';
import { deleteDocumentApi } from '@/services/dashboardApi';
import { normalizePath, normalizeFolderPath, DEFAULT_FOLDER_NAME } from '@/lib/folder-utils';
import { DeletePhase, DialogKind, type DeleteStatus, type DocItem, type FolderItem } from '@/components/dashboard/types';
import type { DialogConfig, DialogResult } from '@/components/dashboard/types';

interface UseDeleteDocumentOptions {
    docs: DocItem[];
    folders: FolderItem[];
    requestDocsRefresh: (opts?: { force?: boolean }) => Promise<void>;
    closeTabById: (docId: string) => Promise<void>;
    showDialog: (config: DialogConfig) => Promise<DialogResult>;
    setDocs: React.Dispatch<React.SetStateAction<DocItem[]>>;
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

    const isWithinFolder = useCallback((candidate: string, folderPath: string) => {
        if (!candidate) return false;
        return candidate === folderPath || candidate.startsWith(`${folderPath}/`);
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
                setDocs(prev => prev.filter(item => !succeeded.includes(item.id)));
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

        const folderDocIds = new Set<string>();
        const docIdsFromFolders = new Set<string>();

        filteredFolderPaths.forEach(folderPath => {
            folders.forEach(folder => {
                if (folder.docId && isWithinFolder(folder.path, folderPath)) {
                    folderDocIds.add(folder.docId);
                }
            });
            docs.forEach(doc => {
                const docFolder = normalizeFolderPath(doc.folder);
                if (isWithinFolder(docFolder, folderPath)) {
                    docIdsFromFolders.add(doc.id);
                }
            });
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
    }, [deleteDocRecords, docs, folders, isWithinFolder, requestDocsRefresh, scheduleDeleteStatusClear, showDialog]);

    const deleteFolder = useCallback(async (folder: FolderItem) => {
        if (folder.path === DEFAULT_FOLDER_NAME || folder.kind === 'system') {
            await showDialog({ type: DialogKind.Info, title: 'No se puede eliminar la carpeta raíz.' });
            return;
        }
        await deleteItems({ docIds: [], folderPaths: [folder.path] });
    }, [deleteItems, showDialog]);

    return { deleteStatus, deletingIds, deleteDocRecords, deleteItems, deleteFolder };
}
