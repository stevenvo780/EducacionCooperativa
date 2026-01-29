
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Disable SWC minification to fix "Super constructor null" with xterm/mosaic classes
  swcMinify: false,
  // Allow imports from outside if needed (monorepo), but here we are self-contained
  transpilePackages: ['react-mosaic-component', 'firebase', 'undici', '@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-web-links'],
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin'] 
  }
};

export default nextConfig;
