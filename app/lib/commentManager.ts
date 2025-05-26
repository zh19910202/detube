interface PinataRow {
  ipfs_pin_hash: string
  timestamp: string
  metadata: {
    name: string
    keyvalues: {
      [key: string]: string
    }
  }
}

export interface Comment {
  id?: string // 评论本身的CID
  videoId: string // 视频ID
  author: string // 用户标识符（如钱包地址）
  text: string // 评论内容
  timestamp: number // 时间戳
  signature?: string // 可选：用于评论验证
  parentId?: string // 父评论ID，用于嵌套回复
  edited?: boolean // 是否已编辑
  editTimestamp?: number // 编辑时间戳
  likes?: number // 点赞数
  dislikes?: number // 踩数
}

interface CommentIndex {
  videoId: string // 视频ID
  commentCIDs: string[] // 评论CID列表
  lastUpdated: number // 最后更新时间
  version: number // 索引版本号
  totalComments: number // 总评论数
  metadata?: {
    // 可选元数据
    moderationFlags: string[] // 审核标记
    pinnedComments: string[] // 置顶评论
  }
}

interface CacheEntry {
  cid: string
  data: CommentIndex
  cachedAt: number // 缓存时间
}

export class CommentManager {
  private pinataJWT: string
  private indexCache: Map<string, CacheEntry> = new Map()
  private commentCache: Map<string, { comment: Comment; timestamp: number }> =
    new Map()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 缓存5分钟
  private readonly COMMENT_CACHE_TTL = 10 * 60 * 1000 // 评论缓存10分钟
  private readonly MAX_RETRIES = 3 // 最大重试次数
  private readonly RETRY_DELAY = 1000 // 重试延迟1秒
  private readonly MAX_COMMENT_LENGTH = 5000 // 最大评论长度
  private readonly BATCH_SIZE = 5 // 批处理大小

  constructor(pinataJWT: string) {
    if (!pinataJWT) {
      throw new Error('需要提供Pinata JWT')
    }
    console.log(
      'CommentManager已初始化，JWT状态:',
      pinataJWT ? '已提供' : '缺失'
    )
    this.pinataJWT = pinataJWT
  }

  /**
   * 延迟函数
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * 重试机制，支持指数退避
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    retries: number = this.MAX_RETRIES
  ): Promise<T> {
    for (let i = 0; i < retries; i++) {
      try {
        return await operation()
      } catch (error) {
        if (i === retries - 1) throw error
        console.warn(`操作失败，正在重试 (${i + 1}/${retries}):`, error)
        await this.delay(this.RETRY_DELAY * Math.pow(2, i)) // 指数退避
      }
    }
    throw new Error('超过最大重试次数')
  }

  /**
   * 检查缓存是否有效
   */
  private isCacheValid(entry: CacheEntry): boolean {
    return Date.now() - entry.cachedAt < this.CACHE_TTL
  }

