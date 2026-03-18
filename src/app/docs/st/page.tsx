'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Brain,
  CheckCircle2,
  Download,
  ExternalLink,
  FlaskConical,
  Layers3,
  Route,
  ShieldCheck,
  Sparkles,
  Terminal
} from 'lucide-react';

type LogicGuide = {
  title: string;
  profile: string;
  level: string;
  useCase: string;
  lesson: string;
  filename: string;
  code: string;
  verified: string;
};

const quickStartSteps = [
  {
    title: '1. Declara la lógica',
    body: 'Cada script ST empieza con `logic <perfil>`. Eso fija qué reglas semánticas usa el motor.',
    code: 'logic classical.propositional'
  },
  {
    title: '2. Agrega hechos o fórmulas',
    body: 'Usa axiomas para registrar premisas y luego comandos como `derive` o `check` para razonar.',
    code: 'axiom a1 = P -> Q\naxiom a2 = P'
  },
  {
    title: '3. Pide una inferencia o verificación',
    body: 'Puedes derivar conclusiones, comprobar validez, satisfacibilidad, equivalencia, tablas o contramodelos según el perfil.',
    code: 'derive Q from {a1, a2}\ncheck valid ((P -> Q) -> (!Q -> !P))'
  },
  {
    title: '4. Ejecuta y revisa la salida',
    body: 'El CLI devuelve pruebas, modelos y diagnósticos. Los ejemplos de esta vista están validados con el binario local de `ST`.',
    code: 'st run teoria.st'
  }
];

