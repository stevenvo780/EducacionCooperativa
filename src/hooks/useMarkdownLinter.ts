'use client';

import { useState, useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { MarkdownLinterRegistry } from '@/lib/markdown-linter/registry';
import { BUILTIN_RULE_IDS } from '@/lib/markdown-linter/rules';
import { getPersonalDictionary, initSpellEngine, isSpellEngineReady } from '@/lib/markdown-linter/spell-engine';
import type { LinterDiagnostic, LinterRule } from '@/lib/markdown-linter/types';

// Re-export types for backward compatibility
export type { LinterDiagnostic, LinterRule };
export type { LinterSeverity } from '@/lib/markdown-linter/types';

// ── Stable selectors for useSyncExternalStore ───────────────

function getRegistrySnapshot(): LinterRule[] {
  return MarkdownLinterRegistry.getEnabledRules();
}

function subscribeRegistry(onStoreChange: () => void): () => void {
  return MarkdownLinterRegistry.subscribe(onStoreChange);
}

// ── Comparador de diagnósticos ──────────────────────────────

function diagnosticsEqual(a: LinterDiagnostic[], b: LinterDiagnostic[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].line !== b[i].line || a[i].column !== b[i].column || a[i].message !== b[i].message) return false;
  }
  return true;
}

function sortDiagnostics(diagnostics: LinterDiagnostic[]): LinterDiagnostic[] {
  return [...diagnostics].sort((left, right) => {
    if (left.line !== right.line) return left.line - right.line;
    return left.column - right.column;
  });
}

type LintWorkerResultMessage = {
  type: 'lint-result';
  requestId: number;
  diagnostics: LinterDiagnostic[];
};

// ── Hook principal ──────────────────────────────────────────

/**
 * Hook de linting Markdown que lee las reglas habilitadas del
 * MarkdownLinterRegistry y permite pasar reglas custom adicionales
 * (como STDefinitionsRule).
 */
export function useMarkdownLinter(content: string, customRules: LinterRule[] = []) {
  const [diagnostics, setDiagnostics] = useState<LinterDiagnostic[]>([]);
  const contentRef = useRef(content);
  contentRef.current = content;
  const workerRef = useRef<Worker | null>(null);
  const latestRequestIdRef = useRef(0);
  const latestMainThreadDiagnosticsRef = useRef<LinterDiagnostic[]>([]);
  const workerAvailableRef = useRef(false);

  // Reactive: re-render when registry enabled rules change
  const enabledRules = useSyncExternalStore(subscribeRegistry, getRegistrySnapshot, getRegistrySnapshot);

  const customRulesRef = useRef(customRules);
  customRulesRef.current = customRules;

  const enabledRulesRef = useRef(enabledRules);
  enabledRulesRef.current = enabledRules;

  useEffect(() => {
    if (typeof Worker === 'undefined') {
      workerAvailableRef.current = false;
      return;
    }

    const worker = new Worker(new URL('../workers/markdownLinter.worker.ts', import.meta.url), { type: 'module' });
    workerAvailableRef.current = true;
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<LintWorkerResultMessage>) => {
      const message = event.data;
      if (!message || message.type !== 'lint-result') return;
      if (message.requestId !== latestRequestIdRef.current) return;

      const combinedDiagnostics = sortDiagnostics([
        ...latestMainThreadDiagnosticsRef.current,
        ...message.diagnostics
      ]);

      setDiagnostics((previous) => diagnosticsEqual(previous, combinedDiagnostics) ? previous : combinedDiagnostics);
    };

    worker.onerror = () => {
      workerAvailableRef.current = false;
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
      workerAvailableRef.current = false;
    };
  }, []);

  const runCustomRules = useCallback((text: string) => {
    const rules = [
      ...enabledRulesRef.current.filter((rule) => !BUILTIN_RULE_IDS.has(rule.id)),
      ...customRulesRef.current
    ];
    return sortDiagnostics(rules.flatMap((rule) => rule.check(text)));
  }, []);

  const runLint = useCallback((text: string) => {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;

    const builtInRuleIds = enabledRulesRef.current
      .filter((rule) => BUILTIN_RULE_IDS.has(rule.id))
      .map((rule) => rule.id);

    const mainThreadDiagnostics = runCustomRules(text);
    latestMainThreadDiagnosticsRef.current = mainThreadDiagnostics;

    if (!workerAvailableRef.current || !workerRef.current || builtInRuleIds.length === 0) {
      const fallbackRules = enabledRulesRef.current.filter((rule) => BUILTIN_RULE_IDS.has(rule.id));
      const fallbackBuiltInDiagnostics = sortDiagnostics(fallbackRules.flatMap((rule) => rule.check(text)));
      const combinedDiagnostics = sortDiagnostics([...mainThreadDiagnostics, ...fallbackBuiltInDiagnostics]);
      setDiagnostics((previous) => diagnosticsEqual(previous, combinedDiagnostics) ? previous : combinedDiagnostics);
      return;
    }

    workerRef.current.postMessage({
      type: 'lint',
      requestId,
      text,
      ruleIds: builtInRuleIds,
      personalDictionary: getPersonalDictionary()
    });
  }, [runCustomRules]);

  // Re-lint when content, enabled rules, or custom rules change
  useEffect(() => {
    const timer = setTimeout(() => {
      runLint(content);
    }, 300);
    return () => clearTimeout(timer);
  }, [content, runLint, enabledRules, customRules]);

  useEffect(() => {
    if (workerAvailableRef.current) return;
    if (isSpellEngineReady()) return;

    let cancelled = false;
    initSpellEngine()
      .then(() => {
        if (!cancelled) {
          runLint(contentRef.current);
        }
      })
      .catch(() => {
        // fail-open: el linter sigue funcionando con reglas locales
      });

    return () => {
      cancelled = true;
    };
  }, [runLint]);

  return { diagnostics, runLint };
}
