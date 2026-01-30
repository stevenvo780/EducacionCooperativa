import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';

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
            {children}
        </AuthProvider>
      </body>
    </html>
  );
}
