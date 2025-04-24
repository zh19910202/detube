import { LitNodeClient } from '@lit-protocol/lit-node-client'
import { LIT_NETWORK } from '@lit-protocol/constants'

// 定义 LitNetwork 类型
type LitNetwork = 'datil-dev' | 'datil-test' | 'datil' | 'custom'

// 单例缓存
let litClientInstance: LitNodeClient | null = null
let connectionPromise: Promise<void> | null = null

// 默认超时时间（毫秒）
const CONNECT_TIMEOUT = 10000

export const getLitClient = async (): Promise<LitNodeClient> => {
  // 如果已有可用实例，直接返回
  if (litClientInstance && litClientInstance.ready) {
    return litClientInstance
  }

  // 如果正在连接，等待现有连接
  if (connectionPromise) {
    await connectionPromise
    if (litClientInstance && litClientInstance.ready) {
      return litClientInstance
    }
    throw new Error('现有 Lit 客户端连接失败')
  }

  try {
    // 检查浏览器环境
    if (typeof window === 'undefined') {
      throw new Error('Lit 客户端仅支持浏览器环境')
    }
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('浏览器不支持 WebCrypto API，请使用现代浏览器并确保 HTTPS')
    }
    if (!window.ethereum) {
      throw new Error('请安装 MetaMask 或其他钱包扩展')
    }

    // 从环境变量获取网络配置
    const envNetwork = process.env.NEXT_PUBLIC_LIT_NETWORK
    const validNetworks: LitNetwork[] = [
      LIT_NETWORK.DatilDev,
      LIT_NETWORK.DatilTest,
      LIT_NETWORK.Datil,
      LIT_NETWORK.Custom,
    ]
    const litNetwork: LitNetwork = validNetworks.includes(envNetwork as LitNetwork)
      ? (envNetwork as LitNetwork)
      : LIT_NETWORK.DatilDev

    // 创建新客户端
    litClientInstance = new LitNodeClient({
      litNetwork,
      debug: process.env.NODE_ENV === 'development',
    })

    // 设置连接超时（显式类型断言）
    connectionPromise = Promise.race<void>([
      litClientInstance.connect() as Promise<void>,
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Lit 客户端连接超时')), CONNECT_TIMEOUT)
      ),
    ])

    await connectionPromise

    // 验证连接状态
    if (!litClientInstance.ready) {
      throw new Error('Lit 客户端未准备就绪')
    }

    // 验证钱包连接
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' })
      if (!accounts || accounts.length === 0) {
        throw new Error('未连接钱包，请在 MetaMask 中授权')
      }
    } catch (error) {
      throw new Error(`钱包连接失败: ${error instanceof Error ? error.message : String(error)}`)
    }

    console.log('Lit 客户端初始化成功:', { network: litNetwork })
    return litClientInstance
  } catch (error) {
    console.error('Lit 客户端初始化失败:', error)
    // 清理失败的实例
    litClientInstance = null
    connectionPromise = null
    const message = error instanceof Error
      ? `Lit 客户端初始化失败: ${error.message}`
      : 'Lit 客户端初始化失败: 未知错误'
    throw new Error(message)
  } finally {
    // 清理连接承诺
    connectionPromise = null
  }
}

// 清理客户端
export const disconnectLitClient = async () => {
  if (litClientInstance) {
    try {
      await litClientInstance.disconnect()
      console.log('Lit 客户端已断开')
    } catch (error) {
      console.warn('Lit 客户端断开失败:', error)
    }
    litClientInstance = null
  }
}