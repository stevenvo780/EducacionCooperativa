/**
 * Snippets ST — plantillas multi-línea para el autocomplete.
 */

export interface Snippet {
  trigger: string;
  label: string;
  description: string;
  body: string;
  /** Offset desde el inicio del body donde colocar el cursor */
  cursorOffset: number;
  kind: 'snippet';
}

export const ST_SNIPPETS: Snippet[] = [
  {
    trigger: 'proof',
    label: 'assume ... show ... qed',
    description: 'Prueba estructurada',
    body: 'assume h1 : \nshow \nqed',
    cursorOffset: 12, // after "assume h1 : "
    kind: 'snippet'
  },
  {
    trigger: 'check',
    label: 'check valid ...',
    description: 'Verificar validez',
    body: 'check valid ',
    cursorOffset: 12, // after "check valid "
    kind: 'snippet'
  },
  {
    trigger: 'checkeq',
    label: 'check equivalent ..., ...',
    description: 'Verificar equivalencia',
    body: 'check equivalent , ',
    cursorOffset: 17, // after "check equivalent "
    kind: 'snippet'
  },
  {
    trigger: 'axiom',
    label: 'axiom name : ...',
    description: 'Declarar axioma',
    body: 'axiom  : ',
    cursorOffset: 6, // after "axiom "
    kind: 'snippet'
  },
  {
    trigger: 'theorem',
    label: 'theorem name : ...',
    description: 'Declarar teorema',
    body: 'theorem  : ',
    cursorOffset: 8, // after "theorem "
    kind: 'snippet'
  },
  {
    trigger: 'forall',
    label: 'forall x (...)',
    description: 'Cuantificador universal',
    body: 'forall  ()',
    cursorOffset: 7, // after "forall "
    kind: 'snippet'
  },
  {
    trigger: 'exists',
    label: 'exists x (...)',
    description: 'Cuantificador existencial',
    body: 'exists  ()',
    cursorOffset: 7, // after "exists "
    kind: 'snippet'
  },
  {
    trigger: 'import',
    label: 'import "file.st"',
    description: 'Importar archivo',
    body: 'import ""',
    cursorOffset: 8, // inside the quotes
    kind: 'snippet'
  },
  {
    trigger: 'truth',
    label: 'truth_table ...',
    description: 'Tabla de verdad',
    body: 'truth_table ',
    cursorOffset: 12,
    kind: 'snippet'
  },
  {
    trigger: 'counter',
    label: 'countermodel ...',
    description: 'Buscar contramodelo',
    body: 'countermodel ',
    cursorOffset: 13,
    kind: 'snippet'
  },
  {
    trigger: 'profile',
    label: 'logic ...',
    description: 'Establecer perfil lógico',
    body: 'logic classical.propositional',
    cursorOffset: 6, // after "logic "
    kind: 'snippet'
  },
  {
    trigger: 'render',
    label: 'render theory',
    description: 'Renderizar theory / claims / all',
    body: 'render theory',
    cursorOffset: 7,
    kind: 'snippet'
  },
  {
    trigger: 'explain',
    label: 'explain ...',
    description: 'Explicar una fórmula o expresión',
    body: 'explain ',
    cursorOffset: 7,
    kind: 'snippet'
  },
  {
    trigger: 'let',
    label: 'let name = ...',
    description: 'Alias de fórmula',
    body: 'let  = ',
    cursorOffset: 4, // after "let "
    kind: 'snippet'
  },
  {
    trigger: 'derive',
    label: 'derive ... from ...',
    description: 'Derivar de premisas',
    body: 'derive  from {}',
    cursorOffset: 7, // after "derive "
    kind: 'snippet'
  },
  {
    trigger: 'passage',
    label: 'let p = passage([[...]])',
    description: 'Formalizar texto natural',
    body: 'let p1 = passage([[\n  \n]])\nlet f1 = formalize p1 as ',
    cursorOffset: 18, // inside [[ ... ]]
    kind: 'snippet'
  },
  {
    trigger: 'export',
    label: 'export let ...',
    description: 'Exportar un símbolo para importarlo desde otro archivo',
    body: 'export let  = ',
    cursorOffset: 11,
    kind: 'snippet'
  },
  {
    trigger: 'define',
    label: 'define Name(x) := ...',
    description: 'Definir macro semántica expandible',
    body: 'define (x) := ',
    cursorOffset: 7, // after "define "
    kind: 'snippet'
  },
  {
    trigger: 'defined',
    label: 'define Name(x) := ...\ndescription "..."',
    description: 'Definir macro con descripción',
    body: 'define (x) := \ndescription ""',
    cursorOffset: 7,
    kind: 'snippet'
  },
  {
    trigger: 'unfold',
    label: 'unfold ...',
    description: 'Expandir definición',
    body: 'unfold ',
    cursorOffset: 7,
    kind: 'snippet'
  },
  {
    trigger: 'fold',
    label: 'fold ...',
    description: 'Contraer fórmula a su definición',
    body: 'fold ',
    cursorOffset: 5,
    kind: 'snippet'
  },
  {
    trigger: 'source',
    label: 'source Name { ... }',
    description: 'Declarar fuente bibliográfica',
    body: 'source  {\n  author ""\n  year 2024\n}',
    cursorOffset: 7,
    kind: 'snippet'
  },
  {
    trigger: 'interpret',
    label: 'interpret "text" as formula',
    description: 'Interpretar texto como fórmula',
    body: 'interpret "" as ',
    cursorOffset: 11, // inside the quotes
    kind: 'snippet'
  },
  {
    trigger: 'glossary',
    label: 'glossary',
    description: 'Mostrar glosario de definiciones activas',
    body: 'glossary',
    cursorOffset: 8,
    kind: 'snippet'
  },
  {
    trigger: 'rglossary',
    label: 'render glossary',
    description: 'Renderizar glosario completo',
    body: 'render glossary',
    cursorOffset: 15,
    kind: 'snippet'
  },
  {
    trigger: 'ranalysis',
    label: 'render analysis',
    description: 'Renderizar análisis completo del script',
    body: 'render analysis',
    cursorOffset: 15,
    kind: 'snippet'
  }
];

/**
 * Convierte snippets a CompletionItems para el autocomplete.
 */
export function snippetsToCompletionItems(): Array<{
  label: string;
  kind: string;
  detail: string;
  insertText: string;
  _cursorOffset?: number;
}> {
  return ST_SNIPPETS.map(s => ({
    label: s.trigger,
    kind: 'snippet',
    detail: s.description,
    insertText: s.body,
    _cursorOffset: s.cursorOffset
  }));
}
