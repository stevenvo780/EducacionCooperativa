'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, BookOpen, ChevronRight, Download, ExternalLink,
  FlaskConical, GraduationCap, Info, Layers3, Scale, ShieldAlert, Sigma, Terminal
} from 'lucide-react';

/* ──────────── Types ──────────── */
interface NavItem { id: string; label: string }
interface SyntaxBlock { title: string; code: string; note?: string }
interface CommandBlock { cmd: string; desc: string; example: string }
interface ProfileManual {
  id: string;
  name: string;
  slug: string;
  badge: string;
  semantics: string;
  engine: string;
  operators: string[];
  axioms?: string[];
  validExample: string;
  invalidExample: string;
  limits: string[];
}
interface LogicCourse {
  id: string;
  navLabel: string;
  title: string;
  level: string;
  focus: string;
  summary: string;
  questions: string[];
  concepts: string[];
  syntax: string[];
  commands: string[];
  mistakes: string[];
  lessonExample: string;
}

/* ──────────── Data: navigation ──────────── */
const NAV: NavItem[] = [
  { id: 'intro', label: 'Introducción' },
  { id: 'academy', label: 'Escuela de Lógicas' },
  { id: 'propositional', label: 'Lógica Proposicional' },
  { id: 'course-fol', label: 'Curso FOL' },
  { id: 'course-modal', label: 'Curso Modal' },
  { id: 'course-deontic', label: 'Curso Deóntico' },
  { id: 'course-epistemic', label: 'Curso Epistémico' },
  { id: 'course-intuitionistic', label: 'Curso Intuicionista' },
  { id: 'course-temporal', label: 'Curso Temporal' },
  { id: 'course-aristotelian', label: 'Curso Aristotélico' },
  { id: 'course-belnap', label: 'Curso Belnap' },
  { id: 'course-probabilistic', label: 'Curso Probabilístico' },
  { id: 'syntax', label: 'Sintaxis' },
  { id: 'commands', label: 'Comandos' },
  { id: 'profiles', label: 'Perfiles Lógicos' },
  { id: 'text-layer', label: 'Text Layer' },
  { id: 'limits', label: 'Limitaciones' },
  { id: 'validation', label: 'Validación' }
];

/* ──────────── Data: syntax blocks ──────────── */
const SYNTAX: SyntaxBlock[] = [
  {
    title: 'Declarar perfil lógico',
    code: 'logic classical.propositional',
    note: 'Obligatorio como primera línea de cada script.'
  },
  {
    title: 'Definir axiomas',
    code: 'axiom modus : P -> Q\naxiom base = P',
    note: 'Se aceptan tanto : como = para la asignación.'
  },
  {
    title: 'Definir teoremas',
    code: 'theorem resultado : Q',
    note: 'Los teoremas representan consecuencias que se desean conservar.'
  },
  {
    title: 'Operadores proposicionales',
    code: '!P          // negación\nP & Q       // conjunción\nP | Q       // disyunción\nP -> Q      // implicación material\nP <-> Q     // bicondicional'
  },
  {
    title: 'Cuantificadores (FOL)',
    code: 'forall x (P(x) -> Q(x))\nexists x (P(x) & R(x))',
    note: 'Solo disponibles en classical.first_order y aristotelian.syllogistic.'
  },
  {
    title: 'Operadores modales / temporales',
    code: '[](P)       // necesidad □ / siempre G / obligación O / conocimiento K\n<>(P)       // posibilidad ◇ / eventualmente F / permisión P̂ / creencia B̂\nX(P)        // next (solo temporal.ltl)',
    note: 'El significado depende del perfil activo.'
  }
];

/* ──────────── Data: commands ──────────── */
const COMMANDS: CommandBlock[] = [
  {
    cmd: 'check valid <φ>',
    desc: 'Verifica si la fórmula es una tautología / válida en la lógica activa.',
    example: 'check valid P | !P'
  },
  {
    cmd: 'check satisfiable <φ>',
    desc: 'Comprueba si existe al menos un modelo donde φ es verdadera.',
    example: 'check satisfiable P & Q'
  },
  {
    cmd: 'check equivalent <φ>, <ψ>',
    desc: 'Determina si dos fórmulas son lógicamente equivalentes.',
    example: 'check equivalent !(P & Q), (!P | !Q)'
  },
  {
    cmd: 'derive <meta> from {<premisas>}',
    desc: 'Intenta demostrar la meta a partir de las premisas listadas.',
    example: 'derive Q from {P -> Q, P}'
  },
  {
    cmd: 'prove <meta> from {<axiomas>}',
    desc: 'Similar a derive, pero verifica contra la teoría registrada.',
    example: 'prove Q from {modus, base}'
  },
  {
    cmd: 'countermodel <φ>',
    desc: 'Si φ no es válida, muestra un modelo que la falsifica.',
    example: 'countermodel P -> Q'
  },
  {
    cmd: 'truth_table <φ>',
    desc: 'Genera la tabla de verdad en formato Markdown (máx. 20 variables).',
    example: 'truth_table P -> (Q -> P)'
  },
  {
    cmd: 'st --list-profiles',
    desc: 'Lista todos los perfiles lógicos disponibles desde la CLI.',
    example: 'st --list-profiles'
  }
];

