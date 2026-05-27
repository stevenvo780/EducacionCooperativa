'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { LazyMotion, domAnimation, m, useReducedMotion, type Transition } from 'framer-motion';
import { ELENXOS_BRAND, PRODUCT_BRAND } from '@/lib/branding';
import {
  ArrowRight, BookOpen, Brain, Check, ChevronDown, Cloud,
  Code2, Edit3, ExternalLink, FileText, FlaskConical, FolderOpen, GraduationCap,
  HardDrive, Kanban, Layers, Lock, Menu, MonitorSmartphone, Network,
  Pencil, Scale, Shield, Sparkles, Terminal, Users, X, Zap
} from 'lucide-react';

const STRunner = dynamic(() => import('@/components/STRunner'), { ssr: false, loading: () => <div className="h-[420px] bg-surface-800/60 rounded-xl animate-pulse" /> });
const MarkdownPreview = dynamic(() => import('@/components/mosaic-editor/MarkdownPreview').then(m => ({ default: m.MarkdownPreview })), { ssr: false, loading: () => <div className="h-[420px] bg-surface-800/60 rounded-xl animate-pulse" /> });
const FormalizerPlayground = dynamic(() => import('@/components/FormalizerPlayground'), { ssr: false, loading: () => <div className="h-[500px] bg-surface-800/60 rounded-xl animate-pulse" /> });

const ST_DEMO = `logic classical.propositional

axiom a1 : P -> Q
axiom a2 : P

derive Q from {a1, a2}

check valid ((P -> Q) -> (!Q -> !P))

truth_table (P & Q) -> P
`;

const ST_DEEP_DEMO = `logic classical.propositional

// Modus Tollens
axiom imp : P -> Q
axiom neg : !Q

derive !P from {imp, neg}

// Contrapositiva — tautología
check valid ((P -> Q) -> (!Q -> !P))

// Equivalencia material
truth_table (P -> Q) <-> (!P | Q)
`;

const MD_DEMO = `# Crítica de la razón pura — §B75

> *"Los pensamientos sin contenido son vacíos,*
> *las intuiciones sin conceptos son ciegas."*

## Formalización

| Proposición             | Variable |
|-------------------------|----------|
| Pensamiento con contenido | $P$   |
| Intuición con concepto    | $Q$   |

**Tesis**: el conocimiento requiere la síntesis
de ambas facultades:

$$P \\wedge Q \\rightarrow K$$

---

### Diagrama del argumento

\`\`\`mermaid
graph LR
  A[Intuición Q] --> C{Síntesis}
  B[Concepto P] --> C
  C --> D[Conocimiento K]
\`\`\`
`;

