'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams } from 'next/navigation'
import {
  useSendTransaction,
  useWaitForTransactionReceipt,
  useAccount,
} from 'wagmi'
import { parseEther, isAddress } from 'viem'
import { VideoMetadata } from '../../hooks/usePinata'
import { handleVideoDecryption } from '../../lib/lit/handleVideoDecryption'
import { ethers } from 'ethers'
import { fromByteArray } from 'base64-js'
import Comments from '@/app/components/Comments' // 导入评论组件

// 添加防抖函数
function debounce<T extends (...args: Parameters<T>) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return function (...args: Parameters<T>) {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// 确保地址格式正确的辅助函数
const formatEthAddress = (address: string): `0x${string}` | null => {
  // 如果地址为空，返回null
  if (!address) return null

  // 确保地址以0x开头
  const formattedAddress = address.startsWith('0x') ? address : `0x${address}`

  // 验证是否为有效的以太坊地址
  if (isAddress(formattedAddress)) {
    return formattedAddress as `0x${string}`
  }

  return null
}

// 添加格式化钱包地址的辅助函数
const formatDisplayAddress = (address: string): string => {
  if (!address) return '未知地址'
  if (address.length <= 10) return address
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
}

// 订阅合约ABI
const subscriptionContractABI = [
  {
    inputs: [],
    name: 'mint',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'user',
        type: 'address',
      },
    ],
    name: 'balanceOf',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
]

// 订阅合约地址 - 这里使用README中提到的示例地址，实际使用时应替换为真实地址
const SUBSCRIPTION_CONTRACT_ADDRESS =
  '0x76C6D6A66f8379660B22B0540Fd4fc9dbD2CA53B'

