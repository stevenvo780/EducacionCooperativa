'use client';

import { useAuth } from '@/context/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import Editor from '@/components/Editor';

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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-blue-400" />
          <span className="text-xs text-slate-500">Cargando editor…</span>
        </div>
      </div>
    );
  }
  if (!user) return null;

  return (
    <main className="h-screen w-screen overflow-hidden bg-slate-950">
      <Editor
        roomId={roomId}
        initialContent=""
        embedded={frameMode}
        forceInline
        onClose={frameMode ? undefined : () => router.push('/dashboard')}
      />
    </main>
  );
}