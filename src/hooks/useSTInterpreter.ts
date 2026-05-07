'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import {
  check,
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
} from '@/lib/st-api';
import { collectSTDiagnostics } from '@/lib/st-execution';
import { checkInWorker, evaluateInWorker } from '@/lib/st-runtime-worker-client';

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
  /** Valida el código sin afectar el historial (síncrono — fallback) */
  validate: (code: string) => Diagnostic[];
  /** Valida en Web Worker — no bloquea hilo principal */
  validateAsync: (code: string) => Promise<Diagnostic[]>;
  /** Diagnósticos acumulados de la última ejecución o validación */
  lastDiagnostics: Diagnostic[];
}

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
    // Cap defensivo: cada entry retiene el resultado completo de evaluate()
    // (tablas de verdad, pruebas, output trace). Sin cap el array crece
    // ilimitado y atrapa MBs en heap durante sesiones largas.
    const HISTORY_CAP = 50;
    setHistory(prev => {
      const next = [...prev, entry];
      return next.length > HISTORY_CAP ? next.slice(next.length - HISTORY_CAP) : next;
    });
    setLastResult(result);
    setLastDiagnostics(collectSTDiagnostics(result));
    return result;
  }, []);

  const getSymbols = useCallback((code: string): SymbolInfo[] => {
    try {
      return stSymbols(code);
    } catch {
      return [];
    }
  }, []);

  const validate = useCallback((code: string): Diagnostic[] => {
    const parserDiagnostics = check(code).diagnostics || [];
    const hasParseErrors = parserDiagnostics.some((diagnostic) => diagnostic.severity === 'error');

    if (hasParseErrors) {
      setLastDiagnostics(parserDiagnostics);
      return parserDiagnostics;
    }

    try {
      const result = evaluate(code);
      const diagnostics = collectSTDiagnostics(result);
      setLastDiagnostics(diagnostics);
      return diagnostics;
    } catch {
      setLastDiagnostics(parserDiagnostics);
      return parserDiagnostics;
    }
  }, []);

  const validateAsync = useCallback(async (code: string): Promise<Diagnostic[]> => {
    // Doble pasada: primero check (rápido) en worker; si pasa, evaluate en
    // worker. Si check tiene errores de parseo, no perdemos tiempo evaluando.
    const checkResult = await checkInWorker(code);
    const parserDiagnostics: Diagnostic[] = checkResult.diagnostics || [];
    const hasParseErrors = parserDiagnostics.some((d: Diagnostic) => d.severity === 'error');

    if (hasParseErrors) {
      setLastDiagnostics(parserDiagnostics);
      return parserDiagnostics;
    }

    try {
      const result = await evaluateInWorker(code);
      const diagnostics = collectSTDiagnostics(result);
      setLastDiagnostics(diagnostics);
      return diagnostics;
    } catch {
      setLastDiagnostics(parserDiagnostics);
      return parserDiagnostics;
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
    validate,
    validateAsync,
    lastDiagnostics
  };
}
