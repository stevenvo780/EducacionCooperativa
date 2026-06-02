import withPWAInit from '@ducanh2912/next-pwa';

const ONE_HOUR = 60 * 60;
const ONE_DAY = 24 * ONE_HOUR;
const ONE_YEAR = 365 * ONE_DAY;

// @ducanh2912/next-pwa reemplaza al next-pwa@5.6 (EOL 2022). El original
// inyecta el registro del SW en `main.js`, que en App Router de Next 15 no
// existe (queda como `main-app.js`), de modo que el SW nunca se registraba
// en producción. En esta versión `runtimeCaching` y `skipWaiting` viven
// dentro de `workboxOptions`.
const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development' || process.env.DISABLE_PWA === 'true',
  register: true,
  cacheOnFrontEndNav: true,
  workboxOptions: {
    skipWaiting: true,
    cleanupOutdatedCaches: true,
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
      urlPattern: ({ url }) => url.origin === self.origin && url.pathname.includes('/stream'),
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
  }
});

/** @type {import('next').NextConfig} */
const useStandaloneOutput = process.env.NEXT_DISABLE_STANDALONE !== 'true';

const isDevEnv = process.env.NODE_ENV !== 'production';
// Escape hatch para self-hosting detrás de HTTP plano (sin TLS): omite
// upgrade-insecure-requests y HSTS, que en HTTP puro hacen que el browser
// intente cargar _next/static por https → ERR_SSL_PROTOCOL_ERROR → sin hidratación.
// En producción real (TLS) esta var debe estar ausente o ser distinto de '1'.
const isPlainHttp = process.env.AGORA_PLAIN_HTTP === '1';
// Dev-only: el stack local (back, hub, emuladores Firebase) corre fuera de
// prod sobre http; sin estos orígenes el CSP de prod bloquea el login y los
// listeners de Firestore/RTDB. Los orígenes se derivan de las NEXT_PUBLIC_*
// para que el CSP siempre matchee a dónde el front realmente conecta (sea
// localhost o una IP de lab), más localhost/127.0.0.1 por defecto.
const buildDevConnectOrigins = () => {
  const set = new Set([
    'http://localhost:8081', 'http://127.0.0.1:8081',
    'http://localhost:3010', 'ws://localhost:3010', 'http://127.0.0.1:3010', 'ws://127.0.0.1:3010',
    'http://localhost:9099', 'http://127.0.0.1:9099',
    'http://localhost:8080', 'http://127.0.0.1:8080',
    'http://localhost:9000', 'ws://localhost:9000', 'http://127.0.0.1:9000', 'ws://127.0.0.1:9000',
    'http://localhost:9100', 'http://127.0.0.1:9100',
  ]);
  const addUrl = (/** @type {string|undefined} */ u, /** @type {boolean} */ ws = false) => {
    if (!u) return;
    try { const x = new URL(u); set.add(x.origin); if (ws) set.add('ws://' + x.host); } catch { /* noop */ }
  };
  addUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
  addUrl(process.env.NEXT_PUBLIC_NEXUS_URL, true);
  const emu = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST;
  if (emu) {
    set.add('http://' + emu + ':9099'); set.add('http://' + emu + ':8080');
    set.add('http://' + emu + ':9100'); set.add('http://' + emu + ':9000'); set.add('ws://' + emu + ':9000');
  }
  return ' ' + [...set].join(' ');
};
const DEV_CONNECT_ORIGINS = (isDevEnv || isPlainHttp) ? buildDevConnectOrigins() : '';

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://cdnjs.cloudflare.com https://cdn.sheetjs.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://*.googleusercontent.com https://lh3.googleusercontent.com https://www.gravatar.com https://s3.elenxos.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://hub.elenxos.com wss://hub.elenxos.com https://s3.elenxos.com https://git.elenxos.com https://*.run.app https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebasedatabase.app https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://firebaseinstallations.googleapis.com https://api.deepseek.com https://api.openai.com https://api.anthropic.com https://cdnjs.cloudflare.com https://cdn.sheetjs.com https://raw.githubusercontent.com http://localhost:11434 http://127.0.0.1:11434" + DEV_CONNECT_ORIGINS,
  "frame-src 'self' https://accounts.google.com https://apis.google.com https://*.firebaseapp.com https://view.officeapps.live.com https://docs.google.com https://s3.elenxos.com",
  "worker-src 'self' blob: https://cdnjs.cloudflare.com",
  "media-src 'self' blob: https://s3.elenxos.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDevEnv || isPlainHttp ? [] : ["upgrade-insecure-requests"])
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP_DIRECTIVES },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
  ...(!isPlainHttp ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
  // Sobrescribe el `Access-Control-Allow-Origin: *` default de Vercel CDN
  // sobre páginas HTML (login/dashboard). Restringimos al origin canónico
  // y a humanizar.cloud (alias activo). Vercel deja al CDN el de assets
  // estáticos, donde * es estándar y seguro.
  { key: 'Access-Control-Allow-Origin', value: 'https://agora.elenxos.com' },
  { key: 'Vary', value: 'Origin' }
];

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
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: SECURITY_HEADERS
      }
    ];
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
