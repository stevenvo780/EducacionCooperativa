import { TerminalProvider } from '@/context/TerminalContext';
import OfflineIndicatorWrapper from '@/components/OfflineIndicatorWrapper';

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <TerminalProvider>
      {children}
      <OfflineIndicatorWrapper />
    </TerminalProvider>
  );
}