/* ──────────── Data: detailed logic courses ──────────── */
const COURSES: LogicCourse[] = [
  {
    id: 'propositional',
    navLabel: 'Proposicional',
    title: 'Curso 1 · Lógica Proposicional Clásica',
    level: 'Fundacional',
    focus: 'Aprender a leer, construir y verificar fórmulas con conectivos clásicos.',
    summary: 'Es la puerta de entrada a todo ST. Aquí estudias proposiciones atómicas, tablas de verdad, tautologías, contradicciones, contingencias y reglas básicas de derivación.',
    questions: ['¿Qué significa una fórmula?', '¿Cuándo una fórmula es válida?', '¿Cómo se prueba algo desde premisas?', '¿Cómo se detecta un contramodelo?'],
    concepts: ['Átomos proposicionales: P, Q, R...', 'Bivalencia: verdadero o falso', 'Conectivos: !, &, |, ->, <->', 'Validez, satisfacibilidad y equivalencia', 'Derivación por Modus Ponens, Modus Tollens y reglas estructurales'],
    syntax: ['logic classical.propositional', 'axiom regla : P -> Q', 'derive Q from {regla, base}', 'check valid P | !P', 'countermodel P -> Q'],
    commands: ['truth_table', 'check valid', 'check satisfiable', 'check equivalent', 'derive', 'countermodel'],
    mistakes: ['Confundir implicación material con causalidad', 'Olvidar que P -> Q solo falla cuando P=V y Q=F', 'Usar derive sin declarar premisas', 'Pensar que satisfacible significa válida'],
    lessonExample: 'logic classical.propositional\n\naxiom regla1 : Estudia -> Aprueba\naxiom regla2 : Aprueba -> Celebra\naxiom hecho = Estudia\n\nderive Aprueba from {regla1, hecho}\nderive Celebra from {regla1, regla2, hecho}\n\ncheck valid (Estudia & (Estudia -> Aprueba)) -> Aprueba\ncheck equivalent Estudia -> Aprueba, !Estudia | Aprueba\ntruth_table Estudia -> Aprueba\ncountermodel Estudia -> Celebra'
  },
  {
    id: 'course-fol',
    navLabel: 'Primer Orden',
    title: 'Curso 2 · Lógica de Primer Orden',
    level: 'Intermedio',
    focus: 'Pasar de proposiciones globales a estructuras con individuos, propiedades y cuantificadores.',
    summary: 'FOL permite decir “todos”, “alguno”, “este individuo” y expresar relaciones entre objetos. Es la base para modelar conocimiento más rico que P o Q.',
    questions: ['¿Qué cambia al introducir individuos?', '¿Cómo se lee forall y exists?', '¿Qué papel cumplen constantes como a o c?', '¿Cuándo una fórmula FOL deja de ser decidible rápidamente?'],
    concepts: ['Dominio de individuos', 'Predicados: P(x), R(x,y)', 'Cuantificador universal: forall x', 'Cuantificador existencial: exists x', 'Instanciación y generalización informal'],
    syntax: ['logic classical.first_order', 'axiom regla : forall x (Humano(x) -> Mortal(x))', 'axiom caso = Humano(socrates)', 'derive Mortal(socrates) from {regla, caso}', 'check valid forall x (P(x) -> P(x))'],
    commands: ['check valid', 'check satisfiable', 'derive', 'countermodel'],
    mistakes: ['Confundir P con P(x)', 'Olvidar paréntesis al cuantificar', 'Creer que exists x P(x) implica forall x P(x)', 'Suponer que el motor siempre decide cualquier fórmula compleja'],
    lessonExample: 'logic classical.first_order\n\naxiom regla : forall x (Estudiante(x) -> Lee(x))\naxiom caso = Estudiante(ana)\n\nderive Lee(ana) from {regla, caso}\ncheck valid forall x (Estudiante(x) -> Estudiante(x))\ncheck satisfiable exists x (Estudiante(x) & Lee(x))\ncountermodel exists x Estudiante(x) -> forall x Estudiante(x)'
  },
  {
    id: 'course-modal',
    navLabel: 'Modal K',
    title: 'Curso 3 · Lógica Modal K',
    level: 'Intermedio',
    focus: 'Entender necesidad y posibilidad usando mundos posibles.',
    summary: 'La lógica modal agrega una idea crucial: una fórmula puede no depender solo del mundo actual, sino también de qué ocurre en mundos accesibles.',
    questions: ['¿Qué significa []P?', '¿Qué significa <>P?', '¿Por qué []P -> P no es válida en K?', '¿Qué es un mundo accesible?'],
    concepts: ['Mundos posibles', 'Relación de accesibilidad', 'Necesidad □', 'Posibilidad ◇', 'Sistema K como base mínima'],
    syntax: ['logic modal.k', 'check valid [](P -> Q) -> ([]P -> []Q)', 'check valid []P -> P', 'countermodel <>P -> []P'],
    commands: ['check valid', 'check satisfiable', 'check equivalent', 'countermodel'],
    mistakes: ['Leer []P como verdad absoluta en lugar de necesidad relativa al frame', 'Suponer reflexividad en K', 'Confundir <>P con P actual'],
    lessonExample: 'logic modal.k\n\ncheck valid [](P -> Q) -> ([]P -> []Q)\ncheck equivalent <>(P), ![](!P)\ncheck valid []P -> P\ncheck satisfiable <>(P) & <>(Q)\ncountermodel <>P -> []P'
  },
  {
    id: 'course-deontic',
    navLabel: 'Deóntica',
    title: 'Curso 4 · Lógica Deóntica',
    level: 'Intermedio',
    focus: 'Modelar obligación, permiso y prohibición.',
    summary: 'La lógica deóntica traduce reglas normativas: lo que debe hacerse, lo que está permitido y lo que está prohibido.',
    questions: ['¿Qué expresa O(P)?', '¿Por qué O(P) no implica P actual?', '¿Cómo aparece la prohibición?', '¿Qué garantiza la serialidad?'],
    concepts: ['Obligación', 'Permisión', 'Prohibición', 'Sistema KD', 'Axioma D: lo obligatorio es permitido'],
    syntax: ['logic deontic.standard', 'check valid [](P) -> <>(P)', 'check valid [](P) -> P', 'derive <>(Q) from {[](P -> Q), <>(P)}'],
    commands: ['check valid', 'check satisfiable', 'derive', 'countermodel'],
    mistakes: ['Confundir deber con hecho', 'Pensar que prohibición es solo !P', 'No distinguir entre norma y cumplimiento'],
    lessonExample: 'logic deontic.standard\n\ncheck valid [](Entrega) -> <>(Entrega)\ncheck valid [](Entrega) -> Entrega\naxiom norma1 : [](Entrega -> Aprueba)\naxiom permiso = <>(Entrega)\nderive <>(Aprueba) from {norma1, permiso}\ncheck satisfiable [](Entrega) & !Entrega'
  },
  {
    id: 'course-epistemic',
    navLabel: 'Epistémica',
    title: 'Curso 5 · Lógica Epistémica S5',
    level: 'Intermedio',
    focus: 'Distinguir verdad, conocimiento y accesibilidad epistémica.',
    summary: 'Aquí las fórmulas hablan de lo que un agente sabe o considera posible. S5 modela conocimiento idealizado con accesibilidad universal.',
    questions: ['¿Qué significa K(P)?', '¿Por qué K(P) -> P es válida en S5?', '¿Qué es introspección positiva y negativa?'],
    concepts: ['Conocimiento', 'Creencia/posibilidad epistémica', 'Veridicidad', 'Introspección positiva', 'Introspección negativa'],
    syntax: ['logic epistemic.s5', 'check valid [](P) -> P', 'check valid [](P) -> []([](P))', 'check valid !([](P)) -> [](!([](P)))'],
    commands: ['check valid', 'check satisfiable', 'derive'],
    mistakes: ['Tomar S5 como modelo realista de agentes humanos', 'Confundir saber P con creer P', 'Suponer que toda ignorancia es inconsistencia'],
    lessonExample: 'logic epistemic.s5\n\ncheck valid [](P) -> P\ncheck valid [](P) -> []([](P))\ncheck valid !([](P)) -> [](!([](P)))\naxiom regla : [](P -> Q)\naxiom hecho = [](P)\nderive [](Q) from {regla, hecho}'
  },
  {
    id: 'course-intuitionistic',
    navLabel: 'Intuicionista',
    title: 'Curso 6 · Lógica Intuicionista',
    level: 'Intermedio–Avanzado',
    focus: 'Estudiar una noción constructiva de verdad.',
    summary: 'En lógica intuicionista, “verdadero” significa “constructivamente demostrable”. Por eso no todo principio clásico se conserva.',
    questions: ['¿Por qué P | !P no siempre vale?', '¿Por qué !!P -> P falla?', 'Qué significa una prueba constructiva?'],
    concepts: ['Verdad como prueba', 'Modelos de Kripke persistentes', 'Fallo del tercero excluido', 'Fallo de la eliminación de doble negación', 'Conservación de implicaciones constructivas'],
    syntax: ['logic intuitionistic.propositional', 'check valid P -> !!P', 'check valid P | !P', 'countermodel !!P -> P'],
    commands: ['check valid', 'check satisfiable', 'check equivalent', 'countermodel'],
    mistakes: ['Aplicar leyes clásicas sin revisar', 'Suponer que no válido = falso', 'Confundir no demostrable con refutado'],
    lessonExample: 'logic intuitionistic.propositional\n\ncheck valid P -> !!P\ncheck valid P | !P\ncheck valid !!P -> P\ncheck satisfiable P | !P\ncountermodel P | !P\ncountermodel !!P -> P'
  },
  {
    id: 'course-temporal',
    navLabel: 'Temporal',
    title: 'Curso 7 · Lógica Temporal LTL',
    level: 'Avanzado',
    focus: 'Razonar sobre estados presentes y futuros.',
    summary: 'La lógica temporal permite expresar propiedades que deben mantenerse siempre, ocurrir eventualmente o suceder en el siguiente paso.',
    questions: ['¿Qué significa G(P)?', '¿Qué significa F(P)?', '¿Qué expresa X(P)?', '¿Por qué F(P) -> G(P) falla?'],
    concepts: ['Siempre (G)', 'Eventualmente (F)', 'Siguiente (X)', 'Frames temporales reflexivo-transitivos', 'Propagación de obligaciones en el tiempo'],
    syntax: ['logic temporal.ltl', 'check valid [](P) -> P', 'check valid [](P) -> <>(P)', 'check valid <>(P) -> [](P)'],
    commands: ['check valid', 'check satisfiable', 'check equivalent', 'derive'],
    mistakes: ['Confundir “alguna vez” con “siempre”', 'Leer X(P) como P actual', 'Suponer que U está tan maduro como G/F/X en el motor'],
    lessonExample: 'logic temporal.ltl\n\ncheck valid [](P) -> P\ncheck valid [](P) -> <>(P)\ncheck valid <>(P) -> [](P)\ncheck equivalent <>(P), ![](!P)\naxiom regla : []((P -> Q))\naxiom hecho = [](P)\nderive [](Q) from {regla, hecho}'
  },
  {
    id: 'course-aristotelian',
    navLabel: 'Aristotélica',
    title: 'Curso 8 · Silogística Aristotélica',
    level: 'Histórica–Formal',
    focus: 'Entender los modos silogísticos categóricos clásicos.',
    summary: 'Este curso traduce la lógica de términos de Aristóteles a ST: universal afirmativa, universal negativa, particular afirmativa y particular negativa.',
    questions: ['¿Qué son A, E, I y O?', '¿Qué es una figura silogística?', '¿Cómo se formaliza Barbara?'],
    concepts: ['Proposiciones A/E/I/O', 'Término mayor, menor y medio', 'Figuras silogísticas', 'Modos válidos como Barbara o Celarent', 'Falacias de distribución'],
    syntax: ['logic aristotelian.syllogistic', 'axiom mayor : forall x (M(x) -> P(x))', 'axiom menor : forall x (S(x) -> M(x))', 'derive forall x (S(x) -> P(x)) from {mayor, menor}'],
    commands: ['check valid', 'check satisfiable', 'derive'],
    mistakes: ['Usar más de dos premisas en derive', 'Confundir un silogismo válido con una mera semejanza verbal', 'Olvidar el papel del término medio'],
    lessonExample: 'logic aristotelian.syllogistic\n\naxiom mayor : forall x (M(x) -> P(x))\naxiom menor : forall x (S(x) -> M(x))\nderive forall x (S(x) -> P(x)) from {mayor, menor}\n\naxiom p1 : forall x (P(x) -> M(x))\naxiom p2 : forall x (S(x) -> M(x))\nderive forall x (S(x) -> P(x)) from {p1, p2}'
  },
  {
    id: 'course-belnap',
    navLabel: 'Belnap',
    title: 'Curso 9 · Lógica Paraconsistente Belnap',
    level: 'Avanzado',
    focus: 'Razonar con inconsistencia sin explosión trivial.',
    summary: 'Belnap introduce cuatro valores: verdadero, falso, ambos y ninguno. Permite describir bases de datos incompletas o contradictorias sin colapso lógico.',
    questions: ['¿Qué son T, F, B y N?', '¿Por qué P & !P puede ser satisfacible?', '¿Por qué P | !P ya no es válida?', '¿Por qué falla ex falso?'],
    concepts: ['Lógica de 4 valores', 'Valores designados: T y B', 'Contradicciones toleradas', 'Fallo de explosión', 'Fallo de tercero excluido y reflexividad material'],
    syntax: ['logic paraconsistent.belnap', 'check satisfiable P & !P', 'check valid P -> P', 'check valid P | !P'],
    commands: ['check valid', 'check satisfiable', 'check equivalent', 'countermodel'],
    mistakes: ['Esperar leyes clásicas automáticas', 'Suponer que contradicción implica cualquier conclusión', 'Olvidar que N no es designado'],
    lessonExample: 'logic paraconsistent.belnap\n\ncheck satisfiable P & !P\ncheck valid (P & !P) -> Q\ncheck valid P | !P\ncheck valid P -> P\ncheck equivalent P -> Q, !P | Q\ncountermodel P -> P'
  },
  {
    id: 'course-probabilistic',
    navLabel: 'Probabilística',
    title: 'Curso 10 · Lógica Probabilística',
    level: 'Avanzado',
    focus: 'Medir la fuerza probabilística de fórmulas clásicas.',
    summary: 'En lugar de evaluar solo verdad o falsedad, este perfil calcula probabilidades de fórmulas sobre distribuciones discretas de probabilidad.',
    questions: ['¿Qué significa que una fórmula sea válida probabilísticamente?', '¿Cómo se calcula P(φ)?', 'Qué papel juega la independencia entre átomos?'],
    concepts: ['Mundos booleanos subyacentes', 'Asignaciones de probabilidad', 'Validez como probabilidad 1 en todo muestreo', 'Independencia de átomos', 'Muestreo discreto del motor'],
    syntax: ['logic probabilistic.basic', 'check valid P | !P', 'check valid P -> Q', 'truth_table P -> Q'],
    commands: ['check valid', 'check satisfiable', 'check equivalent', 'truth_table', 'countermodel'],
    mistakes: ['Pensar que ya no hay estructura clásica dentro del mundo', 'Olvidar que el muestreo es discreto', 'Confundir probabilidad positiva con validez'],
    lessonExample: 'logic probabilistic.basic\n\ncheck valid P | !P\ncheck valid P -> Q\ncheck satisfiable P & Q\ntruth_table P -> Q\ncheck equivalent (P -> Q) <-> (!P | Q), P | !P\ncountermodel P'
  }
];

