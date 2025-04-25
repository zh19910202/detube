'use client'
// hooks/usePinata.ts
import { useState, useEffect, useCallback } from 'react'
import { PinataSDK } from 'pinata'

// 检查是否是服务器端环境
const isServer = typeof window === 'undefined'

// 配置 Pinata
const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT
  ? process.env.NEXT_PUBLIC_PINATA_JWT.replace(/^['"]|['"]$/g, '')
  : ''
const PINATA_GW = process.env.NEXT_PUBLIC_PINATA_GW
  ? process.env.NEXT_PUBLIC_PINATA_GW.replace(/^['"]|['"]$/g, '')
  : ''

// 初始化 Pinata 客户端
let pinata: PinataSDK | null = null

// 元数据JSON文件的组ID
const METADATA_GROUP_ID = '5c16e640-afc1-4b43-a7cb-110b568fba50'

// 定义视频元数据类型
export interface VideoMetadata {
  cid: string
  title: string
  description: string
  coverImageCid: string
  videoCid: string
  timestamp: string
  author?: string
  isPublic: boolean
  dataToEncryptHash?: string
}

// 用于 SDK 返回的文件类型
interface PinataFileItem {
  cid: string
  created_at: string
  id?: string
  name?: string
  added?: string
}

// 定义上传阶段类型
export type UploadStage = 'idle' | 'cover' | 'video' | 'metadata' | 'complete'

export const usePinata = (limit: number = 8) => {
  const [videos, setVideos] = useState<VideoMetadata[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [ipfsHash, setIpfsHash] = useState<string | null>(null)

  // 添加上传进度相关状态
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStage, setUploadStage] = useState<UploadStage>('idle')

  // 在客户端初始化 Pinata SDK
  useEffect(() => {
    if (!isServer && !pinata) {
      try {
        pinata = new PinataSDK({
          pinataJwt: PINATA_JWT,
          pinataGateway: PINATA_GW,
        })
        console.log('Pinata SDK 初始化成功')
      } catch (err) {
        console.error('Pinata SDK 初始化失败:', err)
      }
    }
  }, [])

  // 从 IPFS 获取元数据 JSON 文件内容
  const fetchMetadata = async (cid: string): Promise<VideoMetadata | null> => {
    try {
      // 使用API路由代理请求，避免CORS问题
      const response = await fetch(`/api/pinata?cid=${cid}`)

      if (!response.ok) {
        throw new Error(`获取元数据失败: ${response.statusText}`)
      }

      const jsonContent = await response.json()

      const isValidMetadata =
        jsonContent &&
        typeof jsonContent === 'object' &&
        (jsonContent.title !== undefined ||
          jsonContent.description !== undefined) &&
        jsonContent.coverImageCid !== undefined &&
        jsonContent.videoCid !== undefined

      if (!isValidMetadata) {
        console.error(`CID ${cid} 元数据格式无效:`, jsonContent)
        return null
      }

      const timestamp = jsonContent.timestamp || '2023-01-01T00:00:00.000Z'
      return {
        cid,
        title: jsonContent.title || '未命名视频',
        description: jsonContent.description || '无描述',
        coverImageCid: jsonContent.coverImageCid,
        videoCid: jsonContent.videoCid,
        timestamp,
        author: jsonContent.author || '',
        isPublic:
          jsonContent.isPublic === false
            ? false
            : jsonContent.isPublic === true
            ? true
            : true,
        dataToEncryptHash: jsonContent.dataToEncryptHash || '',
      }
    } catch (err) {
      console.error(`解析元数据出错 CID ${cid}:`, err)
      return null
    }
  }

  // 使用API路由获取元数据组文件列表
  const getFiles = async (pageLimit: number) => {
    if (isServer) {
      console.error('服务器端环境无法获取文件列表')
      return []
    }
    try {
      console.log(
        `尝试获取组 ${METADATA_GROUP_ID} 的文件，限制 ${pageLimit} 条`
      )

      // 使用API路由代理请求获取文件列表
      const response = await fetch(
        `/api/pinata?action=list&groupId=${METADATA_GROUP_ID}`
      )

      if (!response.ok) {
        throw new Error(`获取文件列表失败: ${response.statusText}`)
      }

      const groupResponse = await response.json()
      console.log('groupResponse', groupResponse)
      console.log('组响应:', JSON.stringify(groupResponse, null, 2))

      // 处理Pinata API返回的数据结构
      const rows = groupResponse.rows || []
      if (!rows || !Array.isArray(rows)) {
        console.error('获取组文件失败：无效的 rows 字段')
        return []
      }

      if (rows.length === 0) {
        console.log(`组 ${METADATA_GROUP_ID} 中没有文件`)
        return []
      }

      // 将API返回的数据结构转换为我们需要的格式
      const files = rows

      const mappedFiles = files.slice(0, pageLimit).map(
        (file: {
          ipfs_pin_hash?: string
          date_pinned?: string
          metadata?: {
            name?: string
            keyvalues?: {
              group?: string
            }
          }
        }) => ({
          cid: file.ipfs_pin_hash || '',
          created_at: file.date_pinned || '2023-01-01T00:00:00.000Z',
        })
      )

      console.log(`获取到 ${mappedFiles.length} 个文件`)
      return mappedFiles
    } catch (err) {
      console.error('SDK 获取组文件出错:', err)
      return []
    }
  }

  // 使用API路由上传文件到Pinata（不加入组）
  const uploadFileToPinata = async (
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<{ cid: string; id: string }> => {
    // 如果需要进度更新，先显示初始进度0%
    if (onProgress) {
      onProgress(0)
    }

    try {
      // 创建FormData对象用于文件上传
      const formData = new FormData()
      formData.append('file', file)

      // 模拟上传进度
      let progressInterval: NodeJS.Timeout | null = null
      if (onProgress) {
        let currentProgress = 0
        progressInterval = setInterval(() => {
          // 模拟上传进度，最大到90%（保留最后10%给服务器处理时间）
          if (currentProgress < 90) {
            currentProgress += 5
            onProgress(currentProgress)
          }
        }, 500)
      }

      // 使用API路由代理上传请求
      const response = await fetch('/api/pinata', {
        method: 'POST',
        body: formData,
        // 不设置Content-Type，让浏览器自动设置multipart/form-data和boundary
      })

      // 清除进度模拟定时器
      if (progressInterval) {
        clearInterval(progressInterval)
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`上传文件失败: ${response.statusText}, ${errorText}`)
      }

      // 获取响应数据
      const result = await response.json()
      console.log('文件上传结果:', result)

      // 设置最终进度为100%
      if (onProgress) {
        onProgress(100)
      }
      
      if (!result || !result.IpfsHash) {
        throw new Error('上传结果中没有找到有效的CID')
      }

      return {
        cid: result.IpfsHash,
        id: result.IpfsHash,
      }
    } catch (error) {
      console.error('SDK 上传文件失败:', error)
      throw error
    }
  }

  // 使用API路由上传JSON数据并加入组
  const uploadJsonToPinata = async (
    jsonData: object,
    groupId?: string
  ): Promise<{ cid: string; id: string }> => {
    try {
      // 准备请求数据
      const requestData = {
        data: jsonData,
        options: {
          metadata: {
            name: 'Video Metadata',
          },
          pinataOptions: groupId
            ? {
                customPinPolicy: {
                  regions: [
                    {
                      id: 'FRA1',
                      desiredReplicationCount: 1,
                    },
                  ],
                },
                pinataMetadata: {
                  keyvalues: {
                    group: groupId,
                  },
                },
              }
            : {},
        },
      }

      // 使用API路由代理上传请求
      const response = await fetch('/api/pinata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        throw new Error(`上传JSON失败: ${response.statusText}`)
      }

      const result = await response.json()
      console.log('JSON 上传结果:', result)

      if (!result || !result.IpfsHash) {
        throw new Error('上传结果中没有找到有效的IpfsHash')
      }

      return {
        cid: result.IpfsHash,
        id: result.id || result.cid,
      }
    } catch (error) {
      console.error('SDK 上传 JSON 失败:', error)
      throw error
    }
  }

  // 查询最新元数据文件 CID 列表并获取元数据
  const getLatestCIDs = useCallback(
    async (pageLimit: number = limit) => {
      if (isServer) return

      setLoading(true)
      setError(null)

      try {
        const files = await getFiles(10)
        if (files.length === 0) {
          throw new Error('无法获取元数据文件列表')
        }

        const sortedFiles = files.sort(
          (a: PinataFileItem, b: PinataFileItem) => {
            const dateA = new Date(a.created_at).getTime()
            const dateB = new Date(b.created_at).getTime()
            return dateB - dateA
          }
        )

        const latestCIDs = sortedFiles
          .slice(0, pageLimit)
          .map((file) => file.cid)

        if (latestCIDs.length === 0) {
          throw new Error('没有找到有效的元数据文件')
        }

        const metadataPromises = latestCIDs.map((cid) => fetchMetadata(cid))
        const metadataResults = await Promise.all(metadataPromises)
        const validMetadata = metadataResults.filter(
          (item) => item !== null
        ) as VideoMetadata[]

        if (validMetadata.length === 0) {
          throw new Error('所有元数据获取失败，请检查 IPFS 网关或 CID 有效性')
        }

        setVideos(validMetadata)
      } catch (err) {
        console.error('获取文件列表失败:', err)
        setError('视频加载失败，请刷新页面重试')
      } finally {
        setLoading(false)
      }
    },
    [limit]
  )

  // 上传文件到 Pinata
  const uploadFile = async (
    title: string,
    image: File,
    video: File,
    desc: string,
    walletAddress: string,
    isPublic: boolean,
    dataToEncryptHash?: string
  ) => {
    if (isServer || !pinata) {
      setError('Pinata SDK 未初始化')
      return
    }

    if (!walletAddress) {
      setError('缺少作者钱包地址')
      return
    }

    setUploading(true)
    setError(null)
    setUploadProgress(0)
    setUploadStage('cover')

    try {
      // 模拟上传封面图片的进度 - 占总进度的20%
      setUploadProgress(0)
      console.log('开始上传封面图片...')
      const imageResult = await uploadFileToPinata(image, (progress) => {
        // 将封面上传进度映射到0-20%
        setUploadProgress(Math.max(0, Math.min(20, Math.round(progress * 0.2))))
      })
      console.log('封面图片上传完成:', imageResult)
      setUploadProgress(20)

      // 切换到视频上传阶段
      setUploadStage('video')

      // 模拟上传视频文件的进度 - 占总进度的75%
      console.log('开始上传视频文件...')
      const videoResult = await uploadFileToPinata(video, (progress) => {
        // 将视频上传进度映射到20-95%
        setUploadProgress(
          20 + Math.max(0, Math.min(75, Math.round(progress * 0.75)))
        )
      })
      console.log('视频文件上传完成:', videoResult)
      setUploadProgress(95)

      // 切换到元数据上传阶段
      setUploadStage('metadata')

      // 创建元数据对象
      const metadata = {
        title,
        description: desc,
        coverImageCid: imageResult.cid,
        videoCid: videoResult.cid,
        timestamp: new Date().toISOString(),
        author: walletAddress,
        isPublic,
        ...(isPublic === false ? { dataToEncryptHash } : {}),
      }

      console.log('准备上传的元数据:', JSON.stringify(metadata, null, 2))

      // 上传元数据 JSON 并加入指定组 - 占总进度的5%
      console.log('开始上传元数据...')
      const metadataResult = await uploadJsonToPinata(
        metadata,
        METADATA_GROUP_ID
      )
      console.log('元数据文件上传完成:', metadataResult)

      setUploadProgress(100)
      setUploadStage('complete')
      setIpfsHash(metadataResult.cid)

      // 等待IPFS网络传播并刷新列表
      console.log('上传全部完成，准备刷新视频列表...')

      // 第一次尝试立即获取最新视频
      try {
        await getLatestCIDs()
        console.log('首次刷新视频列表完成')
      } catch (refreshError) {
        console.warn('首次刷新视频列表失败，将在3秒后重试:', refreshError)
      }

      // 再等待3秒后再次尝试获取，以确保IPFS网络有足够时间传播
      setTimeout(async () => {
        try {
          await getLatestCIDs()
          console.log('延迟3秒后再次刷新视频列表完成')
        } catch (delayedRefreshError) {
          console.error('延迟刷新视频列表失败:', delayedRefreshError)
        }
      }, 3000)
    } catch (err) {
      console.error('上传文件失败:', err)
      setError('上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  // 初始化时加载最新文件
  useEffect(() => {
    if (!isServer) {
      getLatestCIDs()
      const loadingTimeout = setTimeout(() => {
        if (loading) {
          setLoading(false)
          setError('视频加载失败，请刷新页面重试')
        }
      }, 10000)
      return () => clearTimeout(loadingTimeout)
    }
    return () => setError(null)
  }, [getLatestCIDs])

  return {
    videos,
    loading,
    error,
    uploadFile,
    uploading,
    ipfsHash,
    getLatestCIDs,
    uploadProgress,
    uploadStage,
  }
}
