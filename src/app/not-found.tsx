import Link from 'next/link';
import { BookOpen, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] bg-surface-900 text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-mandy text-white shadow-lg shadow-mandy-500/20">
          <BookOpen className="h-8 w-8" strokeWidth={1.7} />
        </div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-mandy-400 mb-2">404</p>
        <h1 className="text-3xl font-bold mb-3">Esta página no existe</h1>
        <p className="text-sm text-surface-400 leading-relaxed mb-8">
          La ruta que buscas se movió, fue renombrada o nunca existió. Si llegaste aquí desde un link interno, avísanos.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-mandy text-white text-sm font-semibold hover:opacity-90 transition"
          >
            <Home className="h-4 w-4" />
            Volver al inicio
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-surface-800 border border-surface-700 text-surface-200 text-sm font-semibold hover:border-surface-500 hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Ir a la documentación
          </Link>
        </div>
      </div>
    </div>
  );
}
