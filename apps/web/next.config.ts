import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

// Local dev: the single source of env is pop/.env (Vercel sets env in the project instead).
// Never on Vercel; POP_NO_ROOT_ENV=1 lets a local run prove it works from explicit env only.
if (!process.env.VERCEL && !process.env.POP_NO_ROOT_ENV) loadEnv({ path: resolve(__dirname, "..", "..", ".env"), quiet: true });

const nextConfig: NextConfig = {
  transpilePackages: ["@pop/shared"],
  // Cache Components stays on. Every route that reads chain or app state calls `await connection()`
  // (request-time), and pages that show live state are client components polling those routes.
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
