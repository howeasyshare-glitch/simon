/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // 讓 explore.html 的 /explore/list 轉去新的扁平 API
      { source: "/explore/list", destination: "/api/explore" },

      // 讓 /api/share/<slug> 也能用（轉成 query）
      { source: "/api/share/:slug", destination: "/api/share?slug=:slug" },
    ];
  },
};

module.exports = nextConfig;
