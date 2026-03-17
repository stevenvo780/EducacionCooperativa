/**
 * Autocompletion extension para el lenguaje ST en CodeMirror 6.
 *
 * Combina:
 * - Completions estáticas del st-lang/api (si disponible)
 * - Completions dinámicas (axioms, theorems, lets definidos en el script)
 * - Snippets con placeholders CM6 nativos
 */

import {
  autocompletion,
  CompletionContext,
  CompletionResult,
  Completion,
  snippetCompletion
} from '@codemirror/autocomplete';
import { KEYWORDS, BUILTINS, PROFILES, extractDynamicCompletions } from '../st-editor/tokenizer';

// ── Static keyword completions ──────────────────────────────

function makeKeywordCompletions(): Completion[] {
  const items: Completion[] = [];
  for (const kw of KEYWORDS) {
    items.push({
      label: kw,
      type: 'keyword',
      boost: 1
    });
  }
  for (const bi of BUILTINS) {
    items.push({
      label: bi,
      type: 'function',
      boost: 0
    });
  }
  for (const pf of PROFILES) {
    items.push({
      label: pf,
      type: 'type',
      detail: 'perfil lógico',
      boost: -1
    });
  }
  return items;
}

const staticCompletions = makeKeywordCompletions();

// ── Snippet completions (CM6 native with tab-stop placeholders) ──

function makeSnippetCompletions(): Completion[] {
  return [
    snippetCompletion('proof {\n  assume ${assume}\n  show ${goal}\n} qed', {
      label: 'proof',
      type: 'text',
      detail: 'Bloque de demostración',
      boost: 2
    }),
    snippetCompletion('check valid ${formula} under ${profile}', {
      label: 'check',
      type: 'text',
      detail: 'Verificar validez',
      boost: 2
    }),
    snippetCompletion('check equivalent (${formula1}), (${formula2})', {
      label: 'checkeq',
      type: 'text',
      detail: 'Verificar equivalencia',
      boost: 2
    }),
    snippetCompletion('check satisfiable (${formula})', {
      label: 'checksat',
      type: 'text',
      detail: 'Verificar satisfacibilidad',
      boost: 2
    }),
    snippetCompletion('axiom ${name} : ${formula}', {
      label: 'axiom',
      type: 'text',
      detail: 'Declarar axioma',
      boost: 2
    }),
    snippetCompletion('theorem ${name} : ${formula}', {
      label: 'theorem',
      type: 'text',
      detail: 'Declarar teorema',
      boost: 2
    }),
    snippetCompletion('forall ${x} . (${body})', {
      label: 'forall',
      type: 'text',
      detail: 'Cuantificador universal ∀',
      boost: 2
    }),
    snippetCompletion('exists ${x} . (${body})', {
      label: 'exists',
      type: 'text',
      detail: 'Cuantificador existencial ∃',
      boost: 2
    }),
    snippetCompletion('import "${file}"', {
      label: 'import',
      type: 'text',
      detail: 'Importar archivo',
      boost: 2
    }),
    snippetCompletion('truth_table (${formula})', {
      label: 'truth',
      type: 'text',
      detail: 'Tabla de verdad',
      boost: 2
    }),
    snippetCompletion('countermodel (${formula})', {
      label: 'counter',
      type: 'text',
      detail: 'Buscar contramodelo',
      boost: 2
    }),
    snippetCompletion('logic ${profile}', {
      label: 'logic',
      type: 'text',
      detail: 'Establecer perfil lógico',
      boost: 2
    }),
    snippetCompletion('render ${formula}', {
      label: 'render',
      type: 'text',
      detail: 'Renderizar fórmula Unicode',
      boost: 2
    }),
    snippetCompletion('let ${name} = ${formula}', {
      label: 'let',
      type: 'text',
      detail: 'Alias de fórmula',
      boost: 2
    }),
    snippetCompletion('derive ${conclusion} from {${premises}}', {
      label: 'derive',
      type: 'text',
      detail: 'Derivar de premisas',
      boost: 2
    }),
    snippetCompletion('passage [[\n  ${text}\n]]\nformalize as ${formula}', {
      label: 'passage',
      type: 'text',
      detail: 'Formalizar texto natural',
      boost: 2
    }),
    snippetCompletion('claim ${name} = ${formula}', {
      label: 'claim',
      type: 'text',
      detail: 'Declarar afirmación',
      boost: 2
    }),
    snippetCompletion('analyze (${formula})', {
      label: 'analyze',
      type: 'text',
      detail: 'Analizar fórmula',
      boost: 2
    })
  ];
}

const snippetCompletions = makeSnippetCompletions();

// ── Dynamic completions from document ───────────────────────

function getDynamicCompletions(doc: string): Completion[] {
  const items = extractDynamicCompletions(doc);
  return items.map(item => ({
    label: item.label,
    type: 'variable',
    detail: item.detail,
    boost: 3
  }));
}

// ── st-lang/api completions (async, optional) ───────────────

let stLangApi: null | {
  completion: (code: string, line: number, col: number) => Array<{
    label: string;
    kind: string;
    detail?: string;
    insertText?: string;
  }>;
} = null;

async function loadStLangApi() {
  try {
    const mod = await import('@stevenvo780/st-lang/api');
    if (typeof (mod as Record<string, unknown>).completion === 'function') {
      stLangApi = mod as typeof stLangApi;
    }
  } catch {
    // st-lang not available — use fallback completions only
  }
}

// Eager load
loadStLangApi();

// ── Main completion source ──────────────────────────────────

function stCompletionSource(context: CompletionContext): CompletionResult | null {
  // Get current word being typed
  const word = context.matchBefore(/[\w.]+/);
  if (!word && !context.explicit) return null;

  const from = word ? word.from : context.pos;
  const prefix = word ? word.text.toLowerCase() : '';
  const doc = context.state.doc.toString();

  // Gather all completions
  const all: Completion[] = [
    ...snippetCompletions,
    ...getDynamicCompletions(doc),
    ...staticCompletions
  ];

  // Add st-lang API completions if available
  if (stLangApi) {
    try {
      const line = context.state.doc.lineAt(context.pos);
      const lineNum = line.number;
      const col = context.pos - line.from;
      const apiItems = stLangApi.completion(doc, lineNum, col) || [];
      for (const item of apiItems) {
        all.push({
          label: item.label,
          type: item.kind === 'keyword' ? 'keyword' : item.kind === 'snippet' ? 'text' : 'variable',
          detail: item.detail,
          apply: item.insertText || item.label
        });
      }
    } catch {
      // ignore api errors
    }
  }

  // Filter by prefix (CodeMirror does this too, but pre-filtering helps perf)
  const filtered = prefix.length > 0
    ? all.filter(c => c.label.toLowerCase().startsWith(prefix) && c.label.toLowerCase() !== prefix)
    : all;

  if (filtered.length === 0) return null;

  // Deduplicate by label
  const seen = new Set<string>();
  const unique = filtered.filter(c => {
    if (seen.has(c.label)) return false;
    seen.add(c.label);
    return true;
  });

  return {
    from,
    options: unique,
    validFor: /^[\w.]*$/
  };
}

// ── Export ───────────────────────────────────────────────────

/**
 * CodeMirror autocompletion extension for ST language.
 */
export function stAutocompletion() {
  return autocompletion({
    override: [stCompletionSource],
    activateOnTyping: true,
    maxRenderedOptions: 30,
    icons: true
  });
}
