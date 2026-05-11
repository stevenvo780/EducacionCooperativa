import withPWAInit from 'next-pwa';

const ONE_HOUR = 60 * 60;
const ONE_DAY = 24 * ONE_HOUR;
const ONE_YEAR = 365 * ONE_DAY;

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development' || process.env.DISABLE_PWA === 'true',
  register: true,
  skipWaiting: true,
  cacheOnFrontEndNav: true,
  runtimeCaching: [
    {
      urlPattern: ({ url }) => url.origin === self.origin && url.pathname.startsWith('/api/auth/'),
      handler: 'NetworkOnly',
      method: 'GET'
    },
    {
      urlPattern: ({ url }) => url.origin === self.origin && url.pathname.startsWith('/api/auth/'),
      handler: 'NetworkOnly',
      method: 'POST'
    },
    {
      urlPattern: ({ url }) => url.origin === self.origin && url.pathname === '/api/diag',
      handler: 'NetworkOnly',
      method: 'GET'
    },
    {
      urlPattern: ({ url }) => url.origin === self.origin && url.pathname.startsWith('/api/documents'),
      handler: 'NetworkFirst',
      method: 'GET',
      options: {
        cacheName: 'api-documents',
        networkTimeoutSeconds: 5,
        expiration: {
          maxAgeSeconds: 7 * ONE_DAY
        },
        cacheableResponse: {
          statuses: [0, 200]
        }
      }
    },
    {
      urlPattern: ({ url }) => url.origin === self.origin && url.pathname.startsWith('/api/workspaces'),
      handler: 'NetworkFirst',
      method: 'GET',
      options: {
        cacheName: 'api-workspaces',
        networkTimeoutSeconds: 3,
        expiration: {
          maxAgeSeconds: 7 * ONE_DAY
        },
        cacheableResponse: {
          statuses: [0, 200]
        }
      }
    },
    {
      urlPattern: ({ url }) => url.origin === self.origin && url.pathname.startsWith('/api/users/'),
      handler: 'NetworkFirst',
      method: 'GET',
      options: {
        cacheName: 'api-users',
        networkTimeoutSeconds: 3,
        expiration: {
          maxAgeSeconds: ONE_DAY
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
        networkTimeoutSeconds: 5,
        expiration: {
          maxAgeSeconds: ONE_DAY
        },
        cacheableResponse: {
          statuses: [0, 200]
        }
      }
    },
    {
      urlPattern: ({ url }) => url.origin === self.origin && url.pathname.startsWith('/_next/static/'),
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-static',
        expiration: {
          maxAgeSeconds: ONE_YEAR
        },
        cacheableResponse: {
          statuses: [0, 200]
        }
      }
    },
    {
      urlPattern: ({ url }) => url.origin === self.origin && url.pathname.startsWith('/_next/image'),
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-image',
        expiration: {
          maxAgeSeconds: 30 * ONE_DAY
        }
      }
    },
    {
      urlPattern: ({ url }) => url.origin === self.origin && url.pathname.startsWith('/_next/data/'),
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-data',
        expiration: {
          maxAgeSeconds: ONE_DAY
        }
      }
    },
    {
      urlPattern: /\.(?:woff|woff2|eot|ttf|otf)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-fonts',
        expiration: {
          maxAgeSeconds: ONE_YEAR
        },
        cacheableResponse: {
          statuses: [0, 200]
        }
      }
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|avif)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-images',
        expiration: {
          maxAgeSeconds: 30 * ONE_DAY
        }
      }
    },
    {
      urlPattern: /\.(?:css|less)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-styles',
        expiration: {
          maxAgeSeconds: 30 * ONE_DAY
        }
      }
    },
    {
      urlPattern: /\.(?:js|mjs)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-scripts',
        expiration: {
          maxAgeSeconds: 30 * ONE_DAY
        }
      }
    },
    {
      urlPattern: /\.(?:mp3|wav|ogg|mp4|webm)$/i,
      handler: 'CacheFirst',
      options: {
        rangeRequests: true,
        cacheName: 'static-media',
        expiration: {
          maxAgeSeconds: 7 * ONE_DAY
        }
      }
    },
    {
      urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts-webfonts',
        expiration: {
          maxAgeSeconds: ONE_YEAR
        },
        cacheableResponse: {
          statuses: [0, 200]
        }
      }
    },
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'google-fonts-stylesheets',
        expiration: {
          maxAgeSeconds: 7 * ONE_DAY
        }
      }
    },
    {
      urlPattern: ({ url }) => url.origin === self.origin && !url.pathname.startsWith('/api/'),
      handler: 'NetworkFirst',
      method: 'GET',
      options: {
        cacheName: 'pages',
        networkTimeoutSeconds: 5,
        expiration: {
          maxAgeSeconds: 7 * ONE_DAY
        },
        cacheableResponse: {
          statuses: [0, 200]
        }
      }
    },
    {
      urlPattern: ({ url }) => url.origin !== self.origin,
      handler: 'NetworkFirst',
      method: 'GET',
      options: {
        cacheName: 'cross-origin',
        networkTimeoutSeconds: 5,
        expiration: {
          maxAgeSeconds: ONE_HOUR
        }
      }
    }
  ]
});

/** @type {import('next').NextConfig} */
const useStandaloneOutput = process.env.NEXT_DISABLE_STANDALONE !== 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: useStandaloneOutput ? 'standalone' : undefined,
  // Silenciar el warning de "multiple lockfiles": el wrapper EducacionCooperativa
  // tiene su propio package-lock.json (sin workspaces) y AgoraFront es un repo
  // independiente con el suyo. Anclamos el tracing a este repo.
  outputFileTracingRoot: new URL('.', import.meta.url).pathname,
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
