import { useState, useEffect, useCallback, useRef } from 'react'
import { Comment } from '@/app/lib/commentManager'
import { useAccount, useSignMessage } from 'wagmi'

export interface UseCommentsProps {
  videoId: string
  autoRefresh?: boolean // 自动刷新开关
  refreshInterval?: number // 刷新间隔（毫秒）
}

export interface NewCommentData {
  text: string
  parentId?: string // 支持回复评论
}

export interface CommentState {
  comments: Comment[]
  isLoading: boolean
  error: string | null
  isSubmitting: boolean // 区分获取和提交的加载状态
  hasMore: boolean // 是否还有更多评论
  totalCount: number // 总评论数
}

// 评论验证规则
const COMMENT_VALIDATION = {
  minLength: 1,
  maxLength: 5000,
  // 简单的敏感词过滤（实际应用中应该用更完善的方案）
  forbiddenWords: ['spam', 'scam', '垃圾', '骗子'],
} as const

function useComments({
  videoId,
  autoRefresh = false,
  refreshInterval = 30000,
}: UseCommentsProps) {
  const [state, setState] = useState<CommentState>({
    comments: [],
    isLoading: false,
    error: null,
    isSubmitting: false,
    hasMore: false,
    totalCount: 0,
  })

  const { address, isConnected } = useAccount()
  const { signMessageAsync, isPending: isSigning } = useSignMessage()

  // 使用ref来跟踪组件是否已卸载，避免内存泄漏
  const isMountedRef = useRef(true)
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      isMountedRef.current = false
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
    }
  }, [])

  /**
   * 验证评论内容
   */
  const validateComment = useCallback((text: string): string | null => {
    if (!text || text.trim().length < COMMENT_VALIDATION.minLength) {
      return '评论内容不能为空'
    }

    if (text.length > COMMENT_VALIDATION.maxLength) {
      return `评论内容不能超过${COMMENT_VALIDATION.maxLength}个字符`
    }

    // 检查敏感词
    const lowerText = text.toLowerCase()
    const foundForbiddenWord = COMMENT_VALIDATION.forbiddenWords.find((word) =>
      lowerText.includes(word.toLowerCase())
    )

    if (foundForbiddenWord) {
      return '评论包含不当内容，请修改后重试'
    }

    return null
  }, [])

  /**
   * 获取评论列表
   */
  const fetchComments = useCallback(
    async (showLoading = true) => {
      if (!videoId) return

      if (showLoading) {
        setState((prev) => ({ ...prev, isLoading: true, error: null }))
      }

      try {
        console.log('正在获取视频评论:', videoId)

        const response = await fetch(`/api/comments/${videoId}`, {
          // 添加缓存控制
          headers: {
            'Cache-Control': 'no-cache',
          },
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(
            errorData.error || `获取评论失败: HTTP ${response.status}`
          )
        }

        const data = await response.json()
        console.log('获取到评论数据:', data)

        // 检查组件是否仍然挂载
        if (!isMountedRef.current) return

        // 处理不同的响应格式
        let comments: Comment[] = []
        let totalCount = 0

        if (Array.isArray(data)) {
          comments = data
          totalCount = data.length
        } else if (data.comments && Array.isArray(data.comments)) {
          comments = data.comments
          totalCount = data.totalCount || data.comments.length
        }

        // 按时间戳排序（最新的在前）
        comments.sort((a, b) => b.timestamp - a.timestamp)

        setState((prev) => ({
          ...prev,
          comments,
          totalCount,
          hasMore: comments.length < totalCount,
          isLoading: false,
          error: null,
        }))
      } catch (err: unknown) {
        console.error('获取评论时出错:', err)

        if (!isMountedRef.current) return

        const error = err instanceof Error ? err : new Error('获取评论失败')
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message,
        }))
      }
    },
    [videoId]
  )

  /**
   * 自动刷新评论
   */
  useEffect(() => {
    if (!autoRefresh || !videoId) return

    const startAutoRefresh = () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }

      refreshTimerRef.current = setInterval(() => {
        fetchComments(false) // 静默刷新，不显示加载状态
      }, refreshInterval)
    }

    startAutoRefresh()

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
    }
  }, [autoRefresh, refreshInterval, fetchComments, videoId])

  /**
   * 初始加载评论
   */
  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  /**
   * 添加新评论
   */
  const addComment = useCallback(
    async (
      newCommentData: NewCommentData
    ): Promise<{ success: boolean; error?: string }> => {
      console.log('[addComment] 开始添加评论:', {
        videoId,
        isConnected,
        address,
        newCommentData,
      })

      // 基础验证
      if (!videoId) {
        return { success: false, error: '视频ID缺失' }
      }

      if (!isConnected || !address) {
        return { success: false, error: '请先连接钱包' }
      }

      if (!signMessageAsync) {
        return { success: false, error: '签名功能不可用，请刷新页面重试' }
      }

      // 验证评论内容
      const validationError = validateComment(newCommentData.text)
      if (validationError) {
        return { success: false, error: validationError }
      }

      setState((prev) => ({ ...prev, isSubmitting: true, error: null }))

      try {
        const timestamp = Date.now()
        const commentPayload = {
          videoId,
          author: address,
          text: newCommentData.text.trim(),
          timestamp,
          ...(newCommentData.parentId && { parentId: newCommentData.parentId }),
        }

        console.log('[addComment] 准备签名的评论数据:', commentPayload)

        // 创建规范化的签名消息
        const messageToSign = JSON.stringify(
          commentPayload,
          Object.keys(commentPayload).sort()
        )
        console.log('[addComment] 请求签名消息:', messageToSign)

        // 请求用户签名
        const signature = await signMessageAsync({
          message: messageToSign,
        })

        if (!signature) {
          throw new Error('未获得签名')
        }

        console.log('[addComment] 获得签名，正在提交评论')

        // 提交评论到服务器
        const response = await fetch('/api/comments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...commentPayload,
            signature,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(
            errorData.error || `提交评论失败: HTTP ${response.status}`
          )
        }

        const responseData = await response.json()
        console.log('[addComment] 评论提交成功:', responseData)

        // 刷新评论列表
        await fetchComments(false)

        setState((prev) => ({ ...prev, isSubmitting: false }))
        return { success: true }
      } catch (err: unknown) {
        console.error('[addComment] 添加评论时出错:', err)

        let errorMessage = '添加评论失败'

        if (err && typeof err === 'object') {
          if ('code' in err) {
            const errorWithCode = err as { code: number }
            if (errorWithCode.code === 4001) {
              errorMessage = '用户取消了签名'
            } else if (errorWithCode.code === -32603) {
              errorMessage = '钱包连接异常，请重试'
            }
          }
          if (err instanceof Error) {
            errorMessage = err.message
          }
        }

        if (!isMountedRef.current)
          return { success: false, error: errorMessage }

        setState((prev) => ({
          ...prev,
          isSubmitting: false,
          error: errorMessage,
        }))

        return { success: false, error: errorMessage }
      }
    },
    [
      videoId,
      isConnected,
      address,
      signMessageAsync,
      validateComment,
      fetchComments,
    ]
  )

  /**
   * 删除评论（如果支持的话）
   */
  const deleteComment = useCallback(
    async (commentId: string): Promise<boolean> => {
      if (!commentId || !address) return false

      try {
        const response = await fetch(`/api/comments/${commentId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ author: address }),
        })

        if (!response.ok) {
          throw new Error('删除评论失败')
        }

        // 从本地状态中移除评论
        setState((prev) => ({
          ...prev,
          comments: prev.comments.filter((comment) => comment.id !== commentId),
          totalCount: Math.max(0, prev.totalCount - 1),
        }))

        return true
      } catch (err) {
        console.error('删除评论时出错:', err)
        return false
      }
    },
    [address]
  )

  /**
   * 点赞评论
   */
  const likeComment = useCallback(
    async (commentId: string): Promise<boolean> => {
      if (!commentId || !address) return false

      try {
        const response = await fetch(`/api/comments/${commentId}/like`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ author: address }),
        })

        if (!response.ok) {
          throw new Error('点赞失败')
        }

        // 更新本地状态
        setState((prev) => ({
          ...prev,
          comments: prev.comments.map((comment) =>
            comment.id === commentId
              ? { ...comment, likes: (comment.likes || 0) + 1 }
              : comment
          ),
        }))

        return true
      } catch (err) {
        console.error('点赞评论时出错:', err)
        return false
      }
    },
    [address]
  )

  /**
   * 清除错误状态
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }))
  }, [])

  /**
   * 手动刷新评论
   */
  const refetchComments = useCallback(() => {
    return fetchComments(true)
  }, [fetchComments])

  return {
    // 状态
    comments: state.comments,
    isLoading: state.isLoading,
    isSubmitting: state.isSubmitting,
    error: state.error,
    hasMore: state.hasMore,
    totalCount: state.totalCount,

    // 操作
    addComment,
    deleteComment,
    likeComment,
    refetchComments,
    clearError,

    // 用户状态
    isConnected,
    userAddress: address,
    isSigning,
  }
}

export default useComments
