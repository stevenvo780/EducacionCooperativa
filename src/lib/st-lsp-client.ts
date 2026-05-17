/**
 * Cliente LSP in-process para el playground v2.
 *
 * Implementa la misma forma del Language Server Protocol (rangos 0-based,
 * Position, Hover, CompletionItem, Diagnostic, DocumentSymbol) pero
 * sin JSON-RPC ni proceso separado: llama a la API pública de
 * `@stevenvo780/st-lang` y mapea coordenadas 1-based ST → 0-based LSP.
 *
 * El paquete expone `STLanguageServer` en `dist/tooling/lsp/server.js`,
 * pero ese subpath no está en `exports`, así que reproducimos la misma
 * lógica de mapeo directamente — el server canónico hace lo mismo
 * internamente.
 */

import {
  hover as stHover,
  completion as stCompletion,
  symbols as stSymbols,
  gotoDefinition as stGotoDefinition,
  parse as stParse,
  typeCheck,
  type CompletionItem as StCompletionItem,
  type Diagnostic as StDiagnostic,
  type SymbolInfo as StSymbolInfo,
  type SourceLocation,
  type HoverInfo
} from '@stevenvo780/st-lang/api';

export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4
}

export interface LspDiagnostic {
  range: Range;
  severity: DiagnosticSeverity;
  code?: string;
  source: string;
  message: string;
  suggestion?: string;
}

export interface MarkupContent {
  kind: 'plaintext' | 'markdown';
  value: string;
}

export interface LspHover {
  contents: MarkupContent;
  range?: Range;
}

export interface LspLocation {
  uri: string;
  range: Range;
}

export enum CompletionItemKind {
  Text = 1,
  Method = 2,
  Function = 3,
  Variable = 6,
  Keyword = 14,
  Snippet = 15,
  Constant = 21,
  Operator = 24
}

export enum InsertTextFormat {
  PlainText = 1,
  Snippet = 2
}

export interface LspCompletionItem {
  label: string;
  kind: CompletionItemKind;
  detail?: string;
  documentation?: string;
  insertText: string;
  insertTextFormat: InsertTextFormat;
}

export interface LspDocumentSymbol {
  name: string;
  detail?: string;
  kind: number;
  range: Range;
}

const DIAGNOSTICS_SOURCE = 'st';

const UNICODE_OPERATORS: ReadonlyArray<{ label: string; detail: string }> = [
  { label: '∧', detail: 'Conjunción (and)' },
  { label: '∨', detail: 'Disyunción (or)' },
  { label: '→', detail: 'Implicación' },
  { label: '¬', detail: 'Negación' },
  { label: '↔', detail: 'Bicondicional' },
  { label: '∀', detail: 'Cuantificador universal' },
  { label: '∃', detail: 'Cuantificador existencial' },
  { label: '□', detail: 'Necesidad modal' },
  { label: '◇', detail: 'Posibilidad modal' }
];

interface DocState {
  uri: string;
  version: number;
  text: string;
}

