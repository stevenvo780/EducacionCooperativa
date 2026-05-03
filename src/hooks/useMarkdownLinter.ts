'use client';

import { useState, useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { MarkdownLinterRegistry } from '@/lib/markdown-linter/registry';
import { BUILTIN_RULE_IDS } from '@/lib/markdown-linter/rules';
import { getPersonalDictionary, initSpellEngine, isSpellEngineReady } from '@/lib/markdown-linter/spell-engine';
import { isSuppressed } from '@/lib/markdown-linter/suppressions';
import { LinterRegistry } from '@/lib/linters/registry';
import type { LinterDiagnostic, LinterRule } from '@/lib/markdown-linter/types';

// Re-export types for backward compatibility
export type { LinterDiagnostic, LinterRule };
export type { LinterSeverity } from '@/lib/markdown-linter/types';

function getRegistrySnapshot(): LinterRule[] {
  return MarkdownLinterRegistry.getEnabledRules();
}

function subscribeRegistry(onStoreChange: () => void): () => void {
  const offRules = MarkdownLinterRegistry.subscribe(onStoreChange);
  const offLinters = LinterRegistry.subscribe(onStoreChange);
  return () => { offRules(); offLinters(); };
}

function diagnosticsEqual(a: LinterDiagnostic[], b: LinterDiagnostic[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].line !== b[i].line || a[i].column !== b[i].column || a[i].message !== b[i].message) return false;
  }
  return true;
}

function sortDiagnostics(diagnostics: LinterDiagnostic[]): LinterDiagnostic[] {
  return [...diagnostics].sort((a, b) => a.line !== b.line ? a.line - b.line : a.column - b.column);
}

/** djb2 hash compacto para identificar contenido de párrafo */
function contentHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h & h;
  }
  return h.toString(36);
}

type Paragraph = { text: string; startLine: number; hash: string };

/**
 * Divide el texto en párrafos respetando bloques de código con líneas en blanco.
 * Los diagnósticos de cada párrafo se guardan con líneas 1-based relativas al párrafo,
 * lo que permite reusarlos aunque el párrafo se desplace en el documento.
 */
function splitIntoParagraphs(text: string): Paragraph[] {
  const lines = text.split('\n');
  const paragraphs: Paragraph[] = [];
  let paraStart = -1;
  let paraLines: string[] = [];
  let inFence = false;

  const flush = () => {
    if (paraStart >= 0 && paraLines.some((l) => l.trim())) {
      const paraText = paraLines.join('\n');
      paragraphs.push({ text: paraText, startLine: paraStart + 1, hash: contentHash(paraText) });
    }
    paraStart = -1;
    paraLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) inFence = !inFence;

    if (!inFence && trimmed === '') {
      flush();
    } else {
      if (paraStart < 0) paraStart = i;
      paraLines.push(lines[i]);
    }
  }
  flush();
  return paragraphs;
}

type WorkerResultMessage =
  | { type: 'lint-result'; requestId: number; diagnostics: LinterDiagnostic[] }
  | {
      type: 'lint-incremental-result';
      requestId: number;
      paragraphResults: Array<{ contentHash: string; diagnostics: LinterDiagnostic[] }>;
      documentDiagnostics: LinterDiagnostic[];
    };

/** Lifecycle status exposed to UI for loading indicators */
export type LinterStatus = 'initializing' | 'linting' | 'ready';

/** Minimum time (ms) the 'initializing' status stays visible so users can see it */
const MIN_INITIALIZING_DISPLAY_MS = 800;

// Cache entry: diagnósticos con líneas relativas al párrafo (1-based)
type ParagraphCacheEntry = { diagnostics: LinterDiagnostic[] };

/**
 * Hook de linting Markdown con soporte para:
 * - Reglas en Web Worker (CPU-bound)
 * - Reglas custom en hilo principal (p.ej. STDefinitions)
 * - Linting incremental por párrafo para ediciones parciales
 */
