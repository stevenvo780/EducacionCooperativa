'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, BookOpen, ChevronRight, Download, ExternalLink,
  FlaskConical, Info, Layers3, Scale, ShieldAlert, Sigma, Terminal
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

/* ──────────── Data: navigation ──────────── */
const NAV: NavItem[] = [
  { id: 'intro', label: 'Introducción' },
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
