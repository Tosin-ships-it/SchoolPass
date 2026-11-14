/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@node-rs/argon2'],
  async rewrites() {
    return [
      { source: '/auth/login', destination: '/auth?view=login' },
      { source: '/auth/register', destination: '/auth?view=register' },
      { source: '/auth/forgot-password', destination: '/auth?view=forgot-password' },
      { source: '/auth/reset-password', destination: '/auth?view=reset-password' },
      { source: '/auth/staff-login', destination: '/auth?view=staff-login' },
      { source: '/auth/verify-email', destination: '/auth?view=verify-email' },
    ];
  },
};

module.exports = nextConfig;
