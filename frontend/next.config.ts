import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strict mode double-invokes effects in dev, which causes MediaPipe WASM
  // to be initialized twice and crash on the second attempt.
  reactStrictMode: false,

  turbopack: {
    resolveAlias: {
      framer: "./src/lib/framer-stub.js",
    },
  },

};

export default nextConfig;
