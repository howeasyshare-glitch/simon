/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // legacy explore.html 會打這條
      { source: "/explore/list", destination: "/api/explore" },

      // 讓 /api/share/<slug> 也能用（可留可不留）
      { source: "/api/share/:slug", destination: "/api/share?slug=:slug" },
    ];
  },
};

module.exports = nextConfig;
