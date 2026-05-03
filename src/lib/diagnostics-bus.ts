'use client';

/**
 * Diagnostics Bus — arquitectura modular inspirada en `vscode.languages`
 * y la API de `DiagnosticCollection`.
 *
 * Cada subsistema (linter MDX, linter ST, parser YAML, runtime errors, AI…)
 * registra un *provider* identificado por `source` y publica una lista de
 * diagnostics asociados a un `uri` (ruta del documento o "global"). Cuando
 * vuelve a publicar para el mismo (source, uri), los anteriores se
 * reemplazan en bloque — no se acumulan duplicados.
 *
 * El panel Problemas suscribe al bus y agrupa por archivo / por source,
 * con badge de errors/warnings/infos. Cada item puede llevar `range`
 * (línea/columna) y `actions` (quick fixes), que la UI renderiza como
 * botones para que el caller resuelva.
 */

export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';

export interface DiagnosticRange {
  startLine: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
}

export interface DiagnosticAction {
  id: string;
  label: string;
  /** Pista del kind (quickfix, refactor, source.fixAll). VS Code lo usa para agrupar. */
  kind?: 'quickfix' | 'refactor' | 'source';
}

export interface Diagnostic {
  /** Estable dentro del par (source, uri). Si no se da, el bus genera uno. */
  id?: string;
  severity: DiagnosticSeverity;
  /** Mensaje visible al usuario, una línea. */
  message: string;
  /** Detalle opcional multilínea. */
  detail?: string;
  /** Código del rule (ej. "MD013", "ST/SyntaxError"). */
  code?: string;
  /** Posición dentro del documento. */
  range?: DiagnosticRange;
  /** Acciones disponibles (la UI emite el evento `agora:diagnostic-action`). */
  actions?: DiagnosticAction[];
}

export interface ResolvedDiagnostic extends Omit<Diagnostic, 'id'> {
  id: string;
  source: string;
  uri: string;
  publishedAt: number;
}

type Listener = (snapshot: ResolvedDiagnostic[]) => void;

interface Bucket {
  source: string;
  uri: string;
  items: ResolvedDiagnostic[];
}

const buckets = new Map<string, Bucket>();
const listeners = new Set<Listener>();

function bucketKey(source: string, uri: string): string {
  return `${source}::${uri}`;
}

function emit() {
  const snapshot: ResolvedDiagnostic[] = [];
  for (const b of buckets.values()) snapshot.push(...b.items);
  listeners.forEach((l) => {
    try { l(snapshot); } catch (e) { void e; }
  });
}

