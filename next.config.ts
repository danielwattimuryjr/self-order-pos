import type { NextConfig } from "next";

const nextConfig: NextConfig = process.env.E2E_ISOLATED_DEV === "1"
  ? { distDir: ".next-e2e" }
  : {};

export default nextConfig;
