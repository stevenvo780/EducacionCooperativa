import type { DocItem, FolderItem as MosaicFolderItem, ViewMode } from '@/components/MosaicLayout';
import type { WorkspaceTypeId } from '@/types/workspace';

export type { DocItem, ViewMode };
export type FolderItem = MosaicFolderItem;

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  members: string[];
  pendingInvites?: string[];
  type: WorkspaceTypeId;
}

export enum DialogKind {
  Info = 'info',
  Error = 'error',
  Confirm = 'confirm',
  Input = 'input'
}

export type DialogKindId = `${DialogKind}`;

export interface DialogConfig {
  type: DialogKindId;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  required?: boolean;
}

export type DialogResult = { confirmed: boolean; value?: string | null };

export enum UploadPhase {
  Uploading = 'uploading',
  Converting = 'converting',
  Done = 'done',
  Error = 'error'
}

export type UploadPhaseId = `${UploadPhase}`;

export interface UploadStatus {
  total: number;
  currentIndex: number;
  currentName: string;
  progress: number;
  phase: UploadPhaseId;
  error?: string;
}

export enum DeletePhase {
  Deleting = 'deleting',
  Done = 'done',
  Error = 'error'
}

export type DeletePhaseId = `${DeletePhase}`;

export interface DeleteStatus {
  phase: DeletePhaseId;
  name?: string;
  error?: string;
}

export interface BoardColumn {
  id: string;
  name: string;
  order: number;
}

export interface BoardCard {
  id: string;
  title: string;
  description?: string;
  columnId: string;
  order: number;
  ownerId?: string;
  // Metadata from source document
  sourceDocId?: string;
  sourceDocName?: string;
  sourceFragment?: string;
  sourcePath?: string;
}

export interface BoardData {
  boardId: string;
  workspaceId: string;
  columns: BoardColumn[];
  cards: BoardCard[];
}
