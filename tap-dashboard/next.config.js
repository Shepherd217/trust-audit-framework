/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Required for Stripe webhook raw body parsing
    serverComponentsExternalPackages: ['stripe', 'onnxruntime-node', '@xenova/transformers'],
  },
  // Environment variables that should be available on the server
  env: {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  },
  webpack: (config, { isServer }) => {
    // Exclude native .node files from webpack bundling
    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader',
    });
    
    // Handle native modules that can't be bundled
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    
    return config;
  },
};

module.exports = nextConfig;
