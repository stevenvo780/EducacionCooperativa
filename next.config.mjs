
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow imports from outside if needed (monorepo), but here we are self-contained
  transpilePackages: ['firebase', 'undici'],
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin'] 
  }
};

export default nextConfig;
