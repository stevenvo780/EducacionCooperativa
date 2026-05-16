import type { Metadata } from 'next';
import LatticeViewerClient from '@/components/lattice-viewer/LatticeViewerClient';

export const metadata: Metadata = {
  title: 'Lattice Viewer — Belnap & Modal Frames',
  description:
    'Visualizador SVG 2D de estructuras lógicas: bilattice de Belnap (cuatro valores) y marcos modales de Kripke.',
  alternates: { canonical: '/lattice-viewer' },
  openGraph: {
    title: 'Lattice Viewer',
    description: 'Visualizador SVG de Belnap bilattice y marcos modales.',
    url: '/lattice-viewer'
  },
  robots: { index: true, follow: true }
};

export default function LatticeViewerPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4">
      <div className="max-w-2xl mx-auto">
        <header className="pt-10 pb-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Lattice Viewer</h1>
          <p className="text-slate-400 mt-2 text-sm">
            Estructuras de orden y marcos relacionales para lógica formal
          </p>
        </header>
        <LatticeViewerClient />
      </div>
    </main>
  );
}