export function useMarkdownLinter(content: string, customRules: LinterRule[] = []) {
  const [diagnostics, setDiagnostics] = useState<LinterDiagnostic[]>([]);
  const [linterStatus, setLinterStatus] = useState<LinterStatus>('initializing');
  const contentRef = useRef(content);
  contentRef.current = content;
  const workerRef = useRef<Worker | null>(null);
  const latestRequestIdRef = useRef(0);
  const latestMainThreadDiagnosticsRef = useRef<LinterDiagnostic[]>([]);
  const workerAvailableRef = useRef(false);
  const hasLintedOnceRef = useRef(false);

  // Track when 'initializing' started for minimum display time
  const initStartRef = useRef<number>(Date.now());
  const pendingReadyRef = useRef(false);

  // Caché incremental: contentHash(párrafo) → diagnósticos con líneas relativas
  const paragraphCacheRef = useRef<Map<string, ParagraphCacheEntry>>(new Map());
  // Párrafos del último lint para comparación
  const prevParagraphsRef = useRef<Paragraph[]>([]);
  // Diagnósticos de reglas de documento completo (cacheados separadamente)
  const documentDiagnosticsRef = useRef<LinterDiagnostic[]>([]);

  const enabledRules = useSyncExternalStore(subscribeRegistry, getRegistrySnapshot, getRegistrySnapshot);
  const customRulesRef = useRef(customRules);
  customRulesRef.current = customRules;
  const enabledRulesRef = useRef(enabledRules);
  enabledRulesRef.current = enabledRules;

  useEffect(() => {
    if (typeof Worker === 'undefined') { workerAvailableRef.current = false; return; }

    const worker = new Worker(
      new URL('../workers/markdownLinter.worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerAvailableRef.current = true;
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerResultMessage>) => {
      const message = event.data;
      if (!message || message.requestId !== latestRequestIdRef.current) return;

      if (message.type === 'lint-result') {
        // Linting completo: poblar cache por párrafo para futuros incrementales
        const paragraphs = prevParagraphsRef.current;
        if (paragraphs.length > 0) {
          paragraphCacheRef.current.clear();
          for (const para of paragraphs) {
            const paraLineCount = para.text.split('\n').length;
            const paraDiags = message.diagnostics
              .filter((d) => d.line >= para.startLine && d.line < para.startLine + paraLineCount)
              .map((d) => ({
                ...d,
                line: d.line - para.startLine + 1,
                endLine: d.endLine !== undefined ? d.endLine - para.startLine + 1 : undefined
              }));
            paragraphCacheRef.current.set(para.hash, { diagnostics: paraDiags });
          }
        }
        combineAndSet(message.diagnostics);

      } else if (message.type === 'lint-incremental-result') {
        // Actualizar cache con resultados de párrafos cambiados
        for (const { contentHash: hash, diagnostics: paraDiags } of message.paragraphResults) {
          paragraphCacheRef.current.set(hash, { diagnostics: paraDiags });
        }
        // Guardar diagnósticos de documento completo
        documentDiagnosticsRef.current = message.documentDiagnostics;

        // Recomponer: iterar párrafos actuales, ajustar offsets desde cache
        const allParaDiags: LinterDiagnostic[] = [];
        for (const para of prevParagraphsRef.current) {
          const entry = paragraphCacheRef.current.get(para.hash);
          if (entry) {
            for (const d of entry.diagnostics) {
              allParaDiags.push({
                ...d,
                line: d.line + para.startLine - 1,
                endLine: d.endLine !== undefined ? d.endLine + para.startLine - 1 : undefined
              });
            }
          }
        }
        combineAndSet([...allParaDiags, ...message.documentDiagnostics]);
      }
    };

    worker.onerror = () => { workerAvailableRef.current = false; };

    return () => {
      worker.terminate();
      workerRef.current = null;
      workerAvailableRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const combineAndSet = useCallback((workerDiags: LinterDiagnostic[]) => {
    const combined = sortDiagnostics([
      ...latestMainThreadDiagnosticsRef.current,
      ...workerDiags
    ]).filter(d => !isSuppressed(d.ruleId, d.text));
    setDiagnostics((prev) => diagnosticsEqual(prev, combined) ? prev : combined);

    // Respect minimum display time for 'initializing' so users can see it
    setLinterStatus((prev) => {
      if (prev !== 'initializing') return 'ready';
      const elapsed = Date.now() - initStartRef.current;
      if (elapsed >= MIN_INITIALIZING_DISPLAY_MS) return 'ready';
      // Schedule deferred transition to 'ready'
      if (!pendingReadyRef.current) {
        pendingReadyRef.current = true;
        setTimeout(() => {
          pendingReadyRef.current = false;
          setLinterStatus((s) => s === 'initializing' ? 'ready' : s);
        }, MIN_INITIALIZING_DISPLAY_MS - elapsed);
      }
      return prev;
    });
  }, []);

  const runCustomRules = useCallback((text: string) => {
    const rules = [
      ...enabledRulesRef.current.filter((r) => !BUILTIN_RULE_IDS.has(r.id)),
      ...customRulesRef.current
    ];
    return sortDiagnostics(rules.flatMap((r) =>
      r.check(text).map(d => ({ ...d, ruleId: d.ruleId ?? r.id }))
    ));
  }, []);

  const runLint = useCallback((text: string) => {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;

    // Si el linter Markdown está globalmente desactivado, descarta toda
    // diagnóstico — vacía el estado y sale.
    if (!LinterRegistry.isEnabled('markdown')) {
      latestMainThreadDiagnosticsRef.current = [];
      setDiagnostics((prev) => prev.length === 0 ? prev : []);
      setLinterStatus('ready');
      return;
    }

    // Mark as linting (keep 'initializing' until first complete pass)
    setLinterStatus((prev) => prev === 'initializing' ? 'initializing' : 'linting');

    const builtinEnabled = enabledRulesRef.current.filter((r) => BUILTIN_RULE_IDS.has(r.id));

    // Separar reglas por soporte incremental
    const paragraphRuleIds = builtinEnabled
      .filter((r) => r.supportsIncremental !== false)
      .map((r) => r.id);
    const documentRuleIds = builtinEnabled
      .filter((r) => r.supportsIncremental === false)
      .map((r) => r.id);

    const mainDiags = runCustomRules(text);
    latestMainThreadDiagnosticsRef.current = mainDiags;

    // Emit main-thread results immediately so user sees fast feedback
    // Worker results will merge in asynchronously via combineAndSet
    if (mainDiags.length > 0) {
      setDiagnostics((prev) => diagnosticsEqual(prev, mainDiags) ? prev : mainDiags);
    }

    // Fallback sin worker
    if (!workerAvailableRef.current || !workerRef.current) {
      const fallback = sortDiagnostics(builtinEnabled.flatMap((r) => r.check(text)));
      const combined = sortDiagnostics([...mainDiags, ...fallback]);
      setDiagnostics((prev) => diagnosticsEqual(prev, combined) ? prev : combined);
      setLinterStatus('ready');
      return;
    }

    if (paragraphRuleIds.length === 0 && documentRuleIds.length === 0) {
      setDiagnostics((prev) => diagnosticsEqual(prev, mainDiags) ? prev : mainDiags);
      setLinterStatus('ready');
      return;
    }

    // Calcular párrafos actuales
    const paragraphs = splitIntoParagraphs(text);
    const prevParagraphs = prevParagraphsRef.current;
    prevParagraphsRef.current = paragraphs;

    // Determinar párrafos cambiados (cache miss)
    const cachedHashes = paragraphCacheRef.current;
    const currentHashes = new Set(paragraphs.map((p) => p.hash));

    // Limpiar entradas obsoletas del cache
    for (const hash of cachedHashes.keys()) {
      if (!currentHashes.has(hash)) cachedHashes.delete(hash);
    }

    const changedParagraphs = paragraphs.filter((p) => !cachedHashes.has(p.hash));
    const unchangedFraction = 1 - changedParagraphs.length / Math.max(1, paragraphs.length);

    // Usar incremental si > 50% de párrafos están cacheados y hay al menos 4 párrafos
    const useIncremental =
      paragraphRuleIds.length > 0 &&
      paragraphs.length >= 4 &&
      unchangedFraction > 0.5 &&
      prevParagraphs.length > 0;

    if (useIncremental) {
      workerRef.current.postMessage({
        type: 'lint-incremental',
        requestId,
        changedParagraphs: changedParagraphs.map(({ text: t, hash }) => ({
          text: t,
          contentHash: hash
        })),
        paragraphRuleIds,
        fullText: text,
        documentRuleIds,
        personalDictionary: getPersonalDictionary()
      });
    } else {
      // Linting completo — resetear cache de párrafos
      paragraphCacheRef.current.clear();
      documentDiagnosticsRef.current = [];
      workerRef.current.postMessage({
        type: 'lint',
        requestId,
        text,
        ruleIds: [...paragraphRuleIds, ...documentRuleIds],
        personalDictionary: getPersonalDictionary()
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runCustomRules]);

  useEffect(() => {
    const delay = hasLintedOnceRef.current ? 300 : 50;
    const timer = setTimeout(() => {
      hasLintedOnceRef.current = true;
      runLint(content);
    }, delay);
    return () => clearTimeout(timer);
  }, [content, runLint, enabledRules, customRules]);

  useEffect(() => {
    if (workerAvailableRef.current || isSpellEngineReady()) return;
    let cancelled = false;
    initSpellEngine()
      .then(() => { if (!cancelled) runLint(contentRef.current); })
      .catch(() => { /* fail-open */ });
    return () => { cancelled = true; };
  }, [runLint]);

  useEffect(() => {
    if (linterStatus !== 'initializing') return;
    const timeout = setTimeout(() => {
      setLinterStatus((prev) => prev === 'initializing' ? 'ready' : prev);
    }, 10_000);
    return () => clearTimeout(timeout);
  }, [linterStatus]);

  // Bridge al diagnostics-bus global. Emite cada cambio "real" de
  // diagnostics como custom event; el dashboard lo escucha y publica al
  // bus con el docId activo. Skip si la lista equivale a la anterior
  // para no spamear publishes en cada re-render del editor.
  const lastBridgeSigRef = useRef<string>('');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sig = diagnostics.length === 0
      ? 'empty'
      : `${diagnostics.length}:${diagnostics[0]?.severity ?? ''}:${(diagnostics[0]?.message ?? '').slice(0, 40)}`;
    if (lastBridgeSigRef.current === sig) return;
    lastBridgeSigRef.current = sig;
    window.dispatchEvent(new CustomEvent('agora:md-diagnostics', {
      detail: { diagnostics }
    }));
  }, [diagnostics]);

  return { diagnostics, runLint, linterStatus };
}
