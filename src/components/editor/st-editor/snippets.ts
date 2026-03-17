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
    label: 'proof { ... } qed',
    description: 'Bloque de demostración',
    body: 'proof {\n  assume \n  show \n} qed',
    cursorOffset: 17, // after "assume "
    kind: 'snippet'
  },
  {
    trigger: 'check',
    label: 'check valid ... under ...',
    description: 'Verificar validez con perfil',
    body: 'check valid  under classical.propositional',
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
    label: 'forall x . (...)',
    description: 'Cuantificador universal',
    body: 'forall  . ()',
    cursorOffset: 7, // after "forall "
    kind: 'snippet'
  },
  {
    trigger: 'exists',
    label: 'exists x . (...)',
    description: 'Cuantificador existencial',
    body: 'exists  . ()',
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
    label: '#profile ...',
    description: 'Establecer perfil lógico',
    body: '#profile classical.propositional',
    cursorOffset: 9, // after "#profile "
    kind: 'snippet'
  },
  {
    trigger: 'render',
    label: 'render ...',
    description: 'Renderizar fórmula en Unicode',
    body: 'render ',
    cursorOffset: 7,
    kind: 'snippet'
  },
  {
    trigger: 'explain',
    label: 'explain',
    description: 'Explicar el perfil activo',
    body: 'explain',
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
    body: 'derive  from ',
    cursorOffset: 7, // after "derive "
    kind: 'snippet'
  },
  {
    trigger: 'passage',
    label: 'passage [[...]] formalize as ...',
    description: 'Formalizar texto natural',
    body: 'passage [[\n  \n]]\nformalize as ',
    cursorOffset: 13, // inside the brackets
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
