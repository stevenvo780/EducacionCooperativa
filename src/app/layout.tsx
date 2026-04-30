import type { Metadata, Viewport } from 'next';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import StoreProvider from '@/components/StoreProvider';
import SyncEventsBridge from '@/components/SyncEventsBridge';
import MobileDragDropPolyfill from '@/components/MobileDragDropPolyfill';
import PWAUpdater from '@/components/PWAUpdater';
import { Toaster } from '@/components/ui/Toaster';
import GlobalErrorBoundary from '@/components/GlobalErrorBoundary';
import GlobalErrorCatcher from '@/components/GlobalErrorCatcher';
import { PRODUCT_BRAND } from '@/lib/branding';

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1
};

export const metadata: Metadata = {
  title: PRODUCT_BRAND.title,
  description: PRODUCT_BRAND.metadataDescription,
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg'
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: PRODUCT_BRAND.name
  },
  formatDetection: {
    telephone: false
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="" suppressHydrationWarning>
        <GlobalErrorCatcher />
        <Toaster position="top-right" richColors />
        <GlobalErrorBoundary>
          <StoreProvider>
            <AuthProvider>
              <SyncEventsBridge />
              <MobileDragDropPolyfill />
              {children}
              <PWAUpdater />
            </AuthProvider>
          </StoreProvider>
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
