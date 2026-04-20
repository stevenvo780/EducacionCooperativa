'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { LazyMotion, domAnimation, m, useReducedMotion, type Transition } from 'framer-motion';
import {
  ArrowRight, BookOpen, Brain, Check, ChevronDown, Cloud,
  Code2, Edit3, FileText, FlaskConical, FolderOpen, GraduationCap,
  HardDrive, Kanban, Layers, Lock, MonitorSmartphone, Network,
  Pencil, Scale, Shield, Sparkles, Terminal, Users, Zap
} from 'lucide-react';

/* ─── code snippet for hero demo ──────────────────────────── */
const ST_DEMO = `logic classical.propositional

axiom modus_ponens : P -> Q
axiom hipotesis   : P

derive conclusion from {modus_ponens, hipotesis}
-- ✓ Q derivado exitosamente

check valid ((P -> Q) -> (!Q -> !P))
-- ✓ Contrapositiva: tautología verificada

truth_table (P & Q) -> P
-- ✓ Tabla de verdad generada`;

const MD_DEMO = `# Crítica de la razón pura — §B75

> "Los pensamientos sin contenido son vacíos,
>  las intuiciones sin conceptos son ciegas."

## Formalización

| Proposición             | Variable |
|-------------------------|----------|
| Pensamiento con contenido | P      |
| Intuición con concepto    | Q      |

**Tesis**: El conocimiento requiere la síntesis
de ambas facultades: \`P ∧ Q → K\``;

