'use client';

import React, { useMemo } from 'react';
import { AlertTriangle, FileText, Server, User } from 'lucide-react';
import type { SyncQueueItem } from '@/lib/offlineStorage';

interface ConflictResolutionModalProps {
  open: boolean;
  conflicts: SyncQueueItem[];
  onClose: () => void;
  /** "Mantener mi versión local": fuerza el push descartando la del servidor. */
  onKeepLocal: (item: SyncQueueItem) => void;
  /** "Descartar mi versión": acepta el contenido del servidor, descarta el cambio. */
  onAcceptServer: (item: SyncQueueItem) => void;
  /** Resolver doc id → nombre legible. */
  resolveDocName?: (docId: string) => string | null;
}

export default function ConflictResolutionModal({
  open,
  conflicts,
  onClose,
  onKeepLocal,
  onAcceptServer,
  resolveDocName
}: ConflictResolutionModalProps) {
  if (!open || conflicts.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-amber-500/30 bg-slate-950 shadow-2xl">
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-800 px-5 py-3.5">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-white">
              {conflicts.length === 1
                ? 'Conflicto de versión'
                : `${conflicts.length} conflictos de versión`}
            </h2>
            <p className="text-[11px] text-slate-400">
              Otra persona modificó {conflicts.length === 1 ? 'el documento' : 'los documentos'} mientras estabas offline. Decide qué mantener.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            Cerrar
          </button>
        </header>

        <div className="flex-1 overflow-auto divide-y divide-slate-800">
          {conflicts.map((item) => (
            <ConflictRow
              key={item.id ?? `${item.docId}-${item.timestamp}`}
              item={item}
              onKeepLocal={() => onKeepLocal(item)}
              onAcceptServer={() => onAcceptServer(item)}
              docLabel={resolveDocName?.(item.docId) ?? item.docId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ConflictRow({
  item,
  docLabel,
  onKeepLocal,
  onAcceptServer
}: {
  item: SyncQueueItem;
  docLabel: string;
  onKeepLocal: () => void;
  onAcceptServer: () => void;
}) {
  const localContent = useMemo(() => extractContent(item.payload), [item.payload]);
  const serverContent = item.conflict?.serverContent;

  return (
    <div className="px-5 py-4">
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-200" title={item.docId}>{docLabel}</span>
        {item.conflict?.serverUpdatedBy && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-500">
            <User className="h-3 w-3" />
            Modificado por {item.conflict.serverUpdatedBy}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <DiffPane
          icon={<User className="h-3.5 w-3.5 text-blue-400" />}
          title="Tu versión local"
          subtitle={item.conflict?.localVersion ? `v${item.conflict.localVersion}` : 'sin versión'}
          content={localContent}
          accent="blue"
        />
        <DiffPane
          icon={<Server className="h-3.5 w-3.5 text-emerald-400" />}
          title="Versión en servidor"
          subtitle={item.conflict?.serverVersion ? `v${item.conflict.serverVersion}` : 'sin versión'}
          content={serverContent ?? '(no se trajo el contenido)'}
          accent="emerald"
        />
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onAcceptServer}
          className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
        >
          Mantener servidor (descarta tu cambio)
        </button>
        <button
          type="button"
          onClick={onKeepLocal}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
        >
          Forzar mi versión
        </button>
      </div>
    </div>
  );
}

function DiffPane({
  icon, title, subtitle, content, accent
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  content: string;
  accent: 'blue' | 'emerald';
}) {
  const ring = accent === 'blue' ? 'border-blue-700/50' : 'border-emerald-700/50';
  return (
    <div className={`overflow-hidden rounded border ${ring} bg-slate-900/50`}>
      <div className="flex items-center gap-1.5 border-b border-slate-800 px-2.5 py-1.5 text-[11px]">
        {icon}
        <span className="font-medium text-slate-300">{title}</span>
        <span className="ml-auto text-slate-500">{subtitle}</span>
      </div>
      <pre className="max-h-[180px] overflow-auto whitespace-pre-wrap break-words p-2.5 text-[11px] leading-relaxed text-slate-300">
        {content || '(vacío)'}
      </pre>
    </div>
  );
}

function extractContent(payload: Record<string, unknown>): string {
  if (typeof payload.content === 'string') return payload.content;
  if (typeof payload.body === 'string') return payload.body;
  return JSON.stringify(payload, null, 2);
}
