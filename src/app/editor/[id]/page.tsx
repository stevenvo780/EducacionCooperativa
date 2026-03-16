'use client';

import { useAuth } from '@/context/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const DynamicEditor = dynamic(() => import('@/components/Editor'), { ssr: false });

export default function EditorPage({ params }: { params: { id: string } }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = params.id;
  const frameMode = searchParams?.get('embedded') === '1';

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">Cargando editor...</div>;
  if (!user) return null;

  return (
    <main className="h-screen w-screen overflow-hidden bg-slate-950">
      <DynamicEditor
        roomId={roomId}
        initialContent="# Cargando..."
        embedded={false}
        forceInline
        onClose={frameMode ? undefined : () => router.push('/dashboard')}
      />
    </main>
  );
}