function LandingPage() {
  const { user, loading } = useAuth();
  const reduceMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const fast: Transition = { duration: reduceMotion ? 0.01 : 0.3, ease: 'easeOut' };
  const stagger = (i: number): Transition => ({
    delay: reduceMotion ? 0 : i * 0.08,
    duration: reduceMotion ? 0.01 : 0.25,
    ease: 'easeOut'
  });

  const pillars = [
    {
      icon: Code2,
      accent: 'from-rose-500 to-pink-600',
      title: 'ST — Lenguaje de Lógica Formal',
      desc: 'El primer lenguaje ejecutable diseñado para la investigación académica rigurosa. 11 perfiles lógicos — desde la proposicional clásica hasta la paraconsistente — con derivaciones verificables, contramodelos y tablas de verdad.',
      details: [
        'Silogística aristotélica, modal K, deóntica, epistémica S5',
        'Lógica intuicionista, temporal LTL, probabilística',
        'Text Layer: vincula pasajes naturales con formalizaciones',
        'REPL interactivo y CLI para scripting automatizado'
      ]
    },
    {
      icon: Edit3,
      accent: 'from-violet-500 to-purple-600',
      title: 'Editor Académico de Nueva Generación',
      desc: 'Markdown con superpoderes: LaTeX nativo, diagramas Mermaid, hojas de cálculo integradas, linter en tiempo real, galería de snippets y vista previa lado a lado.',
      details: [
        'KaTeX nativo para ecuaciones, tablas GFM y bloques de código',
        'Linter en tiempo real: resalta errores ortográficos y de estilo',
        'Galería de snippets: plantillas para teoremas, pruebas, tablas y más',
        'Vista previa renderizada en vivo, diagramas Mermaid y ASCII-art',
        'Corrector ortográfico Hunspell integrado (es)'
      ]
    },
    {
      icon: FlaskConical,
      accent: 'from-emerald-500 to-teal-600',
      title: 'Formalización y Análisis Semántico',
      desc: 'Un ecosistema completo para pasar de la prosa al rigor: NL Linter que detecta ambigüedades y falacias, Mesa Semántica que mapea conceptos, y un pipeline NLP que genera código ST verificable.',
      details: [
        'NL Linter: señala vaguedad, ambigüedad, falacias y premisas ocultas',
        'Mesa Semántica: mapa navegable de todos los conceptos del workspace',
        'Pipeline NLP de 6 etapas: desde el texto natural hasta la emisión ST',
        'Text Layer: vincula cada párrafo con su formalización en .st',
        'Modo LLM/SLM para análisis de textos técnicos densos'
      ]
    },
    {
      icon: Terminal,
      accent: 'from-sky-500 to-blue-600',
      title: 'Terminales Linux en la Nube',
      desc: 'Máquinas virtuales completas accesibles desde el navegador. Ejecuta ST, Python, LaTeX, compiladores o cualquier herramienta de investigación sin instalar nada.',
      details: [
        'Sesiones persistentes por workspace',
        'Múltiples terminales simultáneas',
        'Workers dedicados para plan Enterprise',
        'Acceso root completo al entorno'
      ]
    },
    {
      icon: Users,
      accent: 'from-amber-500 to-orange-600',
      title: 'Colaboración Académica Real',
      desc: 'Workspaces compartidos con invitación, tableros Kanban, gestión de archivos en equipo y sincronización en tiempo real entre todos los miembros.',
      details: [
        'Duplicar, fusionar y renombrar workspaces completos',
        'Tableros Kanban para gestión de proyectos de investigación',
        'Explorador de archivos con carpetas, favoritos y drag & drop',
        'Perfiles de miembros y control de acceso por roles'
      ]
    },
    {
      icon: Brain,
      accent: 'from-fuchsia-500 to-pink-600',
      title: 'Agora AI — Asistente de Investigación',
      desc: 'Un asistente IA que entiende tu workspace, tu investigación y la lógica formal. Te ayuda a redactar, formalizar, corregir argumentos y generar código ST — directamente en el editor.',
      details: [
        'Contexto completo del workspace, documentos y archivos .st activos',
        'Genera, corrige y explica scripts ST a partir de tus indicaciones',
        'Galería de snippets: ejemplos listos para silogismos, tablas de verdad, contramodelos',
        'Múltiples proveedores: OpenAI, Anthropic, Google',
        'Sugiere formalizaciones a partir de tu prosa académica'
      ]
    }
  ];

  const capabilities = [
    { icon: FileText, label: 'Markdown + LaTeX' },
    { icon: Code2, label: '11 perfiles lógicos' },
    { icon: FlaskConical, label: 'Formalización NLP' },
    { icon: Terminal, label: 'Terminales cloud' },
    { icon: Kanban, label: 'Tableros Kanban' },
    { icon: FolderOpen, label: 'Explorador de archivos' },
    { icon: Brain, label: 'Asistente IA' },
    { icon: Network, label: 'Mesa Semántica' },
    { icon: Layers, label: 'Text Layer ST' },
    { icon: Scale, label: 'NL Linter' },
    { icon: Sparkles, label: 'Galería de snippets' },
    { icon: Cloud, label: 'Sync en tiempo real' },
    { icon: MonitorSmartphone, label: 'PWA multiplataforma' }
  ];

  const profiles = [
    { name: 'classical.propositional', desc: 'Proposicional clásica' },
    { name: 'classical.first_order', desc: 'Primer orden con cuantificadores' },
    { name: 'modal.k', desc: 'Lógica modal □ ◇' },
    { name: 'aristotelian.syllogistic', desc: 'Silogística aristotélica' },
    { name: 'deontic.standard', desc: 'Razonamiento normativo' },
    { name: 'epistemic.s5', desc: 'Lógica del conocimiento' },
    { name: 'intuitionistic.propositional', desc: 'Sin tercero excluido' },
    { name: 'temporal.ltl', desc: 'Lógica temporal' },
    { name: 'probabilistic.basic', desc: 'Razonamiento probabilístico' },
    { name: 'paraconsistent.belnap', desc: 'Tolerante a inconsistencia' },
    { name: 'arithmetic', desc: 'Aritmética verificable' }
  ];

  const workflow = [
    { step: '01', title: 'Escribe tu texto', desc: 'Redacta en Markdown con toda la potencia académica: LaTeX, tablas, diagramas, referencias.', icon: Pencil },
    { step: '02', title: 'Formaliza', desc: 'El motor NLP extrae la estructura lógica o escribe directamente en ST. El Text Layer vincula cada pasaje con su formalización.', icon: Code2 },
    { step: '03', title: 'Verifica', desc: 'ST ejecuta derivaciones, genera contramodelos, tablas de verdad y demuestra la validez o la refuta.', icon: FlaskConical },
    { step: '04', title: 'Colabora y publica', desc: 'Comparte el workspace con tu equipo, recibe feedback en tiempo real y exporta resultados verificados.', icon: Users }
  ];

  const plans = [
    {
      name: 'Gratuito',
      price: 'Gratis',
      sub: 'Para siempre',
      features: ['Editor Markdown + ST completo', 'Documentos ilimitados', 'Workspace personal', 'Formalización automática', '50 MB de almacenamiento'],
      highlight: false
    },
    {
      name: 'Básico',
      price: '$30.000',
      sub: 'COP / mes',
      features: ['Todo lo del plan Gratuito', 'Workspaces colaborativos', 'Tableros Kanban', 'Soporte por email', '1 GB de almacenamiento'],
      highlight: false
    },
    {
      name: 'Pro',
      price: '$80.000',
      sub: 'COP / mes',
      features: ['Todo lo del plan Básico', 'Terminales ilimitadas', 'Workers compartidos', 'Agora AI completo', 'Soporte prioritario', '1 GB de almacenamiento'],
      highlight: true
    },
    {
      name: 'Enterprise',
      price: '$240.000',
      sub: 'COP / mes',
      features: ['Todo lo del plan Pro', 'Máquina y terminal dedicadas', 'Worker exclusivo', 'Soporte personalizado', '10 GB de almacenamiento'],
      highlight: false
    }
  ];

  const ctaHref = user ? '/dashboard' : '/login';
  const ctaLabel = user ? 'Ir a mis espacios' : 'Comenzar gratis';

  return (
    <LazyMotion features={domAnimation}>
    <div className="min-h-[100dvh] flex flex-col bg-surface-900 text-white overflow-x-hidden">

      {/* ══════════════ Header ══════════════ */}
      <header className="sticky top-0 z-50 w-full border-b border-surface-600/50 bg-surface-900/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <BookOpen className="w-6 h-6 text-mandy-500" />
            <span className="text-gradient-mandy">Agora</span>
          </div>
          <nav aria-label="Navegación principal" className="hidden md:flex items-center gap-6 text-sm text-surface-400">
            <a href="#vision" className="hover:text-mandy-400 transition">Visión</a>
            <a href="#pillars" className="hover:text-mandy-400 transition">Plataforma</a>
            <a href="#st" className="hover:text-mandy-400 transition">Lenguaje ST</a>
            <a href="#formalizer" className="hover:text-mandy-400 transition">Formalizador</a>
            <a href="#pricing" className="hover:text-mandy-400 transition">Planes</a>
            <Link href="/docs" className="hover:text-mandy-400 transition">Docs</Link>
            <Link href="/docs/st" className="hover:text-mandy-400 transition">Docs ST</Link>
            <a href={ELENXOS_BRAND.homeUrl} target="_blank" rel="noopener noreferrer" className="hover:text-mandy-400 transition">
              Elenxos
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <nav aria-label="Cuenta" className="flex items-center gap-4">
              {loading ? (
                <span className="text-sm text-surface-400">Cargando…</span>
              ) : user ? (
                <Link href="/dashboard" className="text-sm font-medium bg-mandy-500 text-white px-4 py-2 rounded-full hover:bg-mandy-600 transition">
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/login" className="text-sm font-medium text-surface-300 hover:text-mandy-400 transition hidden sm:inline">
                    Iniciar Sesión
                  </Link>
                  <Link href="/login" className="text-sm font-medium bg-gradient-mandy text-white px-4 py-2 rounded-full hover:opacity-90 transition">
                    Empezar gratis
                  </Link>
                </>
              )}
            </nav>
            <button
              type="button"
              aria-label="Abrir menú"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen(o => !o)}
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-surface-300 hover:text-white hover:bg-surface-700/60 transition"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav
            id="mobile-nav"
            aria-label="Menú móvil"
            className="md:hidden border-t border-surface-700/50 bg-surface-900/95 px-4 py-4 flex flex-col gap-1"
          >
            <a href="#vision" onClick={() => setMenuOpen(false)} className="text-sm text-surface-300 hover:text-mandy-400 transition py-2 px-3 rounded-lg hover:bg-surface-800/60">Visión</a>
            <a href="#pillars" onClick={() => setMenuOpen(false)} className="text-sm text-surface-300 hover:text-mandy-400 transition py-2 px-3 rounded-lg hover:bg-surface-800/60">Plataforma</a>
            <a href="#st" onClick={() => setMenuOpen(false)} className="text-sm text-surface-300 hover:text-mandy-400 transition py-2 px-3 rounded-lg hover:bg-surface-800/60">Lenguaje ST</a>
            <a href="#formalizer" onClick={() => setMenuOpen(false)} className="text-sm text-surface-300 hover:text-mandy-400 transition py-2 px-3 rounded-lg hover:bg-surface-800/60">Formalizador</a>
            <a href="#pricing" onClick={() => setMenuOpen(false)} className="text-sm text-surface-300 hover:text-mandy-400 transition py-2 px-3 rounded-lg hover:bg-surface-800/60">Planes</a>
            <Link href="/docs" onClick={() => setMenuOpen(false)} className="text-sm text-surface-300 hover:text-mandy-400 transition py-2 px-3 rounded-lg hover:bg-surface-800/60">Docs</Link>
            <Link href="/docs/st" onClick={() => setMenuOpen(false)} className="text-sm text-surface-300 hover:text-mandy-400 transition py-2 px-3 rounded-lg hover:bg-surface-800/60">Docs ST</Link>
            <a href={ELENXOS_BRAND.homeUrl} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)} className="text-sm text-surface-300 hover:text-mandy-400 transition py-2 px-3 rounded-lg hover:bg-surface-800/60">Elenxos</a>
            {!loading && !user && (
              <Link href="/login" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-surface-300 hover:text-mandy-400 transition py-2 px-3 rounded-lg hover:bg-surface-800/60 sm:hidden">
                Iniciar Sesión
              </Link>
            )}
          </nav>
        )}
      </header>

      <main className="flex-1">

        {/* ══════════════ HERO ══════════════ */}
        <section className="relative py-12 lg:py-20 overflow-hidden">
          {/* Background decorations */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-mandy-500/5 rounded-full blur-3xl" />
            <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-violet-500/5 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-mandy-500/3 to-transparent rounded-full" />
          </div>

          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-5xl mx-auto text-center space-y-8">
              <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={fast}>
                <div className="inline-flex items-center gap-2 bg-mandy-500/10 border border-mandy-500/20 text-mandy-400 text-sm px-4 py-1.5 rounded-full mb-6">
                  <Sparkles className="w-4 h-4" />
                  Lógica formal ejecutable · Markdown académico · Terminales cloud
                </div>
              </m.div>

              <m.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...fast, delay: 0.1 }}
                className="text-3xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] break-words"
              >
                El nuevo estándar para{' '}
                <span className="text-gradient-mandy">investigación rigurosa</span>
              </m.h1>

              <m.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...fast, delay: 0.2 }}
                className="text-lg lg:text-xl text-surface-300 leading-relaxed max-w-3xl mx-auto"
              >
                Agora une la escritura académica en Markdown con <strong className="text-white">ST</strong>, el primer lenguaje
                ejecutable de lógica formal. Para filósofos, científicos, investigadores y académicos que
                necesitan formalizar, verificar y colaborar — desde cualquier navegador, sin instalar nada.
              </m.p>

              <m.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...fast, delay: 0.3 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4"
              >
                <Link href={ctaHref}>
                  <button className="flex items-center gap-2 bg-gradient-mandy text-white px-8 py-4 rounded-xl font-semibold text-lg hover:opacity-90 transition shadow-lg shadow-mandy-500/25 transform hover:-translate-y-0.5">
                    {ctaLabel}
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </Link>
                <Link href="/docs/st" className="text-surface-400 font-medium hover:text-mandy-400 transition px-6 py-4 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Documentación ST
                </Link>
              </m.div>

              <m.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...fast, delay: 0.35 }}
                className="flex flex-wrap items-center justify-center gap-2 text-sm text-surface-400"
              >
                <span>{ELENXOS_BRAND.ownershipLine}</span>
                <a
                  href={ELENXOS_BRAND.homeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-mandy-400 hover:text-mandy-300 transition"
                >
                  Conoce {ELENXOS_BRAND.name}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </m.div>

              {/* Trust badges */}
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ ...fast, delay: 0.4 }}
                className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2 text-surface-500 text-sm"
              >
                <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Cifrado end-to-end</span>
                <span className="flex items-center gap-1.5"><Terminal className="w-3.5 h-3.5" /> Terminales Linux</span>
                <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Sin instalación</span>
                <span className="flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5" /> Hecho para académicos</span>
              </m.div>
            </div>

            {/* Code demo panels */}
            <m.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...fast, delay: 0.5 }}
              className="mt-16 max-w-5xl mx-auto"
            >
              <div className="grid lg:grid-cols-2 gap-4">
                {/* ST Runner — live interactive */}
                <div className="min-w-0 rounded-xl border border-surface-600/60 bg-surface-800/80 backdrop-blur overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-surface-700/60 bg-surface-800/50">
                    <Code2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-xs text-surface-400 font-mono truncate">Motor ST — Pruébalo en vivo</span>
                    <span className="ml-auto text-[10px] text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded-full font-medium shrink-0">Interactivo</span>
                  </div>
                  <div className="h-[420px] overflow-hidden">
                    <STRunner initialCode={ST_DEMO} autoRun height="100%" initialOutputHeight={150} className="rounded-none border-0" />
                  </div>
                </div>
                {/* Markdown Preview — live rendered */}
                <div className="min-w-0 rounded-xl border border-surface-600/60 bg-surface-800/80 backdrop-blur overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-surface-700/60 bg-surface-800/50">
                    <FileText className="w-4 h-4 text-violet-400 shrink-0" />
                    <span className="text-xs text-surface-400 font-mono truncate">Vista previa Markdown — KaTeX + Mermaid</span>
                    <span className="ml-auto text-[10px] text-violet-400/80 bg-violet-500/10 px-2 py-0.5 rounded-full font-medium shrink-0">Renderizado</span>
                  </div>
                  <div className="h-[420px] overflow-y-auto overflow-x-hidden p-5 prose prose-invert prose-sm max-w-none">
                    <MarkdownPreview content={MD_DEMO} />
                  </div>
                </div>
              </div>
            </m.div>

            {/* Scroll hint */}
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ ...fast, delay: 0.7 }}
              className="flex justify-center mt-12"
            >
              <a href="#vision" className="text-surface-600 hover:text-surface-400 transition animate-bounce">
                <ChevronDown className="w-6 h-6" />
              </a>
            </m.div>
          </div>
        </section>

        {/* ══════════════ VISION / MANIFESTO ══════════════ */}
        <section id="vision" className="py-24 bg-surface-800/30 border-y border-surface-700/30">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <m.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={fast}
                className="space-y-8"
              >
                <div className="flex items-center gap-3 text-mandy-400 text-sm font-medium uppercase tracking-widest">
                  <span className="w-8 h-px bg-mandy-500/50" />
                  Manifiesto
                </div>
                <h2 className="text-3xl lg:text-5xl font-bold leading-tight">
                  La academia necesita herramientas que estén a la altura de sus preguntas
                </h2>
                <div className="grid md:grid-cols-2 gap-8 text-surface-300 text-lg leading-relaxed">
                  <div className="space-y-4">
                    <p>
                      Filósofos, científicos sociales, investigadores en humanidades, lingüistas,
                      matemáticos, teólogos — toda disciplina que construya conocimiento sobre
                      argumentos necesita herramientas que vayan más allá del procesador de texto.
                    </p>
                    <p>
                      <strong className="text-white">Agora cambia las reglas.</strong> Un editor Markdown con
                      LaTeX, diagramas y tablas. Un motor de lógica formal que verifica derivaciones.
                      Terminales en la nube. Colaboración en tiempo real. Todo en el navegador.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <p>
                      No se trata de reemplazar la prosa académica con código, sino de
                      <em> darle a cada argumento la posibilidad de ser verificado formalmente</em>.
                      El Text Layer vincula pasajes de tu texto con sus formalizaciones en ST,
                      creando un puente entre el lenguaje natural y la lógica simbólica.
                    </p>
                    <p>
                      Markdown para la expresión. ST para la verificación. La nube para la colaboración.
                      Ese es el estándar que proponemos para toda la academia.
                    </p>
                  </div>
                </div>
              </m.div>
            </div>
          </div>
        </section>

        {/* ══════════════ CAPABILITIES RIBBON ══════════════ */}
        <section className="py-12 border-b border-surface-700/30 overflow-hidden">
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap justify-center gap-3">
              {capabilities.map((cap, i) => (
                <m.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={stagger(i)}
                  className="flex items-center gap-2 bg-surface-800/60 border border-surface-700/50 text-surface-300 text-sm px-4 py-2 rounded-full hover:border-mandy-500/30 hover:text-mandy-300 transition"
                >
                  <cap.icon className="w-4 h-4" />
                  {cap.label}
                </m.div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════ PILARES DE LA PLATAFORMA ══════════════ */}
        <section id="pillars" className="py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16 space-y-4">
              <m.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={fast}>
                <h2 className="text-3xl lg:text-4xl font-bold">Seis pilares, un ecosistema</h2>
                <p className="text-surface-400 max-w-2xl mx-auto text-lg mt-4">
                  Cada componente de Agora fue diseñado para integrarse con los demás. El resultado es una plataforma
                  donde investigar, formalizar y colaborar son parte del mismo flujo de trabajo.
                </p>
              </m.div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {pillars.map((pillar, i) => (
                <m.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={stagger(i)}
                  className="group bg-surface-800/40 border border-surface-700/50 rounded-2xl p-8 hover:border-surface-600/80 transition-all hover:bg-surface-800/60"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${pillar.accent} flex items-center justify-center text-white mb-6 shadow-lg group-hover:scale-105 transition-transform`}>
                    <pillar.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{pillar.title}</h3>
                  <p className="text-surface-400 leading-relaxed mb-5">{pillar.desc}</p>
                  <ul className="space-y-2">
                    {pillar.details.map((detail, di) => (
                      <li key={di} className="flex items-start gap-2 text-surface-400 text-sm">
                        <Check className="w-3.5 h-3.5 text-mandy-500 mt-0.5 shrink-0" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </m.div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════ ST DEEP DIVE ══════════════ */}
        <section id="st" className="py-24 bg-surface-800/30 border-y border-surface-700/30">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="grid lg:grid-cols-2 gap-12 items-start">
                {/* Left: explanation */}
                <m.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={fast}
                  className="space-y-8"
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-mandy-400 text-sm font-medium uppercase tracking-widest">
                      <span className="w-8 h-px bg-mandy-500/50" />
                      Motor de Lógica Formal
                    </div>
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold break-words">
                      ST: Symbolic Theory Language
                    </h2>
                    <p className="text-surface-300 text-lg leading-relaxed">
                      ST no es solo un verificador — es un lenguaje completo para el razonamiento formal,
                      pensado para académicos de cualquier disciplina. Declara axiomas, ejecuta derivaciones,
                      genera tablas de verdad y busca contramodelos en un archivo <code className="text-mandy-300 bg-mandy-500/10 px-1.5 py-0.5 rounded text-sm">.st</code>.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">11 perfiles lógicos</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {profiles.map((p, i) => (
                        <span key={i} className="inline-flex items-center bg-surface-800/60 border border-surface-700/40 rounded-md px-2.5 py-1 text-xs" title={p.desc}>
                          <code className="text-emerald-400 font-mono">{p.name}</code>
                        </span>
                      ))}
                    </div>
                    <p className="text-surface-500 text-sm">Desde silogística aristotélica hasta lógica paraconsistente, temporal y probabilística.</p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link href="/docs/st" className="inline-flex items-center gap-2 bg-mandy-500/10 border border-mandy-500/30 text-mandy-400 px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-mandy-500/20 transition">
                      <BookOpen className="w-4 h-4" />
                      Documentación completa
                    </Link>
                    <a
                      href="https://www.npmjs.com/package/@stevenvo780/st-lang"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-surface-700/50 border border-surface-600/50 text-surface-300 px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-surface-700 transition"
                    >
                      <Zap className="w-4 h-4" />
                      npm: @stevenvo780/st-lang
                    </a>
                  </div>
                </m.div>

                {/* Right: interactive code block */}
                <m.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={fast}
                  className="space-y-4"
                >
                  <div className="rounded-xl border border-surface-600/60 bg-surface-800/80 backdrop-blur overflow-hidden shadow-2xl">
                    <div className="h-[460px]">
                      <STRunner initialCode={ST_DEEP_DEMO} autoRun height="100%" initialOutputHeight={150} className="rounded-none border-0" />
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-emerald-300 font-medium text-sm">Todo verificable, todo reproducible</p>
                        <p className="text-surface-400 text-sm mt-1">
                          Cada resultado se puede ejecutar localmente con <code className="text-emerald-300/80">st run</code>,
                          en el REPL integrado de Agora, o vía la API de npm para integraciones programáticas.
                        </p>
                      </div>
                    </div>
                  </div>
                </m.div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════ FORMALIZADOR LIVE ══════════════ */}
        <section id="formalizer" className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <m.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={fast}
                className="space-y-8"
              >
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-3 text-mandy-400 text-sm font-medium uppercase tracking-widest">
                    <span className="w-8 h-px bg-mandy-500/50" />
                    Formalización Automática
                    <span className="w-8 h-px bg-mandy-500/50" />
                  </div>
                  <h2 className="text-3xl lg:text-4xl font-bold">Escribe en prosa, obtén lógica formal</h2>
                  <p className="text-surface-400 max-w-3xl mx-auto text-lg">
                    Pega cualquier argumento en lenguaje natural. El motor NLP de Agora lo analiza, detecta ambigüedades con el NL Linter y genera código ST verificable — todo en tu navegador.
                  </p>
                </div>

                {/* Live Formalizer */}
                <div className="rounded-2xl border border-surface-600/60 bg-surface-800/80 backdrop-blur overflow-hidden shadow-2xl">
                  <div className="h-[520px]">
                    <FormalizerPlayground initialInput="Si todos los hombres son mortales y Sócrates es un hombre, entonces Sócrates es mortal. Sócrates es un hombre. Todos los hombres son mortales. Por lo tanto, Sócrates es mortal." hideSnippets />
                  </div>
                </div>

                {/* Feature cards */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { icon: FlaskConical, title: 'NL Linter', desc: 'Señala vaguedad, ambigüedad estructural, falacias informales y premisas ocultas antes de formalizar.', color: 'text-amber-400' },
                    { icon: Network, title: 'Mesa Semántica', desc: 'Mapa navegable de conceptos, proposiciones y relaciones de tu workspace con su formalización.', color: 'text-cyan-400' },
                    { icon: Layers, title: 'Text Layer', desc: 'Vincula cada párrafo Markdown con su bloque ST. El lector verifica cualquier afirmación sin salir de la prosa.', color: 'text-violet-400' },
                    { icon: Brain, title: 'Modo LLM', desc: 'Para textos densos, activa extracción semántica con OpenAI, Ollama u otros modelos.', color: 'text-fuchsia-400' }
                  ].map((card, i) => (
                    <m.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={stagger(i)}
                      className="bg-surface-800/40 border border-surface-700/40 rounded-xl p-5"
                    >
                      <card.icon className={`w-5 h-5 ${card.color} mb-3`} />
                      <h3 className="font-semibold text-white text-sm mb-1.5">{card.title}</h3>
                      <p className="text-surface-400 text-xs leading-relaxed">{card.desc}</p>
                    </m.div>
                  ))}
                </div>
              </m.div>
            </div>
          </div>
        </section>

        {/* ══════════════ HERRAMIENTAS INTERACTIVAS (MOCKUP) ══════════════ */}
        <section className="py-20 bg-surface-800/30 border-y border-surface-700/30">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto space-y-16">
              <m.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={fast} className="text-center space-y-4">
                <div className="flex items-center justify-center gap-3 text-mandy-400 text-sm font-medium uppercase tracking-widest">
                  <span className="w-8 h-px bg-mandy-500/50" />
                  Herramientas integradas
                  <span className="w-8 h-px bg-mandy-500/50" />
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold">Todo lo que necesitas, en un solo entorno</h2>
                <p className="text-surface-400 max-w-3xl mx-auto text-lg">
                  Cada herramienta está disponible dentro del editor. Aquí tienes una vista previa de lo que encontrarás al iniciar sesión.
                </p>
              </m.div>

              {/* ── Snippets Gallery mockup ── */}
              <m.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={fast} className="grid lg:grid-cols-[1fr_420px] gap-8 items-start">
                <div className="space-y-5">
                  <h3 className="text-2xl font-bold flex items-center gap-3">
                    <Code2 className="w-6 h-6 text-mandy-400" />
                    Galería de Snippets
                  </h3>
                  <p className="text-surface-400 leading-relaxed">
                    Biblioteca de plantillas verificadas listas para insertar: silogismos, tablas de verdad, demostraciones por contradicción, estructuras modales y más. Crea tus propios snippets o usa los predeterminados.
                  </p>
                  <ul className="space-y-2">
                    {['Silogismos aristotélicos formalizados', 'Tablas de verdad y tautologías clásicas', 'Pruebas por contradicción y contrapositiva', 'Estructuras modales, deónticas y epistémicas', 'Plantillas de investigación académica'].map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-surface-300 text-sm">
                        <Check className="w-3.5 h-3.5 text-mandy-500 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Mock snippet cards */}
                <div className="rounded-2xl border border-surface-600/60 bg-surface-800/80 backdrop-blur overflow-hidden shadow-xl">
                  <div className="flex items-center justify-between border-b border-surface-700/50 px-4 py-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-surface-300">Snippets ST</span>
                    <span className="text-[10px] text-surface-500">Vista previa</span>
                  </div>
                  <div className="p-3 space-y-2">
                    {[
                      { cat: 'ST', title: 'Modus Ponens', code: 'logic classical.propositional\naxiom p: P\naxiom p_implies_q: P -> Q\nderive q: Q by mp(p, p_implies_q)' },
                      { cat: 'ST', title: 'Silogismo Aristotélico', code: 'logic classical.first_order\naxiom all_men_mortal: forall x. (Man(x) -> Mortal(x))\naxiom socrates_man: Man(socrates)\nderive socrates_mortal: Mortal(socrates)' },
                      { cat: 'Math', title: 'Tabla de Verdad', code: 'logic classical.propositional\naxiom a: A\naxiom b: B\ntruth_table A, B, A -> B, A & B | ~A' },
                      { cat: 'ST', title: 'Reductio ad Absurdum', code: 'logic classical.propositional\nassume not_p: ~P\naxiom leads_to_q: ~P -> Q\naxiom leads_to_nq: ~P -> ~Q\nderive contradiction: Q & ~Q\nderive p: P by raa(not_p, contradiction)' },
                      { cat: 'Modal', title: 'Necesidad Modal K', code: 'logic modal.K\naxiom nec_p: □P\naxiom k_axiom: □(P -> Q)\nderive nec_q: □Q by K(k_axiom, nec_p)' }
                    ].map((s, i) => (
                      <m.div
                        key={i}
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={stagger(i)}
                        className="rounded-lg border border-surface-700/40 bg-surface-900/60 p-3 hover:border-mandy-500/30 transition cursor-pointer group"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-white group-hover:text-mandy-300 transition">{s.title}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-700/60 text-surface-400">{s.cat}</span>
                        </div>
                        <pre className="text-[11px] text-surface-500 font-mono leading-relaxed overflow-hidden max-h-12 whitespace-pre-wrap">{s.code}</pre>
                      </m.div>
                    ))}
                  </div>
                </div>
              </m.div>

              {/* ── Linter del Editor Markdown ── */}
              <m.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={fast} className="space-y-8">
                <div className="text-center space-y-3">
                  <h3 className="text-2xl lg:text-3xl font-bold flex items-center justify-center gap-3">
                    <FlaskConical className="w-7 h-7 text-amber-400" />
                    Linter académico en tiempo real
                  </h3>
                  <p className="text-surface-400 max-w-3xl mx-auto leading-relaxed">
                    El editor Markdown de Agora incluye <strong className="text-white">+30 reglas de linting</strong> que analizan tu texto mientras escribes: estructura, legibilidad, consistencia, accesibilidad y rigor académico. Cada error se marca en línea con sugerencias de corrección.
                  </p>
                </div>

                {/* Mock editor with inline linting */}
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Left: "Editor" with bad text and inline markers */}
                  <div className="rounded-2xl border border-surface-600/60 bg-surface-800/80 backdrop-blur overflow-hidden shadow-xl">
                    <div className="flex items-center justify-between border-b border-surface-700/50 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Edit3 className="w-3.5 h-3.5 text-surface-400" />
                        <span className="text-xs font-medium text-surface-300">ensayo-kant.md</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px]">
                        <span className="flex items-center gap-1 text-red-400">● 3 errores</span>
                        <span className="flex items-center gap-1 text-amber-400">● 4 alertas</span>
                        <span className="flex items-center gap-1 text-blue-400">● 2 info</span>
                      </div>
                    </div>
                    <div className="p-4 font-mono text-[12px] leading-[1.8] space-y-1">
                      {/* Line numbers + code with inline error highlights */}
                      <div className="flex gap-3">
                        <span className="text-surface-600 select-none w-5 text-right shrink-0">1</span>
                        <span><span className="text-red-400 underline decoration-wavy decoration-red-500/60"># Critica de la razón pura</span></span>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-surface-600 select-none w-5 text-right shrink-0">2</span>
                        <span className="text-surface-500"># Introducción</span>
                      </div>
                      <div className="flex gap-3 bg-red-500/5 -mx-4 px-4 border-l-2 border-red-500/40">
                        <span className="text-surface-600 select-none w-5 text-right shrink-0">3</span>
                        <span className="text-surface-300"><span className="text-red-300 underline decoration-wavy decoration-red-500/60" title="Múltiples h1 — solo debería haber uno">##</span> <span className="text-surface-300">Planteamiento del problema</span></span>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-surface-600 select-none w-5 text-right shrink-0">4</span>
                        <span className="text-surface-500" />
                      </div>
                      <div className="flex gap-3 bg-amber-500/5 -mx-4 px-4 border-l-2 border-amber-500/40">
                        <span className="text-surface-600 select-none w-5 text-right shrink-0">5</span>
                        <span className="text-surface-300">Kant propone que el conocimiento <span className="text-amber-300 underline decoration-wavy decoration-amber-500/60" title="Oración demasiado larga (+40 palabras)">empieza con la experiencia pero no todo conocimiento proviene de ella ya que existen formas a priori de la sensibilidad que estructuran nuestra percepción del mundo de manera necesaria y universal lo cual implica que no podemos conocer las cosas en sí mismas</span>.</span>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-surface-600 select-none w-5 text-right shrink-0">6</span>
                        <span className="text-surface-500" />
                      </div>
                      <div className="flex gap-3 bg-amber-500/5 -mx-4 px-4 border-l-2 border-amber-500/40">
                        <span className="text-surface-600 select-none w-5 text-right shrink-0">7</span>
                        <span className="text-surface-300">- Punto primero</span>
                      </div>
                      <div className="flex gap-3 bg-amber-500/5 -mx-4 px-4 border-l-2 border-amber-500/40">
                        <span className="text-surface-600 select-none w-5 text-right shrink-0">8</span>
                        <span className="text-surface-300"><span className="text-amber-300" title="Marcadores de lista mixtos: - vs *">*</span> Punto segundo</span>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-surface-600 select-none w-5 text-right shrink-0">9</span>
                        <span className="text-surface-300">+ Punto tercero</span>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-surface-600 select-none w-5 text-right shrink-0">10</span>
                        <span className="text-surface-500" />
                      </div>
                      <div className="flex gap-3 bg-blue-500/5 -mx-4 px-4 border-l-2 border-blue-500/40">
                        <span className="text-surface-600 select-none w-5 text-right shrink-0">11</span>
                        <span className="text-surface-300">Ver más en <span className="text-blue-300 underline decoration-wavy decoration-blue-500/60" title="URL sin formato de enlace">https://plato.stanford.edu/entries/kant</span></span>
                      </div>
                      <div className="flex gap-3 bg-red-500/5 -mx-4 px-4 border-l-2 border-red-500/40">
                        <span className="text-surface-600 select-none w-5 text-right shrink-0">12</span>
                        <span className="text-surface-300">Esto es <span className="text-red-300 underline decoration-wavy decoration-red-500/60" title="Paréntesis sin cerrar">muy importante (ver nota 3</span></span>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-surface-600 select-none w-5 text-right shrink-0">13</span>
                        <span className="text-surface-300"><span className="text-amber-300" title="Marcador TODO detectado">TODO:</span> revisar cita de B75</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Problems panel */}
                  <div className="rounded-2xl border border-surface-600/60 bg-surface-800/80 backdrop-blur overflow-hidden shadow-xl">
                    <div className="flex items-center justify-between border-b border-surface-700/50 px-4 py-2.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-surface-300">Problemas</span>
                      <span className="text-[10px] text-surface-500">9 diagnósticos</span>
                    </div>
                    <div className="p-3 space-y-1.5 max-h-[380px] overflow-y-auto">
                      {[
                        { sev: 'error', icon: '✕', msg: 'Múltiples encabezados h1 — un documento debería tener solo uno', line: 'L1, L2', rule: 'structure_multiple_h1', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
                        { sev: 'error', icon: '✕', msg: 'Salto de jerarquía: h1 → h3 (falta h2 intermedio)', line: 'L3', rule: 'structure_heading_hierarchy', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
                        { sev: 'error', icon: '✕', msg: 'Paréntesis sin cerrar: "(" abierto sin ")" correspondiente', line: 'L12', rule: 'academic_unclosed_brackets', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
                        { sev: 'warning', icon: '⚠', msg: 'Oración de 43 palabras — considere dividirla (máx. recomendado: 40)', line: 'L5', rule: 'readability_long_sentence', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
                        { sev: 'warning', icon: '⚠', msg: 'Marcadores de lista mixtos: se usan -, * y + en la misma lista', line: 'L7-L9', rule: 'consistency_list_markers', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
                        { sev: 'warning', icon: '⚠', msg: 'Marcador TODO/FIXME detectado — pendiente por resolver', line: 'L13', rule: 'academic_todo_markers', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
                        { sev: 'warning', icon: '⚠', msg: 'Índice de legibilidad Flesch-Kincaid: 18.2 (muy difícil)', line: 'L5', rule: 'readability_flesch_kincaid_es', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
                        { sev: 'info', icon: 'ℹ', msg: 'URL sin formato de enlace Markdown', line: 'L11', rule: 'links_bare_url', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
                        { sev: 'info', icon: 'ℹ', msg: 'Posible error ortográfico: "Critica" → "Crítica"', line: 'L1', rule: 'spell_check', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' }
                      ].map((d, i) => (
                        <m.div
                          key={i}
                          initial={{ opacity: 0, x: 10 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={stagger(i)}
                          className={`flex items-start gap-2 rounded-lg border p-2.5 ${d.color}`}
                        >
                          <span className="text-xs font-bold shrink-0 mt-0.5 w-4 text-center">{d.icon}</span>
                          <div className="min-w-0">
                            <p className="text-surface-200 text-[11px] leading-snug">{d.msg}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] text-surface-500">{d.line}</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-700/50 text-surface-500 font-mono">{d.rule}</span>
                            </div>
                          </div>
                        </m.div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Rule categories grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { icon: Layers, label: 'Estructura', count: 10, desc: 'Encabezados, tablas, bloques de código, notas al pie', color: 'text-cyan-400 bg-cyan-500/10' },
                    { icon: BookOpen, label: 'Legibilidad', count: 4, desc: 'Oraciones largas, párrafos extensos, Flesch-Kincaid', color: 'text-emerald-400 bg-emerald-500/10' },
                    { icon: Scale, label: 'Consistencia', count: 4, desc: 'Comillas, guiones, numeración, terminología', color: 'text-violet-400 bg-violet-500/10' },
                    { icon: GraduationCap, label: 'Académico', count: 3, desc: 'Paréntesis, TODO/FIXME, frontmatter YAML', color: 'text-amber-400 bg-amber-500/10' },
                    { icon: MonitorSmartphone, label: 'Accesibilidad', count: 3, desc: 'Alt-text, calidad de enlaces, HTML crudo', color: 'text-blue-400 bg-blue-500/10' },
                    { icon: Sparkles, label: 'Ortografía', count: 1, desc: 'Corrector ortográfico en español con diccionario personalizable', color: 'text-fuchsia-400 bg-fuchsia-500/10' }
                  ].map((cat, i) => (
                    <m.div
                      key={i}
                      initial={{ opacity: 0, y: 15 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={stagger(i)}
                      className="rounded-xl border border-surface-700/40 bg-surface-800/40 p-4 text-center hover:border-mandy-500/20 transition"
                    >
                      <div className={`w-9 h-9 rounded-lg ${cat.color} flex items-center justify-center mx-auto mb-2`}>
                        <cat.icon className="w-4.5 h-4.5" />
                      </div>
                      <h4 className="text-sm font-semibold text-white">{cat.label}</h4>
                      <span className="text-[10px] text-mandy-400 font-medium">{cat.count} reglas</span>
                      <p className="text-surface-500 text-[10px] mt-1 leading-snug">{cat.desc}</p>
                    </m.div>
                  ))}
                </div>
              </m.div>

              {/* ── Mesa Semántica mockup ── */}
              <m.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={fast} className="grid lg:grid-cols-[1fr_420px] gap-8 items-start">
                <div className="space-y-5">
                  <h3 className="text-2xl font-bold flex items-center gap-3">
                    <Network className="w-6 h-6 text-cyan-400" />
                    Mesa Semántica Global
                  </h3>
                  <p className="text-surface-400 leading-relaxed">
                    Navega visualmente por todos los conceptos, proposiciones y relaciones formales de tu workspace. Cada nodo se enlaza con su formalización ST y su contexto documental.
                  </p>
                  <p className="text-surface-400 leading-relaxed">
                    Ideal para descubrir conexiones entre documentos, detectar redundancias y construir ontologías compartidas en equipo.
                  </p>
                </div>
                <div className="rounded-2xl border border-surface-600/60 bg-surface-800/80 backdrop-blur overflow-hidden shadow-xl">
                  <div className="flex items-center justify-between border-b border-surface-700/50 px-4 py-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-surface-300">Mesa Semántica</span>
                    <span className="text-[10px] text-surface-500">12 conceptos · 8 relaciones</span>
                  </div>
                  <div className="p-4">
                    {/* Mock semantic graph */}
                    <div className="relative h-56 rounded-lg bg-surface-900/60 border border-surface-700/30 overflow-hidden">
                      {[
                        { label: 'Sustancia', x: '50%', y: '15%', color: 'bg-cyan-500' },
                        { label: 'Accidente', x: '80%', y: '30%', color: 'bg-violet-500' },
                        { label: 'Forma', x: '20%', y: '35%', color: 'bg-emerald-500' },
                        { label: 'Materia', x: '15%', y: '65%', color: 'bg-amber-500' },
                        { label: 'Causa', x: '50%', y: '55%', color: 'bg-mandy-500' },
                        { label: 'Potencia', x: '75%', y: '70%', color: 'bg-blue-500' },
                        { label: 'Acto', x: '40%', y: '80%', color: 'bg-fuchsia-500' }
                      ].map((node, i) => (
                        <div key={i} className="absolute transform -translate-x-1/2 -translate-y-1/2 group" style={{ left: node.x, top: node.y }}>
                          <div className={`w-2.5 h-2.5 rounded-full ${node.color} ring-2 ring-surface-900 group-hover:ring-mandy-400 transition shadow-lg`} />
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] text-surface-400 whitespace-nowrap group-hover:text-white transition">{node.label}</span>
                        </div>
                      ))}
                      {/* Mock connections */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 420 224">
                        <line x1="210" y1="34" x2="84" y2="78" stroke="rgba(100,200,255,0.15)" strokeWidth="1" />
                        <line x1="210" y1="34" x2="336" y2="67" stroke="rgba(100,200,255,0.15)" strokeWidth="1" />
                        <line x1="84" y1="78" x2="63" y2="146" stroke="rgba(100,200,255,0.12)" strokeWidth="1" />
                        <line x1="210" y1="34" x2="210" y2="123" stroke="rgba(233,69,96,0.2)" strokeWidth="1" />
                        <line x1="210" y1="123" x2="315" y2="157" stroke="rgba(100,200,255,0.12)" strokeWidth="1" />
                        <line x1="210" y1="123" x2="168" y2="179" stroke="rgba(100,200,255,0.12)" strokeWidth="1" />
                        <line x1="315" y1="157" x2="168" y2="179" stroke="rgba(200,100,255,0.15)" strokeWidth="1" />
                      </svg>
                    </div>
                  </div>
                </div>
              </m.div>

              {/* ── Text Layer mockup ── */}
              <m.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={fast} className="grid lg:grid-cols-[420px_1fr] gap-8 items-start">
                <div className="rounded-2xl border border-surface-600/60 bg-surface-800/80 backdrop-blur overflow-hidden shadow-xl order-2 lg:order-1">
                  <div className="flex items-center justify-between border-b border-surface-700/50 px-4 py-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-surface-300">Text Layer — Vinculación</span>
                    <span className="flex items-center gap-1.5 text-[10px] text-violet-400"><Layers className="w-3 h-3" /> 3 bloques</span>
                  </div>
                  <div className="p-4 space-y-3 text-xs">
                    {[
                      { prose: '"Todo lo que es compuesto puede descomponerse…"', st: 'axiom composite_decomposable:\n  forall x. (Composite(x) -> Decomposable(x))', tag: 'Axioma' },
                      { prose: '"El alma no es compuesta, por lo tanto…"', st: 'axiom soul_not_composite: ~Composite(soul)\nderive soul_indestructible:\n  ~Decomposable(soul)', tag: 'Derivación' },
                      { prose: '"Luego el alma es inmortal."', st: 'check valid soul_indestructible', tag: 'Verificación' }
                    ].map((block, i) => (
                      <div key={i} className="rounded-lg border border-surface-700/40 bg-surface-900/60 p-3 hover:border-violet-500/30 transition">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-surface-400 italic">{block.prose}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 shrink-0 ml-2">{block.tag}</span>
                        </div>
                        <pre className="text-[11px] text-emerald-400/70 font-mono leading-relaxed whitespace-pre-wrap bg-surface-950/60 rounded p-2">{block.st}</pre>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-5 order-1 lg:order-2">
                  <h3 className="text-2xl font-bold flex items-center gap-3">
                    <Layers className="w-6 h-6 text-violet-400" />
                    Text Layer
                  </h3>
                  <p className="text-surface-400 leading-relaxed">
                    Vincula cada párrafo de tu documento Markdown con su bloque ST correspondiente. El lector puede verificar cualquier afirmación sin salir de la prosa — clic en la frase, aparece la demostración.
                  </p>
                  <p className="text-surface-400 leading-relaxed">
                    Perfecto para artículos académicos, tesis y publicaciones que requieren transparencia lógica total. Exporta el documento con las pruebas embebidas.
                  </p>
                </div>
              </m.div>
            </div>
          </div>
        </section>

        {/* ══════════════ WORKFLOW ══════════════ */}
        <section id="workflow" className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12 space-y-4">
              <m.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={fast}>
                <h2 className="text-3xl lg:text-4xl font-bold">De la idea a la demostración</h2>
                <p className="text-surface-400 max-w-2xl mx-auto text-lg mt-4">
                  Un flujo de trabajo diseñado para que la rigurosidad sea parte natural del proceso creativo.
                </p>
              </m.div>
            </div>

            <div className="max-w-4xl mx-auto">
              <div className="grid md:grid-cols-2 gap-6">
                {workflow.map((item, i) => (
                  <m.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={stagger(i)}
                    className="relative bg-surface-800/40 border border-surface-700/50 rounded-2xl p-8 hover:border-mandy-500/20 transition group"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <span className="text-3xl font-black text-mandy-500/20 group-hover:text-mandy-500/40 transition">{item.step}</span>
                      <div className="w-10 h-10 rounded-lg bg-mandy-500/10 flex items-center justify-center text-mandy-400 group-hover:bg-mandy-500/20 transition">
                        <item.icon className="w-5 h-5" />
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-surface-400 leading-relaxed">{item.desc}</p>
                  </m.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════ SECURITY & TECH ══════════════ */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
              {[
                { icon: Lock, title: 'Cifrado completo', desc: 'Documentos cifrados en tránsito y en reposo. Autenticación segura. Tus datos nunca se exponen.' },
                { icon: HardDrive, title: 'Almacenamiento escalable', desc: 'Desde 50 MB gratuitos hasta 10 GB Enterprise. Sube PDFs, imágenes, hojas de cálculo — cualquier formato.' },
                { icon: MonitorSmartphone, title: 'PWA Multiplataforma', desc: 'Se instala como app nativa. Funciona offline con sincronización automática al reconectar.' }
              ].map((item, i) => (
                <m.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={stagger(i)}
                  className="bg-surface-800/40 border border-surface-700/50 rounded-2xl p-8 text-center"
                >
                  <div className="w-12 h-12 rounded-xl bg-surface-700/50 flex items-center justify-center text-mandy-400 mx-auto mb-4">
                    <item.icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-surface-400 text-sm leading-relaxed">{item.desc}</p>
                </m.div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════ PRICING ══════════════ */}
        <section id="pricing" className="py-24 bg-surface-800/30 border-y border-surface-700/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16 space-y-4">
              <m.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={fast}>
                <h2 className="text-3xl lg:text-4xl font-bold">Planes para cada necesidad</h2>
                <p className="text-surface-400 max-w-xl mx-auto text-lg mt-4">
                  Empieza gratis con todo el poder del editor y ST. Escala cuando lo necesites.
                </p>
              </m.div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {plans.map((plan, i) => (
                <m.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={stagger(i)}
                  className={`rounded-2xl p-6 border backdrop-blur-sm flex flex-col ${
                    plan.highlight
                      ? 'bg-mandy-500/10 border-mandy-500/40 ring-1 ring-mandy-500/20 scale-[1.02]'
                      : 'bg-surface-800/50 border-surface-700/50'
                  }`}
                >
                  {plan.highlight && (
                    <span className="text-xs font-semibold text-mandy-400 bg-mandy-500/20 px-3 py-1 rounded-full self-start mb-4">Popular</span>
                  )}
                  <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                  <div className="mb-6">
                    <span className="text-3xl font-extrabold text-white">{plan.price}</span>
                    {plan.sub !== 'Para siempre' && (
                      <span className="text-surface-400 text-sm ml-1">{plan.sub}</span>
                    )}
                    {plan.sub === 'Para siempre' && (
                      <span className="text-emerald-400 text-sm ml-2">{plan.sub}</span>
                    )}
                  </div>
                  <ul className="space-y-3 flex-1 mb-6">
                    {plan.features.map((f, fi) => (
                      <li key={fi} className="flex items-start gap-2 text-surface-300 text-sm">
                        <Check className="w-4 h-4 text-mandy-500 mt-0.5 flex-shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href={ctaHref}>
                    <button className={`w-full py-3 rounded-xl font-medium text-sm transition ${
                      plan.highlight
                        ? 'bg-gradient-mandy text-white hover:opacity-90 shadow-lg shadow-mandy-500/20'
                        : 'bg-surface-700/50 text-surface-300 hover:bg-surface-600'
                    }`}>
                      {user ? 'Ir al dashboard' : 'Comenzar'}
                    </button>
                  </Link>
                </m.div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════ PHILOSOPHY QUOTE ══════════════ */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <m.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={fast}
              className="max-w-3xl mx-auto text-center space-y-6"
            >
              <blockquote className="text-2xl lg:text-3xl font-light text-surface-200 leading-relaxed italic">
                &ldquo;Los pensamientos sin contenido son vacíos; las intuiciones sin conceptos son ciegas.&rdquo;
              </blockquote>
              <p className="text-surface-500 text-sm tracking-wide uppercase">
                Immanuel Kant — Crítica de la Razón Pura, B75
              </p>
              <p className="text-surface-400 max-w-xl mx-auto">
                Agora nace de esa convicción: la forma y el contenido del pensamiento
                deben poder verificarse juntos. Escribe con libertad, verifica con rigor.
              </p>
            </m.div>
          </div>
        </section>

        {/* ══════════════ FINAL CTA ══════════════ */}
        <section className="py-24 bg-surface-800/30 border-t border-surface-700/30">
          <div className="container mx-auto px-4 text-center">
            <m.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={fast}
              className="max-w-2xl mx-auto space-y-8"
            >
              <h2 className="text-3xl lg:text-4xl font-bold">¿Listo para investigar con rigor?</h2>
              <p className="text-surface-400 text-lg">
                Únete a Agora y accede al primer entorno donde Markdown, lógica formal y colaboración
                en la nube convergen. Sin descargas. Sin configuraciones. Solo tu pensamiento y las herramientas
                para llevarlo al límite.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href={ctaHref}>
                  <button className="flex items-center gap-2 bg-gradient-mandy text-white px-8 py-4 rounded-xl font-semibold text-lg hover:opacity-90 transition shadow-lg shadow-mandy-500/25 transform hover:-translate-y-0.5">
                    {ctaLabel}
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </Link>
                <Link href="/docs" className="text-surface-400 font-medium hover:text-mandy-400 transition px-6 py-4">
                  Explorar documentación
                </Link>
                <a
                  href={ELENXOS_BRAND.homeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-surface-400 font-medium hover:text-mandy-400 transition px-6 py-4 inline-flex items-center gap-2"
                >
                  Conocer Elenxos
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </m.div>
          </div>
        </section>
      </main>

      {/* ══════════════ FOOTER ══════════════ */}
      <footer className="bg-surface-950 text-surface-500 py-12 border-t border-surface-600/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-5 h-5 text-mandy-500" />
                <span className="font-semibold text-white text-lg">{PRODUCT_BRAND.name}</span>
              </div>
              <p className="text-sm leading-relaxed">
                {PRODUCT_BRAND.shortDescription} {PRODUCT_BRAND.fullDescription}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-surface-600">
                {ELENXOS_BRAND.ownershipDisclaimer}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-surface-300 text-sm mb-3 uppercase tracking-wider">Plataforma</h3>
              <nav className="flex flex-col gap-2 text-sm">
                <a href="#pillars" className="hover:text-mandy-400 transition">Características</a>
                <a href="#st" className="hover:text-mandy-400 transition">Lenguaje ST</a>
                <a href="#pricing" className="hover:text-mandy-400 transition">Planes</a>
                <Link href="/docs" className="hover:text-mandy-400 transition">Documentación</Link>
              </nav>
            </div>
            <div>
              <h3 className="font-semibold text-surface-300 text-sm mb-3 uppercase tracking-wider">Recursos</h3>
              <nav className="flex flex-col gap-2 text-sm">
                <Link href="/docs/st" className="hover:text-mandy-400 transition">Docs ST</Link>
                <a href="https://www.npmjs.com/package/@stevenvo780/st-lang" target="_blank" rel="noopener noreferrer" className="hover:text-mandy-400 transition">
                  npm: st-lang
                </a>
                <a href="https://github.com/stevenvo780" target="_blank" rel="noopener noreferrer" className="hover:text-mandy-400 transition">
                  GitHub
                </a>
              </nav>
            </div>
            <div>
              <h3 className="font-semibold text-surface-300 text-sm mb-3 uppercase tracking-wider">Elenxos</h3>
              <nav className="flex flex-col gap-2 text-sm">
                <a href={ELENXOS_BRAND.homeUrl} target="_blank" rel="noopener noreferrer" className="hover:text-mandy-400 transition">
                  Sitio principal
                </a>
                <a href={ELENXOS_BRAND.aboutUrl} target="_blank" rel="noopener noreferrer" className="hover:text-mandy-400 transition">
                  Nosotros
                </a>
                <a href={ELENXOS_BRAND.projectsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-mandy-400 transition">
                  Proyectos
                </a>
                <a href={ELENXOS_BRAND.salesUrl} className="hover:text-mandy-400 transition">
                  Contactar ventas
                </a>
              </nav>
            </div>
          </div>
          <div className="border-t border-surface-800 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm">
              &copy; {new Date().getFullYear()} {PRODUCT_BRAND.name} · Producto de {ELENXOS_BRAND.name}
            </div>
            <div className="text-xs text-surface-600">
              {ELENXOS_BRAND.footerDisclaimer}
            </div>
          </div>
        </div>
      </footer>
    </div>
    </LazyMotion>
  );
}

export default dynamic(() => Promise.resolve(LandingPage), { ssr: false });