function LandingPage() {
  const { user, loading } = useAuth();
  const reduceMotion = useReducedMotion();
  const fast: Transition = { duration: reduceMotion ? 0.01 : 0.3, ease: 'easeOut' };
  const stagger = (i: number): Transition => ({
    delay: reduceMotion ? 0 : i * 0.08,
    duration: reduceMotion ? 0.01 : 0.25,
    ease: 'easeOut'
  });

  /* ─── data ────────────────────────────────────────────── */

  const pillars = [
    {
      icon: Code2,
      accent: 'from-rose-500 to-pink-600',
      title: 'ST — Lenguaje de Lógica Formal',
      desc: 'El primer lenguaje ejecutable diseñado para la investigación filosófica. 11 perfiles lógicos — desde la proposicional clásica hasta la paraconsistente — con derivaciones verificables, contramodelos y tablas de verdad.',
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
      desc: 'Markdown con superpoderes: LaTeX nativo, diagramas Mermaid, hojas de cálculo integradas, corrector ortográfico en español y vista previa en tiempo real.',
      details: [
        'Soporte para KaTeX, tablas avanzadas y bloques de código',
        'Vista previa renderizada mientras escribes',
        'Corrector ortográfico Hunspell integrado (es)',
        'Exportación y conversión de PDF, DOCX y más'
      ]
    },
    {
      icon: FlaskConical,
      accent: 'from-emerald-500 to-teal-600',
      title: 'Formalización Automática',
      desc: 'Convierte texto natural en lógica formal ST sin intervención manual. Un NL Linter detecta ambigüedades antes de formalizar, y el pipeline genera archivos .st companion verificables.',
      details: [
        'Pipeline NLP de 6 etapas: segmentación → extracción → emisión ST',
        'NL Linter: detecta vaguedad, ambigüedad y falacias informales',
        'Mesa Semántica: navegador de conceptos con formalización en vivo',
        'Modo LLM/SLM para textos técnicos densos'
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
      desc: 'Un asistente IA especializado en lógica formal, filosofía y redacción académica. Integrado directamente en el editor para ayudarte a formalizar, argumentar y escribir.',
      details: [
        'Contexto del workspace y documentos activos',
        'Generación y corrección de scripts ST',
        'Múltiples proveedores: OpenAI, Anthropic, Google',
        'Snippets inteligentes y galería de ejemplos'
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
    { icon: Scale, label: 'Argumentación formal' },
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
    <div className="min-h-screen flex flex-col bg-surface-900 text-white">

      {/* ══════════════ Header ══════════════ */}
      <header className="sticky top-0 z-50 w-full border-b border-surface-600/50 bg-surface-900/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <BookOpen className="w-6 h-6 text-mandy-500" />
            <span className="text-gradient-mandy">Agora</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-surface-400">
            <a href="#vision" className="hover:text-mandy-400 transition">Visión</a>
            <a href="#pillars" className="hover:text-mandy-400 transition">Plataforma</a>
            <a href="#st" className="hover:text-mandy-400 transition">Lenguaje ST</a>
            <a href="#workflow" className="hover:text-mandy-400 transition">Flujo</a>
            <a href="#pricing" className="hover:text-mandy-400 transition">Planes</a>
            <Link href="/docs" className="hover:text-mandy-400 transition">Docs</Link>
            <Link href="/docs/st" className="hover:text-mandy-400 transition">Docs ST</Link>
          </nav>
          <nav className="flex items-center gap-4">
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
        </div>
      </header>

      <main className="flex-1">

        {/* ══════════════ HERO ══════════════ */}
        <section className="relative py-24 lg:py-36 overflow-hidden">
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
                className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]"
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
                ejecutable de lógica formal. Formaliza argumentos, verifica derivaciones y genera contramodelos
                — todo en un entorno colaborativo, cifrado y accesible desde cualquier navegador.
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
                <span className="flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5" /> Hecho para filósofos</span>
              </m.div>
            </div>

            {/* Code demo panels */}
            <m.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...fast, delay: 0.5 }}
              className="mt-16 max-w-5xl mx-auto"
            >
              <div className="grid md:grid-cols-2 gap-4">
                {/* ST panel */}
                <div className="rounded-xl border border-surface-600/60 bg-surface-800/80 backdrop-blur overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-surface-700/60 bg-surface-800/50">
                    <div className="flex gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                    </div>
                    <span className="text-xs text-surface-400 font-mono ml-2">argumento.st</span>
                    <span className="ml-auto text-[10px] text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded-full font-medium">ST Lang</span>
                  </div>
                  <pre className="p-4 text-[13px] leading-6 font-mono text-surface-300 overflow-x-auto">
                    <code>{ST_DEMO}</code>
                  </pre>
                </div>
                {/* MD panel */}
                <div className="rounded-xl border border-surface-600/60 bg-surface-800/80 backdrop-blur overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-surface-700/60 bg-surface-800/50">
                    <div className="flex gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                    </div>
                    <span className="text-xs text-surface-400 font-mono ml-2">investigacion.md</span>
                    <span className="ml-auto text-[10px] text-violet-400/80 bg-violet-500/10 px-2 py-0.5 rounded-full font-medium">Markdown</span>
                  </div>
                  <pre className="p-4 text-[13px] leading-6 font-mono text-surface-300 overflow-x-auto">
                    <code>{MD_DEMO}</code>
                  </pre>
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
                  La filosofía necesita herramientas que estén a la altura de sus preguntas
                </h2>
                <div className="grid md:grid-cols-2 gap-8 text-surface-300 text-lg leading-relaxed">
                  <div className="space-y-4">
                    <p>
                      Durante siglos, la verificación de un argumento dependió de la agudeza del lector
                      y de convenciones tipográficas heredadas del papel. Los errores lógicos se
                      escondían entre párrafos elegantes; las falacias se camuflaban con retórica.
                    </p>
                    <p>
                      <strong className="text-white">Agora cambia eso.</strong> Cada afirmación puede vincularse
                      con una formalización ejecutable. Cada derivación puede verificarse con un clic.
                      Cada contramodelo se genera automáticamente.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <p>
                      No se trata de reemplazar la escritura filosófica con código, sino de
                      <em> darle a cada argumento la posibilidad de ser verificado formalmente</em>.
                      El Text Layer de ST vincula pasajes de prosa con sus formalizaciones,
                      creando un puente entre el lenguaje natural y la lógica simbólica.
                    </p>
                    <p>
                      Markdown para la expresión. ST para la verificación. La nube para la colaboración.
                      Ese es el estándar que proponemos.
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
                    <h2 className="text-3xl lg:text-4xl font-bold">
                      ST: Symbolic Theory Language
                    </h2>
                    <p className="text-surface-300 text-lg leading-relaxed">
                      ST no es solo un verificador — es un lenguaje de programación completo especializado
                      en razonamiento formal. Declara axiomas, ejecuta derivaciones, genera tablas de verdad
                      y busca contramodelos, todo en un archivo <code className="text-mandy-300 bg-mandy-500/10 px-1.5 py-0.5 rounded text-sm">.st</code>.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">11 perfiles lógicos</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {profiles.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 bg-surface-800/60 border border-surface-700/40 rounded-lg px-3 py-2 text-sm">
                          <code className="text-emerald-400 font-mono text-xs shrink-0">{p.name}</code>
                          <span className="text-surface-500 text-xs ml-auto">{p.desc}</span>
                        </div>
                      ))}
                    </div>
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
                  <div className="rounded-xl border border-surface-600/60 bg-surface-900/80 overflow-hidden shadow-2xl">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-700/60 bg-surface-800/50">
                      <div className="flex gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                      </div>
                      <span className="text-xs text-surface-400 font-mono ml-2">ejemplo-completo.st</span>
                    </div>
                    <pre className="p-5 text-[13px] leading-7 font-mono text-surface-300 overflow-x-auto">{`logic classical.propositional

-- Modus Tollens formalizado
axiom imp : P -> Q
axiom neg : !Q

derive !P from {imp, neg}
-- ✓ Derivado por Modus Tollens

-- Verificar la ley
check valid ((P -> Q) -> (!Q -> !P))
-- ✓ Tautología

-- ¿Es satisfacible?
check sat (P & !P)
-- ✗ Insatisfacible — contradicción

-- Tabla de verdad
truth_table (P -> Q) <-> (!P | Q)
-- ✓ Equivalencia material verificada`}</pre>
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

        {/* ══════════════ WORKFLOW ══════════════ */}
        <section id="workflow" className="py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16 space-y-4">
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

        {/* ══════════════ FORMALIZACIÓN AUTOMÁTICA ══════════════ */}
        <section className="py-24 bg-surface-800/30 border-y border-surface-700/30">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <m.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={fast}
                className="space-y-12"
              >
                <div className="text-center space-y-4">
                  <h2 className="text-3xl lg:text-4xl font-bold">Formalización automática</h2>
                  <p className="text-surface-400 max-w-3xl mx-auto text-lg">
                    Escribe en lenguaje natural. El motor NLP de Agora extrae la estructura lógica y genera
                    el código ST equivalente — listo para verificar.
                  </p>
                </div>

                {/* Pipeline visualization */}
                <div className="rounded-2xl border border-surface-700/50 bg-surface-800/60 p-8 lg:p-10">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      { icon: FileText, label: 'Texto natural', detail: 'Redacta tu argumento en prosa académica', color: 'text-violet-400 bg-violet-500/10' },
                      { icon: FlaskConical, label: 'NL Linter', detail: 'Detecta ambigüedades, vaguedad y falacias', color: 'text-amber-400 bg-amber-500/10' },
                      { icon: Code2, label: 'Pipeline NLP', detail: 'Segmenta, extrae y emite código ST', color: 'text-emerald-400 bg-emerald-500/10' },
                      { icon: Check, label: 'Verificación', detail: 'Ejecuta, valida y genera archivo .st', color: 'text-mandy-400 bg-mandy-500/10' }
                    ].map((stage, i) => (
                      <div key={i} className="text-center space-y-3">
                        <div className={`w-14 h-14 rounded-xl ${stage.color} flex items-center justify-center mx-auto`}>
                          <stage.icon className="w-7 h-7" />
                        </div>
                        <h4 className="font-semibold text-white">{stage.label}</h4>
                        <p className="text-surface-400 text-sm">{stage.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  {[
                    { title: 'Mesa Semántica', desc: 'Navega conceptos del workspace y visualiza sus formalizaciones en tiempo real. Cada concepto se vincula automáticamente con su representación formal.' },
                    { title: 'Text Layer', desc: 'Vincula párrafos específicos de tu documento Markdown con bloques ST. El lector puede verificar cada afirmación sin salir del texto.' },
                    { title: 'Modo LLM/SLM', desc: 'Para textos técnicos densos, activa la extracción semántica con modelos de lenguaje. Compatible con OpenAI, Ollama y modelos ONNX locales.' }
                  ].map((card, i) => (
                    <m.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={stagger(i)}
                      className="bg-surface-800/40 border border-surface-700/40 rounded-xl p-6"
                    >
                      <h4 className="font-semibold text-white mb-2">{card.title}</h4>
                      <p className="text-surface-400 text-sm leading-relaxed">{card.desc}</p>
                    </m.div>
                  ))}
                </div>
              </m.div>
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
              </div>
            </m.div>
          </div>
        </section>
      </main>

      {/* ══════════════ FOOTER ══════════════ */}
      <footer className="bg-surface-950 text-surface-500 py-12 border-t border-surface-600/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-5 h-5 text-mandy-500" />
                <span className="font-semibold text-white text-lg">Agora</span>
              </div>
              <p className="text-sm leading-relaxed">
                Plataforma de investigación cooperativa. Markdown, lógica formal ST,
                terminales cloud y colaboración en tiempo real.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-surface-300 text-sm mb-3 uppercase tracking-wider">Plataforma</h4>
              <nav className="flex flex-col gap-2 text-sm">
                <a href="#pillars" className="hover:text-mandy-400 transition">Características</a>
                <a href="#st" className="hover:text-mandy-400 transition">Lenguaje ST</a>
                <a href="#pricing" className="hover:text-mandy-400 transition">Planes</a>
                <Link href="/docs" className="hover:text-mandy-400 transition">Documentación</Link>
              </nav>
            </div>
            <div>
              <h4 className="font-semibold text-surface-300 text-sm mb-3 uppercase tracking-wider">Recursos</h4>
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
          </div>
          <div className="border-t border-surface-800 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm">
              &copy; {new Date().getFullYear()} Agora — Plataforma de Investigación Cooperativa
            </div>
            <div className="text-xs text-surface-600">
              Hecho con rigor para quienes piensan con rigor.
            </div>
          </div>
        </div>
      </footer>
    </div>
    </LazyMotion>
  );
}

export default dynamic(() => Promise.resolve(LandingPage), { ssr: false });
