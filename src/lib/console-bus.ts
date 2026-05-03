'use client';

/**
 * Bus mínimo de "Problemas" para el panel inferior. Recoge:
 *  - errores y warnings (`console.error` / `console.warn`)
 *  - promesas rechazadas (`unhandledrejection`)
 *  - errores globales (`window.error`)
 *  - lints / diagnostics emitidos por el editor MDX (custom event `agora:problem`)
 *
 * No persiste: arranca vacío en cada carga. La UI se suscribe vía `subscribe`.
 */

export type ProblemSeverity = 'error' | 'warning' | 'info';

export interface ProblemEntry {
  id: string;
  severity: ProblemSeverity;
  source: string;
  message: string;
  detail?: string;
  at: number;
}

type Listener = (entries: ProblemEntry[]) => void;

const MAX_ENTRIES = 200;
const entries: ProblemEntry[] = [];
const listeners = new Set<Listener>();
let installed = false;

function emit() {
  const snapshot = entries.slice();
  listeners.forEach((l) => {
    try { l(snapshot); } catch (e) { void e; }
  });
}

function push(entry: Omit<ProblemEntry, 'id' | 'at'>) {
  const next: ProblemEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    ...entry
  };
  entries.unshift(next);
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  emit();
}

function formatArg(arg: unknown): string {
  if (arg instanceof Error) return arg.message;
  if (typeof arg === 'string') return arg;
  try { return JSON.stringify(arg); } catch { return String(arg); }
}

function joinArgs(args: unknown[]): { message: string; detail?: string } {
  const parts = args.map(formatArg);
  return parts.length <= 1
    ? { message: parts[0] ?? '' }
    : { message: parts[0] ?? '', detail: parts.slice(1).join(' ') };
}

export function installConsoleBus() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);

  console.error = (...args: unknown[]) => {
    push({ severity: 'error', source: 'console', ...joinArgs(args) });
    origError(...args);
  };
  console.warn = (...args: unknown[]) => {
    push({ severity: 'warning', source: 'console', ...joinArgs(args) });
    origWarn(...args);
  };

  window.addEventListener('error', (e) => {
    push({
      severity: 'error',
      source: 'runtime',
      message: e.message || 'Error en la app',
      detail: e.filename ? `${e.filename}:${e.lineno}` : undefined
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = (e as PromiseRejectionEvent).reason;
    push({
      severity: 'error',
      source: 'promesa',
      message: reason instanceof Error ? reason.message : formatArg(reason)
    });
  });

  window.addEventListener('agora:problem', ((e: Event) => {
    const detail = (e as CustomEvent<{ severity?: ProblemSeverity; source?: string; message: string; detail?: string }>).detail;
    if (!detail) return;
    push({
      severity: detail.severity ?? 'warning',
      source: detail.source ?? 'app',
      message: detail.message,
      detail: detail.detail
    });
  }) as EventListener);
}

export function subscribeProblems(listener: Listener): () => void {
  listeners.add(listener);
  listener(entries.slice());
  return () => listeners.delete(listener);
}

export function clearProblems() {
  entries.length = 0;
  emit();
}

export function getProblems(): ProblemEntry[] {
  return entries.slice();
}
