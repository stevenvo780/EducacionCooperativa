'use client';

import { AuthProvider as ContextProvider } from '@/context/AuthContext';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    return (
        <DndProvider backend={HTML5Backend}>
            <ContextProvider>{children}</ContextProvider>
        </DndProvider>
    );
}
