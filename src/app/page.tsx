'use client';

import { useAuth } from '@/context/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const DynamicEditor = dynamic(() => import('@/components/Editor'), { ssr: false });

export default function Home() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

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
        <p>Bienvenido, {user.email || user.displayName}</p>
        <button 
          onClick={logout}
          className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
        >
          Cerrar Sesión
        </button>
      </header>
      
      <div className="flex-1 overflow-hidden p-4 bg-gray-900">
        <p className="text-white mb-2">Editor Colaborativo (Room: default)</p>
        <DynamicEditor roomId="default" initialContent="# Hola Mundo" />
      </div>
    </main>
  );
}

