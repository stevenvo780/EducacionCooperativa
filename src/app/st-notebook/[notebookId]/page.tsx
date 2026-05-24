import type { Metadata } from 'next';
import NotebookEditor from '@/components/st-notebook/NotebookEditor';

export const metadata: Metadata = {
  title: 'Editor ST Notebook — Agora',
  robots: { index: false, follow: false }
};

interface Props {
  params: Promise<{ notebookId: string }>;
}

export default async function StNotebookEditorPage({ params }: Props) {
  const { notebookId } = await params;
  return <NotebookEditor notebookId={notebookId} />;
}
