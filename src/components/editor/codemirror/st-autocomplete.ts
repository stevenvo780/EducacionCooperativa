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
import { getHoverInfo } from '../st-editor/hover-info';

function buildInfoText(label: string, category: 'keyword' | 'builtin' | 'profile' | 'operator'): string | undefined {
  const info = getHoverInfo(label, category);
  if (!info) return undefined;
  return [info.title, info.description, info.example ? `Ejemplo: ${info.example}` : '']
    .filter(Boolean)
    .join('\n\n');
}

// ── Static keyword completions ──────────────────────────────

function makeKeywordCompletions(): Completion[] {
  const items: Completion[] = [];
  for (const kw of KEYWORDS) {
    const info = getHoverInfo(kw, 'keyword');
    items.push({
      label: kw,
      type: 'keyword',
      detail: info?.description ?? 'Palabra reservada ST',
      info: buildInfoText(kw, 'keyword'),
      boost: 1
    });
  }
  for (const bi of BUILTINS) {
    const info = getHoverInfo(bi, 'builtin');
    items.push({
      label: bi,
      type: 'function',
      detail: info?.description ?? 'Operador lógico predefinido',
      info: buildInfoText(bi, 'builtin'),
      boost: 0
    });
  }
  for (const pf of PROFILES) {
    const info = getHoverInfo(pf, 'profile');
    items.push({
      label: pf,
      type: 'type',
      detail: info?.description ?? 'perfil lógico',
      info: buildInfoText(pf, 'profile'),
      boost: -1
    });
  }
  return items;
}

const staticCompletions = makeKeywordCompletions();

function makeOperatorCompletions(): Completion[] {
  const operators = ['->', '<->', '&', '|', '^', '⊕', '!&', '↑', '!|', '↓', '!', '[]', '<>', '+', '-', '*', '/', '%', '<', '>', '<=', '>=', '≤', '≥'];
  return operators.map((operator) => ({
    label: operator,
    type: 'operator',
    detail: getHoverInfo(operator, 'operator')?.description ?? 'Operador ST',
    info: buildInfoText(operator, 'operator'),
    boost: -2
  }));
}

const operatorCompletions = makeOperatorCompletions();

// ── Snippet completions (CM6 native with tab-stop placeholders) ──

