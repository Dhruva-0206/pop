import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@pop/shared", "@pop/checkout-sdk"],
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
