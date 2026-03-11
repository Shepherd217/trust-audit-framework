/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Required for Stripe webhook raw body parsing
    serverComponentsExternalPackages: ['stripe'],
  },
  // Environment variables that should be available on the server
  env: {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  },
};

module.exports = nextConfig;
