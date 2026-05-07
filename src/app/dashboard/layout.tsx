import { TerminalProvider } from '@/context/TerminalContext';
import OfflineIndicatorWrapper from '@/components/OfflineIndicatorWrapper';
import DashboardDndProvider from '@/components/dashboard/DashboardDndProvider';
import BodyOverflowGuard from '@/components/BodyOverflowGuard';
import SemanticPersistGuard from '@/components/SemanticPersistGuard';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TerminalProvider>
      <DashboardDndProvider>
        <BodyOverflowGuard />
        <SemanticPersistGuard />
        {children}
        <OfflineIndicatorWrapper />
      </DashboardDndProvider>
    </TerminalProvider>
  );
}