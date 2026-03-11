import { TerminalProvider } from '@/context/TerminalContext';
import OfflineIndicatorWrapper from '@/components/OfflineIndicatorWrapper';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TerminalProvider>
      {children}
      <OfflineIndicatorWrapper />
    </TerminalProvider>
  );
}