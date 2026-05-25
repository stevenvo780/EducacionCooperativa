'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, FileText, Loader2 } from 'lucide-react';
import { PRODUCT_BRAND } from '@/lib/branding';

const MarkdownPreview = dynamic(
    () => import('@/components/mosaic-editor/MarkdownPreview').then((m) => ({ default: m.MarkdownPreview })),
    {
        ssr: false,
        loading: () => <div className="p-8 text-slate-400">Cargando vista previa…</div>
    }
);

type DocData = {
    id: string;
    name?: string;
    type?: string;
    content?: string;
};

const backendBase =
    (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_BASE_URL ?? '' : '')
        .trim()
        .replace(/\/+$/, '') || 'https://agora-backend-578238159459.us-central1.run.app';

export default function PublicDocViewer({ token }: { token: string }) {
    const [doc, setDoc] = useState<DocData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const res = await fetch(`${backendBase}/api/public/${token}`, { cache: 'no-store' });
                if (!res.ok) {
                    const body = await res.json().catch(() => ({})) as { error?: string };
                    throw new Error(body.error ?? `HTTP ${res.status}`);
                }
                const data = await res.json() as DocData;
                if (!cancelled) setDoc(data);
            } catch (err: unknown) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Error desconocido');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [token]);

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-slate-100 flex flex-col">
            <header className="border-b border-slate-800 px-6 py-3 flex items-center gap-3">
                <FileText className="h-5 w-5 text-indigo-400 shrink-0" />
                <span className="text-sm font-semibold text-slate-200 truncate">
                    {doc?.name ?? (loading ? 'Cargando…' : 'Documento compartido')}
                </span>
                <span className="ml-auto text-xs text-slate-500 shrink-0">
                    {PRODUCT_BRAND.name} — solo lectura
                </span>
            </header>

            <main className="flex-1 overflow-auto">
                {loading && (
                    <div className="flex items-center justify-center h-64 gap-3 text-slate-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Cargando documento…</span>
                    </div>
                )}

                {!loading && error && (
                    <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
                        <AlertTriangle className="h-8 w-8 text-amber-400" />
                        <p className="text-sm">
                            {error === 'Enlace expirado'
                                ? 'Este enlace ha expirado.'
                                : error === 'Enlace no encontrado' || error === 'Documento no encontrado'
                                  ? 'El enlace no es válido o el documento fue eliminado.'
                                  : `No se pudo cargar el documento: ${error}`}
                        </p>
                    </div>
                )}

                {!loading && error === null && doc !== null && (
                    <div className="max-w-4xl mx-auto px-6 py-8">
                        {doc.content !== null && doc.content !== undefined ? (
                            <MarkdownPreview content={doc.content} />
                        ) : (
                            <p className="text-slate-400 text-sm">Este documento no tiene contenido de texto visible.</p>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
