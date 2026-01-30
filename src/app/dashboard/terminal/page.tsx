'use client';

import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';

const Terminal = dynamic(() => import('@/components/Terminal'), { ssr: false });

export default function TerminalPage() {
    const { user } = useAuth();

    if (!user) return <div className="p-8">Please login to access your assistant.</div>;

    return (
        <div className="h-screen flex flex-col">
            <header className="p-4 bg-gray-900 text-white border-b border-gray-800">
                <h1 className="text-xl font-bold">My Personal Assistant</h1>
                <p className="text-sm text-gray-400">Connected via Nexus Protocol</p>
            </header>
            <main className="flex-1 bg-black p-4">
                {/* Point to local Nexus for dev, or env var in prod */}
                <Terminal nexusUrl={process.env.NEXT_PUBLIC_NEXUS_URL || 'http://localhost:3002'} />
            </main>
        </div>
    );
}