function makeSnippetCompletions(): Completion[] {
  return [
    snippetCompletion('assume ${name} : ${assume}\nshow ${goal}\nqed', {
      label: 'proof',
      type: 'text',
      detail: 'Prueba estructurada con assume/show/qed',
      boost: 2
    }),
    snippetCompletion('check valid ${formula}', {
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
    snippetCompletion('forall ${x} (${body})', {
      label: 'forall',
      type: 'text',
      detail: 'Cuantificador universal ∀',
      boost: 2
    }),
    snippetCompletion('exists ${x} (${body})', {
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
    snippetCompletion('render ${target}', {
      label: 'render',
      type: 'text',
      detail: 'Renderizar theory / claims / all o un nombre',
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
    snippetCompletion('let ${passage} = passage([[\n  ${text}\n]])\nlet ${formalization} = formalize ${passage} as ${formula}', {
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
    snippetCompletion('analyze {${premises}} -> ${conclusion}', {
      label: 'analyze',
      type: 'text',
      detail: 'Analizar inferencia completa',
      info: buildInfoText('analyze', 'keyword'),
      boost: 2
    }),
    snippetCompletion('logic arithmetic', {
      label: 'logic arithmetic',
      type: 'text',
      detail: 'Activar perfil aritmético',
      info: buildInfoText('arithmetic', 'profile'),
      boost: 3
    }),
    snippetCompletion('theory ${Name} {\n  ${body}\n}', {
      label: 'theory',
      type: 'text',
      detail: 'Bloque de teoría con miembros reutilizables',
      info: buildInfoText('theory', 'keyword'),
      boost: 3
    }),
    snippetCompletion('theory ${Name}(${params}) {\n  ${body}\n}', {
      label: 'theory template',
      type: 'text',
      detail: 'Teoría parametrizada e instanciable',
      info: buildInfoText('theory', 'keyword'),
      boost: 3
    }),
    snippetCompletion('theory ${Child} extends ${Parent} {\n  ${body}\n}', {
      label: 'theory extends',
      type: 'text',
      detail: 'Teoría que hereda de otra',
      info: buildInfoText('extends', 'keyword'),
      boost: 3
    }),
    snippetCompletion('export let ${name} = ${value}', {
      label: 'export',
      type: 'text',
      detail: 'Exportar símbolo para importación',
      info: buildInfoText('export', 'keyword'),
      boost: 3
    }),
    snippetCompletion('print ${value}', {
      label: 'print',
      type: 'text',
      detail: 'Imprimir salida en tiempo de ejecución',
      info: buildInfoText('print', 'keyword'),
      boost: 3
    }),
    snippetCompletion('set ${name} = ${value}', {
      label: 'set',
      type: 'text',
      detail: 'Reasignar variable o alias',
      info: buildInfoText('set', 'keyword'),
      boost: 3
    }),
    snippetCompletion('if ${condition} ${formula} {\n  ${body}\n} else {\n  ${fallback}\n}', {
      label: 'if',
      type: 'text',
      detail: 'Condicional ST con rama else',
      info: buildInfoText('if', 'keyword'),
      boost: 3
    }),
    snippetCompletion('for ${item} in {${items}} {\n  ${body}\n}', {
      label: 'for',
      type: 'text',
      detail: 'Bucle sobre valores o fórmulas',
      info: buildInfoText('for', 'keyword'),
      boost: 3
    }),
    snippetCompletion('while ${condition} ${formula} {\n  ${body}\n}', {
      label: 'while',
      type: 'text',
      detail: 'Bucle mientras la condición siga siendo cierta',
      info: buildInfoText('while', 'keyword'),
      boost: 3
    }),
    snippetCompletion('fn ${name}(${params}) {\n  ${body}\n  return ${result}\n}', {
      label: 'fn',
      type: 'text',
      detail: 'Declarar función con retorno',
      info: buildInfoText('fn', 'keyword'),
      boost: 3
    }),
    snippetCompletion('print typeof(${value})', {
      label: 'typeof',
      type: 'text',
      detail: 'Inspeccionar tipo de un valor',
      info: buildInfoText('typeof', 'builtin'),
      boost: 3
    }),
    snippetCompletion('print is_valid(${formula})', {
      label: 'is_valid',
      type: 'text',
      detail: 'Preguntar si una fórmula es válida',
      info: buildInfoText('is_valid', 'builtin'),
      boost: 3
    }),
    snippetCompletion('print get_atoms(${formula})', {
      label: 'get_atoms',
      type: 'text',
      detail: 'Listar átomos usados en una fórmula',
      info: buildInfoText('get_atoms', 'builtin'),
      boost: 3
    }),
    // ── Modal alias snippets ──
    snippetCompletion('logic epistemic.s5\nK(${formula})', {
      label: 'K()',
      type: 'text',
      detail: 'Conocimiento K(φ) ≡ □φ (epistemic.s5)',
      boost: 2
    }),
    snippetCompletion('logic epistemic.s5\nB(${formula})', {
      label: 'B()',
      type: 'text',
      detail: 'Creencia B(φ) ≡ ◇φ (epistemic.s5)',
      boost: 2
    }),
    snippetCompletion('logic deontic.standard\nO(${formula})', {
      label: 'O()',
      type: 'text',
      detail: 'Obligación O(φ) ≡ □φ (deontic.standard)',
      boost: 2
    }),
    snippetCompletion('logic deontic.standard\nP(${formula})', {
      label: 'P()',
      type: 'text',
      detail: 'Permisión P(φ) ≡ ◇φ (deontic.standard)',
      boost: 2
    }),
    snippetCompletion('logic temporal.ltl\nG(${formula})', {
      label: 'G()',
      type: 'text',
      detail: 'Globally G(φ) ≡ □φ (temporal.ltl)',
      boost: 2
    }),
    snippetCompletion('logic temporal.ltl\nF(${formula})', {
      label: 'F()',
      type: 'text',
      detail: 'Eventually F(φ) ≡ ◇φ (temporal.ltl)',
      boost: 2
    }),
    snippetCompletion('logic paraconsistent.belnap\ntruth_table ${formula}', {
      label: 'belnap truth_table',
      type: 'text',
      detail: 'Tabla de verdad Belnap 4-valores (T/F/B/N)',
      boost: 2
    }),
    snippetCompletion('refute ${formula}', {
      label: 'refute',
      type: 'text',
      detail: 'Refutar fórmula (buscar contramodelo)',
      info: buildInfoText('refute', 'keyword'),
      boost: 2
    }),
    snippetCompletion('check equivalent (${formula1}), (${formula2})', {
      label: 'check equivalent',
      type: 'text',
      detail: 'Verificar equivalencia lógica',
      boost: 2
    }),
    snippetCompletion('explain (${formula})', {
      label: 'explain',
      type: 'text',
      detail: 'Explicar una fórmula según el perfil activo',
      info: buildInfoText('explain', 'keyword'),
      boost: 2
    }),
    snippetCompletion('prove ${goal} from {${premises}}', {
      label: 'prove',
      type: 'text',
      detail: 'Demostrar una meta desde premisas',
      info: buildInfoText('prove', 'keyword'),
      boost: 2
    }),
    snippetCompletion('support ${claim} : ${premises}', {
      label: 'support',
      type: 'text',
      detail: 'Asignar premisas de soporte a un claim',
      info: buildInfoText('support', 'keyword'),
      boost: 2
    }),
    snippetCompletion('confidence ${claim} : ${value}', {
      label: 'confidence',
      type: 'text',
      detail: 'Asignar nivel de confianza [0..1] a un claim',
      info: buildInfoText('confidence', 'keyword'),
      boost: 2
    }),
    snippetCompletion('context ${claim} : "${description}"', {
      label: 'context',
      type: 'text',
      detail: 'Asignar contexto semántico a un claim',
      info: buildInfoText('context', 'keyword'),
      boost: 2
    }),
    snippetCompletion('print is_satisfiable(${formula})', {
      label: 'is_satisfiable',
      type: 'text',
      detail: 'Preguntar si una fórmula es satisfacible',
      info: buildInfoText('is_satisfiable', 'builtin'),
      boost: 3
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
    ...staticCompletions,
    ...operatorCompletions
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
          info: item.detail,
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
