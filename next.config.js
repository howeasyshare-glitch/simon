/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: "/explore/list", destination: "/api/explore" },
      { source: "/api/share/:slug", destination: "/api/share?slug=:slug" },
    ];
  },
};

export default nextConfig;
