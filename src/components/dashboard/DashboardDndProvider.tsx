'use client';

import { DndProvider } from 'react-dnd';
import { MultiBackend } from 'react-dnd-multi-backend';
import { HTML5toTouch } from 'rdndmb-html5-to-touch';

export default function DashboardDndProvider({ children }: { children: React.ReactNode }) {
  return (
    <DndProvider backend={MultiBackend} options={HTML5toTouch}>
      {children}
    </DndProvider>
  );
}
