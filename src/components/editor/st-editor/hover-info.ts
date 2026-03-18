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
  as:          { title: 'as', description: 'Conecta una formalización con su representación lógica.', example: 'formalize pasaje1 as P -> Q', category: 'keyword' },
  como:        { title: 'como (→ as)', description: 'Alias en español de as.', example: 'formalizar pasaje1 como P -> Q', category: 'alias' },
  check:       { title: 'check', description: 'Verifica una propiedad lógica de una fórmula.', example: 'check valid (p -> p)', category: 'keyword' },
  verificar:   { title: 'verificar (→ check)', description: 'Alias en español de check.', category: 'alias' },
  prove:       { title: 'prove', description: 'Intenta demostrar una meta usando la teoría cargada.', example: 'prove q from {ax1, ax2}', category: 'keyword' },
  probar:      { title: 'probar (→ prove)', description: 'Alias en español de prove.', category: 'alias' },
  refute:      { title: 'refute', description: 'Intenta refutar una fórmula (busca contramodelo).', example: 'refute p & ~p', category: 'keyword' },
  refutar:     { title: 'refutar (→ refute)', description: 'Alias en español de refute.', category: 'alias' },
  derive:      { title: 'derive', description: 'Deriva una conclusión a partir de premisas.', example: 'derive q from {ax1, ax2}', category: 'keyword' },
  derivar:     { title: 'derivar (→ derive)', description: 'Alias en español de derive.', category: 'alias' },
  from:        { title: 'from', description: 'Indica las premisas de una derivación.', example: 'derive q from {ax1, ax2}', category: 'keyword' },
  forall:      { title: 'forall (∀)', description: 'Cuantificador universal: "para todo x".', example: 'forall x (P(x) -> Q(x))', category: 'keyword' },
  paratodo:    { title: 'paratodo (→ forall)', description: 'Alias en español del cuantificador universal ∀.', category: 'alias' },
  exists:      { title: 'exists (∃)', description: 'Cuantificador existencial: "existe un x".', example: 'exists x P(x)', category: 'keyword' },
  existe:      { title: 'existe (→ exists)', description: 'Alias en español del cuantificador existencial ∃.', category: 'alias' },
  next:        { title: 'next (X / ○)', description: 'Operador temporal LTL: "en el siguiente estado".', example: 'next p', category: 'keyword' },
  siguiente:   { title: 'siguiente (→ next)', description: 'Alias en español del operador temporal Next.', category: 'alias' },
  until:       { title: 'until (U)', description: 'Operador temporal LTL: "hasta que".', example: 'p until q', category: 'keyword' },
  hasta:       { title: 'hasta (→ until)', description: 'Alias en español del operador temporal Until.', category: 'alias' },
  import:      { title: 'import', description: 'Importa definiciones de otro archivo .st.', example: 'import "base.st"', category: 'keyword' },
  importar:    { title: 'importar (→ import)', description: 'Alias en español de import.', category: 'alias' },
  export:      { title: 'export', description: 'Marca un let, axiom, theorem, fn o theory para que sea visible al importar el archivo.', example: 'export let regla = P -> Q', category: 'keyword' },
  exportar:    { title: 'exportar (→ export)', description: 'Alias en español de export.', example: 'exportar axioma base : P', category: 'alias' },
  theory:      { title: 'theory', description: 'Declara un bloque reutilizable con axiomas, teoremas, aliases y miembros encapsulados.', example: 'theory Algebra {\n  axiom neutral : x + 0 = x\n}', category: 'keyword' },
  teoria:      { title: 'teoria (→ theory)', description: 'Alias en español de theory.', example: 'teoria Algebra {\n  axioma neutral : x + 0 = x\n}', category: 'alias' },
  extends:     { title: 'extends', description: 'Hace que una teoría herede miembros públicos de otra teoría.', example: 'theory Calculus extends Algebra {\n  theorem t : P\n}', category: 'keyword' },
  extiende:    { title: 'extiende (→ extends)', description: 'Alias en español de extends.', example: 'teoria Calculo extiende Algebra {\n  teorema t : P\n}', category: 'alias' },
  private:     { title: 'private', description: 'Marca un miembro de teoría como interno y no accesible por dot notation externa.', example: 'private let secreto = P', category: 'keyword' },
  privado:     { title: 'privado (→ private)', description: 'Alias en español de private.', example: 'privado sea secreto = P', category: 'alias' },
  assume:      { title: 'assume', description: 'Introduce una hipótesis nombrada dentro de una prueba estructurada.', example: 'assume h1 : p -> q', category: 'keyword' },
  asumir:      { title: 'asumir (→ assume)', description: 'Alias en español de assume.', category: 'alias' },
  show:        { title: 'show', description: 'Declara la meta a demostrar en un bloque proof.', example: 'show p -> p', category: 'keyword' },
  demostrar:   { title: 'demostrar (→ show)', description: 'Alias en español de show.', category: 'alias' },
  qed:         { title: 'qed', description: 'Cierra una prueba estructurada iniciada con assume/show.', example: 'assume h1 : p\nshow p\nqed', category: 'keyword' },
  print:       { title: 'print', description: 'Imprime texto o fórmulas durante la ejecución del script.', example: 'print "resultado listo"', category: 'keyword' },
  imprimir:    { title: 'imprimir (→ print)', description: 'Alias en español de print.', example: 'imprimir "resultado listo"', category: 'alias' },
  set:         { title: 'set', description: 'Reasigna el valor de una variable o alias previamente definido.', example: 'set total = total + 1', category: 'keyword' },
  asignar:     { title: 'asignar (→ set)', description: 'Alias en español de set.', example: 'asignar total = total + 1', category: 'alias' },
  if:          { title: 'if', description: 'Ejecuta un bloque cuando una condición lógica se cumple.', example: 'if valid (P -> P) {\n  print "ok"\n}', category: 'keyword' },
  si:          { title: 'si (→ if)', description: 'Alias en español de if.', example: 'si valido P -> P {\n  imprimir "ok"\n}', category: 'alias' },
  else:        { title: 'else', description: 'Bloque alternativo cuando ninguna condición previa se cumple.', example: 'else {\n  print "fallback"\n}', category: 'keyword' },
  sino:        { title: 'sino (→ else)', description: 'Alias en español de else.', example: 'sino {\n  imprimir "fallback"\n}', category: 'alias' },
  for:         { title: 'for', description: 'Recorre una colección de fórmulas o valores dentro de un bloque.', example: 'for item in {1, 2, 3} {\n  print item\n}', category: 'keyword' },
  para:        { title: 'para (→ for)', description: 'Alias en español de for.', example: 'para item en {1, 2, 3} {\n  imprimir item\n}', category: 'alias' },
  in:          { title: 'in', description: 'Introduce la colección usada por un bucle for.', example: 'for item in {A, B, C} { ... }', category: 'keyword' },
  en:          { title: 'en (→ in)', description: 'Alias en español de in.', example: 'para item en {A, B, C} { ... }', category: 'alias' },
  while:       { title: 'while', description: 'Repite un bloque mientras la condición siga cumpliéndose.', example: 'while satisfiable P {\n  print P\n}', category: 'keyword' },
  mientras:    { title: 'mientras (→ while)', description: 'Alias en español de while.', example: 'mientras satisfacible P {\n  imprimir P\n}', category: 'alias' },
  fn:          { title: 'fn', description: 'Declara una función reutilizable con parámetros y retorno.', example: 'fn doble(x) {\n  return x + x\n}', category: 'keyword' },
  funcion:     { title: 'funcion (→ fn)', description: 'Alias en español de fn.', example: 'funcion doble(x) {\n  retornar x + x\n}', category: 'alias' },
  return:      { title: 'return', description: 'Devuelve un resultado desde una función.', example: 'return total', category: 'keyword' },
  retornar:    { title: 'retornar (→ return)', description: 'Alias en español de return.', example: 'retornar total', category: 'alias' },
  nand:        { title: 'nand', description: 'Operador NAND textual. Equivale a negar una conjunción.', example: 'P nand Q', category: 'keyword' },
  nor:         { title: 'nor', description: 'Operador NOR textual. Equivale a negar una disyunción.', example: 'P nor Q', category: 'keyword' },
  xor:         { title: 'xor', description: 'Operador XOR textual. Es verdadero cuando exactamente uno de los operandos lo es.', example: 'P xor Q', category: 'keyword' },
  render:      { title: 'render', description: 'Renderiza claims, theory, all o un nombre concreto del estado actual.', example: 'render theory', category: 'keyword' },
  mostrar:     { title: 'mostrar (→ render)', description: 'Alias en español de render.', category: 'alias' },
  explain:     { title: 'explain', description: 'Explica una fórmula o expresión según el perfil activo.', example: 'explain (p -> q)', category: 'keyword' },
  explicar:    { title: 'explicar (→ explain)', description: 'Alias en español de explain.', category: 'alias' },
  countermodel: { title: 'countermodel', description: 'Busca un contramodelo que falsifique la fórmula.', example: 'countermodel p -> q', category: 'keyword' },
  contramodelo: { title: 'contramodelo (→ countermodel)', description: 'Alias en español de countermodel.', category: 'alias' },
  truth_table: { title: 'truth_table', description: 'Genera la tabla de verdad de una fórmula.', example: 'truth_table p -> q', category: 'keyword' },
  tabla_verdad: { title: 'tabla_verdad (→ truth_table)', description: 'Alias en español de truth_table.', category: 'alias' },
  passage:     { title: 'passage', description: 'Referencia un pasaje de documento dentro de una declaración let.', example: 'let p1 = passage([[contrato.md#clausula-1]])', category: 'keyword' },
  formalize:   { title: 'formalize', description: 'Formaliza un pasaje como fórmula lógica dentro de una declaración let.', example: 'let f1 = formalize p1 as (p -> q)', category: 'keyword' },
  claim:       { title: 'claim', description: 'Declara una afirmación con soporte y confianza.', example: 'claim c1 = p & q', category: 'keyword' },
  analyze:     { title: 'analyze', description: 'Analiza una inferencia completa y reporta validez o falacias conocidas.', example: 'analyze {p, p -> q} -> q', category: 'keyword' },
  logic:       { title: 'logic', description: 'Activa el perfil lógico del script ST.', example: 'logic classical.propositional', category: 'keyword' }
};

