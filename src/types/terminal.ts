import type { WorkspaceTypeId } from '@/types/workspace';

export enum TerminalConnectionStatus {
  Checking = 'checking',
  Online = 'online',
  Offline = 'offline',
  Error = 'error'
}

export type TerminalConnectionStatusId = `${TerminalConnectionStatus}`;

export enum WorkerStatusValue {
  Online = 'online',
  Offline = 'offline',
  Unknown = 'unknown'
}

export type WorkerStatus = `${WorkerStatusValue}`;

export interface TerminalSessionPayload {
  id: string;
  workspaceId: string;
  workspaceName?: string;
  workspaceType?: WorkspaceTypeId;
  isOwner: boolean;
  sessionName?: string;
}

export interface TerminalSessionCreationPayload {
  id: string;
  workspaceId?: string;
  workspaceType?: WorkspaceTypeId;
  workspaceName?: string;
  sessionName?: string;
}
