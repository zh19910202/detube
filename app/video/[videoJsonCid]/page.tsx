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
import Image from 'next/image'
import { handleVideoDecryption } from '../../lib/lit/handleVideoDecryption'
import { ethers } from 'ethers'
import { fromByteArray } from 'base64-js'

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
  const [comments, setComments] = useState<string[]>([])
  const [newComment, setNewComment] = useState<string>('')
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
  async function initWalletProvider() {
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
  }

  // 使用 Effect 调用
  useEffect(() => {
    initWalletProvider()
  }, [isConnected, userAddress])

  // 单独的Effect用于检查订阅状态
  useEffect(() => {
    // 当钱包连接时，立即检查订阅状态
    if (isConnected && userAddress) {
      checkSubscriptionStatus()
    }
  }, [isConnected, userAddress])

  // 检查用户是否已订阅
  const checkSubscriptionStatus = async () => {
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
  }

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
        setComments(['真不错的视频！', '学到了很多，感谢分享'])
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
  }, [isConfirmed, hash])
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

  const handleAddComment = () => {
    if (newComment.trim()) {
      setComments((prev) => [...prev, newComment])
      setNewComment('')
    }
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
        <div className="mt-3 text-base text-black bg-yellow-50 p-2 rounded border border-yellow-200">
          请连接钱包以进行打赏。
        </div>
      )
    }

    if (tipError) {
      return (
        <div className="mt-3 text-base text-black bg-red-50 p-3 rounded border border-red-200">
          {tipError}
        </div>
      )
    }

    switch (transactionStatus) {
      case 'error':
        return (
          <div className="mt-4 text-base text-black bg-red-50 p-3 rounded border border-red-200">
            交易失败，请重试
          </div>
        )
      case 'confirming':
        return (
          <div className="mt-4 text-base text-black bg-green-50 p-3 rounded border border-green-200">
            交易确认中...
          </div>
        )
      case 'success':
        return (
          <div className="mt-4 text-base text-black bg-green-50 p-3 rounded border border-green-200">
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
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (metadataError || !videoMetadata) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl text-black font-bold mb-2">加载错误</h2>
          <p className="text-black">视频加载失败，请重试</p>
          <button
            onClick={() => window.history.back()}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-lg">
            返回上一页
          </button>
        </div>
      </div>
    )
  }

  const videoUrl = `${getPinataGateway()}/ipfs/${videoMetadata.videoCid}`
  const coverImageUrl = `${getPinataGateway()}/ipfs/${
    videoMetadata.coverImageCid
  }`

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
    <div className="min-h-screen bg-black text-white">
      <main className="container mx-auto p-5">
        <div className="flex flex-col lg:flex-row lg:space-x-6">
          {/* 视频播放器 - 占据更多空间 */}
          <div className="w-full lg:w-[70%]">
            <div className="bg-black rounded-lg overflow-hidden">
              {videoMetadata.isPublic ? (
                <video
                  src={videoUrl}
                  width="100%"
                  controls
                  autoPlay
                  className="w-full aspect-video object-contain"
                />
              ) : decryptedVideoUrl ? (
                <video
                  src={decryptedVideoUrl}
                  width="100%"
                  controls
                  autoPlay
                  className="w-full aspect-video object-contain"
                />
              ) : (
                <div className="w-full aspect-video flex items-center justify-center bg-gray-900">
                  <div className="text-center p-6">
                    <h3 className="text-xl font-medium text-white mb-4">
                      此视频为加密内容
                    </h3>
                    {decryptError && (
                      <p className="text-red-500 mb-4">{decryptError}</p>
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
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50">
                      {isDecrypting ? '解密中...' : '解密并播放视频'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 视频标题区域 - YouTube风格 */}
            <div className="mt-3">
              <h1 className="text-xl md:text-2xl font-bold text-white leading-tight">
                {videoMetadata.title}
              </h1>

              <div className="flex flex-wrap items-center justify-between mt-3 pb-2 border-b border-gray-800">
                <div className="flex items-center space-x-2 text-gray-400 text-sm mb-2 md:mb-0">
                  <span className="font-medium">4,637 次观看</span>
                  <span>•</span>
                  <span>
                    {new Date(videoMetadata.timestamp).toLocaleDateString(
                      'zh-CN'
                    )}
                  </span>
                  {videoMetadata.author && (
                    <>
                      <span className="hidden md:inline">•</span>
                      <div className="hidden md:flex items-center space-x-2">
                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full dark:bg-blue-900 dark:text-blue-300">
                          #bitcoin
                        </span>
                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full dark:bg-blue-900 dark:text-blue-300">
                          #ethereum
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button className="inline-flex items-center px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full transition-all">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                      />
                    </svg>
                    <span>144</span>
                  </button>

                  <button className="inline-flex items-center px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full transition-all">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                      />
                    </svg>
                    <span>分享</span>
                  </button>

                  <button className="inline-flex items-center px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full transition-all">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                      />
                    </svg>
                    <span>收藏</span>
                  </button>

                  <button className="inline-flex items-center justify-center h-9 w-9 bg-gray-800 hover:bg-gray-700 rounded-full transition-all">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* 作者信息、订阅和打赏按钮 */}
            <div className="flex flex-wrap items-start justify-between py-4 border-b border-gray-800">
              <div className="flex items-center">
                <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-xl font-bold">
                  {videoMetadata.author
                    ? videoMetadata.author.substring(0, 2).toUpperCase()
                    : 'DE'}
                </div>
                <div className="ml-3">
                  <h3 className="text-base md:text-lg font-medium text-white">
                    {videoMetadata.author
                      ? formatDisplayAddress(videoMetadata.author)
                      : '未知作者'}
                  </h3>
                  <p className="text-gray-400 text-xs md:text-sm mt-0.5">
                    40.1K 订阅者
                  </p>
                </div>
              </div>

              <div className="mt-3 md:mt-0 flex flex-wrap md:flex-nowrap items-center space-y-3 md:space-y-0 md:space-x-3 w-full md:w-auto">
                <div className="relative">
                  {/* 订阅按钮 */}
                  <button
                    onClick={handleSubscribe}
                    disabled={!isConnected || isSubscribing || isSubscribed}
                    className={`w-full md:w-auto px-6 py-2 font-medium rounded-full transition-all ${
                      isSubscribed
                        ? 'bg-gray-600 text-white cursor-not-allowed'
                        : isSubscribing
                        ? 'bg-gray-600 text-white cursor-wait'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}>
                    {isSubscribing ? (
                      <>
                        <span className="inline-block mr-2">订阅中</span>
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
                      '已订阅'
                    ) : (
                      '订阅'
                    )}
                  </button>

                  {/* 订阅状态提示 */}
                  {subscribeError && (
                    <div className="absolute -bottom-10 left-0 w-full text-sm text-red-500 bg-red-50 p-2 rounded border border-red-200">
                      {subscribeError}
                    </div>
                  )}

                  {/* 订阅交易状态显示 */}
                  {!isConnected && (
                    <div className="absolute -bottom-10 left-0 w-full text-sm text-yellow-700 bg-yellow-50 p-2 rounded border border-yellow-200">
                      请连接钱包以订阅频道
                    </div>
                  )}

                  {isConnected && subscriptionStatus === 'confirming' && (
                    <div className="absolute -bottom-10 left-0 w-full text-sm text-blue-700 bg-blue-50 p-2 rounded border border-blue-200">
                      订阅交易确认中...
                    </div>
                  )}

                  {showSubscribeConfirmation && (
                    <div className="absolute -bottom-10 left-0 w-full text-sm text-green-700 bg-green-50 p-2 rounded border border-green-200">
                      订阅成功！
                    </div>
                  )}
                </div>

                {/* 打赏作者控件 */}
                <div className="flex items-center md:w-auto space-x-2 w-full">
                  <div className="relative w-28 md:w-32">
                    <input
                      type="number"
                      id="tipAmount"
                      value={displayAmount}
                      onChange={handleTipAmountChange}
                      placeholder="0.01"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <span className="text-gray-400 text-xs">ETH</span>
                    </div>
                  </div>
                  <button
                    onClick={handleSendTip}
                    className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center justify-center ${
                      isConnected && transactionStatus !== 'pending'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    } transition duration-200 shadow-md`}
                    disabled={!isConnected || transactionStatus === 'pending'}
                    title="打赏创作者">
                    {transactionStatus === 'pending' ? (
                      <>
                        <svg
                          className="animate-spin h-4 w-4 text-white"
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
                          className="h-4 w-4 mr-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        打赏
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 交易状态消息 */}
              {renderTransactionStatus && (
                <div className="w-full mt-3 text-sm">
                  {renderTransactionStatus}
                </div>
              )}
            </div>

            {/* 视频描述区域 */}
            <div className="mt-4 bg-gray-900 rounded-xl p-4 text-gray-300">
              <div className="flex items-start">
                <div className="flex-1">
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">
                    {videoMetadata.description || '暂无描述信息'}
                  </div>

                  {/* 推广/链接区域 */}
                  <div className="mt-4 pt-3 border-t border-gray-800">
                    <a
                      href="#"
                      className="text-blue-400 hover:text-blue-300 text-sm flex items-center mt-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14.828 14.828a4 4 0 010-5.656l4-4a4 4 0 015.656 5.656l-1.1 1.1"
                        />
                      </svg>
                      https://detube.com/join
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* 评论区 - YouTube风格 */}
            <div className="mt-8">
              <div className="flex items-center mb-4">
                <h3 className="text-lg font-bold text-white">
                  {comments.length} 条评论
                </h3>
              </div>

              <div className="mb-6 flex">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-lg font-bold">
                  {userAddress
                    ? userAddress.substring(0, 2).toUpperCase()
                    : '游'}
                </div>
                <div className="ml-3 flex-1">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="添加评论..."
                    className="w-full px-4 py-3 bg-gray-800 border-b border-gray-700 text-white focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                      className={`px-4 py-2 rounded-full ${
                        newComment.trim()
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      } transition-all text-sm font-medium`}>
                      评论
                    </button>
                  </div>
                </div>
              </div>

              {comments.length > 0 ? (
                <div className="space-y-6">
                  {comments.map((comment, index) => (
                    <div key={index} className="flex">
                      <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center text-lg font-bold">
                        用
                      </div>
                      <div className="ml-3 flex-1">
                        <div className="flex items-center">
                          <h4 className="font-medium text-white">匿名用户</h4>
                          <span className="ml-2 text-xs text-gray-400">
                            {new Date().toLocaleDateString('zh-CN')}
                          </span>
                        </div>
                        <p className="mt-1 text-gray-300">{comment}</p>
                        <div className="mt-2 flex items-center text-gray-400 text-sm">
                          <button className="flex items-center mr-4 hover:text-white">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4 mr-1"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                              />
                            </svg>
                            赞同
                          </button>
                          <button className="flex items-center hover:text-white">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4 mr-1"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                              />
                            </svg>
                            回复
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-900 rounded-lg">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-12 w-12 text-gray-600 mx-auto mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  <p className="text-gray-400">
                    暂无评论，成为第一个评论的用户吧！
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 右侧推荐视频 */}
          <div className="w-full lg:w-[30%] mt-8 lg:mt-0">
            <h3 className="text-lg font-medium mb-4 text-white">为您推荐</h3>
            <div className="space-y-4">
              {/* 推荐视频项 */}
              {[1, 2, 3, 4, 5].map((_, index) => (
                <div
                  key={index}
                  className="flex items-start group cursor-pointer">
                  <div className="w-40 h-24 relative flex-shrink-0 bg-gray-800 rounded overflow-hidden">
                    {index === 0 ? (
                      <Image
                        src={coverImageUrl}
                        alt="视频封面"
                        fill
                        className="object-cover"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).src =
                            'https://via.placeholder.com/300x200'
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg
                          className="w-10 h-10 text-gray-400"
                          viewBox="0 0 24 24"
                          fill="currentColor">
                          <path d="M8 5.14v14l11-7-11-7z" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center group-hover:bg-black/40 transition-all">
                      <svg
                        className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        viewBox="0 0 24 24"
                        fill="currentColor">
                        <path d="M8 5.14v14l11-7-11-7z" />
                      </svg>
                    </div>
                    <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1">
                      3:45
                    </div>
                  </div>
                  <div className="ml-3 flex-1">
                    <h4 className="font-medium text-white text-sm line-clamp-2 group-hover:text-blue-400 transition-colors">
                      推荐视频{index + 1}：加密货币市场最新动态分析
                    </h4>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                      创作者频道
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      5.2万次观看 • 3天前
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default VideoPage
