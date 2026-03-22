'use client';

import React, { useEffect, useMemo, useState } from 'react';
import MosaicEditor from '@/components/MosaicEditor';
import SpreadsheetViewer from '@/components/SpreadsheetViewer';
import FileDocumentViewer from '@/components/file-viewers/FileDocumentViewer';
import { authFetch } from '@/services/apiClient';
import { getErrorMessage } from '@/lib/error-utils';
import { DocumentType, type DocumentTypeId } from '@/types/documents';
import { isMarkdownDocument, isSpreadsheetDocument } from '@/lib/document-format';

type ViewMode = 'edit' | 'preview' | 'raw';

interface SearchState {
  currentMatch: number;
  totalMatches: number;
}

interface DocumentSurfaceProps {
  roomId: string;
  workspaceId?: string;
  onClose?: () => void;
  embedded?: boolean;
  initialContent?: string;
  externalSearchTerm?: string;
  onSearchStateChange?: (state: SearchState) => void;
  searchNavRef?: React.MutableRefObject<{ next: () => void; prev: () => void } | null>;
  initialDocument?: {
    type?: DocumentTypeId;
    name?: string;
    mimeType?: string;
    url?: string;
    storagePath?: string;
  };
  viewMode?: ViewMode;
}

interface ResolvedDocumentMeta {
  type?: DocumentTypeId;
  name?: string;
  mimeType?: string;
  url?: string | null;
  storagePath?: string | null;
}

const canResolveWithoutFetch = (meta: ResolvedDocumentMeta | null) => {
  if (!meta?.type) return false;
  if (meta.type !== DocumentType.File) return true;
  if (isMarkdownDocument(meta.name, meta.mimeType)) return true;
  if (isSpreadsheetDocument(meta.name, meta.mimeType)) return true;
  return Boolean(meta.url);
};

export default function DocumentSurface({
  roomId,
  workspaceId,
  onClose,
  embedded,
  initialContent,
  externalSearchTerm,
  onSearchStateChange,
  searchNavRef,
  initialDocument
}: DocumentSurfaceProps) {
  const normalizedInitialDocument = useMemo<ResolvedDocumentMeta | null>(() => (
    initialDocument
      ? {
        type: initialDocument.type,
        name: initialDocument.name,
        mimeType: initialDocument.mimeType,
        url: initialDocument.url ?? null,
        storagePath: initialDocument.storagePath ?? null
      }
      : null
  ), [initialDocument]);

  const [resolvedMeta, setResolvedMeta] = useState<ResolvedDocumentMeta | null>(normalizedInitialDocument);
  const [loading, setLoading] = useState(!canResolveWithoutFetch(normalizedInitialDocument));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setResolvedMeta(normalizedInitialDocument);
    setLoading(!canResolveWithoutFetch(normalizedInitialDocument));
    setError(null);
  }, [normalizedInitialDocument, roomId]);

  useEffect(() => {
    if (!roomId || canResolveWithoutFetch(resolvedMeta)) return;

    let cancelled = false;

    const loadMeta = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await authFetch(`/api/documents/${roomId}`, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error('No se pudo cargar el documento');
        }
        const data = await res.json() as ResolvedDocumentMeta;
        if (!cancelled) {
          setResolvedMeta({
            type: data.type,
            name: data.name,
            mimeType: data.mimeType,
            url: data.url ?? null,
            storagePath: data.storagePath ?? null
          });
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(getErrorMessage(fetchError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadMeta();

    return () => {
      cancelled = true;
    };
  }, [resolvedMeta, roomId]);

  const docMeta = useMemo(() => resolvedMeta ?? normalizedInitialDocument ?? null, [normalizedInitialDocument, resolvedMeta]);
  const docName = docMeta?.name || 'Documento';
  const mimeType = docMeta?.mimeType || '';
  const isBinaryFile = docMeta?.type === DocumentType.File && !isMarkdownDocument(docName, mimeType);
  const needsRemoteUrl = isBinaryFile && !isSpreadsheetDocument(docName, mimeType) && !docMeta?.url;

  if (loading && (!docMeta || needsRemoteUrl)) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-blue-400" />
          <span className="text-xs text-slate-500">Cargando documento...</span>
        </div>
      </div>
    );
  }

  if (error && (!docMeta || needsRemoteUrl)) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-950 px-4 text-center text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (isBinaryFile && isSpreadsheetDocument(docName, mimeType)) {
    return (
      <SpreadsheetViewer
        docId={roomId}
        docName={docName}
        onClose={onClose}
      />
    );
  }

  if (isBinaryFile) {
    return (
      <FileDocumentViewer
        docId={roomId}
        workspaceId={workspaceId}
        docName={docName}
        mimeType={mimeType}
        fileUrl={docMeta?.url ?? null}
        onClose={onClose}
      />
    );
  }

  return (
    <MosaicEditor
      roomId={roomId}
      initialContent={initialContent}
      onClose={onClose}
      embedded={embedded}
      externalSearchTerm={externalSearchTerm}
      onSearchStateChange={onSearchStateChange}
      searchNavRef={searchNavRef}
    />
  );
}
