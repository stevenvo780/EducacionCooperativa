'use client';

import { AGORA_EVENTS, subscribeAgoraEvent } from './agora-events';

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

/**
 * Re-entrancy guard: si un listener dispara indirectamente otro publish
 * (por ejemplo, un setState que provoca console.error de React Dev), NO
 * debemos volver a invocar listeners en cascada. inEmit corta el ciclo;
 * la actualización pendiente se aplica al final como un solo emit extra,
 * con un cap para abortar loops patológicos que nunca convergen.
 */
let inEmit = false;
let pendingEmit = false;
let emitDepth = 0;
const MAX_EMIT_DEPTH = 3;

function bucketKey(source: string, uri: string): string {
  return `${source}::${uri}`;
}

function snapshotItems(): ResolvedDiagnostic[] {
  const snapshot: ResolvedDiagnostic[] = [];
  for (const b of buckets.values()) snapshot.push(...b.items);
  return snapshot;
}

function emit() {
  if (inEmit) {
    pendingEmit = true;
    return;
  }
  // Si estamos re-entrando desde un emit que terminó pero llamó a este
  // a traves de pendingEmit, contamos profundidad. Cuando la profundidad
  // excede el cap, abortamos el ciclo (último estado queda en buckets).
  if (emitDepth >= MAX_EMIT_DEPTH) {
    pendingEmit = false;
    emitDepth = 0;
    return;
  }
  inEmit = true;
  emitDepth += 1;
  try {
    const snapshot = snapshotItems();
    listeners.forEach((l) => {
      try { l(snapshot); } catch (e) { void e; }
    });
  } finally {
    inEmit = false;
    if (pendingEmit) {
      pendingEmit = false;
      emit();
    } else {
      emitDepth = 0;
    }
  }
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
/** Cap de items por bucket — evita que un linter buggy llene el bus. */
const MAX_ITEMS_PER_BUCKET = 500;
/** Cap total de buckets — evita memoria sin límite con muchos archivos. */
const MAX_BUCKETS = 200;

export function publishDiagnostics(source: string, uri: string, items: Diagnostic[]) {
  if (items.length === 0) {
    buckets.delete(bucketKey(source, uri));
    emit();
    return;
  }
  const now = Date.now();
  const truncated = items.slice(0, MAX_ITEMS_PER_BUCKET);
  const resolved: ResolvedDiagnostic[] = truncated.map((it) => ({
    ...it,
    id: it.id ?? genId(),
    severity: it.severity,
    message: it.message,
    source,
    uri,
    publishedAt: now
  }));
  buckets.set(bucketKey(source, uri), { source, uri, items: resolved });

  // LRU evict: si excedemos MAX_BUCKETS, quitamos el más antiguo (Map mantiene
  // orden de inserción; al hacer set encima de uno existente lo mueve al final).
  while (buckets.size > MAX_BUCKETS) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }

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
/**
 * Si un listener del bus lanza una excepción, React (o el navegador)
 * puede llamar console.error como reacción. Sin guard, esto vuelve a
 * push'ear al bus → notify → listener falla otra vez → ... OOM.
 * Este flag corta el ciclo durante el procesamiento del propio bus.
 */
let inConsoleHook = false;

function severityFromConsole(level: 'error' | 'warning'): DiagnosticSeverity {
  return level === 'error' ? 'error' : 'warning';
}

function pushConsole(level: 'error' | 'warning', message: string, detail?: string) {
  // Anti re-entrancy: si llegamos acá ya dentro del hook (por ejemplo,
  // un listener que setState que React reporta como warning), salir.
  if (inConsoleHook || inEmit) return;
  inConsoleHook = true;
  try {
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
    if (items.length > 200) items.length = 200;
    buckets.set(key, { source: 'console', uri: 'global', items });
    emit();
  } finally {
    inConsoleHook = false;
  }
}

function pushProblemEvent(detail: {
  severity?: DiagnosticSeverity;
  source?: string;
  uri?: string;
  message: string;
  detail?: string;
  code?: string;
}) {
  if (inEmit) return;
  const source = detail.source ?? 'app';
  const uri = detail.uri ?? 'global';
  const key = bucketKey(source, uri);
  const bucket = buckets.get(key);
  const items: ResolvedDiagnostic[] = bucket ? bucket.items.slice() : [];
  items.unshift({
    id: genId(),
    source,
    uri,
    severity: detail.severity ?? 'warning',
    message: detail.message,
    detail: detail.detail,
    code: detail.code,
    publishedAt: Date.now()
  });
  if (items.length > 200) items.length = 200;
  buckets.set(key, { source, uri, items });
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

type DiagnosticsBusDispose = () => void;
const NOOP_DISPOSE: DiagnosticsBusDispose = () => { /* idempotente */ };
let consoleDispose: DiagnosticsBusDispose = NOOP_DISPOSE;

/**
 * Instala los hooks de diagnostics globales (console.error/warn, window.error,
 * unhandledrejection, agora:problem). Idempotente: si ya está instalado,
 * devuelve el disposable vigente. Llamar al disposable restaura los métodos
 * originales y desuscribe los listeners; útil para HMR/tests.
 */
export function installDiagnosticsBus(): DiagnosticsBusDispose {
  if (typeof window === 'undefined') return NOOP_DISPOSE;
  if (consoleInstalled) return consoleDispose;
  consoleInstalled = true;

  const origError = console.error;
  const origWarn = console.warn;

  const onError = (e: ErrorEvent) => {
    pushConsole('error', e.message || 'Error en la app', e.filename ? `${e.filename}:${e.lineno}` : undefined);
  };
  const onUnhandled = (e: PromiseRejectionEvent) => {
    const reason = e.reason;
    pushConsole('error', reason instanceof Error ? reason.message : formatArg(reason));
  };

  const wrappedError = (...args: unknown[]) => {
    const { message, detail } = joinArgs(args);
    pushConsole('error', message, detail);
    origError.apply(console, args);
  };
  const wrappedWarn = (...args: unknown[]) => {
    const { message, detail } = joinArgs(args);
    pushConsole('warning', message, detail);
    origWarn.apply(console, args);
  };

  console.error = wrappedError;
  console.warn = wrappedWarn;

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onUnhandled);

  const unsubProblem = subscribeAgoraEvent(AGORA_EVENTS.problem, (d) => {
    if (!d) return;
    pushProblemEvent(d);
  });

  consoleDispose = () => {
    if (!consoleInstalled) return;
    consoleInstalled = false;
    if (console.error === wrappedError) console.error = origError;
    if (console.warn === wrappedWarn) console.warn = origWarn;
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onUnhandled);
    unsubProblem();
    consoleDispose = NOOP_DISPOSE;
  };
  return consoleDispose;
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
