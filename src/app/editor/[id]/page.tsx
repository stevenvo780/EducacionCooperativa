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

  if (loading) return <div className="flex h-screen items-center justify-center">Cargando...</div>;
  if (!user) return null;

  return (
    <main className="flex flex-col h-screen">
      <header className="bg-gray-800 text-white p-4 flex justify-between items-center z-10 w-full font-mono text-sm">
        <div className="flex items-center gap-4">
            <button 
                onClick={() => router.push('/dashboard')}
                className="text-gray-300 hover:text-white"
            >
                &larr; Volver
            </button>
            <p>Editor: {roomId}</p>
        </div>
      </header>
      
      <div className="flex-1 overflow-hidden p-4 bg-gray-900">
        <DynamicEditor roomId={roomId} initialContent="# Cargando..." />
      </div>
    </main>
  );
}
