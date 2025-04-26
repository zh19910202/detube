import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import {
  sepolia,
  mainnet,
  polygon,
  optimism,
  arbitrum,
  base,
} from 'wagmi/chains'
import { cookieStorage, createStorage } from 'wagmi'

// 判断是否为生产环境
const isProduction = process.env.NODE_ENV === 'production'

// 创建持久化存储配置，使用cookie存储连接状态
const storage = createStorage({
  storage: cookieStorage,
  key: 'detube-connection-state',
})

export const config = getDefaultConfig({
  appName: 'Detube',
  projectId: 'd20062f0065b7c85019c0c995a61f910',
  chains: [
    mainnet,
    polygon,
    optimism,
    arbitrum,
    base,
    sepolia,
    ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true' ? [sepolia] : []),
  ],
  // 启用持久化存储
  storage,
  // 确保SSR支持
  ssr: true,
  // 在生产环境中禁用开发模式
  ...(isProduction ? { initialChain: mainnet } : {}),
})
