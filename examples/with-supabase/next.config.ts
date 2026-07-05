import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  allowedDevOrigins: ["127.0.0.1"],
  // This example lives inside the Next.js monorepo; pin the workspace root so
  // its own lockfile (not the monorepo's) wins. Harmless in a standalone clone.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
