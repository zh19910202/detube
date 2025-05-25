const nextConfig = {
  webpack (config) {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      child_process: false, // Disable child_process module
      'pino-pretty': false, // Disable pino-pretty if not used or causing issues
      fs: false, // Commonly needed for various libraries in browser environment
      net: false, // if you don't need net module
      tls: false, // if you don't need tls module
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
        hostname: 'ipfs.io',
      },
      {
        protocol: 'https',
        hostname: 'gateway.ipfs.io',
      },
      // Add any other IPFS gateways you might use
      {
        protocol: 'https',
        hostname: 'via.placeholder.com', // For placeholder images
      },
    ],
  },
}

export default nextConfig 