import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the dev badge away from the sidebar's collapse button.
  devIndicators: { position: "bottom-right" },
  experimental: {
    // Mock-mode uploads (up to 4 MB) go through a server action; real files go straight to storage.
    serverActions: { bodySizeLimit: "6mb" },
  },
  // The PDF renderer loads fonts and native-ish deps at runtime; keep it out of the bundle.
  serverExternalPackages: ["@react-pdf/renderer"],
  // Font and logo files are read from disk by the PDF route; make sure they ship with it.
  outputFileTracingIncludes: {
    "/api/estimates/*/pdf": ["./src/assets/fonts/**/*", "./src/assets/brand/**/*"],
  },
};

export default nextConfig;
