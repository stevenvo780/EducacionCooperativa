'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { apiUrl } from '@/services/apiClient';
import { Send, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

type TipoPQR = 'peticion' | 'queja' | 'reclamo' | 'sugerencia';

const TIPOS: { value: TipoPQR; label: string }[] = [
  { value: 'peticion', label: 'Petición' },
  { value: 'queja', label: 'Queja' },
  { value: 'reclamo', label: 'Reclamo' },
  { value: 'sugerencia', label: 'Sugerencia' }
];

interface PqrResponse {
  ok: boolean;
  ticketId?: string;
  error?: string;
}

export default function AyudaForm() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [tipo, setTipo] = useState<TipoPQR>('peticion');
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const waMsg = encodeURIComponent(
    `Hola, quiero enviar una ${tipo} sobre Agora:\n\nNombre: ${nombre}\nEmail: ${email}\n\n${mensaje}`
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);

    if (!nombre.trim()) {
      setSubmitError('El nombre es requerido.');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setSubmitError('Ingresa un email válido.');
      return;
    }
    if (!mensaje.trim() || mensaje.trim().length < 10) {
      setSubmitError('El mensaje debe tener al menos 10 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/support/pqr'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), email: email.trim(), tipo, mensaje: mensaje.trim() })
      });

      let data: PqrResponse;
      try {
        data = (await res.json()) as PqrResponse;
      } catch {
        throw new Error('Respuesta inesperada del servidor.');
      }

      if (!res.ok) {
        throw new Error(data.error ?? `Error ${res.status}`);
      }

      setTicketId(data.ticketId ?? 'generado');
      toast.success('Solicitud enviada', {
        description: `Tu ticket ha sido registrado. ID: ${data.ticketId ?? '—'}. Recibirás respuesta en máx. 15 días hábiles.`,
        duration: 8000
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo enviar la solicitud.';
      setSubmitError(msg);
      toast.error('No se pudo enviar', {
        description: `${msg} Si el problema persiste, escríbenos por WhatsApp o email.`,
        duration: 8000
      });
    } finally {
      setLoading(false);
    }
  };

  if (ticketId) {
    return (
      <div className="space-y-4 text-center py-4">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          </div>
        </div>
        <p className="text-white font-semibold text-lg">Solicitud registrada</p>
        <p className="text-surface-400 text-sm">
          ID de ticket: <code className="text-mandy-300 bg-mandy-500/10 px-1.5 py-0.5 rounded">{ticketId}</code>
        </p>
        <p className="text-surface-400 text-sm">
          Recibirás respuesta en un máximo de 15 días hábiles al correo{' '}
          <strong className="text-surface-300">{email}</strong>.
        </p>
        <p className="text-surface-500 text-xs">
          ¿Preferís contacto inmediato?{' '}
          <a
            href={`https://wa.me/573046374368?text=${waMsg}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:text-emerald-300 transition underline underline-offset-2"
          >
            Escribinos por WhatsApp
          </a>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {submitError && (
        <div className="flex items-start gap-2 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{submitError}</span>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="pqr-nombre" className="block text-sm font-medium text-surface-300">
            Nombre <span className="text-mandy-400">*</span>
          </label>
          <input
            id="pqr-nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Tu nombre completo"
            maxLength={120}
            required
            className="w-full bg-surface-700/60 border border-surface-600 text-surface-100 placeholder-surface-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mandy-500/50 focus:border-mandy-500/60 transition"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="pqr-email" className="block text-sm font-medium text-surface-300">
            Email <span className="text-mandy-400">*</span>
          </label>
          <input
            id="pqr-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            maxLength={200}
            required
            className="w-full bg-surface-700/60 border border-surface-600 text-surface-100 placeholder-surface-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mandy-500/50 focus:border-mandy-500/60 transition"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="pqr-tipo" className="block text-sm font-medium text-surface-300">
          Tipo de solicitud <span className="text-mandy-400">*</span>
        </label>
        <select
          id="pqr-tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoPQR)}
          required
          className="w-full bg-surface-700/60 border border-surface-600 text-surface-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mandy-500/50 focus:border-mandy-500/60 transition appearance-none"
        >
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="pqr-mensaje" className="block text-sm font-medium text-surface-300">
          Mensaje <span className="text-mandy-400">*</span>
        </label>
        <textarea
          id="pqr-mensaje"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder="Describe tu solicitud con el mayor detalle posible..."
          rows={5}
          maxLength={5000}
          required
          className="w-full bg-surface-700/60 border border-surface-600 text-surface-100 placeholder-surface-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mandy-500/50 focus:border-mandy-500/60 transition resize-y"
        />
        <p className="text-xs text-surface-600 text-right">{mensaje.length} / 5000</p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 bg-gradient-mandy text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-mandy-500/20"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {loading ? 'Enviando...' : 'Enviar solicitud'}
        </button>

        <a
          href={`https://wa.me/573046374368?text=${waMsg}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-surface-500 hover:text-emerald-400 transition"
        >
          O enviar por WhatsApp
        </a>
      </div>
    </form>
  );
}
