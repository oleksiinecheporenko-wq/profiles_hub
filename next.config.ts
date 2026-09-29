import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the dev badge away from the sidebar's collapse button.
  devIndicators: { position: "bottom-right" },
  experimental: {
    // Images up to 5 MB go through server actions; leave room for multipart overhead.
    serverActions: { bodySizeLimit: "6mb" },
  },
  // The PDF renderer loads fonts and native-ish deps at runtime; keep it out of the bundle.
  serverExternalPackages: ["@react-pdf/renderer"],
  // Font files are read from disk by the export route; make sure they ship with it.
  outputFileTracingIncludes: {
    "/api/contracts/*/export": ["./src/assets/fonts/**/*"],
  },
};

export default nextConfig;