  /**
   * 查询Pinata API
   */
  private async queryPinata(query: string): Promise<PinataRow[]> {
    return this.retryOperation(async () => {
      console.log('正在查询Pinata:', query)
      const response = await fetch(
        `https://api.pinata.cloud/data/pinList?${query}`,
        {
          headers: {
            Authorization: `Bearer ${this.pinataJWT}`,
          },
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Pinata查询失败:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        })
        throw new Error(
          `Pinata查询失败: ${response.status} ${response.statusText} - ${errorText}`
        )
      }

      const data = await response.json()
      console.log('Pinata查询响应:', data)
      return data.rows || []
    })
  }

  /**
   * 查找评论索引
   */
  private async findCommentIndex(
    videoId: string
  ): Promise<{ cid: string; data: CommentIndex } | null> {
    console.log('正在查找视频评论索引:', videoId)

    // 首先检查缓存
    const cached = this.indexCache.get(videoId)
    if (cached && this.isCacheValid(cached)) {
      console.log('找到有效的缓存索引:', cached)
      return { cid: cached.cid, data: cached.data }
    }

    // 查询Pinata获取索引文件
    const query = `metadata[keyvalues]={"videoId":{"value":"${videoId}","op":"eq"},"type":{"value":"comment-index","op":"eq"}}`
    console.log('正在查询索引文件:', query)
    const pins = await this.queryPinata(query)

    if (pins.length === 0) {
      console.log('未找到视频索引:', videoId)
      return null
    }

    // 获取最新的索引文件
    const latestPin = pins.reduce((latest, current) => {
      return !latest || current.timestamp > latest.timestamp ? current : latest
    })
    console.log('找到最新索引:', latestPin)

    try {
      console.log('正在从IPFS获取索引文件:', latestPin.ipfs_pin_hash)
      const response = await fetch(
        `https://gateway.pinata.cloud/ipfs/${latestPin.ipfs_pin_hash}`,
        {
          signal: AbortSignal.timeout(10000), // 10秒超时
        }
      )

      if (!response.ok) {
        throw new Error(`获取索引文件失败: ${response.status}`)
      }

      const data = await response.json()
      console.log('获取到索引数据:', data)

      // 验证索引结构
      if (!data.videoId || !Array.isArray(data.commentCIDs)) {
        throw new Error('无效的索引结构')
      }

      const result = { cid: latestPin.ipfs_pin_hash, data }

      // 更新缓存
      this.indexCache.set(videoId, {
        cid: latestPin.ipfs_pin_hash,
        data,
        cachedAt: Date.now(),
      })

      return result
    } catch (error) {
      console.error('获取索引文件时出错:', error)
      return null
    }
  }

  /**
   * 创建或更新索引
   */
  private async createOrUpdateIndex(
    videoId: string,
    newCommentCID: string
  ): Promise<string> {
    console.log('正在为视频创建/更新索引:', videoId, '新评论:', newCommentCID)

    const existingIndex = await this.findCommentIndex(videoId)

    const updatedIndex: CommentIndex = {
      videoId,
      commentCIDs: existingIndex
        ? [...existingIndex.data.commentCIDs, newCommentCID]
        : [newCommentCID],
      lastUpdated: Date.now(),
      version: existingIndex ? existingIndex.data.version + 1 : 1,
      totalComments: existingIndex ? existingIndex.data.totalComments + 1 : 1,
      metadata: existingIndex?.data.metadata || {
        moderationFlags: [],
        pinnedComments: [],
      },
    }

    const indexData = {
      pinataOptions: { cidVersion: 1 },
      pinataMetadata: {
        name: `视频${videoId}的评论索引`,
        keyvalues: {
          videoId: videoId,
          type: 'comment-index',
          lastUpdated: Date.now().toString(),
          version: updatedIndex.version.toString(),
          totalComments: updatedIndex.totalComments.toString(),
        },
      },
      pinataContent: updatedIndex,
    }

    const response = await fetch(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.pinataJWT}`,
        },
        body: JSON.stringify(indexData),
      }
    )

    if (!response.ok) {
      throw new Error(`更新评论索引失败: ${response.status}`)
    }

    const result = await response.json()
    const newIndexCID = result.IpfsHash

    // 更新缓存
    this.indexCache.set(videoId, {
      cid: newIndexCID,
      data: updatedIndex,
      cachedAt: Date.now(),
    })

    return newIndexCID
  }

  /**
   * 上传评论到IPFS
   */
  async uploadCommentToIPFS(comment: Omit<Comment, 'id'>): Promise<string> {
    // 输入验证
    if (!comment.videoId || !comment.author || !comment.text?.trim()) {
      throw new Error('缺少必要的评论字段')
    }

    if (comment.text.length > this.MAX_COMMENT_LENGTH) {
      throw new Error(`评论内容过长，最大长度为${this.MAX_COMMENT_LENGTH}字符`)
    }

    // 内容过滤（可以添加敏感词检测等）
    const sanitizedComment = {
      ...comment,
      text: comment.text.trim(),
      timestamp: comment.timestamp || Date.now(),
    }

    console.log('正在上传评论到IPFS:', sanitizedComment)

    const commentData = {
      pinataOptions: { cidVersion: 1 },
      pinataMetadata: {
        name: `视频${comment.videoId}的评论 - ${comment.author}`,
        keyvalues: {
          videoId: comment.videoId,
          author: comment.author,
          timestamp: sanitizedComment.timestamp.toString(),
          type: 'comment',
          ...(comment.parentId && { parentId: comment.parentId }),
        },
      },
      pinataContent: sanitizedComment,
    }

    try {
      const response = await this.retryOperation(async () => {
        return fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.pinataJWT}`,
          },
          body: JSON.stringify(commentData),
        })
      })

      if (!response.ok) {
        throw new Error(`上传评论失败: ${response.status}`)
      }

      const result = await response.json()

      if (!result.IpfsHash) {
        throw new Error('响应中未找到IPFS哈希')
      }

      // 更新索引
      await this.createOrUpdateIndex(comment.videoId, result.IpfsHash)

      console.log('评论已上传到IPFS，CID:', result.IpfsHash)
      return result.IpfsHash
    } catch (error) {
      console.error('上传评论到IPFS时出错:', error)
      throw error
    }
  }

  /**
   * 获取视频的所有评论CID
   */
  async getCommentCIDsForVideo(videoId: string): Promise<string[]> {
    console.log('正在获取视频的评论CID:', videoId)
    const index = await this.findCommentIndex(videoId)
    const cids = index ? index.data.commentCIDs : []
    console.log('找到评论CID:', cids)
    return cids
  }

  /**
   * 从IPFS获取评论内容
   */
  async fetchCommentFromIPFS(cid: string): Promise<Comment> {
    console.log('正在从IPFS获取评论:', cid)

    // 检查缓存
    const cached = this.commentCache.get(cid)
    if (cached && Date.now() - cached.timestamp < this.COMMENT_CACHE_TTL) {
      console.log('使用缓存的评论:', cid)
      return cached.comment
    }

    const gateways = [
      'https://gateway.pinata.cloud/ipfs/',
      'https://ipfs.io/ipfs/',
      'https://cloudflare-ipfs.com/ipfs/',
      'https://dweb.link/ipfs/',
    ]

    for (const gateway of gateways) {
      try {
        console.log('尝试网关:', gateway)
        const response = await fetch(`${gateway}${cid}`, {
          signal: AbortSignal.timeout(15000), // 每个网关15秒超时
          headers: {
            'Cache-Control': 'public, max-age=300', // 5分钟缓存
          },
        })

        if (!response.ok) {
          console.warn(`从${gateway}获取失败:`, response.status)
          continue
        }

        const comment = await response.json()

        // 验证评论结构
        if (!comment.videoId || !comment.author || !comment.text) {
          throw new Error('无效的评论结构')
        }

        const commentWithId = { ...comment, id: cid }

        // 更新缓存
        this.commentCache.set(cid, {
          comment: commentWithId,
          timestamp: Date.now(),
        })

        console.log('成功获取评论:', comment)
        return commentWithId
      } catch (error) {
        console.warn(`从${gateway}获取评论${cid}失败:`, error)
      }
    }

    throw new Error(`从所有网关获取评论${cid}都失败了`)
  }

  /**
   * 获取视频的所有评论（批量处理）
   */
  async getCommentsForVideo(videoId: string): Promise<Comment[]> {
    console.log('正在获取视频的所有评论:', videoId)
    const cids = await this.getCommentCIDsForVideo(videoId)

    if (cids.length === 0) {
      return []
    }

    // 分批并行获取评论以避免过载网关
    const comments: Comment[] = []

    for (let i = 0; i < cids.length; i += this.BATCH_SIZE) {
      const batch = cids.slice(i, i + this.BATCH_SIZE)
      const batchPromises = batch.map(async (cid) => {
        try {
          return await this.fetchCommentFromIPFS(cid)
        } catch (error) {
          console.error(`获取评论${cid}失败:`, error)
          return null
        }
      })

      const batchResults = await Promise.all(batchPromises)
      comments.push(
        ...batchResults.filter(
          (comment): comment is Comment => comment !== null
        )
      )
    }

    // 按时间戳排序
    return comments.sort((a, b) => a.timestamp - b.timestamp)
  }

  /**
   * 构建评论树（嵌套回复）
   */
  buildCommentTree(comments: Comment[]): Comment[] {
    const commentMap = new Map<string, Comment & { replies: Comment[] }>()
    const rootComments: (Comment & { replies: Comment[] })[] = []

    // 初始化所有评论
    comments.forEach((comment) => {
      commentMap.set(comment.id!, { ...comment, replies: [] })
    })

    // 构建树结构
    comments.forEach((comment) => {
      const commentWithReplies = commentMap.get(comment.id!)!

      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId)
        if (parent) {
          parent.replies.push(commentWithReplies)
        } else {
          // 父评论不存在，作为根评论处理
          rootComments.push(commentWithReplies)
        }
      } else {
        rootComments.push(commentWithReplies)
      }
    })

    return rootComments
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.indexCache.clear()
    this.commentCache.clear()
    console.log('缓存已清除')
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { size: number; entries: string[]; totalMemory: number } {
    const entries = Array.from(this.indexCache.entries())
    const totalMemory = entries.reduce((sum, [key, value]) => {
      return sum + JSON.stringify(value).length + key.length
    }, 0)

    return {
      size: this.indexCache.size,
      entries: Array.from(this.indexCache.keys()),
      totalMemory,
    }
  }

  /**
   * 获取视频评论统计
   */
  async getVideoCommentStats(videoId: string): Promise<{
    totalComments: number
    lastUpdated: number
    version: number
  }> {
    const index = await this.findCommentIndex(videoId)

    if (!index) {
      return {
        totalComments: 0,
        lastUpdated: 0,
        version: 0,
      }
    }

    return {
      totalComments: index.data.totalComments,
      lastUpdated: index.data.lastUpdated,
      version: index.data.version,
    }
  }
}
