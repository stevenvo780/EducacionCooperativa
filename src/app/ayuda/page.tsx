import type { Metadata } from 'next';
import { ELENXOS_BRAND, PRODUCT_BRAND } from '@/lib/branding';
import AyudaForm from './AyudaForm';
import Link from 'next/link';
import { BookOpen, Mail, MessageCircle, ArrowLeft, Shield } from 'lucide-react';

export const metadata: Metadata = {
  title: `Ayuda y PQR | ${PRODUCT_BRAND.name}`,
  description: `Centro de ayuda de ${PRODUCT_BRAND.name}. Peticiones, quejas, reclamos y sugerencias. Respuesta en máximo 15 días hábiles.`
};

export default function AyudaPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-surface-900 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-surface-600/50 bg-surface-900/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <BookOpen className="w-6 h-6 text-mandy-500" />
            <span className="text-gradient-mandy">Agora</span>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-surface-400 hover:text-mandy-400 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-12 max-w-3xl">

        {/* Title */}
        <div className="mb-10 text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Ayuda y <span className="text-gradient-mandy">PQR</span>
          </h1>
          <p className="text-surface-400 text-lg">
            Peticiones, Quejas, Reclamos y Sugerencias
          </p>
        </div>

        {/* Direct contact channels — prominent */}
        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          <a
            href="mailto:stevenvallejo780@gmail.com"
            className="flex items-center gap-4 bg-surface-800/60 border border-surface-700/50 rounded-2xl p-5 hover:border-mandy-500/40 hover:bg-surface-800 transition group"
          >
            <div className="w-12 h-12 rounded-xl bg-mandy-500/10 border border-mandy-500/20 flex items-center justify-center shrink-0 group-hover:bg-mandy-500/20 transition">
              <Mail className="w-6 h-6 text-mandy-400" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-white text-sm">Correo electrónico</p>
              <p className="text-surface-400 text-xs truncate">stevenvallejo780@gmail.com</p>
            </div>
          </a>

          <a
            href="https://wa.me/573046374368"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 bg-surface-800/60 border border-surface-700/50 rounded-2xl p-5 hover:border-emerald-500/40 hover:bg-surface-800 transition group"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 transition">
              <MessageCircle className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-white text-sm">WhatsApp</p>
              <p className="text-surface-400 text-xs">+57 304 637 4368</p>
            </div>
          </a>
        </div>

        {/* PQR Form */}
        <div className="bg-surface-800/40 border border-surface-700/50 rounded-2xl p-6 sm:p-8 mb-10">
          <h2 className="text-xl font-bold text-white mb-1">Enviar una solicitud</h2>
          <p className="text-surface-400 text-sm mb-6">
            Completa el formulario y recibirás respuesta en un máximo de{' '}
            <strong className="text-white">15 días hábiles</strong>.
          </p>
          <AyudaForm />
        </div>

        {/* Legal notice */}
        <div className="bg-surface-800/30 border border-surface-700/40 rounded-2xl p-6 text-sm text-surface-400 space-y-3">
          <div className="flex items-center gap-2 text-surface-300 font-semibold">
            <Shield className="w-4 h-4 text-mandy-400 shrink-0" />
            Información sobre el derecho a presentar PQR
          </div>
          <p>
            De conformidad con la Ley 1480 de 2011 (Estatuto del Consumidor, Colombia) y la normativa
            de la Superintendencia de Industria y Comercio (SIC), tienes derecho a presentar
            peticiones, quejas, reclamos y sugerencias ante el responsable del servicio.
          </p>
          <p>
            El responsable del tratamiento de tu solicitud es <strong className="text-surface-300">{ELENXOS_BRAND.name}</strong>,
            operador de <strong className="text-surface-300">{PRODUCT_BRAND.name}</strong>. El plazo máximo de
            respuesta es de <strong className="text-surface-300">15 días hábiles</strong> a partir
            de la recepción de tu solicitud.
          </p>
          <p>
            Para más información sobre el tratamiento de tus datos, consulta nuestra{' '}
            <Link href="/privacidad" className="text-mandy-400 hover:text-mandy-300 transition underline underline-offset-2">
              Política de Privacidad
            </Link>{' '}
            y nuestros{' '}
            <Link href="/terminos" className="text-mandy-400 hover:text-mandy-300 transition underline underline-offset-2">
              Términos y Condiciones
            </Link>.
          </p>
        </div>
      </main>

      <footer className="bg-surface-950 text-surface-500 py-6 border-t border-surface-600/30 text-center text-xs">
        <div className="container mx-auto px-4 flex flex-col items-center gap-2">
          <div>
            &copy; {new Date().getFullYear()} {PRODUCT_BRAND.name} &middot; Producto de {ELENXOS_BRAND.name}
          </div>
          <nav className="flex items-center gap-3">
            <Link href="/terminos" className="hover:text-mandy-400 transition">Términos</Link>
            <span aria-hidden="true">·</span>
            <Link href="/privacidad" className="hover:text-mandy-400 transition">Privacidad</Link>
            <span aria-hidden="true">·</span>
            <Link href="/cookies" className="hover:text-mandy-400 transition">Cookies</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
