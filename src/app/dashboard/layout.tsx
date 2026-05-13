import type { Metadata } from 'next';
import { TerminalProvider } from '@/context/TerminalContext';
import OfflineIndicatorWrapper from '@/components/OfflineIndicatorWrapper';
import DashboardDndProvider from '@/components/dashboard/DashboardDndProvider';
import BodyOverflowGuard from '@/components/BodyOverflowGuard';
import SemanticPersistGuard from '@/components/SemanticPersistGuard';

export const metadata: Metadata = {
  alternates: {
    canonical: '/dashboard'
  }
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TerminalProvider>
      <DashboardDndProvider>
        <BodyOverflowGuard />
        <SemanticPersistGuard />
        <main aria-label="Contenido principal" className="contents">
          {children}
        </main>
        <OfflineIndicatorWrapper />
      </DashboardDndProvider>
    </TerminalProvider>
  );
}