/* ──────────── Data: 10 profile manuals ──────────── */
const PROFILES: ProfileManual[] = [
  {
    id: 'classical-prop',
    name: 'classical.propositional',
    slug: 'Clásica Proposicional',
    badge: 'CPC',
    semantics: 'Lógica clásica bivalente. Cada proposición es V o F. Una fórmula es válida si es verdadera bajo toda valuación.',
    engine: 'Tabla de verdad exhaustiva (2ⁿ valuaciones) + derivación BFS con fallback semántico.',
    operators: ['! (negación)', '& (conjunción)', '| (disyunción)', '-> (implicación)', '<-> (bicondicional)'],
    validExample: 'logic classical.propositional\ncheck valid P | !P\ncheck valid (P -> Q) <-> (!Q -> !P)\nderive Q from {P -> Q, P}',
    invalidExample: 'logic classical.propositional\ncheck valid P -> Q\ncountermodel P -> Q',
    limits: ['Máximo 20 variables para truth_table.', 'Derivación BFS limitada a 200 iteraciones.']
  },
  {
    id: 'classical-fol',
    name: 'classical.first_order',
    slug: 'Primer Orden (FOL)',
    badge: 'FOL',
    semantics: 'Lógica de primer orden con cuantificadores universales y existenciales sobre un dominio de individuos.',
    engine: 'Tableau analítico sistemático v2 con constantes Skolem y unificación.',
    operators: ['forall x (∀)', 'exists x (∃)', 'P(x,y) predicados', '! & | -> <->'],
    validExample: 'logic classical.first_order\naxiom a1 : forall x (P(x) -> Q(x))\naxiom a2 : P(c)\nderive Q(c) from {a1, a2}\ncheck valid forall x (P(x) -> P(x))',
    invalidExample: 'logic classical.first_order\ncheck valid forall x P(x)\ncountermodel exists x P(x) -> forall x P(x)',
    limits: ['Profundidad máxima del tableau: 50 pasos.', 'Semi-decidible: puede retornar unknown en lugar de invalid.']
  },
  {
    id: 'modal-k',
    name: 'modal.k',
    slug: 'Modal K',
    badge: 'K',
    semantics: 'Lógica modal normal mínima. Modelos Kripke sin restricciones sobre la relación de accesibilidad.',
    engine: 'Labeled Tableau con frame K (sin condiciones de marco).',
    operators: ['[] necesidad (□)', '<> posibilidad (◇)', '! & | -> <->'],
    axioms: ['K: [](P -> Q) -> ([]P -> []Q)', 'N: si ⊢ φ entonces ⊢ []φ (necessitación)'],
    validExample: 'logic modal.k\ncheck valid [](P -> Q) -> ([]P -> []Q)\ncheck valid [](P & Q) <-> ([]P & []Q)',
    invalidExample: 'logic modal.k\ncheck valid []P -> P\ncountermodel <>P -> []P',
    limits: ['Máximo 200 nodos en el tableau.', 'Sin reflexividad, transitividad ni simetría.']
  },
  {
    id: 'deontic',
    name: 'deontic.standard',
    slug: 'Deóntica Estándar',
    badge: 'KD',
    semantics: 'Lógica deóntica basada en K + serialidad. O(φ) = obligación, P(φ) = permisión, F(φ) = prohibición.',
    engine: 'Labeled Tableau con frame KD (serial: todo mundo tiene al menos un sucesor deóntico).',
    operators: ['[](φ) obligación O', '<>(φ) permisión P', '[](!) prohibición F', '! & | -> <->'],
    axioms: ['D: O(φ) -> P(φ) (lo obligatorio es permitido)'],
    validExample: 'logic deontic.standard\ncheck valid [](P) -> <>(P)\nderive <>(Q) from {[](P -> Q), <>(P)}',
    invalidExample: 'logic deontic.standard\ncheck valid [](P) -> P\ncountermodel <>(P) -> [](P)',
    limits: ['Máximo 200 nodos en el tableau.', 'No modela conflictos deónticos genuinos.']
  },
  {
    id: 'epistemic',
    name: 'epistemic.s5',
    slug: 'Epistémica S5',
    badge: 'S5',
    semantics: 'Lógica epistémica con relación de accesibilidad universal (reflexiva, simétrica, transitiva). K(φ) = conocimiento, B(φ) = creencia.',
    engine: 'Labeled Tableau con frame S5 (relación universal entre mundos).',
    operators: ['[](φ) conocimiento K', '<>(φ) creencia B', '! & | -> <->'],
    axioms: ['T: Kφ -> φ (veridicidad)', '4: Kφ -> KKφ (introspección +)', 'B: φ -> K¬K¬φ (introspección −)'],
    validExample: 'logic epistemic.s5\ncheck valid [](P) -> P\ncheck valid [](P) -> []([](P))\nderive P from {[](P)}',
    invalidExample: 'logic epistemic.s5\ncheck valid <>(P) -> [](P)\ncountermodel <>(P) -> [](P)',
    limits: ['Máximo 200 nodos en el tableau.', 'Frame universal hace crecer rápido el espacio de búsqueda.']
  },
  {
    id: 'intuitionistic',
    name: 'intuitionistic.propositional',
    slug: 'Intuicionista',
    badge: 'IPC',
    semantics: 'Lógica intuicionista (Heyting). Sin ley del tercero excluido ni doble negación eliminada. Modelos Kripke con valuaciones persistentes.',
    engine: 'Enumeración exhaustiva de modelos Kripke finitos (preórdenes ≤ 4 mundos).',
    operators: ['! (negación intuicionista)', '& | -> <->'],
    validExample: 'logic intuitionistic.propositional\ncheck valid P -> !!P\ncheck valid (P -> Q) -> (P -> Q)\nderive P from {!!P -> P, !!P}',
    invalidExample: 'logic intuitionistic.propositional\ncheck valid P | !P\ncheck valid !!P -> P',
    limits: ['Máximo 4 mundos Kripke.', '≤ 2 átomos: 4 mundos; > 2 átomos: 3 mundos.', 'Complejidad O(2^(n²) · U^a).']
  },
  {
    id: 'temporal',
    name: 'temporal.ltl',
    slug: 'Temporal LTL',
    badge: 'LTL',
    semantics: 'Linear Temporal Logic. G(φ) = siempre, F(φ) = eventualmente, X(φ) = siguiente paso. Frame S4 (reflexivo + transitivo).',
    engine: 'Labeled Tableau con frame S4 para G/F y regla delta para X.',
    operators: ['[](φ) siempre G', '<>(φ) eventualmente F', 'X(φ) next', '! & | -> <->'],
    validExample: 'logic temporal.ltl\ncheck valid [](P) -> P\ncheck valid [](P) -> []([](P))\nderive <>(P) from {P}',
    invalidExample: 'logic temporal.ltl\ncheck valid <>(P) -> [](P)\ncountermodel <>(P) -> P',
    limits: ['Máximo 200 nodos en el tableau.', 'Operador U (until) tiene soporte limitado en el tableau.', 'Frame S4 asume futuro irreversible.']
  },
  {
    id: 'aristotelian',
    name: 'aristotelian.syllogistic',
    slug: 'Silogística Aristotélica',
    badge: 'SYL',
    semantics: 'Silogística categórica. Proposiciones A (Todo S es P), E (Ningún S es P), I (Algún S es P), O (Algún S no es P).',
    engine: 'Validación directa contra tabla de 19 silogismos válidos en 4 figuras.',
    operators: ['forall x (S(x) -> P(x)) = A', 'forall x (S(x) -> !P(x)) = E', 'exists x (S(x) & P(x)) = I', 'exists x (S(x) & !P(x)) = O'],
    validExample: 'logic aristotelian.syllogistic\n// Barbara (AAA-1)\naxiom mayor : forall x (M(x) -> P(x))\naxiom menor : forall x (S(x) -> M(x))\nderive forall x (S(x) -> P(x)) from {mayor, menor}',
    invalidExample: 'logic aristotelian.syllogistic\n// Término medio no distribuido\naxiom p1 : forall x (P(x) -> M(x))\naxiom p2 : forall x (S(x) -> M(x))\nderive forall x (S(x) -> P(x)) from {p1, p2}',
    limits: ['Requiere exactamente 2 premisas categóricas para derive.', 'Solo 19 de 24 silogismos (faltan las formas subalternadas: Barbari, Celaront, etc.).', 'Falacias de forma pueden no detectarse si se interpretan como un modo válido con distribución diferente.']
  },
  {
    id: 'belnap',
    name: 'paraconsistent.belnap',
    slug: 'Paraconsistente Belnap',
    badge: 'B4',
    semantics: 'Lógica de 4 valores de Belnap-Dunn: T (verdadero), F (falso), B (ambos), N (ninguno). Valores designados: T y B. Tolera contradicción sin trivialización.',
    engine: 'Tabla de verdad de 4 valores: enumeración exhaustiva de 4ⁿ valuaciones.',
    operators: ['! (negación Belnap)', '& (meet en retículo)', '| (join en retículo)', '-> (implicación material: !A | B)', '<-> (bicondicional)'],
    validExample: 'logic paraconsistent.belnap\ncheck satisfiable P & !P\ncheck equivalent !(P & Q), (!P | !Q)\ncheck equivalent !(P | Q), (!P & !Q)',
    invalidExample: 'logic paraconsistent.belnap\n// ¡P -> P NO es válida! (N -> N = N, no designado)\ncheck valid P -> P\n// Ex falso quodlibet FALLA\ncheck valid (P & !P) -> Q\n// Tercero excluido FALLA\ncheck valid P | !P',
    limits: ['P -> P NO es válida (N -> N = N).', 'P | !P NO es válida (N | N = N).', 'Ex falso quodlibet falla: la contradicción no trivializa.', 'Crece como 4ⁿ: costoso con muchas variables.']
  },
  {
    id: 'probabilistic',
    name: 'probabilistic.basic',
    slug: 'Probabilística',
    badge: 'PROB',
    semantics: 'Cálculo probabilístico exacto. P(φ) = Σ P(mundo) · ⟦mundo ⊨ φ⟧ asumiendo independencia entre átomos.',
    engine: 'Enumeración de 2ⁿ mundos × muestreo discreto de probabilidades [0, 0.25, 0.5, 0.75, 1].',
    operators: ['! & | -> <-> (semántica clásica por mundo)'],
    validExample: 'logic probabilistic.basic\ncheck valid P | !P\ncheck equivalent !(P & Q), (!P | !Q)\ntruth_table P -> Q',
    invalidExample: 'logic probabilistic.basic\ncheck valid P -> Q\ncountermodel P & !P',
    limits: ['Muestreo discreto: puede no detectar contraejemplos entre puntos.', 'Si 5ⁿ > 10000 se reduce a 3 puntos de muestreo.', 'Tolerancia numérica: 1e-10.', 'truth_table mezcla columnas booleanas y probabilísticas.']
  }
];

