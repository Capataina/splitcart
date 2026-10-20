import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // highs ships a .wasm beside its JS loader; bundling it breaks the relative
  // wasm lookup, so Node must require it from node_modules at run time.
  serverExternalPackages: ["highs"],
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
