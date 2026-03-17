/**
 * Hover info data — información contextual al pasar el cursor sobre tokens ST.
 */

export interface HoverData {
  title: string;
  description: string;
  example?: string;
  category?: 'keyword' | 'operator' | 'builtin' | 'profile' | 'alias';
}

// ── Keywords ────────────────────────────────────────────────

const keywordInfo: Record<string, HoverData> = {
  axiom:       { title: 'axiom', description: 'Declara un axioma (fórmula asumida como verdadera).', example: 'axiom ax1 : p -> (q -> p)', category: 'keyword' },
  axioma:      { title: 'axioma (→ axiom)', description: 'Alias en español de axiom.', example: 'axioma ax1 : p -> (q -> p)', category: 'alias' },
  theorem:     { title: 'theorem', description: 'Declara un teorema (requiere demostración).', example: 'theorem t1 : p -> p', category: 'keyword' },
  teorema:     { title: 'teorema (→ theorem)', description: 'Alias en español de theorem.', example: 'teorema t1 : p -> p', category: 'alias' },
  let:         { title: 'let', description: 'Define un alias de fórmula reutilizable.', example: 'let phi = p -> q', category: 'keyword' },
  sea:         { title: 'sea (→ let)', description: 'Alias en español de let.', example: 'sea phi = p -> q', category: 'alias' },
  check:       { title: 'check', description: 'Verifica una propiedad lógica de una fórmula.', example: 'check valid p -> p under classical.propositional', category: 'keyword' },
  verificar:   { title: 'verificar (→ check)', description: 'Alias en español de check.', category: 'alias' },
  prove:       { title: 'prove', description: 'Genera una demostración formal mediante tableaux.', example: 'prove p -> p under classical.propositional', category: 'keyword' },
  probar:      { title: 'probar (→ prove)', description: 'Alias en español de prove.', category: 'alias' },
  refute:      { title: 'refute', description: 'Intenta refutar una fórmula (busca contramodelo).', example: 'refute p & ~p', category: 'keyword' },
  refutar:     { title: 'refutar (→ refute)', description: 'Alias en español de refute.', category: 'alias' },
  derive:      { title: 'derive', description: 'Deriva una conclusión a partir de premisas.', example: 'derive q from ax1, ax2', category: 'keyword' },
  derivar:     { title: 'derivar (→ derive)', description: 'Alias en español de derive.', category: 'alias' },
  from:        { title: 'from', description: 'Indica las premisas de una derivación.', example: 'derive q from ax1, ax2', category: 'keyword' },
  forall:      { title: 'forall (∀)', description: 'Cuantificador universal: "para todo x".', example: 'forall x . (P(x) -> Q(x))', category: 'keyword' },
  paratodo:    { title: 'paratodo (→ forall)', description: 'Alias en español del cuantificador universal ∀.', category: 'alias' },
  exists:      { title: 'exists (∃)', description: 'Cuantificador existencial: "existe un x".', example: 'exists x . P(x)', category: 'keyword' },
  existe:      { title: 'existe (→ exists)', description: 'Alias en español del cuantificador existencial ∃.', category: 'alias' },
  next:        { title: 'next (X / ○)', description: 'Operador temporal LTL: "en el siguiente estado".', example: 'next p', category: 'keyword' },
  siguiente:   { title: 'siguiente (→ next)', description: 'Alias en español del operador temporal Next.', category: 'alias' },
  until:       { title: 'until (U)', description: 'Operador temporal LTL: "hasta que".', example: 'p until q', category: 'keyword' },
  hasta:       { title: 'hasta (→ until)', description: 'Alias en español del operador temporal Until.', category: 'alias' },
  import:      { title: 'import', description: 'Importa definiciones de otro archivo .st.', example: 'import "base.st"', category: 'keyword' },
  importar:    { title: 'importar (→ import)', description: 'Alias en español de import.', category: 'alias' },
  assume:      { title: 'assume', description: 'Asume una fórmula dentro de un bloque proof.', example: 'assume p -> q', category: 'keyword' },
  asumir:      { title: 'asumir (→ assume)', description: 'Alias en español de assume.', category: 'alias' },
  show:        { title: 'show', description: 'Declara la meta a demostrar en un bloque proof.', example: 'show p -> p', category: 'keyword' },
  demostrar:   { title: 'demostrar (→ show)', description: 'Alias en español de show.', category: 'alias' },
  qed:         { title: 'qed', description: 'Cierra un bloque proof (quod erat demonstrandum).', example: 'proof { ... } qed', category: 'keyword' },
  render:      { title: 'render', description: 'Muestra una fórmula en notación Unicode.', example: 'render forall x . P(x) -> Q(x)', category: 'keyword' },
  mostrar:     { title: 'mostrar (→ render)', description: 'Alias en español de render.', category: 'alias' },
  explain:     { title: 'explain', description: 'Explica el sistema lógico del perfil activo.', example: 'explain', category: 'keyword' },
  explicar:    { title: 'explicar (→ explain)', description: 'Alias en español de explain.', category: 'alias' },
  countermodel: { title: 'countermodel', description: 'Busca un contramodelo que falsifique la fórmula.', example: 'countermodel p -> q', category: 'keyword' },
  contramodelo: { title: 'contramodelo (→ countermodel)', description: 'Alias en español de countermodel.', category: 'alias' },
  truth_table: { title: 'truth_table', description: 'Genera la tabla de verdad de una fórmula.', example: 'truth_table p -> q', category: 'keyword' },
  tabla_verdad: { title: 'tabla_verdad (→ truth_table)', description: 'Alias en español de truth_table.', category: 'alias' },
  passage:     { title: 'passage', description: 'Define un pasaje de texto natural para formalizar.', example: 'passage "Si llueve, me mojo"', category: 'keyword' },
  formalize:   { title: 'formalize', description: 'Formaliza un pasaje como fórmula lógica.', example: 'formalize as p -> q', category: 'keyword' },
  claim:       { title: 'claim', description: 'Declara una afirmación con soporte y confianza.', example: 'claim c1 = p & q', category: 'keyword' },
  analyze:     { title: 'analyze', description: 'Analiza propiedades de una fórmula.', example: 'analyze p -> (q -> p)', category: 'keyword' },
  logic:       { title: 'logic', description: 'Palabra reservada del lenguaje ST.', category: 'keyword' },
  proof:       { title: 'proof { ... } qed', description: 'Bloque de demostración con suposiciones y meta.', example: 'proof {\n  assume p\n  show p\n} qed', category: 'keyword' }
};

