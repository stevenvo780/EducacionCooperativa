/**
 * Cliente singleton para el Web Worker de runtime ST.
 *
 * Lazy: el worker se monta al primer uso. Si la plataforma no soporta Worker
 * (SSR, navegadores antiguos), las llamadas resuelven contra el runtime
 * inline de st-lang (fallback). El módulo principal nunca trae el worker en
 * el bundle del servidor.
 *
 * Cada llamada genera un requestId monotónico y guarda un Promise resolver
 * en un Map; el onmessage del worker resuelve el correspondiente.
 */

import {
  check as inlineCheck,
  evaluate as inlineEvaluate,
  parse as inlineParse,
  symbols as inlineSymbols,
  type STCheckResult,
  type STEvalResult,
  type STParseResult,
  type SymbolInfo
} from '@/lib/st-api';
import type { STWorkerResponse } from '@/workers/stRuntime.worker';

type Pending =
  | { type: 'evaluate'; resolve: (r: STEvalResult) => void }
  | { type: 'check'; resolve: (r: STCheckResult) => void }
  | { type: 'parse'; resolve: (r: STParseResult) => void }
  | { type: 'symbols'; resolve: (r: SymbolInfo[]) => void };

let workerInstance: Worker | null = null;
let workerUnavailable = false;
let nextRequestId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker | null {
  if (workerInstance) return workerInstance;
  if (workerUnavailable) return null;
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    workerUnavailable = true;
    return null;
  }
  try {
    const w = new Worker(
      new URL('../workers/stRuntime.worker.ts', import.meta.url),
      { type: 'module' }
    );
    w.onmessage = (event: MessageEvent<STWorkerResponse>) => {
      const message = event.data;
      if (!message) return;
      const slot = pending.get(message.requestId);
      if (!slot) return;
      pending.delete(message.requestId);
      switch (message.type) {
        case 'evaluate-result':
          if (slot.type === 'evaluate') slot.resolve(message.result);
          return;
        case 'check-result':
          if (slot.type === 'check') slot.resolve(message.result);
          return;
        case 'parse-result':
          if (slot.type === 'parse') slot.resolve(message.result);
          return;
        case 'symbols-result':
          if (slot.type === 'symbols') slot.resolve(message.result);
          break;
      }
    };
    w.onerror = () => {
      workerUnavailable = true;
      workerInstance = null;
      // Resuelve pendientes con fallback inline (fail-open) para no quedar
      // colgando con loading indefinido.
      for (const [, slot] of pending) {
        if (slot.type === 'symbols') slot.resolve([]);
      }
      pending.clear();
    };
    workerInstance = w;
    return w;
  } catch {
    workerUnavailable = true;
    return null;
  }
}

export function evaluateInWorker(code: string, file?: string): Promise<STEvalResult> {
  const w = getWorker();
  if (!w) {
    return Promise.resolve(inlineEvaluate(code, file));
  }
  return new Promise((resolve) => {
    const requestId = nextRequestId++;
    pending.set(requestId, { type: 'evaluate', resolve });
    w.postMessage({ type: 'evaluate', requestId, code, file });
  });
}

export function checkInWorker(code: string, file?: string): Promise<STCheckResult> {
  const w = getWorker();
  if (!w) {
    return Promise.resolve(inlineCheck(code, file));
  }
  return new Promise((resolve) => {
    const requestId = nextRequestId++;
    pending.set(requestId, { type: 'check', resolve });
    w.postMessage({ type: 'check', requestId, code, file });
  });
}

export function parseInWorker(code: string, file?: string): Promise<STParseResult> {
  const w = getWorker();
  if (!w) {
    return Promise.resolve(inlineParse(code, file));
  }
  return new Promise((resolve) => {
    const requestId = nextRequestId++;
    pending.set(requestId, { type: 'parse', resolve });
    w.postMessage({ type: 'parse', requestId, code, file });
  });
}

export function symbolsInWorker(code: string, file?: string): Promise<SymbolInfo[]> {
  const w = getWorker();
  if (!w) {
    try { return Promise.resolve(inlineSymbols(code, file)); }
    catch { return Promise.resolve([]); }
  }
  return new Promise((resolve) => {
    const requestId = nextRequestId++;
    pending.set(requestId, { type: 'symbols', resolve });
    w.postMessage({ type: 'symbols', requestId, code, file });
  });
}

export function isWorkerAvailable(): boolean {
  return !workerUnavailable && getWorker() !== null;
}
