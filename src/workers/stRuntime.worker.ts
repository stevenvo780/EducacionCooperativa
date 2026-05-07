/**
 * stRuntime.worker — ejecuta el runtime de @stevenvo780/st-lang fuera del
 * hilo principal.
 *
 * El parser ST + evaluate son CPU-bound (tablas de verdad, mesa semántica,
 * verificación). En sesiones largas con archivos medianos eso bloqueaba el
 * hilo principal y atrancaba scroll/typing en el editor (especialmente en
 * tablet).
 *
 * Protocolo: postMessage con `{ type, requestId }`. La respuesta replica el
 * `requestId` para que el cliente correlacione cada request con su response.
 */

import {
  check as rawCheck,
  evaluate as rawEvaluate,
  parse as rawParse,
  symbols as rawSymbols,
  type STCheckResult,
  type STEvalResult,
  type STParseResult,
  type SymbolInfo
} from '@stevenvo780/st-lang/api';

type ReqEvaluate = { type: 'evaluate'; requestId: number; code: string; file?: string };
type ReqCheck = { type: 'check'; requestId: number; code: string; file?: string };
type ReqParse = { type: 'parse'; requestId: number; code: string; file?: string };
type ReqSymbols = { type: 'symbols'; requestId: number; code: string; file?: string };

type Request = ReqEvaluate | ReqCheck | ReqParse | ReqSymbols;

type ResEvaluate = { type: 'evaluate-result'; requestId: number; result: STEvalResult; error?: string };
type ResCheck = { type: 'check-result'; requestId: number; result: STCheckResult; error?: string };
type ResParse = { type: 'parse-result'; requestId: number; result: STParseResult; error?: string };
type ResSymbols = { type: 'symbols-result'; requestId: number; result: SymbolInfo[]; error?: string };

export type STWorkerRequest = Request;
export type STWorkerResponse = ResEvaluate | ResCheck | ResParse | ResSymbols;

function fallbackEval(errorMsg: string): STEvalResult {
  return {
    ok: false,
    exitCode: 3,
    results: [],
    diagnostics: [{ severity: 'error', message: errorMsg }],
    stdout: '',
    stderr: errorMsg
  };
}

function fallbackCheck(errorMsg: string): STCheckResult {
  return { ok: false, diagnostics: [{ severity: 'error', message: errorMsg }] };
}

function fallbackParse(errorMsg: string): STParseResult {
  return { ok: false, program: null, diagnostics: [{ severity: 'error', message: errorMsg }] };
}

self.onmessage = (event: MessageEvent<Request>) => {
  const message = event.data;
  if (!message) return;

  try {
    switch (message.type) {
      case 'evaluate': {
        const result = rawEvaluate(message.code, message.file);
        const response: ResEvaluate = { type: 'evaluate-result', requestId: message.requestId, result };
        self.postMessage(response);
        return;
      }
      case 'check': {
        const result = rawCheck(message.code, message.file);
        const response: ResCheck = { type: 'check-result', requestId: message.requestId, result };
        self.postMessage(response);
        return;
      }
      case 'parse': {
        const result = rawParse(message.code, message.file);
        const response: ResParse = { type: 'parse-result', requestId: message.requestId, result };
        self.postMessage(response);
        return;
      }
      case 'symbols': {
        let result: SymbolInfo[];
        try {
          result = rawSymbols(message.code, message.file);
        } catch {
          result = [];
        }
        const response: ResSymbols = { type: 'symbols-result', requestId: message.requestId, result };
        self.postMessage(response);
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    switch (message.type) {
      case 'evaluate': {
        const response: ResEvaluate = {
          type: 'evaluate-result',
          requestId: message.requestId,
          result: fallbackEval(errorMsg),
          error: errorMsg
        };
        self.postMessage(response);
        return;
      }
      case 'check': {
        const response: ResCheck = {
          type: 'check-result',
          requestId: message.requestId,
          result: fallbackCheck(errorMsg),
          error: errorMsg
        };
        self.postMessage(response);
        return;
      }
      case 'parse': {
        const response: ResParse = {
          type: 'parse-result',
          requestId: message.requestId,
          result: fallbackParse(errorMsg),
          error: errorMsg
        };
        self.postMessage(response);
        return;
      }
      case 'symbols': {
        const response: ResSymbols = {
          type: 'symbols-result',
          requestId: message.requestId,
          result: [],
          error: errorMsg
        };
        self.postMessage(response);
      }
    }
  }
};
