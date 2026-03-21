'use client';

import { useState, useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { MarkdownLinterRegistry } from '@/lib/markdown-linter/registry';
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

// ── Hook principal ──────────────────────────────────────────

/**
 * Hook de linting Markdown que lee las reglas habilitadas del
 * MarkdownLinterRegistry y permite pasar reglas custom adicionales
 * (como STDefinitionsRule).
 */
export function useMarkdownLinter(content: string, customRules: LinterRule[] = []) {
  const [diagnostics, setDiagnostics] = useState<LinterDiagnostic[]>([]);

  // Reactive: re-render when registry enabled rules change
  const enabledRules = useSyncExternalStore(subscribeRegistry, getRegistrySnapshot, getRegistrySnapshot);

  const customRulesRef = useRef(customRules);
  customRulesRef.current = customRules;

  const enabledRulesRef = useRef(enabledRules);
  enabledRulesRef.current = enabledRules;

  const runLint = useCallback((text: string) => {
    const allRules = [...enabledRulesRef.current, ...customRulesRef.current];
    const results = allRules.flatMap(rule => rule.check(text));
    const sortedResults = results.sort((a, b) => a.line - b.line || a.column - b.column);
    setDiagnostics(prev => diagnosticsEqual(prev, sortedResults) ? prev : sortedResults);
  }, []);

  // Re-lint when content, enabled rules, or custom rules change
  useEffect(() => {
    const timer = setTimeout(() => {
      runLint(content);
    }, 800);
    return () => clearTimeout(timer);
  }, [content, runLint, enabledRules, customRules]);

  return { diagnostics, runLint };
}