const logicGuides: LogicGuide[] = [
  {
    title: 'Clásica proposicional',
    profile: 'classical.propositional',
    level: 'Inicio recomendado',
    useCase: 'Tautologías, modus ponens, tablas de verdad y contramodelos.',
    lesson: 'Es el mejor punto de entrada para aprender la sintaxis general de ST.',
    filename: '01-clasica-proposicional.st',
    code: 'logic classical.propositional\n\naxiom a1 = P -> Q\naxiom a2 = P\n\nderive Q from {a1, a2}\ncheck valid ((P -> Q) -> (!Q -> !P))',
    verified: 'Deriva `Q` y confirma que la contraposición es válida.'
  },
  {
    title: 'Primer orden',
    profile: 'classical.first_order',
    level: 'Intermedio',
    useCase: 'Cuantificadores `forall` y `exists`, predicados y objetos.',
    lesson: 'Úsalo cuando una variable representa individuos o relaciones entre objetos.',
    filename: '02-primer-orden.st',
    code: 'logic classical.first_order\n\ncheck valid ((forall x P(x)) -> P(a))\ncheck valid (P(a) -> exists x P(x))',
    verified: 'Valida instanciación universal e introducción existencial.'
  },
  {
    title: 'Modal K',
    profile: 'modal.k',
    level: 'Intermedio',
    useCase: 'Necesidad `[]` y posibilidad `<>` en marcos modales mínimos.',
    lesson: 'Sirve para modelar lo posible, lo necesario y lo no garantizado en el mundo actual.',
    filename: '03-modal-k.st',
    code: 'logic modal.k\n\ncheck valid ([](P -> Q) -> ([]P -> []Q))\ncheck valid ([]P -> P)',
    verified: 'Confirma el axioma K y muestra que `[]P -> P` no es válida en K.'
  },
  {
    title: 'Deóntica estándar',
    profile: 'deontic.standard',
    level: 'Intermedio',
    useCase: 'Obligaciones, permisos y prohibiciones en reglas normativas.',
    lesson: 'Útil para reglamentos, ética computacional y validación de normas.',
    filename: '04-deontica.st',
    code: 'logic deontic.standard\n\ncheck valid ([](P) -> <>(P))\ncheck valid ([](!P) -> !<>(P))',
    verified: 'Verifica que lo obligatorio es permitido y que la prohibición bloquea la permisión.'
  },
  {
    title: 'Epistémica S5',
    profile: 'epistemic.s5',
    level: 'Intermedio',
    useCase: 'Conocimiento, introspección positiva y negativa.',
    lesson: 'Buen perfil para agentes que saben, dudan o reflexionan sobre su propio saber.',
    filename: '05-epistemica-s5.st',
    code: 'logic epistemic.s5\n\ncheck valid ([](P) -> P)\ncheck valid (![]P -> [](![]P))',
    verified: 'Valida veridicidad y la introspección negativa propia de S5.'
  },
  {
    title: 'Intuicionista',
    profile: 'intuitionistic.propositional',
    level: 'Intermedio',
    useCase: 'Pruebas constructivas sin asumir tercero excluido.',
    lesson: 'Ideal si quieres enseñar diferencia entre verdad clásica y demostrabilidad constructiva.',
    filename: '06-intuicionista.st',
    code: 'logic intuitionistic.propositional\n\ncheck valid (P -> P)\ncheck valid (P | !P)\ncheck valid (P -> !!P)',
    verified: 'Confirma identidad e introducción de doble negación; rechaza tercero excluido.'
  },
  {
    title: 'Temporal LTL',
    profile: 'temporal.ltl',
    level: 'Intermedio',
    useCase: 'Estados en el tiempo, `always`, `eventually`, `next` y secuencias.',
    lesson: 'Conveniente para procesos, protocolos y eventos que evolucionan en pasos.',
    filename: '07-temporal-ltl.st',
    code: 'logic temporal.ltl\n\ncheck valid ([](P) -> P)\ncheck valid ([](P) -> <>(P))\ncheck valid (<>(P) -> [](P))',
    verified: 'Muestra que “siempre” implica “ahora” y “eventualmente” no implica “siempre”.'
  },
  {
    title: 'Aristotélica',
    profile: 'aristotelian.syllogistic',
    level: 'Humanidades + lógica',
    useCase: 'Silogismos categóricos como Barbara o Celarent.',
    lesson: 'Es la entrada natural para filosofía clásica y cursos introductorios de razonamiento.',
    filename: '08-aristotelica.st',
    code: 'logic aristotelian.syllogistic\n\ncheck valid ((forall x (M(x) -> P(x))) & (forall x (S(x) -> M(x))) -> (forall x (S(x) -> P(x))))',
    verified: 'Valida Barbara y Celarent, y deja un ejemplo inválido para contraste.'
  },
  {
    title: 'Paraconsistente Belnap',
    profile: 'paraconsistent.belnap',
    level: 'Avanzado',
    useCase: 'Razona con contradicciones sin que todo explote.',
    lesson: 'Perfecto cuando tus datos pueden ser inconsistentes pero siguen siendo útiles.',
    filename: '09-paraconsistente-belnap.st',
    code: 'logic paraconsistent.belnap\n\ncheck satisfiable (P & !P)\ncheck valid ((P & !P) -> Q)',
    verified: 'Confirma que una contradicción puede ser satisfacible y que `ex falso` no queda validado.'
  },
  {
    title: 'Probabilística básica',
    profile: 'probabilistic.basic',
    level: 'Avanzado',
    useCase: 'Lecturas semánticas con probabilidad y fórmulas con peso de verdad.',
    lesson: 'Sirve para explicar cuándo una fórmula vale con probabilidad 1 y cuándo no.',
    filename: '10-probabilistica.st',
    code: 'logic probabilistic.basic\n\ncheck valid (P | !P)\ncheck valid P\ncheck satisfiable (P & Q)',
    verified: 'La tautología sale válida, `P` sola no, y `P & Q` sigue siendo satisfacible.'
  }
];

function CopyBlock({ code, label = 'script' }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-surface-700/40 bg-surface-950/90">
      <div className="flex items-center justify-between border-b border-surface-700/40 bg-surface-800/60 px-4 py-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-surface-500">{label}</span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
          className="text-[11px] font-semibold text-surface-400 transition hover:text-emerald-400"
        >
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-emerald-300"><code>{code}</code></pre>
    </div>
  );
}