function genId(): string {
  return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Reemplaza la lista completa de diagnostics para `(source, uri)`.
 * Equivalente a `DiagnosticCollection.set(uri, items)` en VS Code.
 *
 * Pasar `[]` es la forma de limpiar diagnostics de un archivo cuando
 * el linter ya no encuentra problemas.
 */
export function publishDiagnostics(source: string, uri: string, items: Diagnostic[]) {
  if (items.length === 0) {
    buckets.delete(bucketKey(source, uri));
    emit();
    return;
  }
  const now = Date.now();
  const resolved: ResolvedDiagnostic[] = items.map((it) => ({
    ...it,
    id: it.id ?? genId(),
    severity: it.severity,
    message: it.message,
    source,
    uri,
    publishedAt: now
  }));
  buckets.set(bucketKey(source, uri), { source, uri, items: resolved });
  emit();
}

/**
 * Limpia todos los diagnostics de un `source` (al apagar un linter, cambiar
 * de workspace, etc.). Pasar undefined limpia TODO.
 */
export function clearDiagnostics(source?: string) {
  if (!source) {
    buckets.clear();
    emit();
    return;
  }
  for (const key of Array.from(buckets.keys())) {
    if (buckets.get(key)?.source === source) buckets.delete(key);
  }
  emit();
}

/** Limpia los de una `(source, uri)` puntual. */
export function clearDiagnosticsFor(source: string, uri: string) {
  buckets.delete(bucketKey(source, uri));
  emit();
}

export function subscribeDiagnostics(listener: Listener): () => void {
  listeners.add(listener);
  const snapshot: ResolvedDiagnostic[] = [];
  for (const b of buckets.values()) snapshot.push(...b.items);
  try { listener(snapshot); } catch (e) { void e; }
  return () => listeners.delete(listener);
}

export function getAllDiagnostics(): ResolvedDiagnostic[] {
  const snapshot: ResolvedDiagnostic[] = [];
  for (const b of buckets.values()) snapshot.push(...b.items);
  return snapshot;
}

/* ──────────────────────────────────────────────────────────────────
 * Bridge con el bus heredado de console (errors/warns runtime).
 * Se mantiene como fuente "console" del registro unificado, así el
 * panel Problemas puede mostrar todo en una sola vista mientras
 * migramos los linters a publishDiagnostics().
 * ──────────────────────────────────────────────────────────────── */

let consoleInstalled = false;

function severityFromConsole(level: 'error' | 'warning'): DiagnosticSeverity {
  return level === 'error' ? 'error' : 'warning';
}

function pushConsole(level: 'error' | 'warning', message: string, detail?: string) {
  const key = bucketKey('console', 'global');
  const bucket = buckets.get(key);
  const items: ResolvedDiagnostic[] = bucket ? bucket.items.slice() : [];
  items.unshift({
    id: genId(),
    source: 'console',
    uri: 'global',
    severity: severityFromConsole(level),
    message,
    detail,
    publishedAt: Date.now()
  });
  // Cap del historial console — los diagnostics estructurados se reemplazan,
  // pero el bus de consola es append-only y necesita límite.
  if (items.length > 200) items.length = 200;
  buckets.set(key, { source: 'console', uri: 'global', items });
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

export function installDiagnosticsBus() {
  if (consoleInstalled || typeof window === 'undefined') return;
  consoleInstalled = true;

  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);

  console.error = (...args: unknown[]) => {
    const { message, detail } = joinArgs(args);
    pushConsole('error', message, detail);
    origError(...args);
  };
  console.warn = (...args: unknown[]) => {
    const { message, detail } = joinArgs(args);
    pushConsole('warning', message, detail);
    origWarn(...args);
  };

  window.addEventListener('error', (e) => {
    pushConsole('error', e.message || 'Error en la app', e.filename ? `${e.filename}:${e.lineno}` : undefined);
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = (e as PromiseRejectionEvent).reason;
    pushConsole('error', reason instanceof Error ? reason.message : formatArg(reason));
  });

  // Compat con eventos legacy 'agora:problem' que ya emitían algunos
  // subsistemas (tratados como source=app, uri=global).
  window.addEventListener('agora:problem', ((e: Event) => {
    const d = (e as CustomEvent<{ severity?: 'error' | 'warning' | 'info'; source?: string; message: string; detail?: string }>).detail;
    if (!d) return;
    publishDiagnostics(d.source ?? 'app', 'global', [{
      severity: (d.severity ?? 'warning') as DiagnosticSeverity,
      message: d.message,
      detail: d.detail
    }]);
  }) as EventListener);
}

/* ──────────────────────────────────────────────────────────────────
 * API pública para que linters/proveedores publiquen.
 *
 * Ejemplo (linter Markdown):
 *   import { createDiagnosticsCollection } from '@/lib/diagnostics-bus';
 *   const col = createDiagnosticsCollection('markdown-linter');
 *   col.set(docId, [{ severity: 'warning', code: 'MD013', message: 'Linea > 80 chars', range: { startLine: 12 } }]);
 *
 * Cuando el linter vuelve a procesar el doc:
 *   col.set(docId, nuevosItems);  // reemplaza todos los del doc
 *   col.clear(docId);             // si no hay problemas
 *
 * Para apagar el linter:
 *   col.dispose();
 * ──────────────────────────────────────────────────────────────── */

export interface DiagnosticsCollection {
  readonly source: string;
  set(uri: string, items: Diagnostic[]): void;
  clear(uri: string): void;
  dispose(): void;
}

export function createDiagnosticsCollection(source: string): DiagnosticsCollection {
  return {
    source,
    set(uri, items) { publishDiagnostics(source, uri, items); },
    clear(uri) { clearDiagnosticsFor(source, uri); },
    dispose() { clearDiagnostics(source); }
  };
}