/* ──────────── Components ──────────── */
function CopyBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="group relative my-3">
      {label && <div className="text-[10px] uppercase tracking-wider text-surface-500 mb-1 font-semibold">{label}</div>}
      <div className="bg-surface-950 border border-surface-700/50 rounded-lg overflow-hidden font-mono">
        <div className="flex items-center justify-between px-3 py-1.5 bg-surface-800/50 border-b border-surface-700/30">
          <span className="text-[10px] text-surface-500">st</span>
          <button onClick={handleCopy} className="flex items-center gap-1 text-[10px] text-surface-500 hover:text-emerald-400 transition">
            {copied ? <span className="text-emerald-400">✓ Copiado</span> : <span>Copiar</span>}
          </button>
        </div>
        <pre className="p-3 text-sm text-emerald-300 overflow-x-auto leading-relaxed"><code>{code}</code></pre>
      </div>
    </div>
  );
}

function SectionTitle({ id, icon: Icon, title }: { id: string; icon: React.ElementType; title: string }) {
  return (
    <div id={id} className="flex items-center gap-3 mb-6 pt-10 -mt-10 scroll-mt-24">
      <div className="p-2 rounded-lg bg-mandy-500/10 border border-mandy-500/20">
        <Icon className="w-5 h-5 text-mandy-400" />
      </div>
      <h2 className="text-2xl font-extrabold text-white tracking-tight">{title}</h2>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 text-sm text-surface-300">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <ChevronRight className="w-3.5 h-3.5 text-mandy-500 mt-1 shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function CourseSection({ course }: { course: LogicCourse }) {
  return (
    <section id={course.id} className="scroll-mt-24">
      <div className="border border-surface-700/40 rounded-2xl overflow-hidden bg-surface-800/25">
        <div className="px-6 py-5 border-b border-surface-700/30 bg-gradient-to-r from-mandy-500/10 to-transparent">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <span className="text-[10px] font-bold bg-mandy-500/20 text-mandy-300 px-2.5 py-1 rounded-md border border-mandy-500/30 tracking-wider">{course.level}</span>
            <span className="text-[10px] font-bold bg-surface-700/60 text-surface-300 px-2.5 py-1 rounded-md border border-surface-600/40 tracking-wider">{course.navLabel}</span>
          </div>
          <h3 className="text-xl font-extrabold text-white tracking-tight">{course.title}</h3>
          <p className="text-sm text-surface-400 mt-2">{course.focus}</p>
        </div>

        <div className="px-6 py-6 space-y-6">
          <div>
            <h4 className="text-xs font-bold text-surface-500 uppercase tracking-widest mb-2">Qué aprendes aquí</h4>
            <p className="text-sm text-surface-300 leading-relaxed">{course.summary}</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="bg-surface-900/40 rounded-xl p-4 border border-surface-700/30">
              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">Preguntas guía</h4>
              <BulletList items={course.questions} />
            </div>
            <div className="bg-surface-900/40 rounded-xl p-4 border border-surface-700/30">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3">Conceptos clave</h4>
              <BulletList items={course.concepts} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="bg-surface-900/40 rounded-xl p-4 border border-surface-700/30">
              <h4 className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-3">Patrones de sintaxis ST</h4>
              <BulletList items={course.syntax} />
            </div>
            <div className="bg-surface-900/40 rounded-xl p-4 border border-surface-700/30">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3">Comandos que debes practicar</h4>
              <BulletList items={course.commands} />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-surface-500 uppercase tracking-widest mb-2">Lección práctica</h4>
            <CopyBlock code={course.lessonExample} />
          </div>

          <div className="bg-red-500/5 rounded-xl p-4 border border-red-500/20">
            <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3">Errores comunes</h4>
            <BulletList items={course.mistakes} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────── Main Page ──────────── */
export default function STDocsPage() {
  const [openProfile, setOpenProfile] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-surface-900 text-surface-200 selection:bg-mandy-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface-900/90 backdrop-blur border-b border-surface-700/50">
        <div className="max-w-6xl mx-auto flex items-center gap-4 px-6 py-3">
          <Link href="/docs" className="p-2 rounded-lg hover:bg-surface-700/50 transition text-surface-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-mandy-600 to-violet-600 shadow-lg shadow-mandy-900/20">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight">Manual ST — Motor de Lógica Formal</h1>
          </div>
          <div className="flex-1" />
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-surface-800 border border-surface-700 text-[10px] font-bold text-surface-400 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            v1.5.2
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 flex gap-10">
        {/* Sidebar */}
        <nav className="hidden lg:block w-56 shrink-0 sticky top-24 self-start space-y-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-surface-500 font-bold mb-4 px-2">Contenidos</p>
          {NAV.map(n => (
            <a key={n.id} href={`#${n.id}`} className="flex items-center gap-2 text-sm text-surface-400 hover:text-mandy-400 py-2 px-2 rounded-lg hover:bg-surface-800/50 transition-all group">
              <div className="w-1 h-1 rounded-full bg-surface-700 group-hover:bg-mandy-500 transition-colors" />
              {n.label}
            </a>
          ))}
          <div className="border-t border-surface-700/30 pt-3 mt-3">
            <a href="https://github.com/stevenvo780/ST" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-surface-500 hover:text-mandy-400 px-2 py-1.5 transition">
              <ExternalLink className="w-3 h-3" /> Repositorio
            </a>
          </div>
        </nav>

        {/* Main content */}
        <div className="flex-1 space-y-12 min-w-0">
          {/* ── Intro ── */}
          <section>
            <SectionTitle id="intro" icon={BookOpen} title="¿Qué es ST?" />
            <div className="bg-gradient-to-br from-mandy-600/20 via-surface-800/50 to-surface-900 border border-mandy-500/30 rounded-2xl p-8 space-y-4">
              <p className="text-surface-300 leading-relaxed">
                <strong className="text-white">ST</strong> es un lenguaje declarativo para lógica formal.
                Permite definir axiomas, teoremas y ejecutar comandos de verificación
                (validez, satisfacibilidad, equivalencia, derivación, tablas de verdad)
                sobre <strong className="text-mandy-400">10 perfiles lógicos</strong> distintos:
                desde la clásica proposicional hasta la probabilística.
              </p>
              <p className="text-surface-400 text-sm">
                Cada perfil implementa un motor semántico propio (tablas de verdad, tableaux
                analíticos, modelos Kripke, retículos de 4 valores, cálculo probabilístico o
                validación silogística directa). El Text Layer extiende ST para vincular
                fórmulas a documentos en lenguaje natural.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <span className="text-[10px] font-bold bg-surface-700/80 px-3 py-1.5 rounded-lg text-surface-200 border border-surface-600/50">10 perfiles</span>
                <span className="text-[10px] font-bold bg-surface-700/80 px-3 py-1.5 rounded-lg text-surface-200 border border-surface-600/50">CLI + API</span>
                <span className="text-[10px] font-bold bg-surface-700/80 px-3 py-1.5 rounded-lg text-surface-200 border border-surface-600/50">Text Layer</span>
                <span className="text-[10px] font-bold bg-surface-700/80 px-3 py-1.5 rounded-lg text-surface-200 border border-surface-600/50">TypeScript / npm</span>
              </div>
            </div>
          </section>

          <section>
            <SectionTitle id="academy" icon={BookOpen} title="Escuela de Lógicas" />
            <div className="bg-gradient-to-br from-violet-600/10 via-surface-800/50 to-surface-900 border border-violet-500/20 rounded-2xl p-6 space-y-5">
              <div>
                <p className="text-sm text-surface-300 leading-relaxed">
                  Aquí está la parte que faltaba: una <strong className="text-white">ruta de aprendizaje visible</strong>,
                  clara y directa. En vez de esconder la enseñanza dentro de tarjetas compactas, esta página ahora organiza
                  las lógicas como <strong className="text-mandy-400">cursos completos</strong>. La recomendación es estudiar
                  en orden: primero proposicional, luego primer orden, y desde allí abrir las familias modal, normativa,
                  epistémica, intuicionista, temporal, aristotélica, paraconsistente y probabilística.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {COURSES.map(course => (
                  <a
                    key={course.id}
                    href={`#${course.id}`}
                    className="group border border-surface-700/40 rounded-xl p-4 bg-surface-900/35 hover:bg-surface-900/60 hover:border-mandy-500/30 transition"
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-mandy-300 bg-mandy-500/15 border border-mandy-500/25 px-2 py-1 rounded-md">{course.level}</span>
                      <ChevronRight className="w-4 h-4 text-surface-500 group-hover:text-mandy-400 transition group-hover:translate-x-0.5" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">{course.navLabel}</h3>
                    <p className="text-xs text-surface-400 leading-relaxed">{course.focus}</p>
                  </a>
                ))}
              </div>

              <div className="bg-surface-900/40 border border-surface-700/30 rounded-xl p-4">
                <h3 className="text-xs font-bold text-surface-500 uppercase tracking-widest mb-3">Ruta sugerida</h3>
                <div className="flex flex-wrap gap-2 text-xs">
                  <a href="#propositional" className="px-3 py-1.5 rounded-lg border border-surface-700/40 bg-surface-800/50 text-surface-300 hover:text-mandy-300 hover:border-mandy-500/30 transition">1. Proposicional</a>
                  <a href="#course-fol" className="px-3 py-1.5 rounded-lg border border-surface-700/40 bg-surface-800/50 text-surface-300 hover:text-mandy-300 hover:border-mandy-500/30 transition">2. Primer Orden</a>
                  <a href="#course-modal" className="px-3 py-1.5 rounded-lg border border-surface-700/40 bg-surface-800/50 text-surface-300 hover:text-mandy-300 hover:border-mandy-500/30 transition">3. Modal</a>
                  <a href="#course-deontic" className="px-3 py-1.5 rounded-lg border border-surface-700/40 bg-surface-800/50 text-surface-300 hover:text-mandy-300 hover:border-mandy-500/30 transition">4. Deóntica</a>
                  <a href="#course-epistemic" className="px-3 py-1.5 rounded-lg border border-surface-700/40 bg-surface-800/50 text-surface-300 hover:text-mandy-300 hover:border-mandy-500/30 transition">5. Epistémica</a>
                  <a href="#course-intuitionistic" className="px-3 py-1.5 rounded-lg border border-surface-700/40 bg-surface-800/50 text-surface-300 hover:text-mandy-300 hover:border-mandy-500/30 transition">6. Intuicionista</a>
                  <a href="#course-temporal" className="px-3 py-1.5 rounded-lg border border-surface-700/40 bg-surface-800/50 text-surface-300 hover:text-mandy-300 hover:border-mandy-500/30 transition">7. Temporal</a>
                  <a href="#course-aristotelian" className="px-3 py-1.5 rounded-lg border border-surface-700/40 bg-surface-800/50 text-surface-300 hover:text-mandy-300 hover:border-mandy-500/30 transition">8. Aristotélica</a>
                  <a href="#course-belnap" className="px-3 py-1.5 rounded-lg border border-surface-700/40 bg-surface-800/50 text-surface-300 hover:text-mandy-300 hover:border-mandy-500/30 transition">9. Belnap</a>
                  <a href="#course-probabilistic" className="px-3 py-1.5 rounded-lg border border-surface-700/40 bg-surface-800/50 text-surface-300 hover:text-mandy-300 hover:border-mandy-500/30 transition">10. Probabilística</a>
                </div>
              </div>
            </div>
          </section>

          {/* ── Lógica Proposicional — Curso completo ── */}
          <section>
            <SectionTitle id="propositional" icon={GraduationCap} title="Curso de Lógica Proposicional" />
            <p className="text-surface-300 text-sm leading-relaxed mb-6">
              Esta sección es una guía exhaustiva de lógica proposicional clásica usando el lenguaje ST.
              Todos los ejemplos son ejecutables: cópialos y pégalos en la terminal ST o en el editor integrado.
            </p>

            {/* 1. Proposiciones */}
            <div className="space-y-6">
              <div className="bg-surface-800/40 border border-surface-700/40 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-3">1. ¿Qué es una proposición?</h3>
                <p className="text-sm text-surface-300 leading-relaxed mb-3">
                  Una <strong className="text-mandy-400">proposición</strong> es un enunciado declarativo que puede ser
                  verdadero (<strong className="text-emerald-400">V</strong>) o falso (<strong className="text-red-400">F</strong>),
                  pero nunca ambos al mismo tiempo. En ST las proposiciones se representan con letras mayúsculas
                  llamadas <em>átomos proposicionales</em>.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 mb-3">
                  <div className="bg-surface-900/50 rounded-lg p-3 border border-surface-700/30">
                    <p className="text-xs text-emerald-400 font-bold mb-1">✓ Son proposiciones</p>
                    <p className="text-xs text-surface-400">&quot;La Tierra es redonda&quot; → P</p>
                    <p className="text-xs text-surface-400">&quot;2 + 2 = 5&quot; → Q (falsa, pero es proposición)</p>
                  </div>
                  <div className="bg-surface-900/50 rounded-lg p-3 border border-surface-700/30">
                    <p className="text-xs text-red-400 font-bold mb-1">✗ NO son proposiciones</p>
                    <p className="text-xs text-surface-400">&quot;¿Qué hora es?&quot; (pregunta)</p>
                    <p className="text-xs text-surface-400">&quot;¡Cierra la puerta!&quot; (imperativo)</p>
                  </div>
                </div>
                <CopyBlock label="Declarar el perfil proposicional" code="logic classical.propositional" />
                <p className="text-xs text-surface-500 italic">
                  Todo script ST comienza declarando el perfil lógico. Para lógica proposicional usamos
                  <code className="text-mandy-400 mx-1">classical.propositional</code>.
                </p>
              </div>

              {/* 2. Valores de verdad */}
              <div className="bg-surface-800/40 border border-surface-700/40 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-3">2. Valores de verdad y bivalencia</h3>
                <p className="text-sm text-surface-300 leading-relaxed mb-3">
                  La lógica clásica es <strong className="text-white">bivalente</strong>: cada proposición tiene exactamente
                  uno de dos valores — verdadero (V/T) o falso (F). No existe un tercer valor.
                  El motor de ST evalúa fórmulas generando <em>todas</em> las combinaciones posibles de V y F
                  para cada átomo (esto se llama <strong className="text-mandy-400">tabla de verdad</strong>).
                </p>
                <CopyBlock label="Generar tabla de verdad para un átomo" code={'logic classical.propositional\ntruth_table P'} />
                <p className="text-xs text-surface-400 mt-2">
                  Resultado: una tabla con una sola columna y dos filas — P=V y P=F.
                  Con 2 átomos hay 4 filas (2²), con 3 hay 8 (2³), y así sucesivamente hasta 2²⁰ = 1,048,576 filas (el límite del motor).
                </p>
              </div>

              {/* 3. Los 5 operadores */}
              <div className="bg-surface-800/40 border border-surface-700/40 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">3. Los 5 operadores lógicos</h3>
                <p className="text-sm text-surface-300 leading-relaxed mb-4">
                  Los operadores transforman proposiciones simples en fórmulas compuestas. ST implementa los 5 conectivos
                  clásicos. A continuación cada uno con su tabla de verdad y su significado intuitivo.
                </p>

                {/* Negación */}
                <div className="border border-surface-700/30 rounded-lg p-4 mb-4 bg-surface-900/30">
                  <h4 className="text-sm font-bold text-mandy-400 mb-2">3.1 Negación — <code className="text-emerald-300">!P</code></h4>
                  <p className="text-xs text-surface-400 mb-3">
                    Invierte el valor de verdad. Si P es verdadera, !P es falsa y viceversa.
                    Equivale a decir &quot;no es el caso que P&quot;.
                  </p>
                  <CopyBlock code={'logic classical.propositional\n// La negación de una contradicción es tautología\ncheck valid !(P & !P)\n\n// La doble negación se elimina en clásica\ncheck valid !!P -> P\n\n// Tabla de verdad de la negación\ntruth_table !P'} />
                  <div className="mt-3 bg-surface-950/60 rounded-lg p-3 border border-surface-700/30 font-mono text-xs text-surface-400">
                    <p className="text-surface-500 mb-1">Tabla de verdad:</p>
                    <p>P=V → !P=<span className="text-red-400">F</span></p>
                    <p>P=F → !P=<span className="text-emerald-400">V</span></p>
                  </div>
                </div>

                {/* Conjunción */}
                <div className="border border-surface-700/30 rounded-lg p-4 mb-4 bg-surface-900/30">
                  <h4 className="text-sm font-bold text-mandy-400 mb-2">3.2 Conjunción — <code className="text-emerald-300">P & Q</code></h4>
                  <p className="text-xs text-surface-400 mb-3">
                    Es verdadera <em>solo</em> cuando ambos operandos son verdaderos. Equivale al &quot;y&quot; del lenguaje natural.
                    Si cualquiera de los dos es falso, la conjunción completa es falsa.
                  </p>
                  <CopyBlock code={'logic classical.propositional\n// P & Q solo es verdadera si ambas lo son\ntruth_table P & Q\n\n// Satisfacibilidad: ¿existe algún caso donde P & Q sea V?\ncheck satisfiable P & Q\n\n// P & !P nunca es verdadera (contradicción)\ncheck satisfiable P & !P'} />
                  <div className="mt-3 bg-surface-950/60 rounded-lg p-3 border border-surface-700/30 font-mono text-xs text-surface-400">
                    <p className="text-surface-500 mb-1">Tabla de verdad:</p>
                    <p>P=V, Q=V → P&Q=<span className="text-emerald-400">V</span></p>
                    <p>P=V, Q=F → P&Q=<span className="text-red-400">F</span></p>
                    <p>P=F, Q=V → P&Q=<span className="text-red-400">F</span></p>
                    <p>P=F, Q=F → P&Q=<span className="text-red-400">F</span></p>
                  </div>
                </div>

                {/* Disyunción */}
                <div className="border border-surface-700/30 rounded-lg p-4 mb-4 bg-surface-900/30">
                  <h4 className="text-sm font-bold text-mandy-400 mb-2">3.3 Disyunción — <code className="text-emerald-300">P | Q</code></h4>
                  <p className="text-xs text-surface-400 mb-3">
                    Es verdadera cuando <em>al menos uno</em> de los operandos es verdadero (disyunción inclusiva).
                    Solo es falsa cuando ambos son falsos. Equivale al &quot;o&quot; (inclusivo) del lenguaje natural.
                  </p>
                  <CopyBlock code={'logic classical.propositional\n// La disyunción inclusiva\ntruth_table P | Q\n\n// Tercero excluido: P o no-P siempre es verdadero\ncheck valid P | !P\n\n// Si tenemos P, podemos derivar P | Q\naxiom base = P\nderive P | Q from {base}'} />
                  <div className="mt-3 bg-surface-950/60 rounded-lg p-3 border border-surface-700/30 font-mono text-xs text-surface-400">
                    <p className="text-surface-500 mb-1">Tabla de verdad:</p>
                    <p>P=V, Q=V → P|Q=<span className="text-emerald-400">V</span></p>
                    <p>P=V, Q=F → P|Q=<span className="text-emerald-400">V</span></p>
                    <p>P=F, Q=V → P|Q=<span className="text-emerald-400">V</span></p>
                    <p>P=F, Q=F → P|Q=<span className="text-red-400">F</span></p>
                  </div>
                </div>

                {/* Implicación */}
                <div className="border border-surface-700/30 rounded-lg p-4 mb-4 bg-surface-900/30">
                  <h4 className="text-sm font-bold text-mandy-400 mb-2">3.4 Implicación material — <code className="text-emerald-300">P -&gt; Q</code></h4>
                  <p className="text-xs text-surface-400 mb-3">
                    &quot;Si P entonces Q&quot;. Es falsa <em>solo</em> cuando el antecedente (P) es verdadero y el consecuente (Q) es falso.
                    En todos los demás casos es verdadera — incluso cuando P es falsa (la &quot;implicación vacuamente verdadera&quot;).
                    Este es el operador que más confusión genera: <code className="text-surface-300">F -&gt; F = V</code> y{' '}
                    <code className="text-surface-300">F -&gt; V = V</code>.
                  </p>
                  <CopyBlock code={'logic classical.propositional\n// Tabla de verdad de la implicación\ntruth_table P -> Q\n\n// La implicación NO es una tautología\ncheck valid P -> Q\n// → NO es válida (contramodelo: P=V, Q=F)\n\n// Contramodelo: muestra cuándo falla\ncountermodel P -> Q\n\n// Equivalencia fundamental: P->Q ≡ !P | Q\ncheck equivalent P -> Q, !P | Q'} />
                  <div className="mt-3 bg-surface-950/60 rounded-lg p-3 border border-surface-700/30 font-mono text-xs text-surface-400">
                    <p className="text-surface-500 mb-1">Tabla de verdad:</p>
                    <p>P=V, Q=V → P→Q=<span className="text-emerald-400">V</span></p>
                    <p>P=V, Q=F → P→Q=<span className="text-red-400">F</span> ← el único caso falso</p>
                    <p>P=F, Q=V → P→Q=<span className="text-emerald-400">V</span></p>
                    <p>P=F, Q=F → P→Q=<span className="text-emerald-400">V</span></p>
                  </div>
                </div>

                {/* Bicondicional */}
                <div className="border border-surface-700/30 rounded-lg p-4 bg-surface-900/30">
                  <h4 className="text-sm font-bold text-mandy-400 mb-2">3.5 Bicondicional — <code className="text-emerald-300">P &lt;-&gt; Q</code></h4>
                  <p className="text-xs text-surface-400 mb-3">
                    &quot;P si y solo si Q&quot;. Es verdadera cuando ambos tienen el <em>mismo</em> valor de verdad
                    (ambos verdaderos o ambos falsos). Equivale a la doble implicación:
                    (P → Q) y (Q → P) simultáneamente.
                  </p>
                  <CopyBlock code={'logic classical.propositional\n// Tabla de verdad del bicondicional\ntruth_table P <-> Q\n\n// Equivalencia: bicondicional = doble implicación\ncheck equivalent P <-> Q, (P -> Q) & (Q -> P)\n\n// P <-> P siempre es verdadero (reflexividad)\ncheck valid P <-> P'} />
                  <div className="mt-3 bg-surface-950/60 rounded-lg p-3 border border-surface-700/30 font-mono text-xs text-surface-400">
                    <p className="text-surface-500 mb-1">Tabla de verdad:</p>
                    <p>P=V, Q=V → P↔Q=<span className="text-emerald-400">V</span></p>
                    <p>P=V, Q=F → P↔Q=<span className="text-red-400">F</span></p>
                    <p>P=F, Q=V → P↔Q=<span className="text-red-400">F</span></p>
                    <p>P=F, Q=F → P↔Q=<span className="text-emerald-400">V</span></p>
                  </div>
                </div>
              </div>

              {/* 4. Clasificación de fórmulas */}
              <div className="bg-surface-800/40 border border-surface-700/40 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-3">4. Clasificación de fórmulas</h3>
                <p className="text-sm text-surface-300 leading-relaxed mb-4">
                  Toda fórmula proposicional cae en exactamente una de tres categorías según su comportamiento
                  en todas las valuaciones posibles:
                </p>
                <div className="grid gap-4 sm:grid-cols-3 mb-4">
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
                    <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">Tautología</h5>
                    <p className="text-xs text-surface-400">Verdadera en <em>toda</em> valuación. El motor reporta &quot;VÁLIDA&quot;.</p>
                    <p className="text-xs text-surface-500 mt-2 font-mono">P | !P</p>
                  </div>
                  <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                    <h5 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2">Contradicción</h5>
                    <p className="text-xs text-surface-400">Falsa en <em>toda</em> valuación. El motor reporta &quot;INSATISFACIBLE&quot;.</p>
                    <p className="text-xs text-surface-500 mt-2 font-mono">P & !P</p>
                  </div>
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                    <h5 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">Contingencia</h5>
                    <p className="text-xs text-surface-400">Verdadera en algunas valuaciones, falsa en otras. Es &quot;satisfacible pero no válida&quot;.</p>
                    <p className="text-xs text-surface-500 mt-2 font-mono">P -&gt; Q</p>
                  </div>
                </div>
                <CopyBlock code={'logic classical.propositional\n// Tautología: verdadera siempre\ncheck valid P | !P\n\n// Contradicción: nunca satisfacible\ncheck satisfiable P & !P\n\n// Contingencia: satisfacible pero no válida\ncheck valid P -> Q\ncheck satisfiable P -> Q'} />
              </div>

              {/* 5. Equivalencias fundamentales */}
              <div className="bg-surface-800/40 border border-surface-700/40 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-3">5. Equivalencias lógicas fundamentales</h3>
                <p className="text-sm text-surface-300 leading-relaxed mb-4">
                  Dos fórmulas son <strong className="text-mandy-400">lógicamente equivalentes</strong> cuando tienen
                  el mismo valor de verdad en <em>toda</em> valuación. ST las verifica con
                  <code className="text-mandy-400 mx-1">check equivalent</code>.
                </p>
                <div className="space-y-3">
                  <div className="border border-surface-700/30 rounded-lg p-4 bg-surface-900/30">
                    <h5 className="text-xs font-bold text-blue-400 mb-2">Leyes de De Morgan</h5>
                    <p className="text-xs text-surface-400 mb-2">La negación de una conjunción es la disyunción de las negaciones, y viceversa.</p>
                    <CopyBlock code={'logic classical.propositional\ncheck equivalent !(P & Q), (!P | !Q)\ncheck equivalent !(P | Q), (!P & !Q)'} />
                  </div>
                  <div className="border border-surface-700/30 rounded-lg p-4 bg-surface-900/30">
                    <h5 className="text-xs font-bold text-blue-400 mb-2">Contraposición</h5>
                    <p className="text-xs text-surface-400 mb-2">&quot;Si P entonces Q&quot; es equivalente a &quot;Si no Q entonces no P&quot;.</p>
                    <CopyBlock code={'logic classical.propositional\ncheck equivalent P -> Q, !Q -> !P\ncheck valid (P -> Q) <-> (!Q -> !P)'} />
                  </div>
                  <div className="border border-surface-700/30 rounded-lg p-4 bg-surface-900/30">
                    <h5 className="text-xs font-bold text-blue-400 mb-2">Eliminación de implicación</h5>
                    <p className="text-xs text-surface-400 mb-2">La implicación se puede reescribir como disyunción.</p>
                    <CopyBlock code={'logic classical.propositional\ncheck equivalent P -> Q, !P | Q'} />
                  </div>
                  <div className="border border-surface-700/30 rounded-lg p-4 bg-surface-900/30">
                    <h5 className="text-xs font-bold text-blue-400 mb-2">Doble negación</h5>
                    <p className="text-xs text-surface-400 mb-2">En lógica clásica, negar dos veces equivale a afirmar.</p>
                    <CopyBlock code={'logic classical.propositional\ncheck equivalent !!P, P\ncheck valid !!P -> P'} />
                  </div>
                  <div className="border border-surface-700/30 rounded-lg p-4 bg-surface-900/30">
                    <h5 className="text-xs font-bold text-blue-400 mb-2">Idempotencia, conmutatividad y asociatividad</h5>
                    <CopyBlock code={'logic classical.propositional\n// Idempotencia\ncheck equivalent P & P, P\ncheck equivalent P | P, P\n\n// Conmutatividad\ncheck equivalent P & Q, Q & P\ncheck equivalent P | Q, Q | P\n\n// Asociatividad\ncheck equivalent (P & Q) & R, P & (Q & R)\ncheck equivalent (P | Q) | R, P | (Q | R)'} />
                  </div>
                  <div className="border border-surface-700/30 rounded-lg p-4 bg-surface-900/30">
                    <h5 className="text-xs font-bold text-blue-400 mb-2">Distributividad y absorción</h5>
                    <CopyBlock code={'logic classical.propositional\n// Distributividad\ncheck equivalent P & (Q | R), (P & Q) | (P & R)\ncheck equivalent P | (Q & R), (P | Q) & (P | R)\n\n// Absorción\ncheck equivalent P & (P | Q), P\ncheck equivalent P | (P & Q), P'} />
                  </div>
                </div>
              </div>

              {/* 6. Reglas de derivación */}
              <div className="bg-surface-800/40 border border-surface-700/40 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-3">6. Reglas de inferencia (motor de derivación)</h3>
                <p className="text-sm text-surface-300 leading-relaxed mb-4">
                  El motor de ST implementa un <strong className="text-mandy-400">derivador BFS</strong> (búsqueda en anchura)
                  que aplica las siguientes reglas automáticamente. El comando
                  <code className="text-mandy-400 mx-1">derive</code> intenta encadenar estas reglas para llegar
                  desde las premisas hasta la meta. Si la derivación sintáctica falla, usa un
                  <em> fallback semántico</em> por tabla de verdad.
                </p>
                <div className="space-y-3">
                  <div className="border border-surface-700/30 rounded-lg p-4 bg-surface-900/30">
                    <h5 className="text-xs font-bold text-emerald-400 mb-1">Modus Ponens</h5>
                    <p className="text-xs text-surface-400 mb-2">
                      De <code className="text-surface-300">A</code> y <code className="text-surface-300">A -&gt; B</code>,
                      se concluye <code className="text-surface-300">B</code>.
                      La regla de inferencia más fundamental: si sabemos que P y que P implica Q, entonces Q.
                    </p>
                    <CopyBlock code={'logic classical.propositional\naxiom p1 : P -> Q\naxiom p2 = P\nderive Q from {p1, p2}\n// Prueba: Modus Ponens [de p1, p2]'} />
                  </div>
                  <div className="border border-surface-700/30 rounded-lg p-4 bg-surface-900/30">
                    <h5 className="text-xs font-bold text-emerald-400 mb-1">Modus Tollens</h5>
                    <p className="text-xs text-surface-400 mb-2">
                      De <code className="text-surface-300">!B</code> y <code className="text-surface-300">A -&gt; B</code>,
                      se concluye <code className="text-surface-300">!A</code>.
                      Si sabemos que Q es falsa y que P implica Q, entonces P debe ser falsa.
                    </p>
                    <CopyBlock code={'logic classical.propositional\naxiom impl : P -> Q\naxiom neg : !Q\nderive !P from {impl, neg}\n// Prueba: Modus Tollens [de neg, impl]'} />
                  </div>
                  <div className="border border-surface-700/30 rounded-lg p-4 bg-surface-900/30">
                    <h5 className="text-xs font-bold text-emerald-400 mb-1">Silogismo hipotético (encadenamiento)</h5>
                    <p className="text-xs text-surface-400 mb-2">
                      De <code className="text-surface-300">P -&gt; Q</code> y <code className="text-surface-300">Q -&gt; R</code>
                      junto con <code className="text-surface-300">P</code>, se concluye <code className="text-surface-300">R</code>.
                      El motor encadena Modus Ponens múltiples veces.
                    </p>
                    <CopyBlock code={'logic classical.propositional\naxiom chain1 : P -> Q\naxiom chain2 : Q -> R\naxiom start = P\nderive R from {chain1, chain2, start}\n// Prueba: MP[start,chain1] → Q; MP[Q,chain2] → R'} />
                  </div>
                  <div className="border border-surface-700/30 rounded-lg p-4 bg-surface-900/30">
                    <h5 className="text-xs font-bold text-emerald-400 mb-1">Eliminación de conjunción</h5>
                    <p className="text-xs text-surface-400 mb-2">
                      De <code className="text-surface-300">A & B</code> se puede concluir <code className="text-surface-300">A</code> y
                      también <code className="text-surface-300">B</code> por separado.
                    </p>
                    <CopyBlock code={'logic classical.propositional\naxiom both : P & Q\nderive P from {both}\nderive Q from {both}'} />
                  </div>
                  <div className="border border-surface-700/30 rounded-lg p-4 bg-surface-900/30">
                    <h5 className="text-xs font-bold text-emerald-400 mb-1">Introducción de conjunción</h5>
                    <p className="text-xs text-surface-400 mb-2">
                      De <code className="text-surface-300">A</code> y <code className="text-surface-300">B</code> por separado,
                      se concluye <code className="text-surface-300">A & B</code>.
                    </p>
                    <CopyBlock code={'logic classical.propositional\naxiom left = P\naxiom right = Q\nderive P & Q from {left, right}'} />
                  </div>
                  <div className="border border-surface-700/30 rounded-lg p-4 bg-surface-900/30">
                    <h5 className="text-xs font-bold text-emerald-400 mb-1">Introducción de disyunción</h5>
                    <p className="text-xs text-surface-400 mb-2">
                      De <code className="text-surface-300">A</code> se puede concluir <code className="text-surface-300">A | B</code>
                      para cualquier B (si la meta es una disyunción).
                    </p>
                    <CopyBlock code={'logic classical.propositional\naxiom fact = P\nderive P | Q from {fact}'} />
                  </div>
                  <div className="border border-surface-700/30 rounded-lg p-4 bg-surface-900/30">
                    <h5 className="text-xs font-bold text-emerald-400 mb-1">Doble negación</h5>
                    <p className="text-xs text-surface-400 mb-2">
                      De <code className="text-surface-300">!!A</code> se concluye <code className="text-surface-300">A</code>.
                    </p>
                    <CopyBlock code={'logic classical.propositional\naxiom dbl : !!P\nderive P from {dbl}'} />
                  </div>
                  <div className="border border-surface-700/30 rounded-lg p-4 bg-surface-900/30">
                    <h5 className="text-xs font-bold text-emerald-400 mb-1">Contraposición</h5>
                    <p className="text-xs text-surface-400 mb-2">
                      De <code className="text-surface-300">A -&gt; B</code> se genera
                      <code className="text-surface-300 mx-1">!B -&gt; !A</code>.
                    </p>
                    <CopyBlock code={'logic classical.propositional\naxiom orig : P -> Q\naxiom negq : !Q\nderive !P from {orig, negq}\n// El motor genera la contrapositiva y aplica MP'} />
                  </div>
                  <div className="border border-surface-700/30 rounded-lg p-4 bg-surface-900/30">
                    <h5 className="text-xs font-bold text-emerald-400 mb-1">Eliminación de bicondicional</h5>
                    <p className="text-xs text-surface-400 mb-2">
                      De <code className="text-surface-300">A &lt;-&gt; B</code> se generan ambas direcciones:
                      <code className="text-surface-300 mx-1">A -&gt; B</code> y
                      <code className="text-surface-300 mx-1">B -&gt; A</code>.
                    </p>
                    <CopyBlock code={'logic classical.propositional\naxiom iff : P <-> Q\naxiom haveP = P\nderive Q from {iff, haveP}\n// Elimina bic → (P->Q), luego MP con P → Q'} />
                  </div>
                </div>
                <div className="mt-4 bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
                  <p className="text-xs text-amber-300">
                    <strong>Nota:</strong> El derivador BFS tiene un límite de 200 iteraciones. Si no encuentra una prueba
                    sintáctica, recurre a un <strong>fallback semántico</strong>: verifica por tabla de verdad si en toda
                    valuación donde las premisas son verdaderas, la meta también lo es.
                  </p>
                </div>
              </div>

              {/* 7. Tautologías clásicas */}
              <div className="bg-surface-800/40 border border-surface-700/40 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-3">7. Tautologías clásicas importantes</h3>
                <p className="text-sm text-surface-300 leading-relaxed mb-4">
                  Estas fórmulas son verdaderas bajo <em>toda</em> valuación. Son los &quot;teoremas gratuitos&quot; de la lógica
                  proposicional — no necesitan axiomas para ser verdaderas.
                </p>
                <CopyBlock code={'logic classical.propositional\n\n// Identidad\ncheck valid P -> P\n\n// Tercero excluido (LEM)\ncheck valid P | !P\n\n// No-contradicción\ncheck valid !(P & !P)\n\n// Doble negación (eliminación)\ncheck valid !!P -> P\n\n// Contrapositiva\ncheck valid (P -> Q) <-> (!Q -> !P)\n\n// Modus ponens como tautología\ncheck valid (P & (P -> Q)) -> Q\n\n// Transitividad de la implicación\ncheck valid ((P -> Q) & (Q -> R)) -> (P -> R)\n\n// Principio de explosión (ex falso quodlibet)\ncheck valid (P & !P) -> Q\n\n// Axioma S de Hilbert\ncheck valid (P -> (Q -> R)) -> ((P -> Q) -> (P -> R))\n\n// Contrarrecíproca (Modus Tollens como tautología)\ncheck valid (!P -> !Q) -> (Q -> P)'} />
              </div>

              {/* 8. Ejemplo completo */}
              <div className="bg-gradient-to-br from-mandy-600/10 via-surface-800/40 to-surface-900 border border-mandy-500/20 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-3">8. Ejemplo integrador: razonamiento completo</h3>
                <p className="text-sm text-surface-300 leading-relaxed mb-4">
                  Un script completo que combina axiomas, derivaciones, verificaciones de validez, equivalencias,
                  tablas de verdad y contramodelos — todo en un solo flujo:
                </p>
                <CopyBlock code={'logic classical.propositional\n\n// === Teoría: sistema de alarma ===\n// Si hay humo, hay fuego\naxiom regla1 : Humo -> Fuego\n// Si hay fuego, hay que evacuar\naxiom regla2 : Fuego -> Evacuar\n// Hay humo\naxiom hecho = Humo\n\n// === Derivaciones ===\n// ¿Hay fuego? (Modus Ponens)\nderive Fuego from {regla1, hecho}\n\n// ¿Hay que evacuar? (Encadenamiento)\nderive Evacuar from {regla1, regla2, hecho}\n\n// === Verificaciones ===\n// ¿Es válido que humo + reglas implique evacuación?\ncheck valid (Humo & (Humo -> Fuego) & (Fuego -> Evacuar)) -> Evacuar\n\n// Contrapositiva: si no evacuamos, no había humo\ncheck equivalent !Evacuar -> !Humo, Humo -> Evacuar\n\n// === Exploración ===\n// ¿Es posible tener fuego sin humo? (en este modelo)\ncheck satisfiable Fuego & !Humo\n\n// Tabla de verdad del razonamiento completo\ntruth_table (Humo & (Humo -> Fuego)) -> Fuego\n\n// Contramodelo: ¿cuándo falla Humo -> Evacuar directamente?\ncountermodel Humo -> Evacuar'} />
                <p className="text-xs text-surface-500 mt-3 italic">
                  Este script demuestra el flujo típico: definir axiomas → derivar consecuencias → verificar propiedades →
                  explorar con contramodelos y tablas de verdad.
                </p>
              </div>
            </div>
          </section>

          <div className="space-y-8">
            {COURSES.filter(course => course.id !== 'propositional').map(course => (
              <CourseSection key={course.id} course={course} />
            ))}
          </div>

          {/* ── Syntax ── */}
          <section>
            <SectionTitle id="syntax" icon={Terminal} title="Sintaxis del Lenguaje" />
            <div className="grid gap-4">
              {SYNTAX.map((s, i) => (
                <div key={i} className="bg-surface-800/40 border border-surface-700/40 rounded-xl p-5">
                  <h4 className="text-sm font-bold text-white mb-2">{s.title}</h4>
                  <CopyBlock code={s.code} />
                  {s.note && <p className="text-xs text-surface-500 mt-2 italic">{s.note}</p>}
                </div>
              ))}
            </div>
          </section>

          {/* ── Commands ── */}
          <section>
            <SectionTitle id="commands" icon={FlaskConical} title="Referencia de Comandos" />
            <div className="grid gap-3">
              {COMMANDS.map((c, i) => (
                <div key={i} className="border border-surface-700/40 rounded-xl p-5 bg-surface-800/40">
                  <div className="flex items-start gap-3 mb-2">
                    <code className="text-mandy-400 font-bold text-sm whitespace-nowrap">{c.cmd}</code>
                    <p className="text-surface-400 text-sm flex-1">{c.desc}</p>
                  </div>
                  <CopyBlock code={c.example} />
                </div>
              ))}
            </div>
          </section>

          {/* ── Profiles ── */}
          <section>
            <SectionTitle id="profiles" icon={Layers3} title="Perfiles Lógicos (10)" />
            <p className="text-surface-400 text-sm mb-6">
              Cada perfil activa un motor semántico específico. Haz clic en un perfil para ver su manual completo
              con semántica, operadores, axiomas, ejemplos válidos e inválidos, y limitaciones del motor.
            </p>
            <div className="grid gap-3">
              {PROFILES.map(p => {
                const isOpen = openProfile === p.id;
                return (
                  <div key={p.id} className="border border-surface-700/40 rounded-xl overflow-hidden bg-surface-800/30 transition-all hover:border-surface-600/60">
                    <button
                      onClick={() => setOpenProfile(isOpen ? null : p.id)}
                      className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-surface-700/30 transition"
                    >
                      <span className="text-[10px] font-bold bg-mandy-500/20 text-mandy-300 px-2 py-0.5 rounded-md border border-mandy-500/30 tracking-wider">{p.badge}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-bold text-surface-100">{p.slug}</span>
                        <span className="text-xs text-surface-500 ml-2 font-mono">{p.name}</span>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-surface-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-6 space-y-5 border-t border-surface-700/30 pt-5 animate-in fade-in">
                        {/* Semántica */}
                        <div>
                          <h5 className="text-xs font-bold text-surface-500 uppercase tracking-widest mb-2">Semántica</h5>
                          <p className="text-sm text-surface-300">{p.semantics}</p>
                        </div>
                        {/* Motor */}
                        <div>
                          <h5 className="text-xs font-bold text-surface-500 uppercase tracking-widest mb-2">Motor</h5>
                          <p className="text-sm text-surface-300">{p.engine}</p>
                        </div>
                        {/* Operadores */}
                        <div>
                          <h5 className="text-xs font-bold text-surface-500 uppercase tracking-widest mb-2">Operadores</h5>
                          <div className="flex flex-wrap gap-2">
                            {p.operators.map((op, i) => (
                              <code key={i} className="text-xs bg-surface-900/60 px-2.5 py-1 rounded-md border border-surface-700/40 text-emerald-300">{op}</code>
                            ))}
                          </div>
                        </div>
                        {/* Axiomas */}
                        {p.axioms && (
                          <div>
                            <h5 className="text-xs font-bold text-surface-500 uppercase tracking-widest mb-2">Axiomas del Sistema</h5>
                            <BulletList items={p.axioms} />
                          </div>
                        )}
                        {/* Ejemplo válido */}
                        <div>
                          <h5 className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-2">✓ Ejemplo Válido</h5>
                          <CopyBlock code={p.validExample} />
                        </div>
                        {/* Ejemplo inválido */}
                        <div>
                          <h5 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2">✗ Ejemplo Inválido / Contramodelo</h5>
                          <CopyBlock code={p.invalidExample} />
                        </div>
                        {/* Límites */}
                        <div>
                          <h5 className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2">⚠ Limitaciones del Motor</h5>
                          <BulletList items={p.limits} />
                        </div>
                        {/* Download */}
                        <div className="flex gap-2 pt-2">
                          <a
                            href={`/downloads/st/${String(PROFILES.indexOf(p) + 1).padStart(2, '0')}-${p.id}.st`}
                            download
                            className="flex items-center gap-1.5 text-[10px] font-bold text-mandy-400 hover:text-mandy-300 bg-mandy-500/10 border border-mandy-500/20 px-3 py-1.5 rounded-lg transition"
                          >
                            <Download className="w-3 h-3" /> Script básico
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Text Layer ── */}
          <section>
            <SectionTitle id="text-layer" icon={Sigma} title="Text Layer" />
            <div className="space-y-4">
              <p className="text-surface-300 text-sm leading-relaxed">
                El Text Layer extiende ST para vincular lógica formal con documentos en
                lenguaje natural. Permite formalizar pasajes, declarar claims verificables
                y agregar metadatos de soporte y confianza.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                  <h5 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">1. Passage</h5>
                  <CopyBlock code={'let p1 = passage([[doc.md#clause-1]])'} />
                  <p className="text-xs text-surface-400">Referencia a un ancla de documento externo.</p>
                </div>
                <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                  <h5 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">2. Formalize</h5>
                  <CopyBlock code={'let f1 = formalize p1 as (P & Q)'} />
                  <p className="text-xs text-surface-400">Mapea el pasaje a una fórmula lógica.</p>
                </div>
                <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                  <h5 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">3. Claim</h5>
                  <CopyBlock code={'claim c1 = f1'} />
                  <p className="text-xs text-surface-400">Declara un claim verificable a partir de la formalización.</p>
                </div>
                <div className="bg-surface-800/60 border border-surface-700/40 rounded-xl p-5">
                  <h5 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">4. Verificar</h5>
                  <CopyBlock code={'derive R from {c1}\ncheck valid c1'} />
                  <p className="text-xs text-surface-400">Usa claims en cualquier comando estándar de ST.</p>
                </div>
              </div>
              <div className="bg-surface-800/40 border border-surface-700/40 rounded-xl p-5">
                <h5 className="text-xs font-bold text-surface-500 uppercase tracking-widest mb-3">Metadatos opcionales</h5>
                <CopyBlock code={'support c1 <- "fuente académica"\nconfidence c1 = 0.85\ncontext c1 = "Cláusula de privacidad del contrato"'} />
              </div>
            </div>
          </section>

          {/* ── Limits ── */}
          <section>
            <SectionTitle id="limits" icon={ShieldAlert} title="Limitaciones Conocidas" />
            <div className="space-y-4">
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5">
                <p className="text-sm text-surface-300 mb-4">
                  ST es un motor educativo y de prototipado. A continuación las limitaciones
                  técnicas verificadas contra el motor real:
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="bg-surface-900/50 rounded-lg p-4 border border-surface-700/30">
                    <h5 className="text-xs font-bold text-amber-400 mb-2">Clásica Proposicional</h5>
                    <BulletList items={['truth_table: máx. 20 variables', 'Derivación BFS: máx. 200 iteraciones']} />
                  </div>
                  <div className="bg-surface-900/50 rounded-lg p-4 border border-surface-700/30">
                    <h5 className="text-xs font-bold text-amber-400 mb-2">Primer Orden (FOL)</h5>
                    <BulletList items={['Tableau limitado a 50 pasos de profundidad', 'Semi-decidible: retorna unknown, no invalid']} />
                  </div>
                  <div className="bg-surface-900/50 rounded-lg p-4 border border-surface-700/30">
                    <h5 className="text-xs font-bold text-amber-400 mb-2">Modal / Deóntica / Epistémica / Temporal</h5>
                    <BulletList items={['Tableau: máx. 200 nodos', 'LTL: operador U (until) con soporte limitado', 'S5: espacio crece rápido con frame universal']} />
                  </div>
                  <div className="bg-surface-900/50 rounded-lg p-4 border border-surface-700/30">
                    <h5 className="text-xs font-bold text-amber-400 mb-2">Belnap (4 valores)</h5>
                    <BulletList items={[
                      'P -> P NO es válida (N -> N = N)',
                      'P | !P NO es válida (N | N = N)',
                      'Ex falso quodlibet falla: (P & !P) -> Q no es válida'
                    ]} />
                  </div>
                  <div className="bg-surface-900/50 rounded-lg p-4 border border-surface-700/30">
                    <h5 className="text-xs font-bold text-amber-400 mb-2">Aristotélica</h5>
                    <BulletList items={['Solo 19 de 24 silogismos (faltan formas subalternadas)', 'Requiere exactamente 2 premisas categóricas', 'Falacias de forma pueden no detectarse']} />
                  </div>
                  <div className="bg-surface-900/50 rounded-lg p-4 border border-surface-700/30">
                    <h5 className="text-xs font-bold text-amber-400 mb-2">Probabilística</h5>
                    <BulletList items={['Muestreo discreto (5 o 3 puntos)', 'Asume independencia entre átomos', 'truth_table mezcla columnas booleanas y probabilísticas']} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Validation ── */}
          <section>
            <SectionTitle id="validation" icon={Info} title="Validación Automatizada" />
            <div className="space-y-4">
              <p className="text-surface-300 text-sm leading-relaxed">
                Cada ejemplo de esta documentación se valida automáticamente contra el motor ST real.
                El script <code className="text-mandy-400">npm run validate:st-docs</code> ejecuta
                todos los archivos <code className="text-mandy-400">.st</code> de la carpeta de
                descargas y verifica que el motor no lance errores.
              </p>
              <CopyBlock
                label="Ejecutar validación"
                code="npm run validate:st-docs\n# Ejecuta los 22 scripts .st contra el CLI de ST\n# Salida esperada: todos PASS"
              />
              <div className="bg-surface-800/40 border border-surface-700/40 rounded-xl p-5">
                <h5 className="text-xs font-bold text-surface-500 uppercase tracking-widest mb-3">Scripts de validación disponibles</h5>
                <div className="grid gap-2 sm:grid-cols-2 text-xs text-surface-400 font-mono">
                  <span>01 – Clásica proposicional</span>
                  <span>02 – Primer orden (FOL)</span>
                  <span>03 – Modal K</span>
                  <span>04 – Deóntica estándar</span>
                  <span>05 – Epistémica S5</span>
                  <span>06 – Intuicionista</span>
                  <span>07 – Temporal LTL</span>
                  <span>08 – Aristotélica</span>
                  <span>09 – Paraconsistente Belnap</span>
                  <span>10 – Probabilística</span>
                  <span>11 – Text Layer</span>
                  <span>12–22 – Exhaustivos por perfil</span>
                </div>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t border-surface-700/30 pt-8 pb-16 text-center">
            <p className="text-xs text-surface-500">
              Documentación generada y validada automáticamente contra ST v1.5.2.
            </p>
            <div className="flex justify-center gap-4 mt-4">
              <Link href="/docs" className="text-xs text-mandy-400 hover:text-mandy-300 transition">
                ← Manual principal
              </Link>
              <a href="https://github.com/stevenvo780/ST" target="_blank" rel="noopener noreferrer" className="text-xs text-surface-400 hover:text-mandy-400 transition flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> GitHub
              </a>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
