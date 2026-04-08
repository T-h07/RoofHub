import type { NextConfig } from "next";

const allowedDevOrigins = (
  process.env.NEXT_DEV_ALLOWED_ORIGINS ??
  "localhost,127.0.0.1,100.105.126.106"
)
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
