/**
 * Tipo canónico de un documento abierto en la UI. Antes este tipo vivía
 * duplicado en MosaicLayout y FileExplorer con shapes ligeramente distintos
 * (sessionId, workspaceId, size faltaban en FileExplorer). Ahora ambos
 * re-exportan desde aquí.
 *
 * Para el shape persistido en Firestore ver `src/lib/contracts/document-record.ts`.
 */
import type { DocumentTypeId } from '@/types/documents';

export interface DocItem {
  id: string;
  name: string;
  type?: DocumentTypeId;
  /** Identifica una sesión de terminal/board/etc. específica. */
  sessionId?: string;
  /** Sólo memoria local — el contenido canónico vive en MinIO. */
  content?: string;
  url?: string;
  folder?: string;
  storagePath?: string;
  workspaceId?: string;
  order?: number;
  mimeType?: string;
  size?: number;
  updatedAt?: unknown;
  ownerId?: string;
}

export interface FolderItem {
  id: string;
  name: string;
  path: string;
  parentPath: string;
  kind: 'system' | 'record' | 'virtual';
  docId?: string;
  order?: number;
}
