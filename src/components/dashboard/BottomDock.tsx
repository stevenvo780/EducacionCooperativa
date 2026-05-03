'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import {
  Terminal as TerminalIcon,
  X,
  ChevronDown,
  AlertCircle,
  Plus,
  Pencil,
  AlertTriangle
} from 'lucide-react';
import type { WorkspaceTypeId } from '@/types/workspace';
import type { TerminalSession } from '@/context/TerminalContext';
import { subscribeDiagnostics, type ResolvedDiagnostic } from '@/lib/diagnostics-bus';
import { subscribeChannels, type OutputChannel, type ChannelTone } from '@/lib/output-channels';
import ProblemsPane from './ProblemsPane';
import { PanelErrorBoundary } from './PanelErrorBoundary';

const Terminal = dynamic(() => import('@/components/Terminal'), { ssr: false });

interface BottomDockProps {
  open: boolean;
  /** Tab inicial al abrir; si no existe en el registro al render, cae al primero. */
  initialTab?: string;
  onToggle: () => void;
  workspaceId?: string;
  workspaceName?: string;
  workspaceType?: WorkspaceTypeId;
  nexusUrl: string;

  sessions: TerminalSession[];
  activeSessionId: string | null;
  isCreatingSession: boolean;
  workerStatus: 'online' | 'offline' | 'unknown';
  onCreateSession: () => void;
  onSelectSession: (id: string) => void;
  onDestroySession: (id: string) => void;
  onRenameSession: (id: string) => void;

  resolveDocName?: (uri: string) => string | null;
  onOpenDocument?: (uri: string, range?: { line: number; column?: number }) => void;
  onRunDiagnosticAction?: (diagnostic: ResolvedDiagnostic, actionId: string) => void;
}

export default function BottomDock(props: BottomDockProps) {
  const {
    open, initialTab, onToggle, workspaceId, workspaceName, workspaceType, nexusUrl,
    sessions, activeSessionId, isCreatingSession, workerStatus,
    onCreateSession, onSelectSession, onDestroySession, onRenameSession,
    resolveDocName, onOpenDocument, onRunDiagnosticAction
  } = props;

  // Canales dinámicos del registro (ej: st-output, st-symbols, etc.).
  const [extraChannels, setExtraChannels] = useState<OutputChannel[]>([]);
  useEffect(() => subscribeChannels(setExtraChannels), []);

  // Diagnostics counts para el badge de "Problemas".
  const [diagCount, setDiagCount] = useState({ error: 0, warning: 0 });
  useEffect(() => subscribeDiagnostics((items) => {
    let error = 0, warning = 0;
    for (const i of items) {
      if (i.severity === 'error') error++;
      else if (i.severity === 'warning') warning++;
    }
    setDiagCount((prev) => prev.error === error && prev.warning === warning ? prev : { error, warning });
  }), []);

  // Compone la lista total de tabs: [Terminal, Problemas, ...registrados].
  const allTabs = useMemo(() => {
    const builtin: OutputChannel[] = [
      {
        id: 'terminal',
        label: 'Terminal',
        icon: TerminalIcon,
        order: 10,
        render: () => null // render real es inline (necesita props del dock)
      },
      {
        id: 'problems',
        label: 'Problemas',
        icon: AlertCircle,
        order: 20,
        badge: diagCount.error + diagCount.warning > 0
          ? { count: diagCount.error + diagCount.warning, tone: (diagCount.error > 0 ? 'error' : 'warning') }
          : undefined,
        render: () => null // render inline (PanelErrorBoundary + ProblemsPane con props)
      }
    ];
    return [...builtin, ...extraChannels].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  }, [extraChannels, diagCount]);

  const [active, setActive] = useState<string>(initialTab ?? 'terminal');

  // Si initialTab cambia (status bar abre Problems explicito), actualiza.
  useEffect(() => {
    if (open && initialTab) setActive(initialTab);
  }, [open, initialTab]);

  // Si el tab activo desaparece del registro, cae al primero disponible.
  useEffect(() => {
    if (!allTabs.some((t) => t.id === active)) {
      setActive(allTabs[0]?.id ?? 'terminal');
    }
  }, [allTabs, active]);

  if (!open) return null;

  const activeTab = allTabs.find((t) => t.id === active) ?? allTabs[0];
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const workerDisabled = workerStatus !== 'online';

  return (
    <div className="flex h-full w-full flex-col bg-surface-950 border-t border-surface-700/60">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-surface-700/60 px-2">
        <div role="tablist" className="flex items-center gap-0.5 overflow-x-auto">
          {allTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab?.id === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(tab.id)}
                className={`flex h-7 shrink-0 items-center gap-1.5 rounded px-2 text-xs transition ${
                  isActive ? 'bg-surface-800 text-white' : 'text-surface-400 hover:bg-surface-800/60 hover:text-surface-100'
                }`}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {tab.label}
                {tab.badge && <ChannelBadgePill badge={tab.badge} />}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onToggle}
            title="Ocultar panel (Ctrl+`)"
            aria-label="Ocultar panel inferior"
            className="flex h-7 w-7 items-center justify-center rounded text-surface-400 transition hover:bg-surface-800 hover:text-white"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggle}
            title="Cerrar"
            aria-label="Cerrar panel inferior"
            className="flex h-7 w-7 items-center justify-center rounded text-surface-400 transition hover:bg-surface-800 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Cuerpo según el tab activo */}
      {activeTab?.id === 'terminal' ? (
        <TerminalPane
          sessions={sessions}
          activeSession={activeSession}
          isCreatingSession={isCreatingSession}
          workerDisabled={workerDisabled}
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          workspaceType={workspaceType}
          nexusUrl={nexusUrl}
          onCreateSession={onCreateSession}
          onSelectSession={onSelectSession}
          onDestroySession={onDestroySession}
          onRenameSession={onRenameSession}
        />
      ) : activeTab?.id === 'problems' ? (
        <PanelErrorBoundary name="Problemas">
          <ProblemsPane
            resolveDocName={resolveDocName}
            onOpenDocument={onOpenDocument}
            onRunAction={onRunDiagnosticAction}
          />
        </PanelErrorBoundary>
      ) : (
        <PanelErrorBoundary name={activeTab?.label ?? 'Canal'}>
          <div className="flex-1 min-h-0 overflow-auto">
            {activeTab?.render() ?? null}
          </div>
        </PanelErrorBoundary>
      )}
    </div>
  );
}

