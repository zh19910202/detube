'use client'
// hooks/usePinata.ts
import { useState, useEffect, useCallback } from 'react'
import { PinataSDK } from 'pinata-web3'

// 检查是否是服务器端环境
const isServer = typeof window === 'undefined'

// 移除不必要的console.log，以避免服务器/客户端输出不一致
const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT
  ? process.env.NEXT_PUBLIC_PINATA_JWT.replace(/^['"]|['"]$/g, '')
  : ''
const PINATA_GW = process.env.NEXT_PUBLIC_PINATA_GW
  ? process.env.NEXT_PUBLIC_PINATA_GW.replace(/^['"]|['"]$/g, '')
  : ''

// 初始化 Pinata 客户端（使用useEffect确保只在客户端执行）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pinata: any = null

// 元数据JSON文件的组ID - 用于区分元数据和其他文件
const METADATA_GROUP_ID = '8d445587-d12f-4803-ad8d-6099e8369a44'

// 手动测试 CID 列表，用于在 Pinata 不可用时提供测试数据
const TEST_CIDS = [
  'QmZ9zQJuTWNgn6W7Q1tU4KLV8JA9LvdYj1JKsHgSjVrTxi', // 示例CID
]

// 定义视频元数据类型
export interface VideoMetadata {
  cid: string // 元数据JSON文件的CID
  title: string
  description: string
  coverImageCid: string
  videoCid: string
  timestamp: string
}

// 用于API返回的文件类型
interface PinataFileItem {
  cid: string
  created_at: string
  id?: string
  name?: string
  // 添加可能存在的时间字段
  added?: string
}

export const usePinata = (limit: number = 8) => {
  const [videos, setVideos] = useState<VideoMetadata[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [ipfsHash, setIpfsHash] = useState<string | null>(null)
  const [apiMode, setApiMode] = useState<'direct' | 'test'>('direct')

  // 在客户端初始化Pinata SDK
  useEffect(() => {
    if (!isServer) {
      // 确保只在客户端执行
      try {
        pinata = new PinataSDK({
          pinataJwt: PINATA_JWT,
          pinataGateway: PINATA_GW,
        })
        // console.log('Pinata SDK 初始化成功')
      } catch (err) {
        console.error('Pinata SDK 初始化失败:', err)
      }
    }
  }, [])

  // 从 IPFS 获取元数据 JSON 文件内容
  const fetchMetadata = async (cid: string): Promise<VideoMetadata | null> => {
    try {
      // console.log(`开始获取CID ${cid}的元数据`)
      // 使用Pinata SDK获取数据 (如果可用)
      if (pinata) {
        try {
          // console.log(`尝试使用Pinata SDK获取 ${cid}`)
          const response = await pinata.gateways.get(cid)
          const jsonContent =
            typeof response.data === 'string'
              ? JSON.parse(response.data)
              : response.data

          // console.log(`成功通过SDK获取CID ${cid}的元数据:`, jsonContent)

          // 验证元数据格式
          const isValidMetadata =
            jsonContent &&
            typeof jsonContent === 'object' &&
            (jsonContent.title !== undefined ||
              jsonContent.description !== undefined) &&
            jsonContent.coverImageCid !== undefined &&
            jsonContent.videoCid !== undefined

          if (!isValidMetadata) {
            console.error(
              `CID ${cid} 元数据格式无效，缺少必要字段:`,
              jsonContent
            )
            return null
          }

          // 使用提供的timestamp或者固定值，避免使用当前时间戳
          const timestamp = jsonContent.timestamp || '2023-01-01T00:00:00.000Z'

          return {
            cid,
            title: jsonContent.title || '未命名视频',
            description: jsonContent.description || '无描述',
            coverImageCid: jsonContent.coverImageCid,
            videoCid: jsonContent.videoCid,
            timestamp,
          }
        } catch (sdkError) {
          console.error(`SDK获取失败: ${sdkError}`)
          return null
        }
      } else {
        console.error('Pinata SDK 不可用')
        return null
      }
    } catch (err) {
      console.error(`解析元数据出错 CID ${cid}:`, err)
      return null
    }
  }

  // 使用V3 API获取元数据组文件列表
  const getFiles = async (pageLimit: number) => {
    // 确保只在客户端执行
    if (isServer) {
      return []
    }

    try {
      // console.log('使用V3 API获取元数据文件列表...')
      // 根据正确的API端点更新URL
      const apiUrl = `https://api.pinata.cloud/v3/files/public?group=${METADATA_GROUP_ID}&limit=${pageLimit}`
      // console.log('API请求URL:', apiUrl)

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${PINATA_JWT}`,
        },
      })

      if (!response.ok) {
        console.error(
          `V3 API请求失败: ${response.status} ${response.statusText}`
        )
        return []
      }

      const data = await response.json()
      console.log('V3 API返回数据结构:', data)
      // 检查并获取正确路径的文件数组
      if (data.data && data.data.files && Array.isArray(data.data.files)) {
        // console.log('找到视频元数据文件:', data.data.files.length)
        return (
          data.data.files
            .slice(0, pageLimit)
            // 使用接口类型而不是any
            .map(
              (item: {
                cid?: string
                created_at?: string
                added?: string
              }) => ({
                cid: item.cid || '',
                created_at:
                  item.created_at || item.added || '2023-01-01T00:00:00.000Z',
              })
            )
        )
      } else {
        // console.log(
        //  'V3 API返回格式不符合预期，无法找到 data.data.files 数组',
        //  data
        // )
        return []
      }
    } catch (err) {
      console.error('V3 API调用出错:', err)
      return []
    }
  }

  // 直接使用API上传文件到Pinata
  const uploadFileToPinata = async (
    file: File,
    metadata?: { name?: string; keyvalues?: Record<string, string> }
  ): Promise<{ cid: string; id: string }> => {
    const formData = new FormData()
    formData.append('file', file)

    if (metadata) {
      formData.append(
        'pinataMetadata',
        JSON.stringify({
          name: metadata.name || file.name,
          keyvalues: metadata.keyvalues || {},
        })
      )
    }

    const url = 'https://api.pinata.cloud/pinning/pinFileToIPFS'
    // console.log(`上传文件到 ${url}`)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `上传文件失败: ${response.status} ${response.statusText} - ${errorText}`
      )
    }

    const data = await response.json()
    // console.log('上传结果:', data)

    return {
      cid: data.IpfsHash,
      id: data.IpfsHash, // 在v2 API中使用IpfsHash作为ID
    }
  }

  // 将文件添加到组
  const addFileToGroup = async (
    fileId: string,
    groupId: string
  ): Promise<void> => {
    try {
      // 尝试使用V3 API
      const v3Url = `https://api.pinata.cloud/v3/groups/public/${groupId}/files`
      // console.log(`尝试使用V3 API添加文件到组: ${v3Url}`)

      const v3Response = await fetch(v3Url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${PINATA_JWT}`,
        },
        body: JSON.stringify({
          files: [fileId],
        }),
      })

      if (v3Response.ok) {
        // console.log('V3 API成功添加文件到组')
        return
      }

      // 如果V3失败，尝试使用V2 API方式（修改元数据）
      // console.log('V3 API添加文件到组失败，尝试V2 API方式')
      const v2Url = `https://api.pinata.cloud/pinning/hashMetadata`

      const v2Response = await fetch(v2Url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${PINATA_JWT}`,
        },
        body: JSON.stringify({
          ipfsPinHash: fileId,
          name: `Group ${groupId} file`,
          keyvalues: {
            groupId: groupId,
          },
        }),
      })

      if (!v2Response.ok) {
        throw new Error(`V2 API添加文件到组失败: ${v2Response.status}`)
      }

      // console.log('V2 API成功添加文件到组')
    } catch (error) {
      console.error('添加文件到组失败:', error)
      throw error
    }
  }

  // 查询最新元数据文件 CID 列表并获取元数据
  const getLatestCIDs = useCallback(
    async (pageLimit: number = limit) => {
      // 确保只在客户端执行
      if (isServer) {
        return
      }

      // console.log('开始获取最新元数据文件列表...')
      setLoading(true)
      setError(null)

      try {
        // 尝试获取文件列表
        const files = (await getFiles(10)) || []

        // 如果API获取失败，使用测试数据
        if (files.length === 0) {
          // console.log('API获取文件列表失败，使用测试数据')
          setApiMode('test')

          if (TEST_CIDS.length === 0) {
            throw new Error('无法获取元数据文件列表，且没有测试数据可用')
          }

          // 使用测试数据
          const testFiles = TEST_CIDS.map((cid: string) => ({
            cid: cid,
            created_at: '2023-01-01T00:00:00.000Z', // 使用固定时间戳
          }))

          // 获取测试数据元数据
          const metadataPromises = testFiles.map((file: PinataFileItem) =>
            fetchMetadata(file.cid)
          )
          const metadataResults = await Promise.all(metadataPromises)
          const validMetadata = metadataResults.filter(
            (item) => item !== null
          ) as VideoMetadata[]

          if (validMetadata.length === 0) {
            throw new Error('所有测试数据获取失败')
          }

          setVideos(validMetadata)
          setLoading(false)
          return
        }

        // console.log(`成功获取 ${files.length} 个元数据文件`)

        // 按时间倒序排序
        const sortedFiles = files.sort(
          (a: PinataFileItem, b: PinataFileItem) => {
            const dateA = new Date(a.created_at).getTime()
            const dateB = new Date(b.created_at).getTime()
            return dateB - dateA
          }
        )

        // 取最新的文件并获取它们的元数据
        const latestCIDs = sortedFiles
          .slice(0, pageLimit)
          .map((file: PinataFileItem) => file.cid)

        if (latestCIDs.length === 0) {
          throw new Error('没有找到有效的元数据文件')
        }

        // console.log(
        //  `准备获取 ${latestCIDs.length} 个元数据文件内容:`,
        //  latestCIDs
        // )

        // 对每个CID获取元数据
        const metadataPromises = latestCIDs.map((cid: string) =>
          fetchMetadata(cid)
        )
        const metadataResults = await Promise.all(metadataPromises)

        // 过滤掉获取失败的元数据
        const validMetadata = metadataResults.filter(
          (item) => item !== null
        ) as VideoMetadata[]

        // console.log('获取到有效元数据:', validMetadata.length)

        if (validMetadata.length === 0) {
          throw new Error('所有元数据获取失败，请检查IPFS网关或CID有效性')
        }

        setVideos(validMetadata)
      } catch (err) {
        console.error('获取文件列表失败:', err)
        setError(
          // 不暴露具体错误信息给用户
          `视频加载失败，请刷新页面重试`
        )
      } finally {
        // 确保无论如何都设置loading为false
        setLoading(false)
      }
    },
    [limit]
  )

  // 使用直接API上传文件到Pinata
  const uploadFile = async (
    title: string,
    image: File,
    video: File,
    desc: string
  ) => {
    // 确保只在客户端执行
    if (isServer) {
      return
    }

    setUploading(true)
    setError(null)

    try {
      // console.log('开始上传文件到Pinata...')

      // 上传封面图片
      // console.log('上传封面图片...')
      const imageResult = await uploadFileToPinata(image, {
        name: `${title}-cover`,
      })
      // console.log('封面图片上传完成:', imageResult)

      // 上传视频文件
      // console.log('上传视频文件...')
      const videoResult = await uploadFileToPinata(video, {
        name: `${title}-video`,
      })
      // console.log('视频文件上传完成:', videoResult)

      // 创建元数据JSON文件
      const timestamp = new Date().toISOString()
      const metadata = {
        title,
        description: desc,
        coverImageCid: imageResult.cid,
        videoCid: videoResult.cid,
        timestamp,
      }

      // 转换为Blob和File对象
      const metadataBlob = new Blob([JSON.stringify(metadata)], {
        type: 'application/json',
      })

      const metadataFile = new File([metadataBlob], `${title}-metadata.json`, {
        type: 'application/json',
      })

      // 上传元数据文件
      // console.log('上传元数据文件...')
      const metadataResult = await uploadFileToPinata(metadataFile, {
        name: `${title}-metadata`,
        keyvalues: {
          groupId: METADATA_GROUP_ID,
        },
      })
      // console.log('元数据文件上传完成:', metadataResult)

      // 将元数据文件添加到组
      // console.log(`添加元数据文件到组 ${METADATA_GROUP_ID}...`)
      await addFileToGroup(metadataResult.cid, METADATA_GROUP_ID)

      setIpfsHash(metadataResult.cid)

      // 延迟一下再刷新列表，给IPFS一点时间传播
      // console.log('等待3秒后刷新视频列表...')
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // 上传成功后刷新文件列表
      await getLatestCIDs()
    } catch (err) {
      console.error('上传文件失败:', err)
      setError(`上传失败，请重试`)
    } finally {
      // 确保无论如何都设置loading为false
      setUploading(false)
    }
  }

  // 初始化时加载最新文件 - 使用useEffect确保只在客户端执行
  useEffect(() => {
    if (!isServer) {
      getLatestCIDs()

      // 设置错误恢复超时，避免永久加载状态
      const loadingTimeout = setTimeout(() => {
        if (loading) {
          // console.warn('加载超时，自动重置加载状态')
          setLoading(false)
          setError('视频加载失败，请刷新页面重试')
        }
      }, 10000) // 10秒超时

      return () => clearTimeout(loadingTimeout)
    }
    // 确保在组件挂载时清除错误状态
    return () => {
      setError(null)
    }
  }, [getLatestCIDs, isServer]) // 移除 loading 依赖，避免循环调用

  return {
    videos, // 包含完整元数据的视频列表
    loading, // 文件列表加载状态
    error, // 错误信息
    uploadFile, // 上传文件方法
    uploading, // 文件上传状态
    ipfsHash, // 上传文件的 IPFS CID
    getLatestCIDs, // 导出刷新方法让首页可以调用
    apiMode, // 当前API模式
  }
}
