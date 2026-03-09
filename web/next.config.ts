import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/the-ceremony",
  env: { NEXT_PUBLIC_BASE_PATH: "/the-ceremony" },
};

export default nextConfig;
