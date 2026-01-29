'use client';

import { useAuth } from '@/context/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const DynamicEditor = dynamic(() => import('@/components/Editor'), { ssr: false });

export default function EditorPage({ params }: { params: { id: string } }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const roomId = params.id;

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">Cargando editor...</div>;
  if (!user) return null;

  return (
    <main className="h-screen w-screen overflow-hidden bg-slate-950">
      <DynamicEditor roomId={roomId} initialContent="# Cargando..." onClose={() => router.push('/dashboard')} />
    </main>
  );
}