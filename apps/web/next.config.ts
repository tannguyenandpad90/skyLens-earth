import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@skylens/ui", "@skylens/lib", "@skylens/types"],
  experimental: {
    serverComponentsExternalPackages: ["ioredis"],
  },
};

export default nextConfig;
