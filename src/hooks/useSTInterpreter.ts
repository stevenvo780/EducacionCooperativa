'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import {
  evaluate,
  quickEval,
  createInterpreter,
  listProfiles,
  symbols as stSymbols,
  type STEvalResult,
  type STInterpreter,
  type TheorySummary,
  type SymbolInfo,
  type Diagnostic
} from '@stevenvo780/st-lang/api';

// ── Tipos del hook ──────────────────────────────────────────

export interface STHistoryEntry {
  id: number;
  input: string;
  result: STEvalResult;
  timestamp: number;
}

export interface UseSTInterpreterReturn {
  /** Ejecuta código ST completo (sin estado) */
  run: (code: string) => STEvalResult;
  /** Ejecuta una línea en la sesión REPL (con estado) */
  execLine: (line: string) => STEvalResult;
  /** Evalúa una expresión rápida (auto classical.propositional) */
  quick: (expr: string) => STEvalResult;
  /** Reinicia la sesión REPL */
  reset: () => void;
  /** Último resultado */
  lastResult: STEvalResult | null;
  /** Historial de ejecuciones */
  history: STHistoryEntry[];
  /** Limpia el historial */
  clearHistory: () => void;
  /** Estado actual de la teoría en la sesión */
  theorySummary: TheorySummary | null;
  /** Perfiles lógicos disponibles */
  profiles: string[];
  /** Indica si está ejecutando */
  isRunning: boolean;
  /** Obtiene los símbolos del código actual */
  getSymbols: (code: string) => SymbolInfo[];
  /** Diagnósticos acumulados de la última ejecución */
  lastDiagnostics: Diagnostic[];
}

// ── Hook ────────────────────────────────────────────────────

export function useSTInterpreter(): UseSTInterpreterReturn {
  const [lastResult, setLastResult] = useState<STEvalResult | null>(null);
  const [history, setHistory] = useState<STHistoryEntry[]>([]);
  const [theorySummary, setTheorySummary] = useState<TheorySummary | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [lastDiagnostics, setLastDiagnostics] = useState<Diagnostic[]>([]);
  const idCounter = useRef(0);

  // Sesión REPL persistente
  const interpreterRef = useRef<STInterpreter | null>(null);
  const getInterpreter = useCallback(() => {
    if (!interpreterRef.current) {
      interpreterRef.current = createInterpreter();
    }
    return interpreterRef.current;
  }, []);

  const profiles = useMemo(() => {
    try {
      return listProfiles();
    } catch {
      return ['classical.propositional'];
    }
  }, []);

  const addToHistory = useCallback((input: string, result: STEvalResult) => {
    const entry: STHistoryEntry = {
      id: ++idCounter.current,
      input,
      result,
      timestamp: Date.now()
    };
    setHistory(prev => [...prev, entry]);
    setLastResult(result);
    setLastDiagnostics(result.diagnostics || []);
    return result;
  }, []);

  const getSymbols = useCallback((code: string): SymbolInfo[] => {
    try {
      return stSymbols(code);
    } catch {
      return [];
    }
  }, []);

  // Ejecución completa sin estado (cada llamada es independiente)
  const run = useCallback((code: string): STEvalResult => {
    setIsRunning(true);
    try {
      const result = evaluate(code);
      addToHistory(code, result);
      return result;
    } finally {
      setIsRunning(false);
    }
  }, [addToHistory]);

  // Ejecución en sesión REPL (mantiene estado entre llamadas)
  const execLine = useCallback((line: string): STEvalResult => {
    setIsRunning(true);
    try {
      const interp = getInterpreter();
      const result = interp.exec(line);
      addToHistory(line, result);
      setTheorySummary(interp.getTheorySummary());
      return result;
    } finally {
      setIsRunning(false);
    }
  }, [getInterpreter, addToHistory]);

  // Evaluación rápida (auto classical.propositional)
  const quick = useCallback((expr: string): STEvalResult => {
    setIsRunning(true);
    try {
      const result = quickEval(expr);
      addToHistory(expr, result);
      return result;
    } finally {
      setIsRunning(false);
    }
  }, [addToHistory]);

  // Reset
  const reset = useCallback(() => {
    if (interpreterRef.current) {
      interpreterRef.current.reset();
    }
    interpreterRef.current = null;
    setTheorySummary(null);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setLastResult(null);
    idCounter.current = 0;
  }, []);

  return {
    run,
    execLine,
    quick,
    reset,
    lastResult,
    history,
    clearHistory,
    theorySummary,
    profiles,
    isRunning,
    getSymbols,
    lastDiagnostics
  };
}