function ChannelBadgePill({ badge }: { badge: NonNullable<OutputChannel['badge']> }) {
  const tone: ChannelTone = badge.tone ?? 'neutral';
  const cls: Record<ChannelTone, string> = {
    error: 'bg-rose-500/20 text-rose-200',
    warning: 'bg-amber-500/20 text-amber-200',
    info: 'bg-sky-500/20 text-sky-200',
    success: 'bg-emerald-500/20 text-emerald-200',
    neutral: 'bg-surface-700/50 text-surface-200'
  };
  const label = badge.text ?? (typeof badge.count === 'number' ? String(badge.count) : '');
  if (!label) return null;
  return <span className={`rounded-full px-1.5 text-[10px] ${cls[tone]}`}>{label}</span>;
}

interface TerminalPaneProps {
  sessions: TerminalSession[];
  activeSession: TerminalSession | null;
  isCreatingSession: boolean;
  workerDisabled: boolean;
  workspaceId?: string;
  workspaceName?: string;
  workspaceType?: WorkspaceTypeId;
  nexusUrl: string;
  onCreateSession: () => void;
  onSelectSession: (id: string) => void;
  onDestroySession: (id: string) => void;
  onRenameSession: (id: string) => void;
}

function TerminalPane({
  sessions, activeSession, isCreatingSession, workerDisabled,
  workspaceId, workspaceName, workspaceType, nexusUrl,
  onCreateSession, onSelectSession, onDestroySession, onRenameSession
}: TerminalPaneProps) {
  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex w-44 shrink-0 flex-col border-r border-surface-700/60 bg-surface-925/50">
        <div className="flex h-7 shrink-0 items-center justify-between px-2 text-[10px] uppercase tracking-wider text-surface-500">
          <span>Sesiones</span>
          <button
            type="button"
            onClick={onCreateSession}
            disabled={isCreatingSession || workerDisabled}
            title={workerDisabled ? 'Worker sin conexión' : 'Nueva terminal (Ctrl+Shift+`)'}
            aria-label="Nueva sesión"
            className="flex h-5 w-5 items-center justify-center rounded text-surface-300 transition hover:bg-surface-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        <ul className="flex-1 min-h-0 overflow-y-auto px-1 pb-2">
          {sessions.length === 0 ? (
            <li className="px-2 py-3 text-center text-[10px] text-surface-500">
              {workerDisabled ? (
                <span className="flex flex-col items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-rose-300" />
                  Sin worker activo
                </span>
              ) : (
                'Sin sesiones'
              )}
            </li>
          ) : (
            sessions.map((s) => {
              const isActive = s.id === activeSession?.id;
              return (
                <li key={s.id}>
                  <div
                    className={`group mb-0.5 flex items-center gap-1 rounded px-1.5 py-1 text-[11px] transition ${
                      isActive ? 'bg-mandy-500/15 text-white' : 'text-surface-300 hover:bg-surface-800/60'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectSession(s.id)}
                      className="flex flex-1 min-w-0 items-center gap-1.5 text-left"
                    >
                      <TerminalIcon className="h-3 w-3 shrink-0 text-surface-400" />
                      <span className="truncate">{s.name || `Terminal ${s.id.slice(0, 6)}`}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRenameSession(s.id)}
                      title="Renombrar"
                      aria-label="Renombrar"
                      className="hidden h-4 w-4 items-center justify-center rounded text-surface-500 hover:bg-surface-800 hover:text-white group-hover:flex"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDestroySession(s.id)}
                      title="Cerrar sesión"
                      aria-label="Cerrar sesión"
                      className="hidden h-4 w-4 items-center justify-center rounded text-surface-500 hover:bg-rose-500/15 hover:text-rose-300 group-hover:flex"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>

      <div className="relative flex-1 min-w-0 bg-black">
        {activeSession ? (
          <Terminal
            key={activeSession.id}
            nexusUrl={nexusUrl}
            workspaceId={workspaceId}
            workspaceName={workspaceName}
            workspaceType={workspaceType}
            sessionId={activeSession.id}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center text-xs text-surface-400">
            {workerDisabled ? (
              <>
                <AlertTriangle className="h-5 w-5 text-rose-300" />
                <p>Sin worker activo para este workspace.</p>
                <p className="text-[10px] text-surface-500">
                  No se pueden crear terminales hasta que el worker esté en línea.
                </p>
              </>
            ) : (
              <>
                <TerminalIcon className="h-5 w-5 text-surface-500" />
                <p>No hay sesión seleccionada.</p>
                <button
                  type="button"
                  onClick={onCreateSession}
                  disabled={isCreatingSession}
                  className="mt-1 inline-flex items-center gap-1 rounded border border-surface-700 px-2 py-1 text-surface-200 transition hover:border-mandy-500/40 hover:text-white disabled:opacity-40"
                >
                  <Plus className="h-3 w-3" /> Crear terminal
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Re-export simple para que no rompa imports antiguos.
export type { ReactNode };
