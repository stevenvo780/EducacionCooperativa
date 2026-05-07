import {
  check as rawCheck,
  evaluate as rawEvaluate,
  parse as rawParse,
  symbols as rawSymbols,
  hover as rawHover,
  gotoDefinition as rawGotoDefinition,
  type STCheckResult,
  type STEvalResult,
  type STParseResult,
  type SymbolInfo,
  type HoverInfo,
  type SourceLocation
} from '@stevenvo780/st-lang/api';
import { extractDefinitions, type STDefinition } from '@/lib/st-definitions-extract';

type ReqEvaluate = { type: 'evaluate'; requestId: number; code: string; file?: string };
type ReqCheck = { type: 'check'; requestId: number; code: string; file?: string };
type ReqParse = { type: 'parse'; requestId: number; code: string; file?: string };
type ReqSymbols = { type: 'symbols'; requestId: number; code: string; file?: string };
type ReqExtract = { type: 'extract'; requestId: number; code: string; file: string };
type ReqHover = { type: 'hover'; requestId: number; code: string; line: number; column: number; file?: string };
type ReqGoto = { type: 'goto'; requestId: number; code: string; name: string; file?: string };

type Request = ReqEvaluate | ReqCheck | ReqParse | ReqSymbols | ReqExtract | ReqHover | ReqGoto;

type ResEvaluate = { type: 'evaluate-result'; requestId: number; result: STEvalResult; error?: string };
type ResCheck = { type: 'check-result'; requestId: number; result: STCheckResult; error?: string };
type ResParse = { type: 'parse-result'; requestId: number; result: STParseResult; error?: string };
type ResSymbols = { type: 'symbols-result'; requestId: number; result: SymbolInfo[]; error?: string };
type ResExtract = { type: 'extract-result'; requestId: number; result: STDefinition[]; error?: string };
type ResHover = { type: 'hover-result'; requestId: number; result: HoverInfo | null; error?: string };
type ResGoto = { type: 'goto-result'; requestId: number; result: SourceLocation | null; error?: string };

export type STWorkerRequest = Request;
export type STWorkerResponse = ResEvaluate | ResCheck | ResParse | ResSymbols | ResExtract | ResHover | ResGoto;

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
        return;
      }
      case 'extract': {
        const result = extractDefinitions(message.code, message.file);
        const response: ResExtract = { type: 'extract-result', requestId: message.requestId, result };
        self.postMessage(response);
        return;
      }
      case 'hover': {
        let result: HoverInfo | null = null;
        try {
          result = rawHover(message.code, message.line, message.column, message.file);
        } catch {
          result = null;
        }
        const response: ResHover = { type: 'hover-result', requestId: message.requestId, result };
        self.postMessage(response);
        return;
      }
      case 'goto': {
        let result: SourceLocation | null = null;
        try {
          result = rawGotoDefinition(message.code, message.name, message.file) ?? null;
        } catch {
          result = null;
        }
        const response: ResGoto = { type: 'goto-result', requestId: message.requestId, result };
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
        return;
      }
      case 'extract': {
        const response: ResExtract = {
          type: 'extract-result',
          requestId: message.requestId,
          result: [],
          error: errorMsg
        };
        self.postMessage(response);
        return;
      }
      case 'hover': {
        const response: ResHover = {
          type: 'hover-result',
          requestId: message.requestId,
          result: null,
          error: errorMsg
        };
        self.postMessage(response);
        return;
      }
      case 'goto': {
        const response: ResGoto = {
          type: 'goto-result',
          requestId: message.requestId,
          result: null,
          error: errorMsg
        };
        self.postMessage(response);
      }
    }
  }
};
