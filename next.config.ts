import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the dev badge away from the sidebar's collapse button.
  devIndicators: { position: "bottom-right" },
  experimental: {
    // Images up to 5 MB go through server actions; leave room for multipart overhead.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