function SectionTitle({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-mandy-400">{eyebrow}</p>
      <h2 className="text-3xl font-extrabold tracking-tight text-white">{title}</h2>
      <p className="max-w-3xl text-sm leading-relaxed text-surface-400">{body}</p>
    </div>
  );
}

export default function STDocsPage() {
  const sections = [
    { id: 'intro', label: 'Visión General' },
    { id: 'install', label: 'Instalación' },
    { id: 'quickstart', label: 'Primer Script' },
    { id: 'logics', label: 'Perfiles Lógicos' },
    { id: 'text-layer', label: 'Text Layer' },
    { id: 'validation', label: 'Validación' }
  ];

  return (
    <div className="min-h-screen bg-surface-900 text-surface-200 selection:bg-mandy-500/30">
      <header className="sticky top-0 z-50 border-b border-surface-700/50 bg-surface-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
          <Link href="/docs" className="rounded-lg p-2 text-surface-400 transition hover:bg-surface-700/50 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-tr from-mandy-600 to-violet-600 p-2 shadow-lg shadow-mandy-900/20">
              <FlaskConical className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-surface-500">Centro ST</p>
              <h1 className="text-lg font-bold tracking-tight text-white">Guía dedicada del lenguaje lógico</h1>
            </div>
          </div>
          <div className="flex-1" />
          <a
            href="https://github.com/stevenvo780/ST"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-2 rounded-full border border-surface-700 bg-surface-800 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-surface-300 transition hover:border-mandy-500/40 hover:text-white sm:flex"
          >
            Repositorio ST <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-10 px-6 py-10">
        <aside className="sticky top-24 hidden w-56 shrink-0 self-start lg:block">
          <p className="mb-4 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-surface-500">Navegación ST</p>
          <nav className="space-y-1">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="group flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-surface-400 transition hover:bg-surface-800/50 hover:text-mandy-400"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-surface-700 transition group-hover:bg-mandy-500" />
                {section.label}
              </a>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 space-y-14">
          <section id="intro" className="overflow-hidden rounded-3xl border border-mandy-500/30 bg-gradient-to-br from-mandy-600/20 via-surface-800/60 to-surface-900 p-8 md:p-10">
            <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-mandy-500/20 bg-mandy-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-mandy-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  Tutoriales validados
                </div>
                <h2 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">Aprende ST paso a paso dentro de Ágora</h2>
                <p className="max-w-3xl text-base leading-relaxed text-surface-300">
                  Esta vista concentra la documentación operativa de <strong className="text-white">ST</strong>: perfiles lógicos, ejemplos mínimos, descargas listas para ejecutar y un flujo de validación reproducible.
                  Todo lo que aparece aquí fue contrastado con el CLI local del repositorio hermano `ST`.
                </p>
                <div className="flex flex-wrap gap-3 text-[11px] font-bold">
                  <span className="rounded-xl border border-surface-600/40 bg-surface-700/70 px-4 py-2 text-surface-200">10 perfiles lógicos documentados</span>
                  <span className="rounded-xl border border-surface-600/40 bg-surface-700/70 px-4 py-2 text-surface-200">11 scripts descargables</span>
                  <span className="rounded-xl border border-surface-600/40 bg-surface-700/70 px-4 py-2 text-surface-200">Validación con `bash` y CLI real</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="#quickstart" className="rounded-2xl bg-mandy-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-mandy-400">
                    Empezar con ST
                  </Link>
                  <a href="#validation" className="rounded-2xl border border-surface-600/50 px-5 py-3 text-sm font-bold text-surface-200 transition hover:border-mandy-500/40 hover:text-white">
                    Ver cómo se valida
                  </a>
                </div>
              </div>

              <div className="rounded-3xl border border-surface-700/40 bg-surface-900/60 p-6">
                <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-surface-500">Ruta recomendada</p>
                <div className="space-y-4 text-sm text-surface-300">
                  <div className="flex gap-3">
                    <BookOpen className="mt-0.5 h-4 w-4 text-blue-400" />
                    <p>Empieza por `classical.propositional` para dominar sintaxis, derivación y validez.</p>
                  </div>
                  <div className="flex gap-3">
                    <Brain className="mt-0.5 h-4 w-4 text-violet-400" />
                    <p>Sigue con `classical.first_order`, `modal.k` e `intuitionistic.propositional`.</p>
                  </div>
                  <div className="flex gap-3">
                    <Layers3 className="mt-0.5 h-4 w-4 text-emerald-400" />
                    <p>Después pasa a perfiles especializados: deóntico, epistémico, temporal, paraconsistente y probabilístico.</p>
                  </div>
                  <div className="flex gap-3">
                    <Route className="mt-0.5 h-4 w-4 text-amber-400" />
                    <p>Cierra con `Text Layer` para conectar documentos reales con formalizaciones.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="install" className="space-y-6">
            <SectionTitle
              eyebrow="Preparación"
              title="Instalación y ejecución"
              body="Estas rutas te dejan corriendo ST desde terminal. Los comandos se verificaron con el proyecto `ST` del workspace y sirven también como referencia para usar los scripts de esta vista."
            />
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-3 rounded-3xl border border-surface-700/40 bg-surface-800/40 p-6">
                <div className="flex items-center gap-2 text-sm font-bold text-white"><Terminal className="h-4 w-4 text-emerald-400" /> Instalación global</div>
                <CopyBlock label="bash" code={'npm install -g @stevenvo780/st-lang\nst --help'} />
              </div>
              <div className="space-y-3 rounded-3xl border border-surface-700/40 bg-surface-800/40 p-6">
                <div className="flex items-center gap-2 text-sm font-bold text-white"><ShieldCheck className="h-4 w-4 text-blue-400" /> Desde este workspace</div>
                <CopyBlock label="bash" code={'cd /home/operador/proyectos/humanizar/EducacionCooperativa\nbash scripts/validate-st-docs.sh'} />
              </div>
            </div>
          </section>

          <section id="quickstart" className="space-y-6">
            <SectionTitle
              eyebrow="Primer Script"
              title="Qué escribir primero"
              body="Si nunca has usado ST, sigue esta secuencia exacta. Cada paso corresponde a una operación que ya probamos con el binario local."
            />
            <div className="grid gap-5 md:grid-cols-2">
              {quickStartSteps.map((step) => (
                <div key={step.title} className="space-y-3 rounded-3xl border border-surface-700/40 bg-surface-800/30 p-5">
                  <h3 className="text-lg font-bold text-white">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-surface-400">{step.body}</p>
                  <CopyBlock code={step.code} />
                </div>
              ))}
            </div>
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6">
              <p className="text-sm leading-relaxed text-emerald-100">
                Script mínimo validado: descarga `01-clasica-proposicional.st`, ejecútalo y verás una derivación completa, una tautología válida y la tabla de verdad de `P & Q`.
              </p>
            </div>
          </section>

          <section id="logics" className="space-y-6">
            <SectionTitle
              eyebrow="Perfiles"
              title="Las lógicas que ya puedes enseñar y practicar"
              body="Cada tarjeta resume cuándo conviene usar un perfil, qué enseña y qué script fue validado para esta documentación."
            />
            <div className="grid gap-5 xl:grid-cols-2">
              {logicGuides.map((guide) => (
                <article key={guide.profile} className="overflow-hidden rounded-3xl border border-surface-700/40 bg-surface-800/30">
                  <div className="space-y-3 border-b border-surface-700/40 p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-mandy-500/20 bg-mandy-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.15em] text-mandy-300">{guide.level}</span>
                      <code className="rounded-full border border-surface-600/50 bg-surface-900/80 px-3 py-1 text-[11px] text-surface-300">{guide.profile}</code>
                    </div>
                    <h3 className="text-2xl font-bold tracking-tight text-white">{guide.title}</h3>
                    <p className="text-sm leading-relaxed text-surface-400">{guide.lesson}</p>
                    <p className="text-sm text-surface-300"><strong className="text-white">Úsala para:</strong> {guide.useCase}</p>
                    <p className="flex items-start gap-2 text-sm text-emerald-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {guide.verified}</p>
                  </div>
                  <div className="space-y-4 p-6">
                    <CopyBlock code={guide.code} />
                    <a
                      href={`/downloads/st/${guide.filename}`}
                      className="inline-flex items-center gap-2 rounded-2xl border border-surface-600/50 px-4 py-2 text-sm font-bold text-surface-200 transition hover:border-mandy-500/40 hover:text-white"
                    >
                      <Download className="h-4 w-4" /> Descargar script verificado
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="text-layer" className="space-y-6">
            <SectionTitle
              eyebrow="Puente documental"
              title="Text Layer: formalizar texto real"
              body="El diferencial de ST es que no se limita a fórmulas abstractas. Puedes vincular pasajes de documentos, formalizarlos y luego razonar sobre ellos con los mismos comandos del motor lógico."
            />
            <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-4 rounded-3xl border border-surface-700/40 bg-surface-800/30 p-6">
                <h3 className="text-xl font-bold text-white">Secuencia paso a paso</h3>
                <div className="space-y-3 text-sm leading-relaxed text-surface-400">
                  <p><strong className="text-white">1.</strong> Declara un pasaje con `passage([[archivo#ancla]])`.</p>
                  <p><strong className="text-white">2.</strong> Formaliza ese pasaje con `formalize ... as (...)`.</p>
                  <p><strong className="text-white">3.</strong> Registra el resultado como `claim` y añade soporte, confianza y contexto.</p>
                  <p><strong className="text-white">4.</strong> Usa el `claim` o la formalización en derivaciones y verificaciones normales.</p>
                </div>
                <a
                  href="/downloads/st/11-text-layer.st"
                  className="inline-flex items-center gap-2 rounded-2xl border border-surface-600/50 px-4 py-2 text-sm font-bold text-surface-200 transition hover:border-mandy-500/40 hover:text-white"
                >
                  <Download className="h-4 w-4" /> Descargar ejemplo de Text Layer
                </a>
              </div>
              <CopyBlock
                code={'logic classical.propositional\n\nlet p = passage([[clase-logica.md#b8]])\nlet phi = formalize p as (P -> Q)\nclaim c1 = phi\nsupport c1 <- p\nconfidence c1 = 0.84\ncontext c1 = "Si P entonces Q"\naxiom base = P -> Q\naxiom premisa = P\nderive Q from {base, premisa}'}
              />
            </div>
          </section>

          <section id="validation" className="space-y-6">
            <SectionTitle
              eyebrow="Verificación"
              title="Cómo se comprobó esta documentación"
              body="Para evitar ejemplos bonitos pero falsos, dejé un validador reproducible dentro de `EducacionCooperativa`. Recorre todos los scripts de `public/downloads/st`, compila `ST` si hace falta y ejecuta cada archivo con el CLI real."
            />
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-3 rounded-3xl border border-surface-700/40 bg-surface-800/30 p-6">
                <h3 className="text-lg font-bold text-white">Comando recomendado</h3>
                <CopyBlock label="bash" code={'cd /home/operador/proyectos/humanizar/EducacionCooperativa\nbash scripts/validate-st-docs.sh'} />
              </div>
              <div className="space-y-3 rounded-3xl border border-surface-700/40 bg-surface-800/30 p-6">
                <h3 className="text-lg font-bold text-white">Qué valida</h3>
                <ul className="space-y-2 text-sm text-surface-400">
                  <li>- Compila `ST` si `dist/cli/index.js` no está actualizado.</li>
                  <li>- Ejecuta los 11 scripts usados por la guía.</li>
                  <li>- Muestra pruebas, modelos y salidas del motor para detectar desajustes.</li>
                  <li>- Falla rápido si cambia la sintaxis o un ejemplo deja de ser válido.</li>
                </ul>
              </div>
            </div>
            <div className="rounded-3xl border border-blue-500/20 bg-blue-500/10 p-6 text-sm leading-relaxed text-blue-100">
              Si quieres, el siguiente paso natural es conectar esta vista con el `STRunner` para abrir cualquiera de estos scripts con un click dentro del editor mosaico.
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