// ── Operators ───────────────────────────────────────────────

const operatorInfo: Record<string, HoverData> = {
  '->':  { title: '→  Implicación', description: 'Si A entonces B. Falso solo cuando A es verdadero y B es falso.', example: 'p -> q   equivale a  ¬p ∨ q', category: 'operator' },
  '<->': { title: '↔  Bicondicional', description: 'A si y solo si B. Verdadero cuando ambos tienen el mismo valor.', example: 'p <-> q  equivale a  (p→q) ∧ (q→p)', category: 'operator' },
  '&':   { title: '∧  Conjunción', description: 'A y B. Verdadero solo cuando ambos son verdaderos.', example: 'p & q', category: 'operator' },
  '|':   { title: '∨  Disyunción', description: 'A o B. Falso solo cuando ambos son falsos.', example: 'p | q', category: 'operator' },
  '^':   { title: '⊕  XOR', description: 'Disyunción exclusiva. Verdadero cuando exactamente uno de los operandos es verdadero.', example: 'p ^ q', category: 'operator' },
  '⊕':   { title: '⊕  XOR', description: 'Versión Unicode del operador XOR.', example: 'p ⊕ q', category: 'operator' },
  '!&':  { title: '↑  NAND', description: 'Negación de la conjunción. Falso solo cuando ambos operandos son verdaderos.', example: 'p !& q', category: 'operator' },
  '↑':   { title: '↑  NAND', description: 'Versión Unicode del operador NAND.', example: 'p ↑ q', category: 'operator' },
  '!|':  { title: '↓  NOR', description: 'Negación de la disyunción. Verdadero solo cuando ambos operandos son falsos.', example: 'p !| q', category: 'operator' },
  '↓':   { title: '↓  NOR', description: 'Versión Unicode del operador NOR.', example: 'p ↓ q', category: 'operator' },
  '~':   { title: '¬  Negación', description: 'No A. Invierte el valor de verdad.', example: '~p  equivale a  ¬p', category: 'operator' },
  '!':   { title: '¬  Negación (alternativa)', description: 'No A. Equivalente a ~.', example: '!p  equivale a  ~p', category: 'operator' },
  '[]':  { title: '□  Necesidad (modal)', description: 'Es necesario que A. En todos los mundos accesibles, A es verdadero.', example: '[]p  en Kripke: ∀w′(wRw′ → p∈w′)', category: 'operator' },
  '<>':  { title: '◇  Posibilidad (modal)', description: 'Es posible que A. En algún mundo accesible, A es verdadero.', example: '<>p  en Kripke: ∃w′(wRw′ ∧ p∈w′)', category: 'operator' },
  '<-':  { title: '←  Implicación inversa', description: 'B entonces A (A si B).', category: 'operator' },
  '=':   { title: '=  Igualdad / asignación contextual', description: 'Expresa igualdad entre términos o asigna valores según la construcción usada.', example: 'x = y', category: 'operator' },
  '+':   { title: '+  Suma', description: 'Suma dos expresiones numéricas dentro del perfil arithmetic.', example: '1 + 2', category: 'operator' },
  '-':   { title: '-  Resta', description: 'Resta dos expresiones numéricas o niega un número con signo.', example: 'total - 1', category: 'operator' },
  '*':   { title: '×  Multiplicación', description: 'Multiplica expresiones numéricas.', example: '2 * 3', category: 'operator' },
  '/':   { title: '÷  División', description: 'Divide una expresión numérica por otra.', example: '10 / 2', category: 'operator' },
  '%':   { title: '%  Módulo', description: 'Devuelve el residuo de una división entera.', example: '7 % 2', category: 'operator' },
  '<':   { title: '<  Menor que', description: 'Comparación aritmética estricta.', example: 'x < 10', category: 'operator' },
  '>':   { title: '>  Mayor que', description: 'Comparación aritmética estricta.', example: 'x > 10', category: 'operator' },
  '<=':  { title: '≤  Menor o igual que', description: 'Comparación aritmética no estricta.', example: 'x <= 10', category: 'operator' },
  '>=':  { title: '≥  Mayor o igual que', description: 'Comparación aritmética no estricta.', example: 'x >= 10', category: 'operator' },
  '≤':   { title: '≤  Menor o igual que', description: 'Versión Unicode de <=.', example: 'x ≤ 10', category: 'operator' },
  '≥':   { title: '≥  Mayor o igual que', description: 'Versión Unicode de >=.', example: 'x ≥ 10', category: 'operator' }
};

