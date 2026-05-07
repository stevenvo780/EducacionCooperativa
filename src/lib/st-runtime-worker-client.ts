import {
  check as inlineCheck,
  evaluate as inlineEvaluate,
  parse as inlineParse,
  symbols as inlineSymbols,
  hover as inlineHover,
  gotoDefinition as inlineGoto,
  type STCheckResult,
  type STEvalResult,
  type STParseResult,
  type SymbolInfo,
  type HoverInfo,
  type SourceLocation
} from '@/lib/st-api';
import { extractDefinitions, type STDefinition } from '@/lib/st-definitions-extract';
import type { STWorkerResponse } from '@/workers/stRuntime.worker';

type Pending =
  | { type: 'evaluate'; resolve: (r: STEvalResult) => void; fallback: () => STEvalResult }
  | { type: 'check'; resolve: (r: STCheckResult) => void; fallback: () => STCheckResult }
  | { type: 'parse'; resolve: (r: STParseResult) => void; fallback: () => STParseResult }
  | { type: 'symbols'; resolve: (r: SymbolInfo[]) => void; fallback: () => SymbolInfo[] }
  | { type: 'extract'; resolve: (r: STDefinition[]) => void; fallback: () => STDefinition[] }
  | { type: 'hover'; resolve: (r: HoverInfo | null) => void; fallback: () => HoverInfo | null }
  | { type: 'goto'; resolve: (r: SourceLocation | null) => void; fallback: () => SourceLocation | null };

let workerInstance: Worker | null = null;
let workerUnavailable = false;
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;
let nextRequestId = 1;
const pending = new Map<number, Pending>();

function failOpenAllPending(): void {
  for (const [, slot] of pending) {
    switch (slot.type) {
      case 'evaluate':
        slot.resolve(slot.fallback());
        break;
      case 'check':
        slot.resolve(slot.fallback());
        break;
      case 'parse':
        slot.resolve(slot.fallback());
        break;
      case 'symbols':
        slot.resolve(slot.fallback());
        break;
      case 'extract':
        slot.resolve(slot.fallback());
        break;
      case 'hover':
        slot.resolve(slot.fallback());
        break;
      case 'goto':
        slot.resolve(slot.fallback());
        break;
    }
  }
  pending.clear();
}

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
      consecutiveFailures = 0;
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
          return;
        case 'extract-result':
          if (slot.type === 'extract') slot.resolve(message.result);
          return;
        case 'hover-result':
          if (slot.type === 'hover') slot.resolve(message.result);
          return;
        case 'goto-result':
          if (slot.type === 'goto') slot.resolve(message.result);
      }
    };
    w.onerror = () => {
      consecutiveFailures += 1;
      try { w.terminate(); } catch { /* noop */ }
      workerInstance = null;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        workerUnavailable = true;
      } else {
        workerUnavailable = false;
      }
      failOpenAllPending();
    };
    workerInstance = w;
    return w;
  } catch {
    consecutiveFailures += 1;
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      workerUnavailable = true;
    }
    return null;
  }
}

function safeInlineEvaluate(code: string, file?: string): STEvalResult {
  try { return inlineEvaluate(code, file); }
  catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      exitCode: 3,
      results: [],
      diagnostics: [{ severity: 'error', message: msg }],
      stdout: '',
      stderr: msg
    };
  }
}

function safeInlineCheck(code: string, file?: string): STCheckResult {
  try { return inlineCheck(code, file); }
  catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, diagnostics: [{ severity: 'error', message: msg }] };
  }
}

function safeInlineParse(code: string, file?: string): STParseResult {
  try { return inlineParse(code, file); }
  catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, program: null, diagnostics: [{ severity: 'error', message: msg }] };
  }
}

function safeInlineSymbols(code: string, file?: string): SymbolInfo[] {
  try { return inlineSymbols(code, file); }
  catch { return []; }
}

function safeInlineHover(code: string, line: number, column: number, file?: string): HoverInfo | null {
  try { return inlineHover(code, line, column, file); }
  catch { return null; }
}

function safeInlineGoto(code: string, name: string, file?: string): SourceLocation | null {
  try { return inlineGoto(code, name, file) ?? null; }
  catch { return null; }
}

export function evaluateInWorker(code: string, file?: string): Promise<STEvalResult> {
  const w = getWorker();
  if (!w) return Promise.resolve(safeInlineEvaluate(code, file));
  return new Promise((resolve) => {
    const requestId = nextRequestId++;
    pending.set(requestId, { type: 'evaluate', resolve, fallback: () => safeInlineEvaluate(code, file) });
    w.postMessage({ type: 'evaluate', requestId, code, file });
  });
}

export function checkInWorker(code: string, file?: string): Promise<STCheckResult> {
  const w = getWorker();
  if (!w) return Promise.resolve(safeInlineCheck(code, file));
  return new Promise((resolve) => {
    const requestId = nextRequestId++;
    pending.set(requestId, { type: 'check', resolve, fallback: () => safeInlineCheck(code, file) });
    w.postMessage({ type: 'check', requestId, code, file });
  });
}

export function parseInWorker(code: string, file?: string): Promise<STParseResult> {
  const w = getWorker();
  if (!w) return Promise.resolve(safeInlineParse(code, file));
  return new Promise((resolve) => {
    const requestId = nextRequestId++;
    pending.set(requestId, { type: 'parse', resolve, fallback: () => safeInlineParse(code, file) });
    w.postMessage({ type: 'parse', requestId, code, file });
  });
}

export function symbolsInWorker(code: string, file?: string): Promise<SymbolInfo[]> {
  const w = getWorker();
  if (!w) return Promise.resolve(safeInlineSymbols(code, file));
  return new Promise((resolve) => {
    const requestId = nextRequestId++;
    pending.set(requestId, { type: 'symbols', resolve, fallback: () => safeInlineSymbols(code, file) });
    w.postMessage({ type: 'symbols', requestId, code, file });
  });
}

export function extractInWorker(code: string, fileId: string): Promise<STDefinition[]> {
  const w = getWorker();
  if (!w) return Promise.resolve(extractDefinitions(code, fileId));
  return new Promise((resolve) => {
    const requestId = nextRequestId++;
    pending.set(requestId, { type: 'extract', resolve, fallback: () => extractDefinitions(code, fileId) });
    w.postMessage({ type: 'extract', requestId, code, file: fileId });
  });
}

export function hoverInWorker(code: string, line: number, column: number, file?: string): Promise<HoverInfo | null> {
  const w = getWorker();
  if (!w) return Promise.resolve(safeInlineHover(code, line, column, file));
  return new Promise((resolve) => {
    const requestId = nextRequestId++;
    pending.set(requestId, { type: 'hover', resolve, fallback: () => safeInlineHover(code, line, column, file) });
    w.postMessage({ type: 'hover', requestId, code, line, column, file });
  });
}

export function gotoInWorker(code: string, name: string, file?: string): Promise<SourceLocation | null> {
  const w = getWorker();
  if (!w) return Promise.resolve(safeInlineGoto(code, name, file));
  return new Promise((resolve) => {
    const requestId = nextRequestId++;
    pending.set(requestId, { type: 'goto', resolve, fallback: () => safeInlineGoto(code, name, file) });
    w.postMessage({ type: 'goto', requestId, code, name, file });
  });
}

export function isWorkerAvailable(): boolean {
  return !workerUnavailable && getWorker() !== null;
}
