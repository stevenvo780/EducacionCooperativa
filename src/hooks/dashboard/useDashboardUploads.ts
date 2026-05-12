'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type RefObject
} from 'react';
import { isInternalDragActive as isInternalDragActiveCheck, markInternalDragEnd } from '@/lib/internal-drag-flag';
import { DialogKind, UploadPhase, type DocItem, type DialogConfig, type DialogResult, type UploadStatus, type Workspace } from '@/components/dashboard/types';
import { getErrorCode, getErrorMessage } from '@/lib/error-utils';
import { DEFAULT_FOLDER_NAME, normalizeFolderPath, normalizePath } from '@/lib/folder-utils';
import { createDocumentApi, uploadFileApi } from '@/services/dashboardApi';
import { isMarkdownConvertibleFile, isMarkdownDocItem, isMarkdownFile } from '@/services/dashboardDocUtils';
import { convertToMarkdown, canConvertToMarkdown } from '@/lib/clientMarkdownConversion';
import {
  MULTIPART_THRESHOLD_BYTES,
  MultipartUnsupportedError,
  uploadFileMultipart
} from '@/lib/multipart-upload';
import { authFetch } from '@/services/apiClient';
import type { User as FirebaseUser } from 'firebase/auth';
import { DocumentType } from '@/types/documents';
import { PERSONAL_WORKSPACE_ID, isPersonalWorkspaceId } from '@/types/workspace';

interface UploadLargeFileParams {
  file: File;
  workspaceId: string;
  folder: string;
  ownerId: string;
  onProgress?: (loadedBytes: number, totalBytes: number) => void;
}

async function uploadLargeFile(params: UploadLargeFileParams): Promise<DocItem> {
  const { file, workspaceId, folder, onProgress } = params;
  const mimeType = (file.type && file.type.trim()) || 'application/octet-stream';

  try {
    const completed = await uploadFileMultipart({
      file,
      workspaceId,
      folder,
      onProgress: (event) => onProgress?.(event.loadedBytes, event.totalBytes)
    });
    return {
      id: completed.id,
      name: completed.originalName,
      type: DocumentType.File,
      mimeType: completed.mimeType,
      ownerId: params.ownerId,
      updatedAt: { seconds: Date.now() / 1000 },
      folder: completed.folder,
      storagePath: completed.storagePath,
      size: completed.size
    };
  } catch (err) {
    if (!(err instanceof MultipartUnsupportedError)) throw err;
  }

  const signedUrlRes = await authFetch('/api/upload/signed-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      mimeType,
      workspaceId,
      folder,
      fileSize: file.size
    })
  });

  if (!signedUrlRes.ok) {
    if (signedUrlRes.status === 413) {
      throw new Error('Límite de almacenamiento alcanzado');
    }
    throw new Error(`Failed to get upload URL: HTTP ${signedUrlRes.status}`);
  }

  const rawSigned = await signedUrlRes.json() as Record<string, unknown>;
  const signedUrl = typeof rawSigned['signedUrl'] === 'string' ? rawSigned['signedUrl'] : null;
  const storagePath = typeof rawSigned['storagePath'] === 'string' ? rawSigned['storagePath'] : null;
  const fileName = typeof rawSigned['fileName'] === 'string' ? rawSigned['fileName'] : file.name;
  const originalName = typeof rawSigned['originalName'] === 'string' ? rawSigned['originalName'] : file.name;
  const signedMime = typeof rawSigned['mimeType'] === 'string' ? rawSigned['mimeType'] : mimeType;
  const respWorkspaceId = typeof rawSigned['workspaceId'] === 'string' ? rawSigned['workspaceId'] : workspaceId;
  const respFolder = typeof rawSigned['folder'] === 'string' ? rawSigned['folder'] : folder;
  if (!signedUrl || !storagePath) {
    throw new Error('Signed URL response inválido: signedUrl/storagePath ausente');
  }

  const putRes = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': signedMime },
    body: file
  });
  if (!putRes.ok) {
    throw new Error(`Direct upload failed: HTTP ${putRes.status}`);
  }
  onProgress?.(file.size, file.size);

  const registerRes = await authFetch('/api/upload/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storagePath,
      fileName,
      originalName,
      mimeType: signedMime,
      workspaceId: respWorkspaceId,
      folder: respFolder
    })
  });
  if (!registerRes.ok) {
    throw new Error(`Failed to register upload: HTTP ${registerRes.status}`);
  }
  return (await registerRes.json()) as DocItem;
}

