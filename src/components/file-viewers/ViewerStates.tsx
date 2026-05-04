'use client';

import React from 'react';
import { Loader2, AlertTriangle, type LucideIcon } from 'lucide-react';

export function ViewerLoading({ label = 'Cargando...' }: { label?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-300">
      <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ViewerError({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-slate-300">
      <AlertTriangle className="h-10 w-10 text-amber-400" />
      <span className="text-sm">{hint ?? 'No se pudo abrir el archivo'}</span>
      <code className="max-w-full overflow-hidden truncate text-xs text-slate-500">{message}</code>
    </div>
  );
}

export function ViewerEmpty({
  icon: Icon,
  message
}: {
  icon: LucideIcon;
  message: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
      <Icon className="h-10 w-10 text-slate-600" />
      <span className="text-sm">{message}</span>
    </div>
  );
}

export function ViewerUnsupported({
  icon: Icon,
  title,
  description,
  fileUrl
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  fileUrl?: string | null;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <Icon className="h-12 w-12 text-slate-500" />
      <div className="max-w-md space-y-2">
        <h3 className="text-base font-medium text-slate-200">{title}</h3>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
      {fileUrl && (
        <div className="flex gap-2">
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700"
          >
            Abrir externo
          </a>
          <a
            href={fileUrl}
            download
            className="rounded bg-blue-600 px-3 py-1.5 text-xs hover:bg-blue-500"
          >
            Descargar
          </a>
        </div>
      )}
    </div>
  );
}

export interface AsyncResource<T> {
  state: 'idle' | 'loading' | 'ready' | 'error';
  data?: T;
  error?: string;
}
