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
      <h3 className="text-xl font-semibold mb-4 text-foreground">
        Comments ({comments.length})
      </h3>

      {/* Comment submission form */}
      {isConnected ? (
        <form onSubmit={handleSubmitComment} className="mb-6">
          <textarea
            className="w-full p-3 bg-secondary border border-secondary text-foreground rounded-lg focus:ring-2 focus:ring-accent focus:border-accent placeholder-gray-500 transition-colors"
            rows={3}
            placeholder="Add a public comment..."
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            disabled={isSubmitting}
          />
          {submitError && (
            <p className="mt-2 text-red-400 text-sm">{submitError}</p>
          )}
          <div className="flex items-center justify-between mt-3">
            <button
              onClick={() => refetchComments()}
              type="button" // Important: type="button" to prevent form submission
              className="px-4 py-2 text-sm bg-secondary text-foreground rounded-lg hover:bg-primary border border-secondary hover:border-accent/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isLoading}>
              {isLoading && comments.length > 0
                ? 'Refreshing...'
                : 'Refresh Comments'}
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-accent text-background font-semibold rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isSubmitting || !newCommentText.trim() || !isConnected}>
              {isSubmitting ? 'Submitting...' : 'Comment'}
            </button>
          </div>
        </form>
      ) : (
        <div className="text-gray-400 bg-primary border border-secondary p-4 rounded-lg mb-6">
          <p>Please connect your wallet to leave a comment.</p>
        </div>
      )}

      {/* Display general errors for fetching comments */}
      {error && !isLoading && (
        <div className="p-3 mb-4 bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg text-sm">
          Error loading comments: {error}
        </div>
      )}

      {/* Comments list */}
      {isLoading && comments.length === 0 && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent mx-auto mb-2"></div>
          <p className="text-gray-400">Loading comments...</p>
        </div>
      )}
      {!isLoading && comments.length === 0 && !error && (
        <div className="text-center py-4 text-gray-500 bg-primary border border-secondary p-4 rounded-lg">
          No comments yet. Be the first to share your thoughts!
        </div>
      )}

      <div className="space-y-4">
        {comments.map((comment) => (
          <div
            key={comment.id || comment.timestamp} // Use a stable key
            className="p-4 border border-secondary rounded-lg bg-primary shadow-md">
            <div className="flex items-center mb-2">
              <p
                className="font-semibold text-sm text-accent truncate mr-2"
                title={comment.author}>
                {comment.author.slice(0, 6)}...{comment.author.slice(-4)}
              </p>
              <span className="text-xs text-gray-500">
                {formatDistanceToNow(new Date(comment.timestamp * 1000), {
                  // Assuming timestamp is in seconds
                  addSuffix: true,
                })}
              </span>
            </div>
            <p className="text-gray-300 whitespace-pre-wrap text-sm">
              {comment.text}
            </p>
            {comment.id && (
              <a
                href={`https://${process.env.NEXT_PUBLIC_PINATA_GW}/ipfs/${comment.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent/80 hover:text-accent hover:underline mt-2 inline-block transition-colors">
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
