import withPWAInit from 'next-pwa';
import runtimeCaching from 'next-pwa/cache.js';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: ({ url }) => url.origin === self.origin && url.pathname.startsWith('/api/documents'),
      handler: 'NetworkFirst',
      method: 'GET',
      options: {
        cacheName: 'api-documents',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
        },
        cacheableResponse: {
          statuses: [0, 200]
        }
      }
    },
    {
      urlPattern: ({ url }) => url.origin === self.origin && url.pathname.startsWith('/api/'),
      handler: 'NetworkFirst',
      method: 'GET',
      options: {
        cacheName: 'api-general',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 24 * 60 * 60 // 1 day
        },
        cacheableResponse: {
          statuses: [0, 200]
        }
      }
    },
    ...runtimeCaching
  ]
});

/** @type {import('next').NextConfig} */
const useStandaloneOutput = process.env.NEXT_DISABLE_STANDALONE !== 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: useStandaloneOutput ? 'standalone' : undefined,
  transpilePackages: ['react-mosaic-component', 'firebase', 'undici', '@stevenvo780/st-lang'],
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin'],
    serverActions: {
      bodySizeLimit: '50mb'
    }
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't minify xterm packages - they break with any minifier
      config.module.rules.push({
        test: /[\\/]node_modules[\\/]@xterm[\\/]/,
        sideEffects: true,
      });
      
      // Handle pdfjs-dist for browser
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };
    }
    
    // Exclude canvas from bundling (Node.js only module)
    config.externals = config.externals || [];
    if (Array.isArray(config.externals)) {
      config.externals.push('canvas');
    }
    
    return config;
  },
};

export default withPWA(nextConfig);
