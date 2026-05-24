import type { Metadata } from 'next';
import NotebookList from '@/components/st-notebook/NotebookList';

export const metadata: Metadata = {
  title: 'ST Notebooks — Agora',
  description:
    'Crea y edita notebooks de lógica formal ST (.stnb): celdas de código ejecutable y markdown con KaTeX.',
  alternates: { canonical: '/st-notebook' },
  openGraph: {
    title: 'ST Notebooks — Agora',
    description: 'Notebooks interactivos de lógica formal ST.',
    url: '/st-notebook'
  },
  robots: { index: true, follow: true }
};

export default function StNotebookPage() {
  return <NotebookList />;
}
