import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import { TerminalProvider } from '@/context/TerminalContext';

export const metadata: Metadata = {
  title: 'AgoraSync',
  description: 'Collaborative Learning Platform'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="">
        <AuthProvider>
            <TerminalProvider>
                {children}
            </TerminalProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
