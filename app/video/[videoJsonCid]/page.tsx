'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams } from 'next/navigation'
import {
  useSendTransaction,
  useWaitForTransactionReceipt,
  useAccount,
} from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { parseEther, isAddress } from 'viem'
import { VideoMetadata } from '../../hooks/usePinata'
import { handleVideoDecryption } from '../../lib/lit/handleVideoDecryption'
import { ethers } from 'ethers'
import { fromByteArray } from 'base64-js'
import Comments from '@/app/components/Comments' // 导入评论组件
import { formatDisplayAddress, debounce } from '../../lib/utils' // debounce was already moved in a previous step, but the read file content was stale
import { usePinata } from '../../hooks/usePinata'
import RecommendedVideoCard from '@/app/components/RecommendedVideoCard'

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
  const {
    videos: allVideos,
    loading: recommendationsLoading,
    getLatestCIDs,
  } = usePinata(7) // Fetch 7 to have some buffer
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null)
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [decryptedVideoUrl, setDecryptedVideoUrl] = useState<string | null>(
    null
  )
  const [isVideoReadyForDisplay, setIsVideoReadyForDisplay] = useState(false) // Added for fade-in effect
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
  const { openConnectModal } = useConnectModal() // RainbowKit hook for connect modal
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

  useEffect(() => {
    getLatestCIDs()
  }, [getLatestCIDs])

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

      console.log('Received videoJsonCid:', videoJsonCid)
      setIsMetadataLoading(true)
      setMetadataError(null)

      const responseUrl = `${getPinataGateway()}/ipfs/${videoJsonCid}`
      console.log('Attempting to fetch video metadata from URL:', responseUrl)

      try {
        // 从 IPFS 获取元数据 JSON
        const response = await fetch(responseUrl)

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

        console.log(
          'Successfully fetched and processed video metadata:',
          metadata
        )
        setVideoMetadata(metadata)

        // 模拟评论数据
        // setComments(['真不错的视频！', '学到了很多，感谢分享'])
      } catch (err: unknown) {
        console.error('Error fetching video metadata:', err)
        if (err instanceof Error) {
          if (err.message.includes('Failed to fetch metadata')) {
            setMetadataError(
              'Network error: Failed to fetch video metadata. Please check the gateway URL and your network connection.'
            )
            console.error(
              'Specific Error: Network error. Check gateway URL and connectivity.'
            )
          } else if (err instanceof SyntaxError) {
            // Likely a JSON parsing error
            setMetadataError(
              'Error parsing video metadata. The data received from the gateway may not be valid JSON.'
            )
            console.error(
              'Specific Error: JSON parsing error. The response from the gateway was not valid JSON.'
            )
          } else {
            setMetadataError(
              'Unable to load video information. Please check your network connection or try again later.'
            )
          }
        } else {
          setMetadataError(
            'Unable to load video information. An unknown error occurred.'
          )
        }
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
    let gateway = process.env.NEXT_PUBLIC_PINATA_GW
      ? process.env.NEXT_PUBLIC_PINATA_GW.replace(/^['"]|['"]$/g, '')
      : ''

    if (!gateway) {
      console.warn(
        'NEXT_PUBLIC_PINATA_GW is not set or is an empty string. Defaulting to public gateway: gateway.pinata.cloud'
      )
      gateway = 'gateway.pinata.cloud'
    }

    // 确保URL以https://开头
    return gateway.startsWith('http') ? gateway : `https://${gateway}`
  }

  const { videoJsonCid: currentVideoCid } = useParams()
  const recommendedVideos = useMemo(() => {
    if (!allVideos || allVideos.length === 0) {
      return []
    }
    return allVideos
      .filter((video) => video.cid !== currentVideoCid)
      .slice(0, 5)
  }, [allVideos, currentVideoCid])

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
  console.log('Public video URL for player:', videoUrl)

  // 读取加密视频的二进制数据
  const fetchEncryptedVideo = async (urlToFetch: string): Promise<string> => {
    console.log('Fetching encrypted video from URL:', urlToFetch)
    try {
      const response = await fetch(urlToFetch)
      if (!response.ok) {
        throw new Error(
          `Failed to fetch encrypted video: ${response.statusText}`
        )
      }

      // 加载 ArrayBuffer
      const encryptedArrayBuffer = await response.arrayBuffer()
      if (!encryptedArrayBuffer || encryptedArrayBuffer.byteLength === 0) {
        throw new Error('加密文件内容为空')
      }

      // 转换为 Base64 字符串
      const uint8Array = new Uint8Array(encryptedArrayBuffer)
      const ciphertext = fromByteArray(uint8Array)
      console.log('Loaded ciphertext from IPFS:', {
        length: ciphertext.length,
        url: urlToFetch, // Changed from videoUrl to urlToFetch to match param
      })
      // Log ciphertext length or snippet
      console.log(
        'Fetched ciphertext length in fetchEncryptedVideo:',
        ciphertext?.length
      )
      if (ciphertext?.length > 60) {
        console.log(
          'Ciphertext snippet in fetchEncryptedVideo:',
          ciphertext.substring(0, 60) + '...'
        )
      } else {
        console.log('Ciphertext in fetchEncryptedVideo:', ciphertext)
      }

      // 验证 ciphertext
      if (!ciphertext || typeof ciphertext !== 'string') {
        throw new Error('无效的 ciphertext：需要 Base64 编码的字符串')
      }

      return ciphertext
    } catch (error) {
      console.error('Error reading encrypted video:', error)
      const message =
        error instanceof Error
          ? `Error reading encrypted video: ${error.message}`
          : `Error reading encrypted video: ${String(error)}`
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
                  onCanPlay={() => setIsVideoReadyForDisplay(true)}
                  className={`w-full h-full object-cover ${
                    isVideoReadyForDisplay ? 'opacity-100' : 'opacity-0'
                  } transition-opacity duration-500 ease-in-out`}
                />
              ) : decryptedVideoUrl ? (
                <video
                  src={decryptedVideoUrl}
                  width="100%"
                  controls
                  autoPlay
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary">
                  <div className="text-center p-6">
                    <h3 className="text-xl font-medium text-foreground mb-4">
                      This video is private
                    </h3>
                    {decryptError && (
                      <div
                        className={
                          decryptError ===
                          'Please connect your wallet and ensure video information is complete.'
                            ? 'mb-4 p-3 rounded-md bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 text-sm'
                            : 'mb-4 text-red-400' // Fallback for other decrypt errors
                        }>
                        {decryptError}
                      </div>
                    )}
                    <button
                      onClick={async () => {
                        console.log(
                          'Video metadata for decryption:',
                          videoMetadata
                        )
                        console.log('User address for decryption:', userAddress)
                        console.log(
                          'Wallet provider available:',
                          !!walletWithProvider
                        )

                        if (
                          !videoMetadata ||
                          !userAddress ||
                          !walletWithProvider
                        ) {
                          setDecryptError(
                            'Please connect your wallet and ensure video information is complete.'
                          )
                          if (!videoMetadata)
                            console.error(
                              'Decryption failed: videoMetadata is null or undefined.'
                            )
                          if (!userAddress)
                            console.error(
                              'Decryption failed: userAddress is null or undefined.'
                            )
                          if (!walletWithProvider)
                            console.error(
                              'Decryption failed: walletWithProvider is null or undefined.'
                            )
                          return
                        }

                        // Log specific critical metadata fields
                        console.log(
                          'videoMetadata.dataToEncryptHash:',
                          videoMetadata.dataToEncryptHash
                        )
                        console.log(
                          'videoMetadata.videoCid:',
                          videoMetadata.videoCid
                        )

                        try {
                          setIsDecrypting(true)
                          setDecryptError(null)
                          console.log('Starting video decryption...')
                          console.log(
                            'Video URL for fetching encrypted content:',
                            videoUrl
                          )
                          const ciphertext: string = await fetchEncryptedVideo(
                            videoUrl
                          )
                          // Log ciphertext length or snippet
                          console.log(
                            'Fetched ciphertext length:',
                            ciphertext?.length
                          )
                          if (ciphertext?.length > 100) {
                            console.log(
                              'Ciphertext snippet:',
                              ciphertext.substring(0, 100) + '...'
                            )
                          } else {
                            console.log('Ciphertext:', ciphertext)
                          }

                          console.log(
                            'Calling handleVideoDecryption with arguments:',
                            {
                              dataToEncryptHash:
                                videoMetadata.dataToEncryptHash!,
                              ciphertextLength: ciphertext?.length,
                              userAddress,
                            }
                          )
                          const decryptedFile = await handleVideoDecryption(
                            videoMetadata.dataToEncryptHash!,
                            ciphertext,
                            userAddress,
                            walletWithProvider
                          )

                          if (decryptedFile) {
                            console.log('Decrypted file details:', {
                              name: decryptedFile.name,
                              size: decryptedFile.size,
                              type: decryptedFile.type,
                            })
                            const url = URL.createObjectURL(decryptedFile)
                            console.log('Decrypted video URL for player:', url)
                            setDecryptedVideoUrl(url)
                          } else {
                            console.error(
                              'Decryption failed: handleVideoDecryption returned null or undefined.'
                            )
                            setDecryptError(
                              'Decryption failed: Unable to generate decrypted file.'
                            )
                          }
                        } catch (error: unknown) {
                          console.error('Decryption process failed:', error)
                          const message =
                            error instanceof Error
                              ? `Decryption failed: ${error.message}`
                              : 'Decryption failed: An unknown error occurred.'
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
                    onClick={isConnected ? handleSendTip : openConnectModal}
                    className={`px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center transition-colors border
                      ${
                        !isConnected
                          ? 'bg-accent text-background hover:bg-accent-hover border-accent' // Styling for "Connect Wallet"
                          : transactionStatus === 'pending' ||
                            transactionStatus === 'confirming'
                          ? 'bg-accent/70 text-background cursor-wait border-accent/50' // Styling for pending/confirming tip
                          : 'bg-accent text-background hover:bg-accent-hover border-accent' // Styling for active "Tip"
                      } disabled:opacity-60`}
                    disabled={
                      isConnected &&
                      (transactionStatus === 'pending' ||
                        transactionStatus === 'confirming')
                    }
                    title={
                      isConnected ? 'Tip Creator' : 'Connect wallet to tip'
                    }>
                    {!isConnected ? (
                      '连接钱包'
                    ) : transactionStatus === 'pending' ||
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

              {/* 交易状态消息 - Conditionally render if user is connected, otherwise button handles connect prompt */}
              {isConnected && renderTransactionStatus && (
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
              {recommendationsLoading ? (
                <p className="text-gray-400">Loading recommendations...</p>
              ) : recommendedVideos.length === 0 ? (
                <p className="text-gray-400">
                  No other videos available to recommend.
                </p>
              ) : (
                recommendedVideos.map((video) => (
                  <RecommendedVideoCard key={video.cid} video={video} />
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default VideoPage
