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
  alternates: {
    canonical: '/'
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: '/apple-touch-icon.png'
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
    locale: 'es_ES',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: PRODUCT_BRAND.title
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: PRODUCT_BRAND.title,
    description: PRODUCT_BRAND.metadataDescription,
    images: ['/og-image.png']
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
