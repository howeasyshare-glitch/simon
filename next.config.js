/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep your pretty function-like routes working
  async rewrites() {
    return [
      // Explore list endpoint (your frontends call /explore/list)
      { source: '/explore/list', destination: '/api/explore/list' },

      // Optional: keep old /api/share/:slug if you already have it
      // Next will serve /api/share/:slug from pages/api/share/[slug].js
      { source: '/api/share/:slug', destination: '/api/share/:slug' }
    ];
  },
};

export default nextConfig;
