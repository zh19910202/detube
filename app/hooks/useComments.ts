import { useState, useEffect, useCallback } from 'react'
import { Comment } from '@/app/lib/commentManager' // Assuming Comment interface is exported
import { useAccount, useSignMessage } from 'wagmi' // For getting user's address and signing messages

export interface UseCommentsProps {
  videoId: string
}

export interface NewCommentData {
  text: string
}

function useComments({ videoId }: UseCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const { address, isConnected } = useAccount()
  const { signMessageAsync, isPending: isSigning } = useSignMessage()

  useEffect(() => {
    console.log('useComments: signMessageAsync is ready:', !!signMessageAsync)
    console.log('useComments: isSigning (isPending) status:', isSigning)
  }, [signMessageAsync, isSigning])

  const fetchComments = useCallback(async () => {
    if (!videoId) return
    setIsLoading(true)
    setError(null)
    try {
      console.log('Fetching comments for video:', videoId)
      const response = await fetch(`/api/comments/${videoId}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch comments')
      }
      const data: Comment[] = await response.json()
      console.log('Fetched comments:', data)
      setComments(data)
    } catch (err: any) {
      console.error('Error fetching comments:', err)
      setError(err.message || 'An unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [videoId])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const addComment = async (
    newCommentData: NewCommentData
  ): Promise<boolean> => {
    console.log('[addComment] Starting with data:', {
      videoId,
      isConnected,
      address,
      newCommentData,
    })

    if (!signMessageAsync) {
      console.error('[addComment] signMessageAsync is not available!')
      setError('Signing function not available. Please try again later.')
      return false
    }

    if (!videoId || !isConnected || !address) {
      const errorMsg = 'User not connected or videoId missing.'
      console.error('[addComment]', errorMsg, { videoId, isConnected, address })
      setError(errorMsg)
      return false
    }

    setIsLoading(true)
    setError(null)

    const timestamp = Date.now()
    const commentPayload = {
      videoId,
      author: address,
      text: newCommentData.text,
      timestamp,
    }

    console.log('[addComment] Prepared comment payload:', commentPayload)

    const messageToSign = JSON.stringify(commentPayload)
    console.log('[addComment] Requesting signature for message:', messageToSign)
    console.log(
      '[addComment] Current isSigning (isPending) status from useSignMessage:',
      isSigning
    )

    try {
      console.log('[addComment] About to call signMessageAsync...')
      const signaturePromise = signMessageAsync({ message: messageToSign })
      console.log('[addComment] signMessageAsync called, promise obtained.')

      const signature = await signaturePromise
        .then((sig) => {
          console.log('[addComment] signMessageAsync resolved:', sig)
          return sig
        })
        .catch((err) => {
          console.error('[addComment] signMessageAsync rejected:', err)
          throw err // Re-throw to be caught by the outer try-catch
        })

      if (!signature) {
        console.error(
          '[addComment] Signature was not obtained after promise settled (should have been caught by .catch).'
        )
        setError(
          'Failed to obtain signature. The signing process might have been interrupted.'
        )
        setIsLoading(false)
        return false
      }

      console.log('[addComment] Got signature:', signature)

      console.log('[addComment] Sending POST request to /api/comments')
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...commentPayload, signature }),
      })

      console.log('[addComment] Got response from /api/comments:', {
        status: response.status,
        ok: response.ok,
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error(
          '[addComment] API error response from /api/comments:',
          errorData
        )
        throw new Error(errorData.error || 'Failed to add comment')
      }

      const responseData = await response.json()
      console.log(
        '[addComment] API success response from /api/comments:',
        responseData
      )

      console.log(
        '[addComment] Refreshing comments after successful submission'
      )
      await fetchComments()
      return true
    } catch (err: any) {
      console.error('[addComment] Error in outer catch block:', err)
      if (err.code === 4001) {
        // MetaMask user rejected transaction
        setError('Please sign the message to submit your comment.')
      } else if (
        err.message &&
        err.message.includes('Signature was not obtained')
      ) {
        setError(err.message)
      } else {
        setError(`Failed to add comment: ${err.message || 'Unknown error'}`)
      }
      return false
    } finally {
      setIsLoading(false)
      console.log('[addComment] Finished execution.')
    }
  }

  return {
    comments,
    isLoading,
    error,
    addComment,
    refetchComments: fetchComments,
  }
}

export default useComments
