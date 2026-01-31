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
    }
    return config;
  },
};

export default nextConfig;
