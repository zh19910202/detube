import React, { useState, useEffect } from 'react'
import useComments, { NewCommentData } from '@/app/hooks/useComments'
import { useAccount } from 'wagmi'
import { formatDistanceToNow } from 'date-fns'

interface CommentsProps {
  videoId: string
}

const Comments: React.FC<CommentsProps> = ({ videoId }) => {
  const { comments, isLoading, error, addComment, refetchComments } =
    useComments({ videoId })
  const [newCommentText, setNewCommentText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const { isConnected, address } = useAccount()

  // 添加调试信息：组件状态变化
  useEffect(() => {
    console.log('Comments component state:', {
      videoId,
      isConnected,
      address,
      commentsCount: comments.length,
      isLoading,
      error,
      isSubmitting,
      submitError,
    })
  }, [
    videoId,
    isConnected,
    address,
    comments,
    isLoading,
    error,
    isSubmitting,
    submitError,
  ])

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCommentText.trim()) return

    console.log('Attempting to submit comment:', {
      videoId,
      text: newCommentText,
      address,
      isConnected,
    })

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      console.log('Calling addComment...')
      const success = await addComment({ text: newCommentText })
      console.log('addComment result:', success)

      if (success) {
        console.log('Comment submitted successfully, clearing form')
        setNewCommentText('')
        console.log('Refreshing comments...')
        await refetchComments()
        console.log('Comments refreshed')
      } else {
        console.warn('Comment submission returned false')
        setSubmitError('Failed to submit comment. Please try again.')
      }
    } catch (err) {
      console.error('Error submitting comment:', err)
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to submit comment'
      )
    } finally {
      setIsSubmitting(false)
      console.log('Comment submission process completed')
    }
  }

  return (
    <div className="mt-8">
      <h3 className="text-xl font-semibold mb-4 text-white">Comments</h3>

      {/* Comment submission form */}
      {isConnected ? (
        <form onSubmit={handleSubmitComment} className="mb-6">
          <textarea
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-gray-700 border-gray-600 text-white"
            rows={3}
            placeholder="Add a comment..."
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            disabled={isSubmitting}
          />
          {submitError && (
            <p className="mt-2 text-red-500 text-sm">{submitError}</p>
          )}
          <button
            type="submit"
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting || !newCommentText.trim()}>
            {isSubmitting ? 'Submitting...' : 'Submit Comment'}
          </button>
        </form>
      ) : (
        <p className="text-gray-500 dark:text-gray-400 bg-gray-800 p-4 rounded-md">
          Please connect your wallet to comment.
        </p>
      )}

      {/* Display errors */}
      {error && (
        <div className="p-4 mb-4 bg-red-100 border border-red-400 text-red-700 rounded">
          Error: {error}
        </div>
      )}

      {/* Refresh button */}
      <button
        onClick={() => refetchComments()}
        className="mb-4 px-3 py-1.5 text-sm bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
        disabled={isLoading}>
        {isLoading ? 'Refreshing...' : 'Refresh Comments'}
      </button>

      {/* Comments list */}
      {isLoading && comments.length === 0 && (
        <p className="text-gray-400">Loading comments...</p>
      )}
      {!isLoading && comments.length === 0 && !error && (
        <p className="text-gray-400">
          No comments yet. Be the first to comment!
        </p>
      )}

      <div className="space-y-4">
        {comments.map((comment) => (
          <div
            key={comment.id || comment.timestamp}
            className="p-4 border border-gray-700 rounded-lg bg-gray-800">
            <div className="flex items-center mb-1">
              <p
                className="font-semibold text-sm text-blue-400 truncate"
                title={comment.author}>
                {comment.author.slice(0, 6)}...{comment.author.slice(-4)}
              </p>
              <span className="text-xs text-gray-400 ml-2">
                {formatDistanceToNow(new Date(comment.timestamp), {
                  addSuffix: true,
                })}
              </span>
            </div>
            <p className="text-gray-200 whitespace-pre-wrap">{comment.text}</p>
            {comment.id && (
              <a
                href={`https://gateway.pinata.cloud/ipfs/${comment.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline mt-1 inline-block">
                View on IPFS
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default Comments
