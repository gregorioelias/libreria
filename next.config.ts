import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ["localhost", "192.168.0.7", "*.loca.lt", "*.ngrok-free.app", "*.ngrok-free.dev"],
};

export default nextConfig;
