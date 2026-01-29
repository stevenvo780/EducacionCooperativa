import TerserPlugin from 'terser-webpack-plugin';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  swcMinify: false,
  transpilePackages: ['react-mosaic-component', 'firebase', 'undici', '@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-web-links'],
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin'] 
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization.minimizer = config.optimization.minimizer?.filter(
        (m) => m.constructor.name !== 'TerserPlugin'
      ) || [];
      config.optimization.minimizer.push(
        new TerserPlugin({
          terserOptions: {
            keep_classnames: true,
            keep_fnames: true,
          },
        })
      );
    }
    return config;
  },
};

export default nextConfig;
