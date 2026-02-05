import withPWAInit from 'next-pwa';
import runtimeCaching from 'next-pwa/cache.js';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: ({ url }) => url.origin === self.origin && url.pathname.startsWith('/api/documents'),
      handler: 'NetworkOnly',
      method: 'GET'
    },
    ...runtimeCaching
  ]
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  swcMinify: false,
  transpilePackages: ['react-mosaic-component', 'firebase', 'undici'],
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin'] 
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
