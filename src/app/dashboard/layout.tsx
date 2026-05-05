import { TerminalProvider } from '@/context/TerminalContext';
import OfflineIndicatorWrapper from '@/components/OfflineIndicatorWrapper';
import DashboardDndProvider from '@/components/dashboard/DashboardDndProvider';
import BodyOverflowGuard from '@/components/BodyOverflowGuard';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TerminalProvider>
      <DashboardDndProvider>
        <BodyOverflowGuard />
        {children}
        <OfflineIndicatorWrapper />
      </DashboardDndProvider>
    </TerminalProvider>
  );
}