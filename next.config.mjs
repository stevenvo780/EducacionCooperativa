import withPWAInit from 'next-pwa';
import runtimeCaching from 'next-pwa/cache.js';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development' || process.env.DISABLE_PWA === 'true',
  register: true,
  skipWaiting: true,
  cacheOnFrontEndNav: true,
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
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-images',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
        }
      }
    },
    {
      urlPattern: /\.(?:woff|woff2|eot|ttf|otf)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-fonts',
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 365 * 24 * 60 * 60 // 1 year
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
  transpilePackages: ['react-mosaic-component', 'firebase', 'undici', '@stevenvo780/st-lang', '@stevenvo780/autologic'],
  experimental: {
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
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        worker_threads: false,
        readline: false,
        child_process: false,
        net: false,
        tls: false,
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