// ── Builtins ────────────────────────────────────────────────

const builtinInfo: Record<string, HoverData> = {
  valid:        { title: 'valid', description: 'Verifica si la fórmula es una tautología (verdadera en toda interpretación).', example: 'check valid p -> p', category: 'builtin' },
  valido:       { title: 'válido (→ valid)', description: 'Alias español de valid.', category: 'alias' },
  invalid:      { title: 'invalid', description: 'Condición derivada útil en if/while: se cumple cuando una fórmula no es válida.', example: 'if invalid (p -> q) {\n  countermodel p -> q\n}', category: 'builtin' },
  invalido:     { title: 'inválido (→ invalid)', description: 'Alias español de invalid.', category: 'alias' },
  satisfiable:  { title: 'satisfiable', description: 'Verifica si existe al menos una interpretación que haga verdadera la fórmula.', example: 'check satisfiable p & q', category: 'builtin' },
  satisfacible: { title: 'satisfacible (→ satisfiable)', description: 'Alias español de satisfiable.', category: 'alias' },
  unsatisfiable: { title: 'unsatisfiable', description: 'Condición derivada útil en if/while: se cumple cuando no existe ningún modelo para la fórmula.', example: 'while unsatisfiable (p & !p) {\n  print "sin modelo"\n}', category: 'builtin' },
  insatisfacible: { title: 'insatisfacible (→ unsatisfiable)', description: 'Alias español de unsatisfiable.', category: 'alias' },
  equivalent:   { title: 'equivalent', description: 'Verifica si dos fórmulas son lógicamente equivalentes.', example: 'check equivalent p -> q, ~p | q', category: 'builtin' },
  equivalente:  { title: 'equivalente (→ equivalent)', description: 'Alias español de equivalent.', category: 'alias' },
  claims:       { title: 'claims', description: 'Target especial para renderizar todas las afirmaciones registradas.', example: 'render claims', category: 'builtin' },
  typeof:       { title: 'typeof(arg)', description: 'Función nativa que devuelve el tipo inferido del argumento.', example: 'print typeof(2 + 3)', category: 'builtin' },
  is_valid:     { title: 'is_valid(arg)', description: 'Función nativa que devuelve "True" o "False" según la validez del argumento.', example: 'print is_valid(P -> P)', category: 'builtin' },
  is_satisfiable: { title: 'is_satisfiable(arg)', description: 'Función nativa que devuelve "True" o "False" según la satisfacibilidad del argumento.', example: 'print is_satisfiable(P & Q)', category: 'builtin' },
  get_atoms:    { title: 'get_atoms(arg)', description: 'Función nativa que devuelve el conjunto de átomos usados por una fórmula.', example: 'print get_atoms((P -> Q) & R)', category: 'builtin' },
  input:        { title: 'input(arg)', description: 'Función nativa para pedir entrada interactiva cuando el runtime está en CLI/REPL.', example: 'let nombre = input("Tu nombre:")', category: 'builtin' }
};

