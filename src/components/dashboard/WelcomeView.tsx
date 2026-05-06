'use client';

import { useEffect, useState } from 'react';
import {
  FilePlus,
  FolderPlus,
  Upload,
  Search,
  Files,
  Terminal as TerminalIcon,
  GitBranch,
  KanbanSquare,
  FlaskConical,
  Sparkles,
  HardDrive,
  Clock,
  FileText,
  type LucideIcon
} from 'lucide-react';
import type { DocItem } from '@/components/dashboard/types';
import { fetchZod } from '@/lib/fetch-zod';
import { workspaceStorageInfoSchema } from '@agora/contracts';

interface WelcomeViewProps {
  workspaceName?: string;
  recentDocs: DocItem[];
  loadingRecents?: boolean;
  onOpenDoc: (doc: DocItem) => void;
  onCreateDoc: () => void;
  onCreateFolder: () => void;
  onUploadFile: () => void;
  onOpenSearch: () => void;
  onOpenFiles: () => void;
  onOpenTerminal: () => void;
  onOpenGit: () => void;
  onOpenBoard: () => void;
  onOpenStRunner: () => void;
  onOpenAI: () => void;
}

interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  onClick: () => void;
  accent?: string;
}

interface StorageInfo {
  usedBytes: number;
  limitBytes: number;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    try { return (value as { toDate: () => Date }).toDate(); } catch { return null; }
  }
  return null;
}

function formatRelativeDate(raw: unknown): string {
  const value = toDate(raw);
  if (!value) return '';
  const ms = Date.now() - value.getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  return value.toLocaleDateString();
}

