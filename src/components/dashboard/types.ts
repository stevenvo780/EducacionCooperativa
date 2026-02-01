import type { DocItem, FolderItem as MosaicFolderItem, ViewMode } from '@/components/MosaicLayout';

export type { DocItem, ViewMode };
export type FolderItem = MosaicFolderItem;

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  members: string[];
  pendingInvites?: string[];
  type: 'personal' | 'shared';
}

export type DialogKind = 'info' | 'error' | 'confirm' | 'input';

export interface DialogConfig {
  type: DialogKind;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export type DialogResult = { confirmed: boolean; value?: string | null };

export interface UploadStatus {
  total: number;
  currentIndex: number;
  currentName: string;
  progress: number;
  phase: 'uploading' | 'done' | 'error';
  error?: string;
}

export interface DeleteStatus {
  phase: 'deleting' | 'done' | 'error';
  name?: string;
  error?: string;
}
