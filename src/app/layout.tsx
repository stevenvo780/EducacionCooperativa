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
  themeColor: '#0a0a0f',
  width: 'device-width',
  initialScale: 1
};

export const metadata: Metadata = {
  metadataBase: new URL('https://agora.elenxos.com'),
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
  },
  openGraph: {
    type: 'website',
    siteName: PRODUCT_BRAND.name,
    title: PRODUCT_BRAND.title,
    description: PRODUCT_BRAND.metadataDescription,
    url: 'https://agora.elenxos.com',
    locale: 'es_ES'
  },
  twitter: {
    card: 'summary',
    title: PRODUCT_BRAND.title,
    description: PRODUCT_BRAND.metadataDescription
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true }
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
