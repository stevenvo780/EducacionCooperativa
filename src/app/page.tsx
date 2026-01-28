'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import { BookOpen, Edit3, Cloud, Users, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-surface-900 text-white">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-surface-600/50 bg-surface-900/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-xl">
                <BookOpen className="w-6 h-6 text-mandy-500" />
                <span className="text-gradient-mandy">AgoraSync</span>
            </div>
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
                            Empezar
                        </Link>
                    </>
                )}
            </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-20 lg:py-32 overflow-hidden">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-glow opacity-60" />
            <div className="container mx-auto px-4 text-center relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="max-w-3xl mx-auto space-y-8"
                >
                    <h1 className="text-4xl lg:text-6xl font-extrabold tracking-tight text-white">
                        La plataforma definitiva para estudiar <span className="text-gradient-mandy">Colaborativamente</span>
                    </h1>
                    <p className="text-lg lg:text-xl text-surface-300 leading-relaxed">
                        Crea espacios de trabajo, gestiona documentos y estudia en equipo. Edita textos y comparte conocimiento en tiempo real.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link href={user ? "/dashboard" : "/login"}>
                            <button className="flex items-center gap-2 bg-gradient-mandy text-white px-8 py-4 rounded-lg font-semibold text-lg hover:opacity-90 transition shadow-lg shadow-mandy-500/25 transform hover:-translate-y-1">
                                {user ? "Ir a mis espacios" : "Comenzar gratis"}
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </Link>
                        <a href="#features" className="text-surface-400 font-medium hover:text-mandy-400 transition px-6 py-4">
                            Saber más
                        </a>
                    </div>
                </motion.div>
            </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-20 bg-surface-800/50">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold text-white mb-4">Todo lo que necesitas</h2>
                    <p className="text-surface-400 max-w-2xl mx-auto">Diseñado para estudiantes y profesores de filología clásica.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                    {[
                        { icon: Edit3, title: "Editor Markdown", desc: "Soporte nativo para escritura poltónica y formatos académicos." },
                        { icon: Cloud, title: "Sincronización Cloud", desc: "Tus textos guardados automáticamente en la nube, accesibles desde donde sea." },
                        { icon: Users, title: "Tiempo Real", desc: "Colabora con compañeros o profesores en el mismo documento simultáneamente." },
                    ].map((feature, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.2 }}
                            className="bg-surface-700/50 p-8 rounded-2xl hover:bg-surface-700/80 transition border border-surface-600/50 backdrop-blur-sm"
                        >
                            <div className="bg-mandy-500/10 w-12 h-12 rounded-lg flex items-center justify-center text-mandy-500 mb-6">
                                <feature.icon className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                            <p className="text-surface-400">{feature.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
      </main>

      <footer className="bg-surface-950 text-surface-500 py-12 border-t border-surface-600/30">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
                <BookOpen className="w-5 h-5 text-mandy-500" />
                <span className="font-semibold text-white">AgoraSync</span>
            </div>
            <div className="text-sm">
                &copy; {new Date().getFullYear()} Universidad de Antioquia - Instituto de Filosofía
            </div>
        </div>
      </footer>
    </div>
  );
}
