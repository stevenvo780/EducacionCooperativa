
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Allow imports from outside if needed (monorepo), but here we are self-contained
  transpilePackages: ['react-mosaic-component', 'firebase', 'undici', '@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-web-links'],
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin'] 
  }
};

export default nextConfig;
