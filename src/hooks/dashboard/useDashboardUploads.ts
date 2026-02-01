'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { DocItem, DialogConfig, DialogResult, UploadStatus, Workspace } from '@/components/dashboard/types';
import { DEFAULT_FOLDER_NAME, normalizeFolderPath, normalizePath } from '@/lib/folder-utils';
import { createDocumentApi, uploadFileApi } from '@/services/dashboardApi';
import { isMarkdownFile } from '@/services/dashboardDocUtils';
import type { User as FirebaseUser } from 'firebase/auth';

interface UseDashboardUploadsParams {
  user: FirebaseUser | null;
  currentWorkspace: Workspace | null;
  activeFolder: string;
  rootFolderPath: string;
  fileInputRef: React.RefObject<HTMLInputElement>;
  folderInputRef: React.RefObject<HTMLInputElement>;
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
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

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
    const workspaceId = currentWorkspace?.id ?? 'personal';
    const isPersonal = workspaceId === 'personal';
    const basePath = isPersonal ? `users/${user.uid}` : `workspaces/${workspaceId}`;

    return {
      workspaceId: isPersonal ? 'personal' : workspaceId,
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

  const collectDroppedFiles = useCallback(async (e: React.DragEvent) => {
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
    const oversized = files.filter(file => file.size > MAX_FILE_SIZE).map(file => file.name);
    const allowedFiles = files.filter(file => file.size <= MAX_FILE_SIZE);
    if (oversized.length > 0) {
      setUploadStatus({
        total: files.length,
        currentIndex: 0,
        currentName: '',
        progress: 0,
        phase: 'error',
        error: `Estos archivos superan 50MB: ${oversized.slice(0, 3).join(', ')}${oversized.length > 3 ? '…' : ''}`
      });
      scheduleUploadStatusClear();
    }
    if (allowedFiles.length === 0) {
      return;
    }
    const baseFolder = options?.preservePaths
      ? normalizePath(targetFolder ?? '')
      : normalizeFolderPath(targetFolder ?? DEFAULT_FOLDER_NAME);
    const context = getUploadContext();
    if (!context) return;

    if (uploadStatusTimer.current) {
      clearTimeout(uploadStatusTimer.current);
    }
    setUploadStatus({
      total: allowedFiles.length,
      currentIndex: 0,
      currentName: '',
      progress: 0,
      phase: 'uploading'
    });
    try {
      const createdDocs: DocItem[] = [];
      for (let i = 0; i < allowedFiles.length; i += 1) {
        const file = allowedFiles[i];
        setUploadStatus(prev => prev ? {
          ...prev,
          currentIndex: i + 1,
          currentName: file.name,
          progress: 0,
          phase: 'uploading',
          error: undefined
        } : prev);

        const relativeDir = options?.preservePaths ? getRelativeDir(file) : '';
        const resolvedFolder = joinPaths(baseFolder, relativeDir) || DEFAULT_FOLDER_NAME;

        if (isMarkdownFile(file)) {
          const content = await file.text();

          const data = await createDocumentApi({
            name: file.name,
            content: content,
            type: 'text',
            mimeType: file.type || 'text/markdown',
            ownerId: user.uid,
            workspaceId: context.workspaceId,
            folder: resolvedFolder
          });

          setUploadStatus(prev => prev ? { ...prev, progress: 100 } : prev);
          createdDocs.push({
            id: String(data.id),
            name: file.name,
            type: 'text',
            mimeType: file.type || 'text/markdown',
            ownerId: user.uid,
            updatedAt: { seconds: Date.now() / 1000 },
            folder: resolvedFolder
          });
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('ownerId', user.uid);
        formData.append('workspaceId', context.workspaceId || 'personal');
        formData.append('folder', resolvedFolder);

        const newDoc = await uploadFileApi(formData);
        createdDocs.push({ ...newDoc, folder: newDoc.folder ?? resolvedFolder });

        setUploadStatus(prev => prev ? { ...prev, progress: 100 } : prev);
      }

      await fetchDocs();
      if (createdDocs.length === 1) {
        openDocument(createdDocs[0]);
      }
      setUploadStatus(prev => prev ? { ...prev, progress: 100, phase: 'done' } : prev);
      scheduleUploadStatusClear();
    } catch (error) {
      console.error('Upload failed', error);
      setUploadStatus(prev => prev ? {
        ...prev,
        phase: 'error',
        error: 'Error al subir'
      } : prev);
      scheduleUploadStatusClear();
      await showDialog({ type: 'error', title: 'Error al subir archivo' });
    }
  }, [
    user,
    getUploadContext,
    scheduleUploadStatusClear,
    getRelativeDir,
    joinPaths,
    MAX_FILE_SIZE,
    fetchDocs,
    openDocument,
    showDialog
  ]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const targetFolder = uploadTargetFolder ?? DEFAULT_FOLDER_NAME;
    setUploadTargetFolder(null);
    await uploadFiles(files, targetFolder);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [uploadTargetFolder, uploadFiles, fileInputRef]);

  const handleFolderUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const targetFolder = uploadTargetFolder ?? activeFolder ?? rootFolderPath;
    setUploadTargetFolder(null);
    await uploadFiles(files, targetFolder, { preservePaths: true });
    if (folderInputRef.current) folderInputRef.current.value = '';
  }, [uploadTargetFolder, activeFolder, rootFolderPath, uploadFiles, folderInputRef]);

  const isFileDrag = useCallback((e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer?.types ?? []);
    if (types.includes('Files')) return true;
    return Array.from(e.dataTransfer?.items ?? []).some(item => item.kind === 'file');
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    setIsDragActive(true);
  }, [isFileDrag]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!isDragActive) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragActive(false);
    }
  }, [isDragActive]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, [isFileDrag]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragActive(false);
    const { files, preservePaths } = await collectDroppedFiles(e);
    if (files.length === 0) return;
    await uploadFiles(files, DEFAULT_FOLDER_NAME, { preservePaths });
  }, [collectDroppedFiles, isFileDrag, uploadFiles]);

  const uploadDroppedFilesToFolder = useCallback(async (e: React.DragEvent, targetFolder: string) => {
    const { files, preservePaths } = await collectDroppedFiles(e);
    if (files.length === 0) return false;
    e.preventDefault();
    e.stopPropagation();
    await uploadFiles(files, targetFolder, { preservePaths });
    return true;
  }, [collectDroppedFiles, uploadFiles]);

  return {
    uploadStatus,
    isDragActive,
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
