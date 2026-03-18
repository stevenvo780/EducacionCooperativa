'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  GraduationCap,
  Sigma,
  Terminal
} from 'lucide-react';
import type { LogicCoursePageData } from './logicCourses';

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
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <pre className="p-3 text-sm text-emerald-300 overflow-x-auto leading-relaxed"><code>{code}</code></pre>
      </div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-surface-300">
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-2">
          <ChevronRight className="w-3.5 h-3.5 text-mandy-500 mt-1 shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function LogicCoursePage({ course }: { course: LogicCoursePageData }) {
  const sections = useMemo(() => ([
    { id: 'overview', label: 'Panorama' },
    { id: 'concepts', label: 'Conceptos' },
    { id: 'operators', label: 'Operadores' },
    { id: 'commands', label: 'Comandos' },
    { id: 'examples', label: 'Ejemplos' },
    { id: 'mistakes', label: 'Errores' },
    { id: 'limits', label: 'Límites' },
    { id: 'bridges', label: 'Conexiones' }
  ]), []);

  return (
    <div className="min-h-screen bg-surface-900 text-surface-200 selection:bg-mandy-500/30">
      <header className="sticky top-0 z-50 bg-surface-900/90 backdrop-blur border-b border-surface-700/50">
        <div className="max-w-7xl mx-auto flex items-center gap-4 px-6 py-3">
          <Link href="/docs/st" className="p-2 rounded-lg hover:bg-surface-700/50 transition text-surface-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-mandy-600 to-violet-600 shadow-lg shadow-mandy-900/20">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-white tracking-tight truncate">{course.title}</h1>
              <p className="text-xs text-surface-500 truncate">Perfil activo: {course.profile}</p>
            </div>
          </div>
          <div className="flex-1" />
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-surface-800 border border-surface-700 text-[10px] font-bold text-surface-400 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {course.level}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10 flex gap-10">
        <aside className="hidden xl:block w-64 shrink-0 sticky top-24 self-start space-y-4">
          <div className="border border-surface-700/40 rounded-2xl bg-surface-800/35 p-4 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-surface-500 font-bold mb-1">Ruta</p>
              <h2 className="text-sm font-bold text-white">{course.navLabel}</h2>
              <p className="text-xs text-surface-400 mt-1">{course.subtitle}</p>
            </div>
            <div className="space-y-1">
              {sections.map(section => (
                <a key={section.id} href={`#${section.id}`} className="flex items-center gap-2 text-sm text-surface-400 hover:text-mandy-400 py-2 px-2 rounded-lg hover:bg-surface-800/50 transition-all group">
                  <div className="w-1 h-1 rounded-full bg-surface-700 group-hover:bg-mandy-500 transition-colors" />
                  {section.label}
                </a>
              ))}
            </div>
            <div className="border-t border-surface-700/30 pt-3 space-y-2">
              <a href={course.downloads.basic} download className="flex items-center gap-2 text-xs text-surface-300 hover:text-mandy-300 transition">
                <Download className="w-3.5 h-3.5" /> Script base
              </a>
              <a href={course.downloads.complete} download className="flex items-center gap-2 text-xs text-surface-300 hover:text-mandy-300 transition">
                <Download className="w-3.5 h-3.5" /> Script completo
              </a>
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0 space-y-8">
          <section className="border border-mandy-500/25 rounded-3xl p-8 bg-gradient-to-br from-mandy-600/15 via-surface-800/50 to-surface-900 overflow-hidden relative">
            <div className="relative z-10 space-y-5">
              <div className="flex flex-wrap gap-2">
                <span className="text-[10px] font-bold bg-mandy-500/20 text-mandy-300 px-3 py-1.5 rounded-lg border border-mandy-500/30 tracking-wider">{course.badge}</span>
                <span className="text-[10px] font-bold bg-surface-700/80 px-3 py-1.5 rounded-lg text-surface-200 border border-surface-600/50">{course.profile}</span>
                <span className="text-[10px] font-bold bg-surface-700/80 px-3 py-1.5 rounded-lg text-surface-200 border border-surface-600/50">Curso dedicado</span>
              </div>
              <div>
                <h2 className="text-4xl font-extrabold text-white tracking-tight">{course.title}</h2>
                <p className="text-surface-300 max-w-4xl text-base leading-relaxed mt-4">{course.intro}</p>
              </div>
              <div className="bg-surface-900/35 border border-surface-700/30 rounded-2xl p-5">
                <p className="text-[11px] font-semibold text-surface-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5" /> Por qué importa
                </p>
                <p className="text-sm text-surface-300 leading-relaxed">{course.whyItMatters}</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="bg-surface-900/40 border border-surface-700/30 rounded-2xl p-5">
                  <p className="text-[11px] font-semibold text-surface-500 uppercase tracking-widest mb-3">Objetivos de aprendizaje</p>
                  <BulletList items={course.learningGoals} />
                </div>
                <div className="bg-surface-900/40 border border-surface-700/30 rounded-2xl p-5">
                  <p className="text-[11px] font-semibold text-surface-500 uppercase tracking-widest mb-3">Accesos rápidos</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Link href="/docs/st" className="px-3 py-1.5 rounded-lg border border-surface-700/40 bg-surface-800/50 text-surface-300 hover:text-mandy-300 hover:border-mandy-500/30 transition">Volver a la academia</Link>
                    <a href={course.downloads.basic} download className="px-3 py-1.5 rounded-lg border border-surface-700/40 bg-surface-800/50 text-surface-300 hover:text-mandy-300 hover:border-mandy-500/30 transition">Descargar base</a>
                    <a href={course.downloads.complete} download className="px-3 py-1.5 rounded-lg border border-surface-700/40 bg-surface-800/50 text-surface-300 hover:text-mandy-300 hover:border-mandy-500/30 transition">Descargar completo</a>
                    <a href="https://github.com/stevenvo780/ST" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg border border-surface-700/40 bg-surface-800/50 text-surface-300 hover:text-mandy-300 hover:border-mandy-500/30 transition inline-flex items-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5" /> Repositorio ST
                    </a>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-violet-500/10 blur-[90px]" />
          </section>

          <section id="overview" className="scroll-mt-24 border border-surface-700/40 rounded-2xl p-6 bg-surface-800/25">
            <h3 className="text-xl font-bold text-white mb-4">Panorama del curso</h3>
            <p className="text-sm text-surface-300 leading-relaxed">
              Esta vista está pensada como una clase larga y dedicada. No es un resumen corto: es un espacio para estudiar una lógica en serio,
              practicar con el lenguaje ST y construir intuición semántica y operativa. Puedes recorrer la barra lateral o bajar de forma lineal.
            </p>
          </section>

          <section id="concepts" className="scroll-mt-24 border border-surface-700/40 rounded-2xl p-6 bg-surface-800/25">
            <div className="flex items-center gap-2 mb-4">
              <Sigma className="w-5 h-5 text-mandy-400" />
              <h3 className="text-xl font-bold text-white">Conceptos fundamentales</h3>
            </div>
            <div className="space-y-4">
              {course.concepts.map((concept, index) => (
                <div key={index} className="bg-surface-900/40 rounded-xl p-5 border border-surface-700/30">
                  <h4 className="text-sm font-bold text-white mb-2">{concept.title}</h4>
                  <p className="text-sm text-surface-300 leading-relaxed">{concept.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="operators" className="scroll-mt-24 border border-surface-700/40 rounded-2xl p-6 bg-surface-800/25">
            <div className="flex items-center gap-2 mb-4">
              <Terminal className="w-5 h-5 text-mandy-400" />
              <h3 className="text-xl font-bold text-white">Operadores y formas expresivas</h3>
            </div>
            <div className="grid gap-4">
              {course.operators.map((operator, index) => (
                <div key={index} className="bg-surface-900/40 rounded-xl p-5 border border-surface-700/30">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <code className="text-xs bg-surface-950 border border-surface-700/40 rounded-md px-2.5 py-1 text-emerald-300">{operator.symbol}</code>
                    <h4 className="text-sm font-bold text-white">{operator.name}</h4>
                  </div>
                  <p className="text-sm text-surface-300 leading-relaxed mb-3">{operator.meaning}</p>
                  <CopyBlock label="Práctica ST" code={`logic ${course.profile}\n${operator.stExample}`} />
                </div>
              ))}
            </div>
          </section>

          <section id="commands" className="scroll-mt-24 border border-surface-700/40 rounded-2xl p-6 bg-surface-800/25">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-mandy-400" />
              <h3 className="text-xl font-bold text-white">Comandos que debes dominar</h3>
            </div>
            <div className="space-y-4">
              {course.commands.map((command, index) => (
                <div key={index} className="bg-surface-900/40 rounded-xl p-5 border border-surface-700/30">
                  <h4 className="text-sm font-bold text-white mb-2">{command.title}</h4>
                  <p className="text-sm text-surface-300 mb-3">{command.description}</p>
                  <CopyBlock code={command.code} />
                </div>
              ))}
            </div>
          </section>

          <section id="examples" className="scroll-mt-24 border border-surface-700/40 rounded-2xl p-6 bg-surface-800/25">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="w-5 h-5 text-mandy-400" />
              <h3 className="text-xl font-bold text-white">Lecciones prácticas largas</h3>
            </div>
            <div className="space-y-4">
              {course.workedExamples.map((example, index) => (
                <div key={index} className="bg-surface-900/40 rounded-xl p-5 border border-surface-700/30">
                  <h4 className="text-sm font-bold text-white mb-2">{example.title}</h4>
                  <p className="text-sm text-surface-300 mb-3">{example.description}</p>
                  <CopyBlock code={example.code} />
                </div>
              ))}
            </div>
          </section>

          <section id="mistakes" className="scroll-mt-24 border border-red-500/20 rounded-2xl p-6 bg-red-500/5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h3 className="text-xl font-bold text-white">Errores frecuentes al estudiar esta lógica</h3>
            </div>
            <BulletList items={course.mistakes} />
          </section>

          <section id="limits" className="scroll-mt-24 border border-amber-500/20 rounded-2xl p-6 bg-amber-500/5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h3 className="text-xl font-bold text-white">Límites del motor y advertencias</h3>
            </div>
            <BulletList items={course.limits} />
          </section>

          <section id="bridges" className="scroll-mt-24 border border-surface-700/40 rounded-2xl p-6 bg-surface-800/25">
            <div className="flex items-center gap-2 mb-4">
              <ChevronRight className="w-5 h-5 text-mandy-400" />
              <h3 className="text-xl font-bold text-white">Cómo conecta con otras lógicas</h3>
            </div>
            <BulletList items={course.bridges} />
          </section>

          <footer className="border-t border-surface-700/30 pt-8 pb-16">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div>
                <p className="text-sm text-surface-400">Siguiente paso recomendado: vuelve a `Escuela de Lógicas` y abre otro curso largo.</p>
                <p className="text-xs text-surface-500 mt-1">También puedes descargar los scripts y probarlos con `npm run validate:st-docs`.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/docs/st" className="px-3 py-2 rounded-lg border border-surface-700/40 bg-surface-800/50 text-surface-300 hover:text-mandy-300 hover:border-mandy-500/30 transition">Volver a la academia</Link>
                <a href={course.downloads.complete} download className="px-3 py-2 rounded-lg border border-surface-700/40 bg-surface-800/50 text-surface-300 hover:text-mandy-300 hover:border-mandy-500/30 transition">Descargar curso completo</a>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