// ── Operators ───────────────────────────────────────────────

const operatorInfo: Record<string, HoverData> = {
  '->':  { title: '→  Implicación', description: 'Si A entonces B. Falso solo cuando A es verdadero y B es falso.', example: 'p -> q   equivale a  ¬p ∨ q', category: 'operator' },
  '<->': { title: '↔  Bicondicional', description: 'A si y solo si B. Verdadero cuando ambos tienen el mismo valor.', example: 'p <-> q  equivale a  (p→q) ∧ (q→p)', category: 'operator' },
  '&':   { title: '∧  Conjunción', description: 'A y B. Verdadero solo cuando ambos son verdaderos.', example: 'p & q', category: 'operator' },
  '|':   { title: '∨  Disyunción', description: 'A o B. Falso solo cuando ambos son falsos.', example: 'p | q', category: 'operator' },
  '~':   { title: '¬  Negación', description: 'No A. Invierte el valor de verdad.', example: '~p  equivale a  ¬p', category: 'operator' },
  '!':   { title: '¬  Negación (alternativa)', description: 'No A. Equivalente a ~.', example: '!p  equivale a  ~p', category: 'operator' },
  '[]':  { title: '□  Necesidad (modal)', description: 'Es necesario que A. En todos los mundos accesibles, A es verdadero.', example: '[]p  en Kripke: ∀w′(wRw′ → p∈w′)', category: 'operator' },
  '<>':  { title: '◇  Posibilidad (modal)', description: 'Es posible que A. En algún mundo accesible, A es verdadero.', example: '<>p  en Kripke: ∃w′(wRw′ ∧ p∈w′)', category: 'operator' },
  '<-':  { title: '←  Implicación inversa', description: 'B entonces A (A si B).', category: 'operator' },
  '=':   { title: '=  Igualdad (FOL)', description: 'Igualdad entre términos en lógica de primer orden.', example: 'x = y', category: 'operator' }
};

// ── Builtins ────────────────────────────────────────────────

