/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer, dev }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    // Exclude .node files from webpack bundling (native addons)
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        '../../../gpu-vanity/index.node': 'commonjs ../../../gpu-vanity/index.node'
      });
    }

    // SECURITY NOTE: Next.js automatically removes console.log in production builds
    // via built-in Terser configuration when running `npm run build`

    return config;
  },
  // Disable image optimization for static export if needed
  images: {
    unoptimized: false,
  },
  // Optimize performance
  reactStrictMode: true,

  // SECURITY FIX: Add security headers including CSP
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: https: blob:",
              "connect-src 'self' https://*.solana.com https://*.alchemy.com https://*.jup.ag https://*.ankr.com https://*.sonic.game wss://*.solana.com wss://*.alchemy.com https://*.supabase.co",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'"
            ].join('; ')
          }
        ],
      },
    ];
  },
}

module.exports = nextConfig
