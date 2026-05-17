import type { Metadata } from 'next';
import STPlaygroundV2 from '@/components/st-playground-v2/STPlaygroundV2';

export const metadata: Metadata = {
  title: 'ST Playground v2',
  description:
    'Editor ST con LSP in-process: autocompletado, hover, diagnósticos en tiempo real, outline y proof tree visual. Sin servidor — corre 100% en el navegador.',
  alternates: { canonical: '/st-playground-v2' },
  openGraph: {
    title: 'ST Playground v2',
    description:
      'Editor de lógica formal ST con LSP en el navegador (autocompletado, hover, errores en vivo).',
    url: '/st-playground-v2'
  },
  robots: { index: true, follow: true }
};

export default function StPlaygroundV2Page() {
  return <STPlaygroundV2 />;
}
