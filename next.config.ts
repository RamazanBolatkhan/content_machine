import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is opened at 127.0.0.1 (X login needs that exact host); without this the
  // dev server blocks hot reload and fonts for that host and pages keep "loading"
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
