import React, { useState, useEffect, useCallback, useMemo } from 'react'
import useComments from '@/app/hooks/useComments'
import { useAccount } from 'wagmi'
import { formatDistanceToNow } from 'date-fns'

interface CommentsProps {
  videoId: string
}

interface Comment {
  id?: string
  author: string
  text: string
  timestamp: number
}

const Comments: React.FC<CommentsProps> = ({ videoId }) => {
  const { comments, isLoading, error, addComment, refetchComments } =
    useComments({ videoId })
  const [newCommentText, setNewCommentText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const { isConnected, address } = useAccount()

  // Memoize formatted comments to prevent unnecessary re-renders
  const formattedComments = useMemo(() => {
    return comments.map((comment: Comment) => ({
      ...comment,
      formattedTime: formatDistanceToNow(new Date(comment.timestamp * 1000), {
        addSuffix: true,
      }),
      truncatedAuthor: `${comment.author.slice(0, 6)}...${comment.author.slice(
        -4
      )}`,
    }))
  }, [comments])

  // Helper function to get error message
  const getErrorMessage = useCallback((err: unknown): string => {
    if (typeof err === 'string') return err
    if (err instanceof Error) return err.message
    return 'Unknown error'
  }, [])

  // Optimize debug logging with useCallback
  const logComponentState = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Comments component state:', {
        videoId,
        isConnected,
        address,
        commentsCount: comments.length,
        isLoading,
        error: error ? getErrorMessage(error) : null,
        isSubmitting,
        submitError,
      })
    }
  }, [
    videoId,
    isConnected,
    address,
    comments.length,
    isLoading,
    error,
    isSubmitting,
    submitError,
    getErrorMessage,
  ])

  useEffect(() => {
    logComponentState()
  }, [logComponentState])

  // Memoize form validation
  const isFormValid = useMemo(() => {
    return newCommentText.trim().length > 0 && isConnected && !isSubmitting
  }, [newCommentText, isConnected, isSubmitting])

  // Optimize comment submission with useCallback
  const handleSubmitComment = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!isFormValid) {
        console.warn('Form validation failed:', {
          isConnected,
          hasText: !!newCommentText.trim(),
        })
        return
      }

      const trimmedText = newCommentText.trim()
      console.log('Submitting comment:', {
        videoId,
        textLength: trimmedText.length,
        address,
      })

      setIsSubmitting(true)
      setSubmitError(null)

      try {
        const success = await addComment({ text: trimmedText })
        console.log('Comment submission result:', success)

        if (success) {
          setNewCommentText('')
          // Use a small delay to ensure backend has processed the comment
          setTimeout(() => {
            refetchComments()
          }, 500)
        } else {
          throw new Error('Comment submission failed')
        }
      } catch (err) {
        console.error('Comment submission error:', err)
        const errorMessage = getErrorMessage(err)
        setSubmitError(errorMessage)
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      isFormValid,
      newCommentText,
      videoId,
      address,
      addComment,
      refetchComments,
      isConnected,
      getErrorMessage,
    ]
  )

  // Optimize refresh handler
  const handleRefreshComments = useCallback(async () => {
    try {
      await refetchComments()
    } catch (err) {
      console.error('Failed to refresh comments:', err)
    }
  }, [refetchComments])

  // Optimize text change handler
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setNewCommentText(e.target.value)
      // Clear submit error when user starts typing
      if (submitError) {
        setSubmitError(null)
      }
    },
    [submitError]
  )

  // Memoize IPFS link component
  const IPFSLink = React.memo(({ commentId }: { commentId: string }) => (
    <a
      href={`https://${process.env.NEXT_PUBLIC_PINATA_GW}/ipfs/${commentId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-accent/80 hover:text-accent hover:underline mt-2 inline-block transition-colors"
      aria-label="View comment on IPFS">
      View on IPFS
    </a>
  ))
  IPFSLink.displayName = 'IPFSLink'

  // Memoize comment item component
  const CommentItem = React.memo(
    ({ comment }: { comment: (typeof formattedComments)[0] }) => (
      <div
        className="p-4 border border-secondary rounded-lg bg-primary shadow-md"
        role="article"
        aria-label={`Comment by ${comment.truncatedAuthor}`}>
        <div className="flex items-center mb-2">
          <p
            className="font-semibold text-sm text-accent truncate mr-2"
            title={comment.author}>
            {comment.truncatedAuthor}
          </p>
          <time
            className="text-xs text-gray-500"
            dateTime={new Date(comment.timestamp * 1000).toISOString()}>
            {comment.formattedTime}
          </time>
        </div>
        <p className="text-gray-300 whitespace-pre-wrap text-sm">
          {comment.text}
        </p>
        {comment.id && <IPFSLink commentId={comment.id} />}
      </div>
    )
  )
  CommentItem.displayName = 'CommentItem'

  return (
    <section className="mt-8" aria-labelledby="comments-heading">
      <h3
        id="comments-heading"
        className="text-xl font-semibold mb-4 text-foreground">
        Comments ({comments.length})
      </h3>

      {/* Comment submission form */}
      {isConnected ? (
        <form onSubmit={handleSubmitComment} className="mb-6" noValidate>
          <div className="relative">
            <textarea
              className="w-full p-3 bg-secondary border border-secondary text-foreground rounded-lg focus:ring-2 focus:ring-accent focus:border-accent placeholder-gray-500 transition-colors resize-vertical min-h-[80px]"
              placeholder="Add a public comment..."
              value={newCommentText}
              onChange={handleTextChange}
              disabled={isSubmitting}
              maxLength={1000}
              aria-label="Write your comment"
              aria-describedby={submitError ? 'comment-error' : undefined}
            />
            {newCommentText.length > 800 && (
              <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                {1000 - newCommentText.length} characters remaining
              </div>
            )}
          </div>

          {submitError && (
            <p
              id="comment-error"
              className="mt-2 text-red-400 text-sm"
              role="alert">
              {submitError}
            </p>
          )}

          <div className="flex items-center justify-between mt-3 gap-3">
            <button
              onClick={handleRefreshComments}
              type="button"
              className="px-4 py-2 text-sm bg-secondary text-foreground rounded-lg hover:bg-primary border border-secondary hover:border-accent/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isLoading}
              aria-label="Refresh comments list">
              {isLoading && comments.length > 0
                ? 'Refreshing...'
                : 'Refresh Comments'}
            </button>

            <button
              type="submit"
              className="px-6 py-2 bg-accent text-background font-semibold rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={!isFormValid}
              aria-label="Submit comment">
              {isSubmitting ? 'Submitting...' : 'Comment'}
            </button>
          </div>
        </form>
      ) : (
        <div
          className="text-gray-400 bg-primary border border-secondary p-4 rounded-lg mb-6"
          role="status">
          <p>Please connect your wallet to leave a comment.</p>
        </div>
      )}

      {/* Error display */}
      {error && !isLoading && (
        <div
          className="p-3 mb-4 bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg text-sm"
          role="alert">
          Error loading comments:{' '}
          {getErrorMessage(error)}
        </div>
      )}

      {/* Loading state */}
      {isLoading && comments.length === 0 && (
        <div className="text-center py-8" role="status" aria-live="polite">
          <div
            className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent mx-auto mb-2"
            aria-hidden="true"></div>
          <p className="text-gray-400">Loading comments...</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && comments.length === 0 && !error && (
        <div className="text-center py-8 text-gray-500 bg-primary border border-secondary p-6 rounded-lg">
          <p>No comments yet. Be the first to share your thoughts!</p>
        </div>
      )}

      {/* Comments list */}
      {formattedComments.length > 0 && (
        <div className="space-y-4" role="feed" aria-label="Comments">
          {formattedComments.map((comment) => (
            <CommentItem
              key={comment.id || `${comment.author}-${comment.timestamp}`}
              comment={comment}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default Comments