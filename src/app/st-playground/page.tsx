import type { Metadata } from 'next';
import Playground from '@/components/st-playground/Playground';

export const metadata: Metadata = {
  title: 'ST Playground',
  description:
    'Playground público para escribir y evaluar código ST (lógica formal) directamente en el navegador.',
  alternates: { canonical: '/st-playground' },
  openGraph: {
    title: 'ST Playground',
    description: 'Editor de lógica formal ST con evaluación client-side.',
    url: '/st-playground'
  },
  robots: { index: true, follow: true }
};

export default function StPlaygroundPage() {
  return <Playground />;
}
