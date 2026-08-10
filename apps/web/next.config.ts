import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@construction-ops/shared", "@construction-ops/validation"],
};

export default nextConfig;
