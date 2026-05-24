import type { Metadata } from 'next';
import STPlaygroundV3 from '@/components/st-playground-v3/STPlaygroundV3';

export const metadata: Metadata = {
  title: 'ST Playground v3 — AI Co-pilot',
  description:
    'Co-piloto IA estilo Cursor para fórmulas ST. Describe en lenguaje natural lo que quieres formalizar y la IA propone una fórmula; ST valida en tiempo real.',
  alternates: { canonical: '/st-playground-v3' },
  openGraph: {
    title: 'ST Playground v3 — AI Co-pilot',
    description:
      'Co-piloto IA para lógica formal ST. NL → fórmula → validación en vivo.',
    url: '/st-playground-v3'
  },
  robots: { index: true, follow: true }
};

export default function StPlaygroundV3Page() {
  return <STPlaygroundV3 />;
}
