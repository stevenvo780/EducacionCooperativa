import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import StoreProvider from '@/components/StoreProvider';
import { TerminalProvider } from '@/context/TerminalContext';

export const metadata: Metadata = {
  title: 'Agora',
  description: 'Collaborative Learning Platform',
  icons: {
    icon: '/favicon.svg'
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="">
        <StoreProvider>
          <AuthProvider>
            <TerminalProvider>
              {children}
            </TerminalProvider>
          </AuthProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