interface SourceLocLike {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

function toLspRange(loc: SourceLocLike): Range {
  const startLine = Math.max(0, loc.line - 1);
  const startCol = Math.max(0, loc.column - 1);
  const endLine = loc.endLine !== undefined ? Math.max(0, loc.endLine - 1) : startLine;
  const endCol =
    loc.endColumn !== undefined ? Math.max(0, loc.endColumn - 1) : startCol + 1;
  return {
    start: { line: startLine, character: startCol },
    end: { line: endLine, character: endCol }
  };
}

function mapDiagnosticSeverity(s: StDiagnostic['severity']): DiagnosticSeverity {
  switch (s) {
    case 'error':
      return DiagnosticSeverity.Error;
    case 'warning':
      return DiagnosticSeverity.Warning;
    case 'info':
      return DiagnosticSeverity.Information;
    case 'hint':
      return DiagnosticSeverity.Hint;
    default:
      return DiagnosticSeverity.Information;
  }
}

function mapCompletionKind(kind: StCompletionItem['kind']): CompletionItemKind {
  switch (kind) {
    case 'keyword':
      return CompletionItemKind.Keyword;
    case 'snippet':
      return CompletionItemKind.Snippet;
    case 'value':
      return CompletionItemKind.Variable;
    case 'function':
      return CompletionItemKind.Function;
    case 'variable':
      return CompletionItemKind.Variable;
    case 'operator':
      return CompletionItemKind.Operator;
    default:
      return CompletionItemKind.Text;
  }
}

function mapSymbolKind(kind: StSymbolInfo['kind']): number {
  switch (kind) {
    case 'axiom':
      return 14;
    case 'theorem':
      return 11;
    case 'claim':
      return 13;
    case 'definition':
      return 6;
    case 'function':
      return 12;
    case 'passage':
      return 7;
    case 'source':
      return 1;
    default:
      return 13;
  }
}

function diagnosticToLsp(d: StDiagnostic): LspDiagnostic {
  const startLine = Math.max(0, (d.line ?? 1) - 1);
  const startCharacter = Math.max(0, (d.column ?? 1) - 1);
  const endLine = Math.max(0, (d.endLine ?? d.line ?? 1) - 1);
  const endCharacter = Math.max(
    startCharacter + 1,
    (d.endColumn ?? (d.column ?? 1) + 1) - 1
  );
  return {
    range: {
      start: { line: startLine, character: startCharacter },
      end: { line: endLine, character: endCharacter }
    },
    severity: mapDiagnosticSeverity(d.severity),
    code: d.code,
    source: DIAGNOSTICS_SOURCE,
    message: d.message,
    suggestion: d.suggestion
  };
}

function completionItemToLsp(item: StCompletionItem): LspCompletionItem {
  const isSnippet = /\$\{[^}]+\}/.test(item.insertText);
  return {
    label: item.label,
    kind: mapCompletionKind(item.kind),
    detail: item.detail,
    documentation: item.documentation,
    insertText: item.insertText,
    insertTextFormat: isSnippet
      ? InsertTextFormat.Snippet
      : InsertTextFormat.PlainText
  };
}

function inferProfile(programOrNull: unknown): string {
  if (
    programOrNull &&
    typeof programOrNull === 'object' &&
    'statements' in programOrNull
  ) {
    const stmts = (programOrNull as { statements: Array<{ kind: string; profile?: string }> })
      .statements;
    for (const s of stmts) {
      if (s.kind === 'logic_decl' && typeof s.profile === 'string') return s.profile;
    }
  }
  return '';
}

/**
 * Cliente LSP que mantiene el estado de documentos en memoria y expone
 * operaciones síncronas envueltas en promesas (para parecer un cliente
 * remoto sin bloquear el render thread con APIs sync).
 */
export class InProcessLSPClient {
  private readonly documents = new Map<string, DocState>();

  /** Notifica apertura de un documento. */
  didOpen(uri: string, text: string, version = 1): void {
    this.documents.set(uri, { uri, version, text });
  }

  /** Notifica cambios al documento (full sync). */
  didChange(uri: string, text: string, version: number): void {
    const existing = this.documents.get(uri);
    if (!existing) {
      this.documents.set(uri, { uri, version, text });
      return;
    }
    existing.text = text;
    existing.version = version;
  }

  /** Cierra el documento. */
  didClose(uri: string): void {
    this.documents.delete(uri);
  }

  /** Texto actual del documento. */
  getText(uri: string): string | null {
    return this.documents.get(uri)?.text ?? null;
  }

