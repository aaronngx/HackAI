import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      framer: "./src/lib/framer-stub.js",
    },
  },
};

export default nextConfig;
