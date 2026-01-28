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
    } else if (user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  return <div className="flex h-screen items-center justify-center">Redirigiendo...</div>;
}


