import type { WorkspaceTypeId } from '@/types/workspace';

export enum SyncEventType {
  Created = 'created',
  Updated = 'updated',
  Deleted = 'deleted',
  Refresh = 'refresh'
}

export type SyncEventTypeId = `${SyncEventType}`;

export enum SyncEventSource {
  Worker = 'worker',
  Frontend = 'frontend'
}

export type SyncEventSourceId = `${SyncEventSource}`;

export interface SyncEvent {
  type: SyncEventTypeId;
  path: string;
  folder?: string;
  docId?: string;
  timestamp: number;
  source: SyncEventSourceId;
}

export interface SyncEventScope {
  workspaceId: string | null;
  userId: string | null;
  workspaceType: WorkspaceTypeId;
}
