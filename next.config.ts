import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config) {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      child_process: false, // 禁用 child_process 模块
    };
    return config;
  },
};

module.exports = {
  images: {
    domains: ['via.placeholder.com'], 
  },
};




export default nextConfig;