  /**
   * Diagnósticos combinados: parse + typeCheck. Ejecuta de forma síncrona
   * pero devuelve una promesa para no bloquear callers que esperen async.
   */
  async diagnostics(uri: string): Promise<LspDiagnostic[]> {
    const doc = this.documents.get(uri);
    if (!doc) return [];
    const out: LspDiagnostic[] = [];
    let parsed: ReturnType<typeof stParse>;
    try {
      parsed = stParse(doc.text, uri);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
          severity: DiagnosticSeverity.Error,
          source: DIAGNOSTICS_SOURCE,
          message: `parse threw: ${message}`,
          code: 'st-lsp/parse-threw'
        }
      ];
    }
    for (const d of parsed.diagnostics) {
      if (d.severity === 'error' || d.severity === 'warning') {
        out.push(diagnosticToLsp(d));
      }
    }
    if (parsed.ok && parsed.program) {
      const profile = inferProfile(parsed.program);
      try {
        const typeErrors = typeCheck(parsed.program, profile, uri);
        for (const te of typeErrors) {
          out.push({
            range: toLspRange(te.location),
            severity:
              te.severity === 'error'
                ? DiagnosticSeverity.Error
                : DiagnosticSeverity.Warning,
            code: te.code,
            source: DIAGNOSTICS_SOURCE,
            message: te.message,
            suggestion: te.suggestion
          });
        }
      } catch {
        // ignoramos errores del typecheck — perdemos esa ronda
      }
    }
    return out;
  }

  /**
   * Hover en posición LSP (0-based). Devuelve null si no hay info.
   */
  async hover(uri: string, line: number, character: number): Promise<LspHover | null> {
    const doc = this.documents.get(uri);
    if (!doc) return null;
    let info: HoverInfo | null;
    try {
      info = stHover(doc.text, line + 1, character + 1, uri);
    } catch {
      return null;
    }
    if (!info) return null;
    const range = info.range
      ? toLspRange({
          line: info.range.line,
          column: info.range.column,
          endLine: info.range.endLine,
          endColumn: info.range.endColumn
        })
      : undefined;
    return {
      contents: { kind: 'markdown', value: info.content },
      range
    };
  }

  /** Lista de completion items. La posición se ignora — el cliente filtra. */
  async completion(uri: string, _line: number, _character: number): Promise<LspCompletionItem[]> {
    void _line;
    void _character;
    const doc = this.documents.get(uri);
    if (!doc) return [];
    let items: LspCompletionItem[];
    try {
      items = stCompletion().map(completionItemToLsp);
    } catch {
      return [];
    }
    for (const op of UNICODE_OPERATORS) {
      items.push({
        label: op.label,
        kind: CompletionItemKind.Operator,
        detail: op.detail,
        insertText: op.label,
        insertTextFormat: InsertTextFormat.PlainText
      });
    }
    return items;
  }

  /** Goto-definition: busca el símbolo bajo el caret y devuelve su ubicación. */
  async definition(
    uri: string,
    line: number,
    character: number
  ): Promise<LspLocation | null> {
    const doc = this.documents.get(uri);
    if (!doc) return null;
    const word = wordAtPosition(doc.text, { line, character });
    if (!word) return null;
    let loc: SourceLocation | null;
    try {
      loc = stGotoDefinition(doc.text, word, uri);
    } catch {
      return null;
    }
    if (!loc) return null;
    return {
      uri,
      range: toLspRange({
        line: loc.line,
        column: loc.column,
        endLine: loc.endLine,
        endColumn: loc.endColumn
      })
    };
  }

  /** Outline / símbolos del documento. */
  async documentSymbol(uri: string): Promise<LspDocumentSymbol[]> {
    const doc = this.documents.get(uri);
    if (!doc) return [];
    let list: StSymbolInfo[];
    try {
      list = stSymbols(doc.text, uri);
    } catch {
      return [];
    }
    return list.map((s) => ({
      name: s.name,
      detail: s.detail,
      kind: mapSymbolKind(s.kind),
      range: toLspRange({
        line: s.location.line,
        column: s.location.column,
        endLine: s.location.endLine,
        endColumn: s.location.endColumn
      })
    }));
  }
}

const WORD_CHAR = /[a-zA-Z0-9_.]/;

function wordAtPosition(text: string, position: Position): string | null {
  const lines = text.split('\n');
  if (position.line < 0 || position.line >= lines.length) return null;
  const line = lines[position.line] ?? '';
  const col = Math.min(position.character, line.length);
  if (col < 0) return null;
  let start = col;
  while (start > 0) {
    const ch = line[start - 1];
    if (!ch || !WORD_CHAR.test(ch)) break;
    start--;
  }
  let end = col;
  while (end < line.length) {
    const ch = line[end];
    if (!ch || !WORD_CHAR.test(ch)) break;
    end++;
  }
  const word = line.slice(start, end).replace(/^\.+|\.+$/g, '');
  return word.length > 0 ? word : null;
}