const builtinInfo: Record<string, HoverData> = {
  valid:        { title: 'valid', description: 'Verifica si la fórmula es una tautología (verdadera en toda interpretación).', example: 'check valid p -> p', category: 'builtin' },
  valido:       { title: 'válido (→ valid)', description: 'Alias español. Tautología.', category: 'builtin' },
  satisfiable:  { title: 'satisfiable', description: 'Verifica si existe al menos una interpretación que haga verdadera la fórmula.', example: 'check satisfiable p & q', category: 'builtin' },
  satisfacible: { title: 'satisfacible (→ satisfiable)', description: 'Alias español. Satisfacibilidad.', category: 'builtin' },
  equivalent:   { title: 'equivalent', description: 'Verifica si dos fórmulas son lógicamente equivalentes.', example: 'check equivalent p -> q, ~p | q', category: 'builtin' },
  equivalente:  { title: 'equivalente (→ equivalent)', description: 'Alias español. Equivalencia.', category: 'builtin' },
  claims:       { title: 'claims', description: 'Lista las afirmaciones registradas.', category: 'builtin' }
};

// ── Profiles ────────────────────────────────────────────────

const profileInfo: Record<string, HoverData> = {
  'classical.propositional':  { title: 'Lógica proposicional clásica', description: 'Operadores: ¬ ∧ ∨ → ↔\nTableaux con ramas abiertas/cerradas.\nSemántica bivalente (V/F).', category: 'profile' },
  'classical.first_order':    { title: 'Lógica de primer orden', description: 'Extensión con cuantificadores ∀ ∃, predicados, funciones e igualdad.', category: 'profile' },
  'classical.first-order':    { title: 'Lógica de primer orden', description: 'Alias con guión de classical.first_order.', category: 'profile' },
  'modal.k':                  { title: 'Lógica modal K', description: 'Sistema modal mínimo. □ (necesidad) y ◇ (posibilidad).\nModelos Kripke sin restricciones en R.', category: 'profile' },
  'modal.s5':                 { title: 'Lógica modal S5', description: 'R es una relación de equivalencia (reflexiva, simétrica, transitiva).\n□p ↔ "p en todos los mundos".', category: 'profile' },
  'paraconsistent.belnap':    { title: 'Lógica paraconsistente (Belnap)', description: '4 valores: T, F, Both (⊤), Neither (⊥).\nTolera contradicciones sin trivializar.', category: 'profile' },
  'deontic.standard':         { title: 'Lógica deóntica estándar', description: 'Obligación (O), Permisión (P), Prohibición (F).\nAxioma D: Ob(p) → Perm(p).', category: 'profile' },
  'epistemic.s5':             { title: 'Lógica epistémica S5', description: 'Conocimiento (K) y creencia.\nIntrospección positiva y negativa.', category: 'profile' },
  'intuitionistic.propositional': { title: 'Lógica intuicionista', description: 'Rechaza el tercero excluido (p ∨ ¬p).\nRequiere evidencia constructiva.', category: 'profile' },
  'temporal.ltl':             { title: 'Lógica temporal (LTL)', description: 'Operadores: X (next/○), U (until), F (eventually), G (always).\nRazzonamiento sobre secuencias de estados.', category: 'profile' },
  'probabilistic.basic':      { title: 'Lógica probabilística básica', description: 'Asigna probabilidades a fórmulas.\nP(A) ∈ [0,1], axiomas de Kolmogorov.', category: 'profile' },
  'aristotelian.syllogistic': { title: 'Silogística aristotélica', description: 'Proposiciones categóricas: A (todo), E (ninguno), I (alguno), O (alguno no).\nSilogismos con figuras y modos.', category: 'profile' }
};

// ── Lookup unificado ────────────────────────────────────────

/**
 * Busca información hover para un token dado su texto y categoría.
 */
export function getHoverInfo(text: string, category: string): HoverData | null {
  const lower = text.toLowerCase();

  // Keyword / alias
  if (category === 'keyword') return keywordInfo[lower] ?? null;
  // Builtin
  if (category === 'builtin') return builtinInfo[lower] ?? null;
  // Profile
  if (category === 'profile') return profileInfo[text] ?? profileInfo[lower] ?? null;
  // Operator
  if (category === 'operator') return operatorInfo[text] ?? null;

  // Fallback: buscar en todos
  return keywordInfo[lower] ?? builtinInfo[lower] ?? operatorInfo[text] ?? profileInfo[text] ?? null;
}