const VideoPage = () => {
  const { videoJsonCid } = useParams()
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null)
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [decryptedVideoUrl, setDecryptedVideoUrl] = useState<string | null>(
    null
  )
  const [isLoading, setIsLoading] = useState(false)
  const [isMetadataLoading, setIsMetadataLoading] = useState(true)
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const [tipAmount, setTipAmount] = useState<string>('0.01') // 默认打赏金额为 0.01 ETH
  const [displayAmount, setDisplayAmount] = useState<string>('0.01') // 用于显示的金额，减少重渲染
  const [tipError, setTipError] = useState<string | null>(null) // 新增错误状态
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false) // 订阅状态
  const [isSubscribing, setIsSubscribing] = useState<boolean>(false) // 订阅中状态
  const [subscribeError, setSubscribeError] = useState<string | null>(null) // 订阅错误状态
  const [showSubscribeConfirmation, setShowSubscribeConfirmation] =
    useState<boolean>(false) // 订阅确认状态
  const {
    data: hash,
    sendTransaction,
    error,
    isPending: isTransactionPending,
  } = useSendTransaction()
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash })
  const { isConnected, address: userAddress } = useAccount() // 获取当前用户的钱包地址
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [walletWithProvider, setWalletWithProvider] = useState<ethers.Signer>()
  const [decryptError, setDecryptError] = useState<string | null>(null) // 新增解密错误状态
  const prevDecryptedUrlRef = useRef<string | null>(null)
  // 使用useMemo缓存交易状态，减少状态变化导致的重渲染
  // 初始化钱包提供者
  const initWalletProvider = useCallback(async () => {
    try {
      if (!isConnected || !userAddress) {
        console.log('钱包未连接或用户地址为空')
        return
      }

      console.log('开始初始化钱包 signer')

      // 1. 创建 Metamask 提供者
      const browserProvider = new ethers.BrowserProvider(window.ethereum)

      // 2. 请求账户访问
      await browserProvider.send('eth_requestAccounts', [])

      // 3. 获取 signer
      const signer = await browserProvider.getSigner()

      // 4. 打印 signer 地址
      const address = await signer.getAddress()
      console.log('已连接地址:', address)

      // 5. 设置 signer（用于 generateAuthSig）
      setWalletWithProvider(signer) // signer 即可，无需连接 Lit RPC
    } catch (error) {
      console.error('钱包初始化失败:', error)
      setWalletWithProvider(undefined)
    }
  }, [isConnected, userAddress])

  // 使用 Effect 调用
  useEffect(() => {
    initWalletProvider()
  }, [isConnected, userAddress, initWalletProvider])

  // 检查订阅状态
  const checkSubscriptionStatus = useCallback(async () => {
    if (!isConnected || !userAddress) {
      return
    }

    try {
      // 创建合约实例
      const provider = new ethers.BrowserProvider(window.ethereum)
      const contract = new ethers.Contract(
        SUBSCRIPTION_CONTRACT_ADDRESS,
        subscriptionContractABI,
        provider
      )

      // 调用balanceOf方法检查用户是否持有订阅NFT
      const balance = await contract.balanceOf(userAddress)
      setIsSubscribed(balance > 0)
      console.log('订阅状态:', balance > 0 ? '已订阅' : '未订阅')
    } catch (error) {
      console.error('检查订阅状态失败:', error)
      setIsSubscribed(false)
    }
  }, [isConnected, userAddress])

  useEffect(() => {
    checkSubscriptionStatus()
  }, [checkSubscriptionStatus])

  // 处理订阅
  const handleSubscribe = async () => {
    if (!isConnected || !userAddress) {
      setSubscribeError('请先连接钱包后再订阅！')
      return
    }

    // 如果已经订阅，则不需要再次订阅
    if (isSubscribed) {
      // 已订阅状态下不显示错误信息，直接返回
      return
    }

    setIsSubscribing(true)
    setSubscribeError(null)

    try {
      // 发送交易调用合约的mint方法并支付0.1 ETH
      await sendTransaction({
        to: SUBSCRIPTION_CONTRACT_ADDRESS,
        value: parseEther('0.1'), // 固定支付0.1 ETH
        data: '0x6a627842', // mint方法的函数选择器
      })

      // 交易发送成功后，等待确认
      // 注意：实际确认会在useEffect中通过isConfirmed状态监控
    } catch (err) {
      console.error('订阅失败:', err)
      setSubscribeError('订阅失败，请重试！')
    } finally {
      setIsSubscribing(false)
    }
  }

  // 交易状态 - 用于打赏功能
  const transactionStatus = useMemo(() => {
    if (isTransactionPending || isLoading) return 'pending'
    if (isConfirming) return 'confirming'
    if (showConfirmation) return 'success'
    if (error) return 'error'
    return 'idle'
  }, [isTransactionPending, isLoading, isConfirming, showConfirmation, error])

  // 订阅交易状态 - 用于订阅功能
  const subscriptionStatus = useMemo(() => {
    if (isSubscribing) return 'pending'
    if (isConfirming && !showSubscribeConfirmation) return 'confirming'
    if (showSubscribeConfirmation) return 'success'
    if (error) return 'error'
    return 'idle'
  }, [isSubscribing, isConfirming, showSubscribeConfirmation, error])

  // 获取视频元数据
  useEffect(() => {
    const fetchMetadata = async () => {
      if (!videoJsonCid) return

      setIsMetadataLoading(true)
      setMetadataError(null)

      try {
        // 从 IPFS 获取元数据 JSON
        const response = await fetch(
          `${getPinataGateway()}/ipfs/${videoJsonCid}`
        )

        if (!response.ok) {
          throw new Error(`Failed to fetch metadata: ${response.statusText}`)
        }

        const data = await response.json()
        // console.log('获取到的原始元数据:', data)
        // console.log('描述字段:', data.description)

        const metadata = {
          cid: videoJsonCid as string,
          title: data.title || '未命名视频',
          description: data.description || '无描述',
          coverImageCid: data.coverImageCid,
          videoCid: data.videoCid,
          timestamp: data.timestamp,
          author: data.author || '', // 获取作者钱包地址
          isPublic: data.isPublic || false, // 获取视频的公开状态
          dataToEncryptHash: data.dataToEncryptHash || '', // 获取原始视频数据的哈希值
        }

        // console.log('处理后的元数据:', metadata)
        setVideoMetadata(metadata)

        // 模拟评论数据
        // setComments(['真不错的视频！', '学到了很多，感谢分享'])
      } catch (err) {
        console.error('Error fetching video metadata:', err)
        setMetadataError('无法加载视频信息，请检查网络连接或稍后重试')
      } finally {
        setIsMetadataLoading(false)
      }
    }

    fetchMetadata()
  }, [videoJsonCid])

  useEffect(() => {
    if (isConfirmed && hash) {
      // 显示确认消息
      setShowConfirmation(true)
      setShowSubscribeConfirmation(true)

      // 如果交易确认成功，更新订阅状态
      checkSubscriptionStatus()

      const timer = setTimeout(() => {
        setShowConfirmation(false)
        setShowSubscribeConfirmation(false)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isConfirmed, hash, checkSubscriptionStatus])
  // 使用 useRef 跟踪上一个解密 URL

  // 清理解密 URL（组件卸载时）
  useEffect(() => {
    return () => {
      if (prevDecryptedUrlRef.current) {
        URL.revokeObjectURL(prevDecryptedUrlRef.current)
        console.log('清理上一解密 URL:', prevDecryptedUrlRef.current)
      }
    }
  }, [])

  // 清理旧的解密 URL（新 URL 设置时）
  useEffect(() => {
    if (
      decryptedVideoUrl &&
      prevDecryptedUrlRef.current !== decryptedVideoUrl
    ) {
      if (prevDecryptedUrlRef.current) {
        URL.revokeObjectURL(prevDecryptedUrlRef.current)
        console.log('清理旧解密 URL:', prevDecryptedUrlRef.current)
      }
      prevDecryptedUrlRef.current = decryptedVideoUrl
    }
  }, [decryptedVideoUrl])

  // 处理金额输入变化，使用内联防抖函数
  const handleTipAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setDisplayAmount(value) // 立即更新显示

    // 使用内联防抖函数替代独立的debouncedSetTipAmount
    debounce((val: string) => {
      setTipAmount(val)
    }, 300)(value)
  }

  // 使用useCallback优化打赏函数，减少重渲染
  const handleSendTip = useCallback(async () => {
    if (!tipAmount || parseFloat(tipAmount) <= 0) {
      setTipError('请输入有效的打赏金额！')
      return
    }

    if (!videoMetadata || !videoMetadata.author) {
      setTipError('无法识别视频作者地址，无法打赏！')
      return
    }

    // 确保用户已连接钱包
    if (!isConnected || !userAddress) {
      setTipError('请先连接钱包后再打赏！')
      return
    }

    // 格式化并验证作者地址
    const formattedAuthorAddress = formatEthAddress(videoMetadata.author)
    if (!formattedAuthorAddress) {
      setTipError('作者地址格式无效，无法进行打赏！')
      console.error('无效的作者地址:', videoMetadata.author)
      return
    }

    // 检查是否是给自己打赏
    const currentUserAddress = userAddress.toLowerCase()
    const videoAuthorAddress = formattedAuthorAddress.toLowerCase()

    console.log('当前用户地址:', currentUserAddress)
    console.log('视频作者地址:', videoAuthorAddress)

    if (currentUserAddress === videoAuthorAddress) {
      setTipError('您不能给自己打赏！您是该视频的创作者。')
      return
    }

    setIsLoading(true) // Start loading state
    setTipError(null) // 清除之前的错误
    try {
      await sendTransaction({
        to: formattedAuthorAddress, // 使用格式化后的地址
        value: parseEther(tipAmount), // 使用自定义金额
      })
    } catch (err) {
      console.error('打赏失败:', err)
      setTipError('打赏失败，请重试！')
    } finally {
      setIsLoading(false) // Stop loading state
    }
  }, [tipAmount, sendTransaction, videoMetadata, userAddress, isConnected]) // 添加isConnected依赖

  // 优化渲染状态信息的逻辑
  const renderTransactionStatus = useMemo(() => {
    if (!isConnected) {
      return (
        <div className="mt-3 text-sm text-yellow-300 bg-yellow-500/20 p-3 rounded-md border border-yellow-500/30">
          请连接钱包以进行打赏。
        </div>
      )
    }

    if (tipError) {
      return (
        <div className="mt-3 text-sm text-red-300 bg-red-500/20 p-3 rounded-md border border-red-500/30">
          {tipError}
        </div>
      )
    }

    switch (transactionStatus) {
      case 'error':
        return (
          <div className="mt-4 text-sm text-red-300 bg-red-500/20 p-3 rounded-md border border-red-500/30">
            交易失败，请重试
          </div>
        )
      case 'confirming':
        return (
          <div className="mt-4 text-sm text-green-300 bg-green-500/20 p-3 rounded-md border border-green-500/30">
            交易确认中...
          </div>
        )
      case 'success':
        return (
          <div className="mt-4 text-sm text-green-300 bg-green-500/20 p-3 rounded-md border border-green-500/30">
            交易成功！
          </div>
        )
      default:
        return null
    }
  }, [isConnected, tipError, transactionStatus])

  // 使用相同的格式处理环境变量
  const getPinataGateway = () => {
    // 确保返回完整URL，包括https://前缀
    const gateway = process.env.NEXT_PUBLIC_PINATA_GW
      ? process.env.NEXT_PUBLIC_PINATA_GW.replace(/^['"]|['"]$/g, '')
      : ''

    // 确保URL以https://开头
    return gateway.startsWith('http') ? gateway : `https://${gateway}`
  }

  if (isMetadataLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background text-foreground">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
        <p className="ml-3">Loading video data...</p>
      </div>
    )
  }

  if (metadataError || !videoMetadata) {
    return (
      <div className="min-h-screen bg-background text-foreground flex justify-center items-center p-4">
        <div className="bg-primary p-6 rounded-lg shadow-xl border border-secondary">
          <h2 className="text-xl text-foreground font-bold mb-3">
            Loading Error
          </h2>
          <p className="text-gray-400 mb-4">
            {metadataError || 'Video failed to load. Please try again.'}
          </p>
          <button
            onClick={() => window.history.back()}
            className="mt-4 bg-accent text-background px-4 py-2 rounded-lg hover:bg-accent-hover transition-colors">
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const videoUrl = `${getPinataGateway()}/ipfs/${videoMetadata.videoCid}`

  // 读取加密视频的二进制数据
  const fetchEncryptedVideo = async (videoUrl: string): Promise<string> => {
    try {
      const response = await fetch(videoUrl)
      if (!response.ok) {
        throw new Error(`获取加密视频失败: ${response.statusText}`)
      }

      // 加载 ArrayBuffer
      const encryptedArrayBuffer = await response.arrayBuffer()
      if (!encryptedArrayBuffer || encryptedArrayBuffer.byteLength === 0) {
        throw new Error('加密文件内容为空')
      }

      // 转换为 Base64 字符串
      const uint8Array = new Uint8Array(encryptedArrayBuffer)
      const ciphertext = fromByteArray(uint8Array)
      console.log('从 IPFS 加载 ciphertext:', {
        length: ciphertext.length,
        url: videoUrl,
      })

      // 验证 ciphertext
      if (!ciphertext || typeof ciphertext !== 'string') {
        throw new Error('无效的 ciphertext：需要 Base64 编码的字符串')
      }

      return ciphertext
    } catch (error) {
      console.error('读取加密视频失败:', error)
      const message =
        error instanceof Error
          ? `读取加密视频失败: ${error.message}`
          : `读取加密视频失败: ${String(error)}`
      throw new Error(message)
    }
  }
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container mx-auto p-4 md:p-6">
        <div className="flex flex-col lg:flex-row lg:space-x-8">
          {/* 视频播放器 - 占据更多空间 */}
          <div className="w-full lg:w-[calc(70%-1rem)]">
            {' '}
            {/* Adjusted width for spacing */}
            <div className="bg-primary rounded-lg overflow-hidden shadow-xl border border-secondary aspect-video">
              {videoMetadata.isPublic ? (
                <video
                  src={videoUrl}
                  width="100%"
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              ) : decryptedVideoUrl ? (
                <video
                  src={decryptedVideoUrl}
                  width="100%"
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary">
                  <div className="text-center p-6">
                    <h3 className="text-xl font-medium text-foreground mb-4">
                      This video is private
                    </h3>
                    {decryptError && (
                      <p className="text-red-400 mb-4">{decryptError}</p>
                    )}
                    <button
                      onClick={async () => {
                        console.log('videoMetadata', videoMetadata)
                        console.log('userAddress', userAddress)
                        console.log('walletWithProvider', walletWithProvider)
                        if (
                          !videoMetadata ||
                          !userAddress ||
                          !walletWithProvider
                        ) {
                          setDecryptError('请连接钱包并确保视频信息完整')
                          return
                        }
                        try {
                          setIsDecrypting(true)
                          setDecryptError(null)
                          console.log('开始解密视频...')
                          const ciphertext: string = await fetchEncryptedVideo(
                            videoUrl
                          )
                          console.log('获取到的加密视频内容:', ciphertext)
                          const decryptedFile = await handleVideoDecryption(
                            videoMetadata.dataToEncryptHash!,
                            ciphertext,
                            userAddress,
                            walletWithProvider
                          )
                          if (decryptedFile) {
                            const url = URL.createObjectURL(decryptedFile)
                            console.log('设置解密视频 URL:', url)
                            setDecryptedVideoUrl(url)
                          } else {
                            setDecryptError('解密失败：无法生成解密文件')
                          }
                        } catch (error) {
                          console.error('解密失败:', error)
                          const message =
                            error instanceof Error
                              ? `解密失败: ${error.message}`
                              : '解密失败：未知错误'
                          setDecryptError(message)
                        } finally {
                          setIsDecrypting(false)
                        }
                      }}
                      disabled={isDecrypting || !isConnected}
                      className={`px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed
                        ${
                          isDecrypting
                            ? 'bg-accent/70 text-background cursor-wait'
                            : 'bg-accent text-background hover:bg-accent-hover'
                        }`}>
                      {isDecrypting ? 'Decrypting...' : 'Decrypt & Play Video'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            {/* 视频标题区域 */}
            <div className="mt-4 py-3">
              <div className="flex items-center mb-1">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
                  {videoMetadata.title}
                </h1>
                {videoMetadata.isPublic ? (
                  <span className="ml-3 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-secondary/70 text-gray-300 border border-secondary">
                    Public
                  </span>
                ) : (
                  <span className="ml-3 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-accent text-background border border-accent/50">
                    Private
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between mt-2 text-sm text-gray-400 border-b border-secondary pb-3 mb-3">
                <div className="flex items-center space-x-2 mb-2 md:mb-0">
                  {/* <span>4,637 Views</span> Placeholder for actual views */}
                  {/* <span>•</span> */}
                  <span>
                    Uploaded:{' '}
                    {new Date(videoMetadata.timestamp).toLocaleDateString()}
                  </span>
                  {/* Tags can be added here if available in metadata */}
                </div>

                <div className="flex items-center space-x-2">
                  {/* Like, Share, Save buttons styling update */}
                  <button className="inline-flex items-center px-3 py-1.5 bg-secondary text-foreground hover:bg-primary rounded-full transition-colors border border-secondary hover:border-accent/50">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-1.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                      />
                    </svg>
                    <span>Like</span> {/* Placeholder count */}
                  </button>
                  <button className="inline-flex items-center px-3 py-1.5 bg-secondary text-foreground hover:bg-primary rounded-full transition-colors border border-secondary hover:border-accent/50">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-1.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                      />
                    </svg>
                    <span>Share</span>
                  </button>
                  <button className="inline-flex items-center px-3 py-1.5 bg-secondary text-foreground hover:bg-primary rounded-full transition-colors border border-secondary hover:border-accent/50">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-1.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                      />
                    </svg>
                    <span>Save</span>
                  </button>
                  <button className="inline-flex items-center justify-center h-9 w-9 bg-secondary text-foreground hover:bg-primary rounded-full transition-colors border border-secondary hover:border-accent/50">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            {/* 作者信息、订阅和打赏按钮 */}
            <div className="flex flex-col md:flex-row items-start justify-between py-4 border-b border-secondary">
              <div className="flex items-center mb-3 md:mb-0">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-accent to-purple-600 rounded-full flex items-center justify-center text-xl font-bold text-background">
                  {videoMetadata.author
                    ? videoMetadata.author.substring(0, 2).toUpperCase()
                    : 'NA'}
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-foreground">
                    {videoMetadata.author
                      ? formatDisplayAddress(videoMetadata.author)
                      : 'Unknown Creator'}
                  </h3>
                  {/* <p className="text-gray-400 text-sm mt-0.5"> Placeholder for subscriber count</p> */}
                </div>
              </div>

              <div className="mt-3 md:mt-0 flex flex-col sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-3 w-full md:w-auto">
                <div className="relative w-full sm:w-auto">
                  {/* 订阅按钮 */}
                  <button
                    onClick={handleSubscribe}
                    disabled={!isConnected || isSubscribing || isSubscribed}
                    className={`w-full sm:w-auto px-6 py-2.5 font-semibold rounded-lg transition-all text-sm
                      ${
                        isSubscribed
                          ? 'bg-secondary text-gray-400 cursor-not-allowed border border-secondary'
                          : isSubscribing
                          ? 'bg-accent/70 text-background cursor-wait border border-accent/50'
                          : 'bg-accent text-background hover:bg-accent-hover border border-accent'
                      } disabled:opacity-60`}>
                    {isSubscribing ? (
                      <>
                        <span className="inline-block mr-2">Subscribing</span>
                        <svg
                          className="inline-block animate-spin h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </>
                    ) : isSubscribed ? (
                      'Subscribed'
                    ) : (
                      'Subscribe'
                    )}
                  </button>

                  {/* 订阅状态提示 */}
                  {subscribeError && (
                    <div className="absolute -bottom-12 left-0 w-full text-xs text-red-300 bg-red-500/20 p-2 rounded-md border border-red-500/30 mt-1">
                      {subscribeError}
                    </div>
                  )}
                  {!isConnected &&
                    !isSubscribed && ( // Show only if not connected and not yet trying to subscribe
                      <div className="absolute -bottom-12 left-0 w-full text-xs text-yellow-300 bg-yellow-500/20 p-2 rounded-md border border-yellow-500/30 mt-1">
                        Connect wallet to subscribe.
                      </div>
                    )}
                  {isConnected && subscriptionStatus === 'confirming' && (
                    <div className="absolute -bottom-12 left-0 w-full text-xs text-accent bg-accent/20 p-2 rounded-md border border-accent/30 mt-1">
                      Subscription confirming...
                    </div>
                  )}
                  {showSubscribeConfirmation &&
                    subscriptionStatus === 'success' && (
                      <div className="absolute -bottom-12 left-0 w-full text-xs text-green-300 bg-green-500/20 p-2 rounded-md border border-green-500/30 mt-1">
                        Subscribed successfully!
                      </div>
                    )}
                </div>

                {/* 打赏作者控件 */}
                <div className="flex items-center w-full sm:w-auto space-x-2">
                  <div className="relative flex-grow sm:flex-grow-0 sm:w-28">
                    <input
                      type="number"
                      id="tipAmount"
                      value={displayAmount}
                      onChange={handleTipAmountChange}
                      placeholder="0.01"
                      className="w-full px-3 py-2.5 bg-secondary border border-secondary text-foreground rounded-lg focus:ring-2 focus:ring-accent focus:border-accent text-sm placeholder-gray-500"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <span className="text-gray-400 text-xs">ETH</span>
                    </div>
                  </div>
                  <button
                    onClick={handleSendTip}
                    className={`px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center transition-colors border
                      ${
                        isConnected &&
                        transactionStatus !== 'pending' &&
                        transactionStatus !== 'confirming'
                          ? 'bg-accent text-background hover:bg-accent-hover border-accent'
                          : 'bg-secondary text-gray-400 cursor-not-allowed border-secondary'
                      } ${
                      transactionStatus === 'pending' ||
                      transactionStatus === 'confirming'
                        ? 'bg-accent/70 text-background cursor-wait border-accent/50'
                        : ''
                    } disabled:opacity-60`}
                    disabled={
                      !isConnected ||
                      transactionStatus === 'pending' ||
                      transactionStatus === 'confirming'
                    }
                    title="Tip Creator">
                    {transactionStatus === 'pending' ||
                    transactionStatus === 'confirming' ? (
                      <>
                        <svg
                          className="animate-spin h-4 w-4 text-background"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </>
                    ) : (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 mr-1.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Tip
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 交易状态消息 */}
              {renderTransactionStatus && (
                <div className="w-full mt-3 md:text-right">
                  {' '}
                  {/* Aligned to right on medium screens */}
                  {renderTransactionStatus}
                </div>
              )}
            </div>
            {/* 视频描述区域 */}
            <div className="mt-6 bg-primary border border-secondary rounded-xl p-4 md:p-5">
              <h4 className="text-lg font-semibold text-foreground mb-2">
                Description
              </h4>
              <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed prose prose-sm prose-invert max-w-none">
                {videoMetadata.description || 'No description provided.'}
              </div>

              {/* 推广/链接区域 - Example */}
              {/* <div className="mt-4 pt-4 border-t border-secondary">
                <a href="#" className="text-accent hover:text-accent-hover text-sm flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 010-5.656l4-4a4 4 0 015.656 5.656l-1.1 1.1" />
                  </svg>
                  Promotional Link
                </a>
              </div> */}
            </div>
            {/* 评论组件 */}
            <div className="mt-8">
              <Comments videoId={videoJsonCid as string} />{' '}
              {/* Assuming Comments component will also be styled */}
            </div>
          </div>

          {/* 右侧推荐视频 */}
          <div className="w-full lg:w-[30%] mt-8 lg:mt-0">
            <h3 className="text-xl font-semibold mb-4 text-foreground">
              Recommended
            </h3>
            <div className="space-y-4">
              {/* 推荐视频项 - Needs data source and styling */}
              {[1, 2, 3, 4, 5].map(
                (
                  _,
                  index // Placeholder loop
                ) => (
                  <div
                    key={index}
                    className="flex items-start group cursor-pointer p-2 rounded-lg hover:bg-secondary transition-colors">
                    <div className="w-32 h-20 relative flex-shrink-0 bg-primary border border-secondary rounded-md overflow-hidden">
                      {/* Placeholder for recommended video thumbnail */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg
                          className="w-8 h-8 text-gray-500"
                          viewBox="0 0 24 24"
                          fill="currentColor">
                          <path d="M8 5.14v14l11-7-11-7z" />
                        </svg>
                      </div>
                      {/* Example Image (replace with actual data) */}
                      {/* {index === 0 && videoMetadata.coverImageCid && (
                      <Image src={`${getPinataGateway()}/ipfs/${videoMetadata.coverImageCid}`} alt="Video thumbnail" fill className="object-cover" />
                    )} */}
                      <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                        0:00 {/* Placeholder duration */}
                      </div>
                    </div>
                    <div className="ml-3 flex-1">
                      <h4 className="font-semibold text-foreground text-sm line-clamp-2 group-hover:text-accent transition-colors">
                        Recommended Video Title {index + 1}
                      </h4>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                        Creator Name
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Views • Upload Date
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default VideoPage
