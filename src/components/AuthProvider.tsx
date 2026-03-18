'use client';

import { AuthProvider as ContextProvider } from '@/context/AuthContext';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    return <ContextProvider>{children}</ContextProvider>;
}