// ── Profiles ────────────────────────────────────────────────

const profileInfo: Record<string, HoverData> = {
  'classical.propositional':  { title: 'Lógica proposicional clásica', description: 'Operadores: ¬ ∧ ∨ → ↔\nTableaux con ramas abiertas/cerradas.\nSemántica bivalente (V/F).', category: 'profile' },
  'classical.first_order':    { title: 'Lógica de primer orden', description: 'Extensión con cuantificadores ∀ ∃, predicados, funciones e igualdad.', category: 'profile' },
  'modal.k':                  { title: 'Lógica modal K', description: 'Sistema modal mínimo. □ (necesidad) y ◇ (posibilidad).\nModelos Kripke sin restricciones en R.', category: 'profile' },
  'paraconsistent.belnap':    { title: 'Lógica paraconsistente (Belnap)', description: '4 valores: T, F, Both (⊤), Neither (⊥).\nTolera contradicciones sin trivializar.', category: 'profile' },
  'deontic.standard':         { title: 'Lógica deóntica estándar', description: 'Obligación (O), Permisión (P), Prohibición (F).\nAxioma D: Ob(p) → Perm(p).', category: 'profile' },
  'epistemic.s5':             { title: 'Lógica epistémica S5', description: 'Conocimiento (K) y creencia.\nIntrospección positiva y negativa.', category: 'profile' },
  'intuitionistic.propositional': { title: 'Lógica intuicionista', description: 'Rechaza el tercero excluido (p ∨ ¬p).\nRequiere evidencia constructiva.', category: 'profile' },
  'temporal.ltl':             { title: 'Lógica temporal (LTL)', description: 'Operadores: X (next/○), U (until), F (eventually), G (always).\nRazzonamiento sobre secuencias de estados.', category: 'profile' },
  'probabilistic.basic':      { title: 'Lógica probabilística básica', description: 'Asigna probabilidades a fórmulas.\nP(A) ∈ [0,1], axiomas de Kolmogorov.', category: 'profile' },
  'aristotelian.syllogistic': { title: 'Silogística aristotélica', description: 'Proposiciones categóricas: A (todo), E (ninguno), I (alguno), O (alguno no).\nSilogismos con figuras y modos.', category: 'profile' },
  arithmetic:                 { title: 'Lógica arithmetic', description: 'Perfil numérico para evaluar expresiones aritméticas, comparaciones y combinarlas con scripting ST.', category: 'profile' }
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
