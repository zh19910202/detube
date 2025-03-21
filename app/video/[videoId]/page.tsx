'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import {
  useSendTransaction,
  useWaitForTransactionReceipt,
  useAccount,
} from 'wagmi'
import { parseEther } from 'viem'
import { VideoMetadata } from '../../hooks/usePinata'
import Image from 'next/image'

// 添加防抖函数
function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return function (...args: Parameters<T>) {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

const VideoPage = () => {
  const { videoId } = useParams()
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null)
  const [comments, setComments] = useState<string[]>([])
  const [newComment, setNewComment] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isMetadataLoading, setIsMetadataLoading] = useState(true)
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const [tipAmount, setTipAmount] = useState<string>('0.01') // 默认打赏金额为 0.01 ETH
  const [displayAmount, setDisplayAmount] = useState<string>('0.01') // 用于显示的金额，减少重渲染
  const [tipError, setTipError] = useState<string | null>(null) // 新增错误状态
  const {
    data: hash,
    sendTransaction,
    error,
    isPending: isTransactionPending,
  } = useSendTransaction()
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash })
  const { isConnected } = useAccount() // 检查钱包连接状态
  const [showConfirmation, setShowConfirmation] = useState(false)

  // 使用useMemo缓存交易状态，减少状态变化导致的重渲染
  const transactionStatus = useMemo(() => {
    if (isTransactionPending || isLoading) return 'pending'
    if (isConfirming) return 'confirming'
    if (showConfirmation) return 'success'
    if (error) return 'error'
    return 'idle'
  }, [isTransactionPending, isLoading, isConfirming, showConfirmation, error])

  // 获取视频元数据
  useEffect(() => {
    const fetchMetadata = async () => {
      if (!videoId) return

      setIsMetadataLoading(true)
      setMetadataError(null)

      try {
        // 从 IPFS 获取元数据 JSON
        const response = await fetch(`${getPinataGateway()}/ipfs/${videoId}`)

        if (!response.ok) {
          throw new Error(`Failed to fetch metadata: ${response.statusText}`)
        }

        const data = await response.json()
        // console.log('获取到的原始元数据:', data)
        // console.log('描述字段:', data.description)

        const metadata = {
          cid: videoId as string,
          title: data.title || '未命名视频',
          description: data.description || '无描述',
          coverImageCid: data.coverImageCid,
          videoCid: data.videoCid,
          timestamp: data.timestamp,
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
  }, [videoId])

  useEffect(() => {
    if (isConfirmed && hash) {
      setShowConfirmation(true) // 显示确认消息
      const timer = setTimeout(() => {
        setShowConfirmation(false)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isConfirmed, hash])

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

    setIsLoading(true) // Start loading state
    setTipError(null) // 清除之前的错误
    try {
      await sendTransaction({
        to: '0x4B8f2F91541814722B3F6a2FABC9Ae16C3D0050b', // 替换为创作者的钱包地址
        value: parseEther(tipAmount), // 使用自定义金额
      })
    } catch (err) {
      console.error('打赏失败:', err)
      setTipError('打赏失败，请重试！')
    } finally {
      setIsLoading(false) // Stop loading state
    }
  }, [tipAmount, sendTransaction])

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
    return process.env.NEXT_PUBLIC_PINATA_GW
      ? process.env.NEXT_PUBLIC_PINATA_GW.replace(/^['"]|['"]$/g, '')
      : 'https://cyan-fast-mastodon-963.mypinata.cloud'
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

  return (
    <div className="min-h-screen bg-gray-100">
      <main className="container mx-auto p-5">
        <div className="flex flex-col md:flex-row">
          {/* 视频播放器 */}
          <div className="w-full md:w-3/4 pr-0 md:pr-5 mb-8 md:mb-0">
            <div className="bg-black rounded-lg shadow-md overflow-hidden">
              <iframe
                src={videoUrl}
                width="100%"
                height="520"
                frameBorder="0"
                allowFullScreen
                className="rounded-lg"></iframe>
            </div>

            <div className="mt-5 bg-white p-5 rounded-lg shadow-md">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 pb-2 border-b">
                {videoMetadata.title}
              </h1>
              <div className="text-black mt-2 text-sm">
                发布于:{' '}
                {new Date(videoMetadata.timestamp).toLocaleString('zh-CN')}
              </div>
            </div>

            {/* 描述信息 */}
            <div className="mt-4 bg-white p-5 rounded-lg shadow-md border-l-4 border-blue-500">
              <h3 className="text-xl font-bold mb-3 text-black">视频描述</h3>
              <p className="text-black whitespace-pre-wrap text-base leading-relaxed">
                {videoMetadata.description || '暂无描述信息'}
              </p>
            </div>

            <div className="mt-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <label
                htmlFor="tipAmount"
                className="block text-base font-semibold text-gray-800">
                输入打赏金额 (ETH)
              </label>
              <input
                type="number"
                id="tipAmount"
                value={displayAmount}
                onChange={handleTipAmountChange}
                placeholder="0.01"
                className="mt-2 block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-base"
              />
            </div>
            <button
              onClick={handleSendTip}
              className={`mt-4 px-5 py-3 rounded-lg font-semibold text-base ${
                isConnected && transactionStatus !== 'pending'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-400 text-gray-600 cursor-not-allowed'
              } transition duration-200`}
              disabled={!isConnected || transactionStatus === 'pending'} // 优化了禁用条件
            >
              {transactionStatus === 'pending'
                ? '打赏处理中...'
                : `打赏视频创作者 (${displayAmount} ETH)`}
            </button>
            {renderTransactionStatus}
          </div>

          {/* 推荐视频 */}
          <div className="w-full md:w-1/4">
            <h3 className="text-xl font-bold mb-4 text-black">视频封面</h3>
            <div className="bg-white shadow-md rounded-lg overflow-hidden mb-6 border border-gray-200">
              <div className="relative w-full h-56">
                <Image
                  src={coverImageUrl}
                  alt={videoMetadata.title}
                  fill
                  className="object-cover"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).src =
                      'https://via.placeholder.com/300x200'
                  }}
                />
              </div>
            </div>

            <h3 className="text-xl font-bold mb-4 text-black">推荐视频</h3>
            <div className="space-y-4">
              <div className="bg-white shadow-md p-4 rounded-lg border-l-4 border-blue-400 hover:shadow-lg transition duration-200">
                <h4 className="font-bold text-black">推荐视频示例</h4>
                <p className="text-black text-base mt-1">视频描述...</p>
              </div>
              {/* 更多推荐视频可以在这里添加 */}
            </div>
          </div>
        </div>

        {/* 评论区 */}
        <div className="mt-8 bg-white p-5 rounded-lg shadow-md">
          <h3 className="text-xl font-bold text-black mb-4 border-b pb-2">
            用户评论
          </h3>
          <div className="space-y-4 mt-4">
            {comments.map((comment, index) => (
              <div
                key={index}
                className="bg-gray-50 p-4 rounded-lg border-l-4 border-gray-300">
                <p className="text-black">{comment}</p>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="添加你的评论..."
              className="w-full p-3 border border-gray-300 rounded-lg text-base focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={handleAddComment}
              className="mt-3 bg-blue-600 text-white px-5 py-3 rounded-lg hover:bg-blue-700 transition duration-200 font-semibold text-base">
              添加评论
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default VideoPage
