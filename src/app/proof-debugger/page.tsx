import type { Metadata } from 'next';
import DebuggerLoader from '@/components/proof-debugger/DebuggerLoader';

export const metadata: Metadata = {
  title: 'Proof Debugger — ST',
  description: 'UI de replay paso a paso para derivaciones ST. Navega cada paso de una prueba formal como un debugger de código.',
  alternates: { canonical: '/proof-debugger' },
  openGraph: {
    title: 'Proof Debugger — ST',
    description: 'Replay paso a paso de derivaciones de lógica formal ST.',
    url: '/proof-debugger'
  },
  robots: { index: true, follow: true }
};

export default function ProofDebuggerPage() {
  return <DebuggerLoader />;
}
