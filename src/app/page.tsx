'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { LazyMotion, domAnimation, m, useReducedMotion, type Transition } from 'framer-motion';
import {
  BookOpen, Edit3, Cloud, Users, ArrowRight, Terminal,
  Shield, FolderOpen, Zap, HardDrive, Kanban,
  MonitorSmartphone, Lock, Check
} from 'lucide-react';

function LandingPage() {
  const { user, loading } = useAuth();
  const reduceMotion = useReducedMotion();
  const heroTransition: Transition = { duration: reduceMotion ? 0.01 : 0.3, ease: 'easeOut' };
  const cardTransition = (index: number): Transition => ({
    delay: reduceMotion ? 0 : index * 0.1,
    duration: reduceMotion ? 0.01 : 0.25,
    ease: 'easeOut'
  });

  const features = [
    {
      icon: Edit3,
      title: 'Editor Markdown Avanzado',
      desc: 'Editor profesional con vista previa en tiempo real, soporte para Mermaid, LaTeX, tablas, hojas de cálculo y múltiples formatos académicos.'
    },
    {
      icon: Terminal,
      title: 'Terminales en la Nube',
      desc: 'Accede a terminales Linux completas desde el navegador. Ejecuta código, compila proyectos y administra entornos sin instalar nada.'
    },
    {
      icon: Cloud,
      title: 'Sincronización en la Nube',
      desc: 'Todos tus documentos sincronizados automáticamente. Accede desde cualquier dispositivo, en cualquier momento.'
    },
    {
      icon: Users,
      title: 'Espacios Colaborativos',
      desc: 'Crea workspaces compartidos para tu equipo, clase o grupo de investigación. Trabaja en documentos simultáneamente en tiempo real.'
    },
    {
      icon: Shield,
      title: 'Seguridad y Cifrado',
      desc: 'Autenticación segura, documentos cifrados en tránsito y en reposo. Tus datos protegidos con estándares de seguridad empresarial.'
    },
    {
      icon: Kanban,
      title: 'Tableros Kanban',
      desc: 'Organiza tareas y proyectos con tableros visuales estilo Kanban. Gestiona el flujo de trabajo de tu equipo de forma ágil.'
    },
    {
      icon: FolderOpen,
      title: 'Gestión de Archivos',
      desc: 'Explorador de archivos completo con carpetas, búsqueda, subida masiva de archivos y descarga de carpetas completas.'
    },
    {
      icon: HardDrive,
      title: 'Almacenamiento Escalable',
      desc: 'Desde 50 MB gratuitos hasta 10 GB en planes enterprise. Sube PDFs, imágenes, hojas de cálculo y cualquier tipo de archivo.'
    },
    {
      icon: MonitorSmartphone,
      title: 'Multiplataforma y PWA',
      desc: 'Funciona en cualquier navegador y se instala como app nativa. Diseño responsivo que se adapta a escritorio, tablet y móvil.'
    }
  ];

    const plans = [
        {
            name: 'Gratuito',
            price: 'Gratis',
            features: ['Editor Markdown completo', 'Documentos ilimitados', 'Workspace personal', '50 MB de almacenamiento'],
            highlight: false
        },
        {
            name: 'Básico',
            price: '$30.000/mes',
            features: ['Todo lo del plan Gratuito', 'Workspaces colaborativos', 'Tableros Kanban', 'Soporte por email', '1 GB de almacenamiento'],
            highlight: false
        },
        {
            name: 'Pro',
            price: '$80.000/mes',
            features: ['Todo lo del plan Básico', 'Terminales ilimitadas', 'Acceso completo a workers', 'Soporte prioritario', '1 GB de almacenamiento'],
            highlight: true
        },
        {
            name: 'Enterprise',
            price: '$240.000/mes',
            features: ['Todo lo del plan Pro', 'Máquina dedicada', 'Terminal dedicada', 'Soporte personalizado', '10 GB de almacenamiento'],
            highlight: false
        }
    ];

  return (
    <LazyMotion features={domAnimation}>
    <div className="min-h-screen flex flex-col bg-surface-900 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-surface-600/50 bg-surface-900/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-xl">
                <BookOpen className="w-6 h-6 text-mandy-500" />
                <span className="text-gradient-mandy">Agora</span>
            </div>
            <nav className="hidden sm:flex items-center gap-6 text-sm text-surface-400">
                <a href="#features" className="hover:text-mandy-400 transition">Características</a>
                <a href="#how" className="hover:text-mandy-400 transition">Cómo funciona</a>
                <a href="#pricing" className="hover:text-mandy-400 transition">Planes</a>
                <Link href="/docs" className="hover:text-mandy-400 transition">Documentación</Link>
            </nav>
            <nav className="flex items-center gap-4">
                {loading ? (
                    <span className="text-sm text-surface-400">Cargando...</span>
                ) : user ? (
                    <Link href="/dashboard" className="text-sm font-medium bg-mandy-500 text-white px-4 py-2 rounded-full hover:bg-mandy-600 transition">
                        Dashboard
                    </Link>
                ) : (
                    <>
                        <Link href="/login" className="text-sm font-medium text-surface-300 hover:text-mandy-400 transition">
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
        {/* Hero */}
        <section className="relative py-20 lg:py-32 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-glow opacity-60" />
            <div className="container mx-auto px-4 text-center relative z-10">
                <m.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={heroTransition}
                    className="max-w-4xl mx-auto space-y-8"
                >
                    <div className="inline-flex items-center gap-2 bg-mandy-500/10 border border-mandy-500/20 text-mandy-400 text-sm px-4 py-1.5 rounded-full">
                        <Zap className="w-4 h-4" />
                        Editor + Terminales + Cloud — Todo en tu navegador
                    </div>
                    <h1 className="text-4xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
                        Tu entorno de trabajo <span className="text-gradient-mandy">completo</span> en la nube
                    </h1>
                    <p className="text-lg lg:text-xl text-surface-300 leading-relaxed max-w-2xl mx-auto">
                        Editor Markdown profesional, terminales Linux, workspaces colaborativos y tableros Kanban. Todo cifrado, sincronizado y accesible desde cualquier dispositivo.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link href={user ? '/dashboard' : '/login'}>
                            <button className="flex items-center gap-2 bg-gradient-mandy text-white px-8 py-4 rounded-lg font-semibold text-lg hover:opacity-90 transition shadow-lg shadow-mandy-500/25 transform hover:-translate-y-1">
                                {user ? 'Ir a mis espacios' : 'Comenzar gratis'}
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </Link>
                        <a href="#features" className="text-surface-400 font-medium hover:text-mandy-400 transition px-6 py-4">
                            Explorar características
                        </a>
                    </div>
                    {/* Trust badges */}
                    <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-surface-500 text-sm">
                        <span className="flex items-center gap-1.5"><Lock className="w-4 h-4" /> Cifrado end-to-end</span>
                        <span className="flex items-center gap-1.5"><Cloud className="w-4 h-4" /> Sync automático</span>
                        <span className="flex items-center gap-1.5"><Terminal className="w-4 h-4" /> Terminales Linux</span>
                        <span className="flex items-center gap-1.5"><Shield className="w-4 h-4" /> Sin instalación</span>
                    </div>
                </m.div>
            </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-20 bg-surface-800/50">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                    <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Todo lo que necesitas en un solo lugar</h2>
                    <p className="text-surface-400 max-w-2xl mx-auto text-lg">
                        Desde la edición de documentos hasta la ejecución de código en terminales reales. Agora combina las herramientas que necesitas para trabajar, estudiar y colaborar.
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
                    {features.map((feature, i) => (
                        <m.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={cardTransition(i)}
                            className="bg-surface-700/50 p-8 rounded-2xl hover:bg-surface-700/80 transition border border-surface-600/50 backdrop-blur-sm group"
                        >
                            <div className="bg-mandy-500/10 w-12 h-12 rounded-lg flex items-center justify-center text-mandy-500 mb-6 group-hover:bg-mandy-500/20 transition">
                                <feature.icon className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                            <p className="text-surface-400 leading-relaxed">{feature.desc}</p>
                        </m.div>
                    ))}
                </div>
            </div>
        </section>

        {/* How it works */}
        <section id="how" className="py-20">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                    <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Empieza en minutos</h2>
                    <p className="text-surface-400 max-w-xl mx-auto text-lg">Sin instalaciones, sin configuraciones complicadas.</p>
                </div>
                <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                    {[
                        { step: '1', title: 'Crea tu cuenta', desc: 'Regístrate gratis con tu correo. Sin tarjeta de crédito.' },
                        { step: '2', title: 'Crea o sube documentos', desc: 'Escribe en Markdown, sube PDFs, hojas de cálculo o cualquier archivo.' },
                        { step: '3', title: 'Colabora y ejecuta', desc: 'Invita a tu equipo, abre terminales y trabaja como si tuvieras un servidor propio.' }
                    ].map((item, i) => (
                        <m.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={cardTransition(i)}
                            className="text-center"
                        >
                            <div className="w-14 h-14 rounded-full bg-mandy-500/20 text-mandy-400 text-2xl font-bold flex items-center justify-center mx-auto mb-6 border border-mandy-500/30">
                                {item.step}
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                            <p className="text-surface-400">{item.desc}</p>
                        </m.div>
                    ))}
                </div>
            </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-20 bg-surface-800/50">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                    <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Planes para cada necesidad</h2>
                    <p className="text-surface-400 max-w-xl mx-auto text-lg">Empieza gratis y escala cuando lo necesites. Pagos seguros con MercadoPago.</p>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                    {plans.map((plan, i) => (
                        <m.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={cardTransition(i)}
                            className={`rounded-2xl p-6 border backdrop-blur-sm flex flex-col ${
                                plan.highlight
                                    ? 'bg-mandy-500/10 border-mandy-500/40 ring-1 ring-mandy-500/20'
                                    : 'bg-surface-700/50 border-surface-600/50'
                            }`}
                        >
                            {plan.highlight && (
                                <span className="text-xs font-semibold text-mandy-400 bg-mandy-500/20 px-3 py-1 rounded-full self-start mb-4">Popular</span>
                            )}
                            <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                            <p className="text-2xl font-extrabold text-white mb-6">{plan.price}</p>
                            <ul className="space-y-3 flex-1 mb-6">
                                {plan.features.map((f, fi) => (
                                    <li key={fi} className="flex items-start gap-2 text-surface-300 text-sm">
                                        <Check className="w-4 h-4 text-mandy-500 mt-0.5 flex-shrink-0" />
                                        <span>{f}</span>
                                    </li>
                                ))}
                            </ul>
                            <Link href={user ? '/dashboard' : '/login'}>
                                <button className={`w-full py-2.5 rounded-lg font-medium text-sm transition ${
                                    plan.highlight
                                        ? 'bg-gradient-mandy text-white hover:opacity-90'
                                        : 'bg-surface-600/50 text-surface-300 hover:bg-surface-600'
                                }`}>
                                    {user ? 'Ir al dashboard' : 'Comenzar'}
                                </button>
                            </Link>
                        </m.div>
                    ))}
                </div>
            </div>
        </section>

        {/* CTA */}
        <section className="py-20">
            <div className="container mx-auto px-4 text-center">
                <m.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={heroTransition}
                    className="max-w-2xl mx-auto space-y-6"
                >
                    <h2 className="text-3xl lg:text-4xl font-bold text-white">¿Listo para empezar?</h2>
                    <p className="text-surface-400 text-lg">
                        Únete a Agora y accede a un entorno de trabajo completo desde tu navegador. Sin descargas, sin complicaciones.
                    </p>
                    <Link href={user ? '/dashboard' : '/login'}>
                        <button className="flex items-center gap-2 bg-gradient-mandy text-white px-8 py-4 rounded-lg font-semibold text-lg hover:opacity-90 transition shadow-lg shadow-mandy-500/25 transform hover:-translate-y-1 mx-auto">
                            {user ? 'Ir a mis espacios' : 'Crear cuenta gratis'}
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </Link>
                </m.div>
            </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface-950 text-surface-500 py-12 border-t border-surface-600/30">
        <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-mandy-500" />
                    <span className="font-semibold text-white">Agora</span>
                </div>
                <nav className="flex items-center gap-6 text-sm">
                    <a href="#features" className="hover:text-mandy-400 transition">Características</a>
                    <a href="#pricing" className="hover:text-mandy-400 transition">Planes</a>
                    <Link href="/docs" className="hover:text-mandy-400 transition">Documentación</Link>
                </nav>
                <div className="text-sm">
                    &copy; {new Date().getFullYear()} Agora — Plataforma de Educación Cooperativa
                </div>
            </div>
        </div>
      </footer>
    </div>
    </LazyMotion>
  );
}

export default dynamic(() => Promise.resolve(LandingPage), {
    ssr: false
});
