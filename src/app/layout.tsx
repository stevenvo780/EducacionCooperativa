import type { Metadata, Viewport } from 'next';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import StoreProvider from '@/components/StoreProvider';
import { TerminalProvider } from '@/context/TerminalContext';

import OfflineIndicator from '@/components/OfflineIndicator';

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1
};

export const metadata: Metadata = {
  title: 'Agora',
  description: 'Collaborative Learning Platform',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg'
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Agora'
  },
  formatDetection: {
    telephone: false
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
              <OfflineIndicator />
            </TerminalProvider>
          </AuthProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
