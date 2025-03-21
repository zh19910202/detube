/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack (config) {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      child_process: false, // 禁用 child_process 模块
      'pino-pretty': false,
    }
    return config
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.mypinata.cloud',
      },
      {
        protocol: 'https',
        hostname: 'gateway.pinata.cloud',
      },
      {
        protocol: 'https',
        hostname: 'gateway-0.4everland.co',
      },
      {
        protocol: 'https',
        hostname: 'gateway.ipfs.io',
      },
      {
        protocol: 'https',
        hostname: 'ipfs.io',
      },
      {
        protocol: 'https',
        hostname: 'ipfs.filebase.io',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
    ],
  },
  // 关闭 ESLint 检查（仅用于构建）
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig 