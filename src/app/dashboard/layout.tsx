import { TerminalProvider } from '@/context/TerminalContext';
import OfflineIndicatorWrapper from '@/components/OfflineIndicatorWrapper';
import DashboardDndProvider from '@/components/dashboard/DashboardDndProvider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TerminalProvider>
      <DashboardDndProvider>
        {children}
        <OfflineIndicatorWrapper />
      </DashboardDndProvider>
    </TerminalProvider>
  );
}