export default function WelcomeView({
  workspaceName,
  recentDocs,
  loadingRecents,
  onOpenDoc,
  onCreateDoc,
  onCreateFolder,
  onUploadFile,
  onOpenSearch,
  onOpenFiles,
  onOpenTerminal,
  onOpenGit,
  onOpenBoard,
  onOpenStRunner,
  onOpenAI
}: WelcomeViewProps) {
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [storageLoading, setStorageLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setStorageLoading(true);
    void (async () => {
      try {
        const data = await fetchZod('/api/payments/storage-usage', workspaceStorageInfoSchema);
        if (active && typeof data.usedBytes === 'number' && typeof data.limitBytes === 'number') {
          setStorage({ usedBytes: data.usedBytes, limitBytes: data.limitBytes });
        }
      } catch {
        if (active) setStorage(null);
      } finally {
        if (active) setStorageLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const start: QuickAction[] = [
    { id: 'new-doc', label: 'Nuevo archivo', icon: FilePlus, shortcut: 'Ctrl+N', onClick: onCreateDoc, accent: 'text-mandy-300' },
    { id: 'new-folder', label: 'Nueva carpeta', icon: FolderPlus, onClick: onCreateFolder, accent: 'text-amber-300' },
    { id: 'upload', label: 'Subir archivo', icon: Upload, onClick: onUploadFile, accent: 'text-emerald-300' },
    { id: 'search', label: 'Buscar', icon: Search, shortcut: 'Ctrl+P', onClick: onOpenSearch, accent: 'text-sky-300' }
  ];

  const tools: QuickAction[] = [
    { id: 'files', label: 'Explorador', icon: Files, shortcut: 'Ctrl+Shift+E', onClick: onOpenFiles, accent: 'text-surface-200' },
    { id: 'terminal', label: 'Terminal', icon: TerminalIcon, shortcut: 'Ctrl+`', onClick: onOpenTerminal, accent: 'text-emerald-300' },
    { id: 'git', label: 'Control de versiones', icon: GitBranch, onClick: onOpenGit, accent: 'text-orange-300' },
    { id: 'board', label: 'Tablero', icon: KanbanSquare, onClick: onOpenBoard, accent: 'text-mandy-300' },
    { id: 'st', label: 'ST Logic', icon: FlaskConical, onClick: onOpenStRunner, accent: 'text-indigo-300' },
    { id: 'ai', label: 'Agora AI', icon: Sparkles, onClick: onOpenAI, accent: 'text-sky-300' }
  ];

  const usagePct = storage && storage.limitBytes > 0
    ? Math.min(100, (storage.usedBytes / storage.limitBytes) * 100)
    : null;

  return (
    <div className="h-full w-full overflow-y-auto bg-surface-900">
      <div className="mx-auto max-w-3xl px-6 py-10 lg:px-10 lg:py-14">
        <header className="mb-10">
          <p className="text-xs uppercase tracking-wider text-surface-500">Bienvenido a Agora</p>
          <h1 className="mt-1 text-2xl font-semibold text-surface-100 lg:text-3xl">
            {workspaceName ? `Espacio: ${workspaceName}` : 'Tu espacio de trabajo'}
          </h1>
          <p className="mt-2 text-sm text-surface-400">
            Crea o abre un archivo, lanza una herramienta o continúa con un documento reciente.
          </p>
        </header>

        <Section title="Empezar">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {start.map((a) => <ActionCard key={a.id} action={a} />)}
          </div>
        </Section>

        <Section title="Recientes">
          {loadingRecents ? (
            <ul className="space-y-1">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex items-center gap-3 px-3 py-2">
                  <span className="h-4 w-4 shrink-0 animate-pulse rounded bg-surface-800" />
                  <span className="h-3 flex-1 animate-pulse rounded bg-surface-800" />
                </li>
              ))}
            </ul>
          ) : recentDocs.length === 0 ? (
            <p className="text-xs text-surface-500">Aún no has abierto documentos en este espacio.</p>
          ) : (
            <ul className="divide-y divide-surface-800/60 rounded-md border border-surface-800/60">
              {recentDocs.slice(0, 6).map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => onOpenDoc(d)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-surface-800/60"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-surface-400" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-surface-100">{d.name}</span>
                      <span className="truncate text-[10px] text-surface-500">
                        {d.folder || 'Raíz'} · <Clock className="inline h-2.5 w-2.5" /> {formatRelativeDate(d.updatedAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Herramientas del workspace">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {tools.map((a) => <ToolPill key={a.id} action={a} />)}
          </div>
        </Section>

        <Section title="Almacenamiento">
          <div className="rounded-md border border-surface-800/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs text-surface-300">
              <HardDrive className="h-3.5 w-3.5" />
              {storageLoading ? (
                'Calculando…'
              ) : storage ? (
                <>
                  <span className="font-medium text-surface-100">{formatBytes(storage.usedBytes)}</span>
                  <span className="text-surface-500">/ {formatBytes(storage.limitBytes)}</span>
                </>
              ) : (
                <span className="text-surface-500">Sin información</span>
              )}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-800">
              <div
                className={`h-full transition-[width] duration-300 ${
                  usagePct === null ? 'bg-surface-700' :
                  usagePct > 90 ? 'bg-rose-400' :
                  usagePct > 70 ? 'bg-amber-300' :
                  'bg-emerald-400'
                }`}
                style={{ width: `${usagePct ?? 0}%` }}
              />
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-surface-500">{title}</h2>
      {children}
    </section>
  );
}

function ActionCard({ action }: { action: QuickAction }) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      onClick={action.onClick}
      className="group flex items-center gap-3 rounded-md border border-surface-800/60 bg-surface-900 px-3 py-3 text-left transition hover:border-mandy-500/40 hover:bg-surface-800/60"
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-800/80 ${action.accent ?? 'text-surface-300'}`}>
        <Icon className="h-4 w-4" strokeWidth={1.7} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-surface-100">{action.label}</span>
      </span>
      {action.shortcut && (
        <kbd className="rounded border border-surface-700 bg-surface-950 px-1.5 py-0.5 font-mono text-[10px] text-surface-400">
          {action.shortcut}
        </kbd>
      )}
    </button>
  );
}

function ToolPill({ action }: { action: QuickAction }) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      onClick={action.onClick}
      title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
      className="flex flex-col items-center gap-1.5 rounded-md border border-surface-800/60 bg-surface-900 px-3 py-3 text-center transition hover:border-mandy-500/40 hover:bg-surface-800/60"
    >
      <Icon className={`h-4 w-4 ${action.accent ?? 'text-surface-300'}`} strokeWidth={1.7} />
      <span className="text-[11px] text-surface-200">{action.label}</span>
    </button>
  );
}