interface UseDashboardUploadsParams {
  user: FirebaseUser | null;
  currentWorkspace: Workspace | null;
  activeFolder: string;
  rootFolderPath: string;
  fileInputRef: RefObject<HTMLInputElement>;
  folderInputRef: RefObject<HTMLInputElement>;
  fetchDocs: (options?: { showLoading?: boolean }) => Promise<void> | void;
  openDocument: (doc: DocItem) => void;
  showDialog: (config: DialogConfig) => Promise<DialogResult>;
}

export const useDashboardUploads = ({
  user,
  currentWorkspace,
  activeFolder,
  rootFolderPath,
  fileInputRef,
  folderInputRef,
  fetchDocs,
  openDocument,
  showDialog
}: UseDashboardUploadsParams) => {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [uploadTargetFolder, setUploadTargetFolder] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const uploadStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    const folderInput = folderInputRef.current;
    if (!folderInput) return;
    folderInput.setAttribute('webkitdirectory', 'true');
    folderInput.setAttribute('directory', 'true');
  }, [folderInputRef]);

  useEffect(() => () => {
    if (uploadStatusTimer.current) {
      clearTimeout(uploadStatusTimer.current);
    }
  }, []);

  const scheduleUploadStatusClear = useCallback(() => {
    if (uploadStatusTimer.current) {
      clearTimeout(uploadStatusTimer.current);
    }
    uploadStatusTimer.current = setTimeout(() => setUploadStatus(null), 2000);
  }, []);

  const getUploadContext = useCallback(() => {
    if (!user) return null;
    const workspaceId = currentWorkspace?.id ?? PERSONAL_WORKSPACE_ID;
    const isPersonal = isPersonalWorkspaceId(workspaceId);
    const basePath = isPersonal ? `users/${user.uid}` : `workspaces/${workspaceId}`;

    return {
      workspaceId: isPersonal ? PERSONAL_WORKSPACE_ID : workspaceId,
      storageFolder: `${basePath}/${DEFAULT_FOLDER_NAME}`
    };
  }, [user, currentWorkspace]);

  const getRelativeDir = useCallback((file: File) => {
    const raw = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? '';
    if (!raw) return '';
    return normalizePath(raw.split('/').slice(0, -1).join('/'));
  }, []);

  const joinPaths = useCallback((...parts: string[]) => normalizePath(parts.filter(Boolean).join('/')), []);

  type FileSystemEntry = {
    isFile: boolean;
    isDirectory: boolean;
    name: string;
    fullPath?: string;
    file?: (success: (file: File) => void, error?: (err: unknown) => void) => void;
    createReader?: () => FileSystemDirectoryReader;
  };

  type FileSystemDirectoryReader = {
    readEntries: (success: (entries: FileSystemEntry[]) => void, error?: (err: unknown) => void) => void;
  };

  const readAllEntries = useCallback(async (dirEntry: FileSystemEntry) => {
    const reader = dirEntry.createReader?.();
    if (!reader) return [];
    const all: FileSystemEntry[] = [];
    while (true) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
        reader.readEntries(resolve, reject);
      });
      if (batch.length === 0) break;
      all.push(...batch);
    }
    return all;
  }, []);

  const collectFilesFromEntry = useCallback(async (entry: FileSystemEntry): Promise<File[]> => {
    if (entry.isFile && entry.file) {
      const file = await new Promise<File>((resolve, reject) => entry.file?.(resolve, reject));
      const rawPath = entry.fullPath ?? file.name;
      const relativePath = rawPath.startsWith('/') ? rawPath.slice(1) : rawPath;
      if (relativePath) {
        Object.defineProperty(file, 'webkitRelativePath', { value: relativePath });
      }
      return [file];
    }
    if (entry.isDirectory) {
      const entries = await readAllEntries(entry);
      const nested = await Promise.all(entries.map(collectFilesFromEntry));
      return nested.flat();
    }
    return [];
  }, [readAllEntries]);

  const collectDroppedFiles = useCallback(async (e: DragEvent) => {
    const items = Array.from(e.dataTransfer.items ?? []);
    if (items.length === 0) {
      return { files: Array.from(e.dataTransfer.files ?? []), preservePaths: false };
    }
    const entries = items
      .map(item => (item as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null }).webkitGetAsEntry?.())
      .filter((entry) => Boolean(entry)) as FileSystemEntry[];
    if (entries.length === 0) {
      return { files: Array.from(e.dataTransfer.files ?? []), preservePaths: false };
    }
    const fileGroups = await Promise.all(entries.map(collectFilesFromEntry));
    const files = fileGroups.flat();
    const preservePaths = entries.some(entry => entry.isDirectory) || files.some(file => !!(file as File & { webkitRelativePath?: string }).webkitRelativePath);
    return { files, preservePaths };
  }, [collectFilesFromEntry]);

  const uploadFiles = useCallback(async (
    files: File[],
    targetFolder?: string,
    options?: { preservePaths?: boolean }
  ) => {
    if (!user || files.length === 0) return;
    const baseFolder = options?.preservePaths
      ? normalizePath(targetFolder ?? '')
      : normalizeFolderPath(targetFolder ?? DEFAULT_FOLDER_NAME);
    const context = getUploadContext();
    if (!context) return;

    if (uploadStatusTimer.current) {
      clearTimeout(uploadStatusTimer.current);
    }
    setUploadStatus({
      total: files.length,
      currentIndex: 0,
      currentName: '',
      progress: 0,
      phase: UploadPhase.Uploading
    });
    try {
      const createdDocs: DocItem[] = [];
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i]!;
        setUploadStatus(prev => prev ? {
          ...prev,
          currentIndex: i + 1,
          currentName: file.name,
          progress: 0,
          phase: UploadPhase.Uploading,
          error: undefined
        } : prev);

        const relativeDir = options?.preservePaths ? getRelativeDir(file) : '';
        const resolvedFolder = joinPaths(baseFolder, relativeDir) || DEFAULT_FOLDER_NAME;
        const shouldConvert = isMarkdownConvertibleFile(file) && !isMarkdownFile(file);

        if (isMarkdownFile(file)) {
          const content = await file.text();

          const data = await createDocumentApi({
            name: file.name,
            content,
            type: DocumentType.Text,
            mimeType: file.type || 'text/markdown',
            ownerId: user.uid,
            workspaceId: context.workspaceId,
            folder: resolvedFolder
          });

          setUploadStatus(prev => prev ? { ...prev, progress: 100 } : prev);
          createdDocs.push({
            id: String(data.id),
            name: file.name,
            type: DocumentType.Text,
            mimeType: file.type || 'text/markdown',
            ownerId: user.uid,
            updatedAt: { seconds: Date.now() / 1000 },
            folder: resolvedFolder
          });
          continue;
        }

        let newDoc: DocItem;
        if (file.size > MULTIPART_THRESHOLD_BYTES) {
          newDoc = await uploadLargeFile({
            file,
            workspaceId: context.workspaceId || PERSONAL_WORKSPACE_ID,
            folder: resolvedFolder,
            ownerId: user.uid,
            onProgress: (loaded, total) => {
              const progress = total > 0 ? Math.round((loaded / total) * 100) : 0;
              setUploadStatus(prev => prev ? { ...prev, progress } : prev);
            }
          });
        } else {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('ownerId', user.uid);
          formData.append('workspaceId', context.workspaceId || PERSONAL_WORKSPACE_ID);
          formData.append('folder', resolvedFolder);
          newDoc = await uploadFileApi(formData);
        }
        const fileDoc = { ...newDoc, folder: newDoc.folder ?? resolvedFolder };
        createdDocs.push(fileDoc);

        // Client-side markdown conversion (no server limits!)
        if (shouldConvert && canConvertToMarkdown(file)) {
          try {
            setUploadStatus(prev => prev ? {
              ...prev,
              phase: UploadPhase.Converting,
              progress: 0
            } : prev);

            const conversion = await convertToMarkdown(file, (progress) => {
              setUploadStatus(prev => prev ? { ...prev, progress } : prev);
            });

            const mdDoc = await createDocumentApi({
              name: conversion.suggestedName,
              content: conversion.markdown,
              type: DocumentType.Text,
              mimeType: 'text/markdown',
              ownerId: user.uid,
              workspaceId: context.workspaceId,
              folder: resolvedFolder
            });

            createdDocs.push({
              id: String(mdDoc.id),
              name: conversion.suggestedName,
              type: DocumentType.Text,
              mimeType: 'text/markdown',
              ownerId: user.uid,
              updatedAt: { seconds: Date.now() / 1000 },
              folder: resolvedFolder
            });
          } catch (conversionError) {
            console.error('Markdown conversion failed', conversionError);
          }
        }

        setUploadStatus(prev => prev ? { ...prev, progress: 100 } : prev);
      }

      await fetchDocs();
      const docToOpen = createdDocs.find(doc => isMarkdownDocItem(doc)) ?? createdDocs[0];
      if (docToOpen) {
        openDocument(docToOpen);
      }
      setUploadStatus(prev => prev ? { ...prev, progress: 100, phase: UploadPhase.Done } : prev);
      scheduleUploadStatusClear();
    } catch (error: unknown) {
      console.error('Upload failed', error);
      const isStorageLimit = getErrorCode(error) === 'STORAGE_LIMIT_EXCEEDED';
      const detail = getErrorMessage(error, 'Error desconocido');
      setUploadStatus(prev => prev ? {
        ...prev,
        phase: UploadPhase.Error,
        error: isStorageLimit
          ? getErrorMessage(error, 'Límite de almacenamiento alcanzado')
          : `Error al subir: ${detail}`
      } : prev);
      scheduleUploadStatusClear();
      await showDialog({
        type: DialogKind.Error,
        title: isStorageLimit
          ? 'Límite de almacenamiento alcanzado'
          : 'Error al subir archivo',
        message: isStorageLimit ? undefined : detail
      });
    }
  }, [
    user,
    getUploadContext,
    scheduleUploadStatusClear,
    getRelativeDir,
    joinPaths,
    fetchDocs,
    openDocument,
    showDialog
  ]);

  const handleFileUpload = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const targetFolder = uploadTargetFolder ?? DEFAULT_FOLDER_NAME;
    setUploadTargetFolder(null);
    await uploadFiles(files, targetFolder);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [uploadTargetFolder, uploadFiles, fileInputRef]);

  const handleFolderUpload = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const targetFolder = uploadTargetFolder ?? activeFolder ?? rootFolderPath;
    setUploadTargetFolder(null);
    await uploadFiles(files, targetFolder, { preservePaths: true });
    if (folderInputRef.current) folderInputRef.current.value = '';
  }, [uploadTargetFolder, activeFolder, rootFolderPath, uploadFiles, folderInputRef]);

  const dragSafetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDragSafety = useCallback(() => {
    if (dragSafetyTimer.current) {
      clearTimeout(dragSafetyTimer.current);
      dragSafetyTimer.current = null;
    }
  }, []);

  const startDragSafety = useCallback(() => {
    clearDragSafety();
    dragSafetyTimer.current = setTimeout(() => {
      // Safety: auto-dismiss overlay if drag gets stuck (e.g. tablet bugs)
      dragCounter.current = 0;
      setIsDragActive(false);
    }, 8000);
  }, [clearDragSafety]);

  const dismissDragOverlay = useCallback(() => {
    clearDragSafety();
    dragCounter.current = 0;
    setIsDragActive(false);
  }, [clearDragSafety]);

  // Safety: always clear the internal drag flag when ANY drag ends globally.
  // This prevents the flag from getting stuck if a dragEnd is missed.
  useEffect(() => {
    const clearOnDragEnd = () => markInternalDragEnd();
    document.addEventListener('dragend', clearOnDragEnd);
    return () => document.removeEventListener('dragend', clearOnDragEnd);
  }, []);

  const isFileDrag = useCallback((e: DragEvent) => {
    // Application-level flag: the most reliable check on all devices.
    // On tablets, dataTransfer.types/items are restricted during
    // dragenter/dragover, so we cannot trust them to distinguish
    // internal drags from real file drags.
    if (isInternalDragActiveCheck()) {
      return false;
    }

    const types = Array.from(e.dataTransfer?.types ?? []);
    const isInternalDashboardDrag = types.includes('application/x-dashboard-internal-drag')
      || types.includes('application/x-doc-id')
      || types.includes('application/x-doc-reorder')
      || types.includes('application/x-folder-reorder');

    if (isInternalDashboardDrag) {
      return false;
    }

    if (types.includes('Files')) return true;
    return Array.from(e.dataTransfer?.items ?? []).some(item => item.kind === 'file');
  }, []);

  const handleDragEnter = useCallback((e: DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    setIsDragActive(true);
    startDragSafety();
  }, [isFileDrag, startDragSafety]);

  const handleDragLeave = useCallback((e: DragEvent) => {
    if (!isDragActive) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragActive(false);
      clearDragSafety();
    }
  }, [isDragActive, clearDragSafety]);

  const handleDragOver = useCallback((e: DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, [isFileDrag]);

  const handleDrop = useCallback(async (e: DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragActive(false);
    clearDragSafety();
    const { files, preservePaths } = await collectDroppedFiles(e);
    if (files.length === 0) return;
    const targetFolder = activeFolder || DEFAULT_FOLDER_NAME;
    await uploadFiles(files, targetFolder, { preservePaths });
  }, [collectDroppedFiles, isFileDrag, uploadFiles, activeFolder, clearDragSafety]);

  const uploadDroppedFilesToFolder = useCallback(async (e: DragEvent, targetFolder: string) => {
    const { files, preservePaths } = await collectDroppedFiles(e);
    if (files.length === 0) return false;
    e.preventDefault();
    e.stopPropagation();
    await uploadFiles(files, targetFolder, { preservePaths });
    return true;
  }, [collectDroppedFiles, uploadFiles]);

  // Cleanup safety timer on unmount
  useEffect(() => () => { clearDragSafety(); }, [clearDragSafety]);

  return {
    uploadStatus,
    isDragActive,
    dismissDragOverlay,
    setUploadTargetFolder,
    handleFileUpload,
    handleFolderUpload,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    uploadDroppedFilesToFolder
  };
};
