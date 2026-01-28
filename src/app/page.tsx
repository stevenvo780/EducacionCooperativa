'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import { BookOpen, Edit3, Cloud, Users, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-xl text-blue-700">
                <BookOpen className="w-6 h-6" />
                <span>Griego App</span>
            </div>
            <nav className="flex items-center gap-4">
                {loading ? (
                    <span className="text-sm text-slate-500">Cargando...</span>
                ) : user ? (
                    <Link href="/dashboard" className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700 transition">
                        Dashboard
                    </Link>
                ) : (
                    <>
                        <Link href="/login" className="text-sm font-medium hover:text-blue-600 transition">
                            Iniciar Sesión
                        </Link>
                        <Link href="/login" className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700 transition">
                            Empezar
                        </Link>
                    </>
                )}
            </nav>
        </div>
      </header>
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-20 lg:py-32 overflow-hidden bg-white">
            <div className="container mx-auto px-4 text-center">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="max-w-3xl mx-auto space-y-8"
                >
                    <h1 className="text-4xl lg:text-6xl font-extrabold tracking-tight text-slate-900">
                        La plataforma definitiva para estudiar <span className="text-blue-600">Colaborativamente</span>
                    </h1>
                    <p className="text-lg lg:text-xl text-slate-600 leading-relaxed">
                        Crea espacios de trabajo, gestiona documentos y estudia en equipo. Edita textos y comparte conocimiento en tiempo real.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link href={user ? "/dashboard" : "/login"}>
                            <button className="flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition shadow-lg hover:shadow-xl transform hover:-translate-y-1">
                                {user ? "Ir a mis espacios" : "Comenzar gratis"}
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </Link>
                        <a href="#features" className="text-slate-600 font-medium hover:text-blue-600 transition px-6 py-4">
                            Saber más
                        </a>
                    </div>
                </motion.div>
            </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-20 bg-slate-50">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">Todo lo que necesitas</h2>
                    <p className="text-slate-600 max-w-2xl mx-auto">Diseñado para estudiantes y profesores de filología clásica.</p>
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
                            className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition border border-slate-100"
                        >
                            <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center text-blue-600 mb-6">
                                <feature.icon className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">{feature.title}</h3>
                            <p className="text-slate-600">{feature.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
      </main>

      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
                <BookOpen className="w-5 h-5" />
                <span className="font-semibold text-white">Griego App</span>
            </div>
            <div className="text-sm">
                &copy; {new Date().getFullYear()} Universidad de Antioquia - Instituto de Filosofía
            </div>
        </div>
      </footer>
    </div>
  );
}


