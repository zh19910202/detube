import { useState, useEffect, useCallback, useRef } from 'react';
import { Comment } from '@/app/lib/commentManager';
import { useAccount, useSignMessage } from 'wagmi';

export interface UseCommentsProps {
  videoId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface NewCommentData {
  text: string;
  parentId?: string;
}

export interface CommentState {
  comments: Comment[];
  isLoading: boolean;
  error: string | null;
  isSubmitting: boolean;
  hasMore: boolean;
  totalCount: number;
}

const COMMENT_VALIDATION = {
  minLength: 1,
  maxLength: 5000,
  forbiddenWords: ['spam', 'scam', '垃圾', '骗子'],
} as const;

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
  });

  const { address, isConnected } = useAccount();
  const { signMessageAsync, isPending: isSigning } = useSignMessage();
  const abortControllerRef = useRef<AbortController | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 清理函数
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, []);

  const validateComment = useCallback((text: string): string | null => {
    if (!text || text.trim().length < COMMENT_VALIDATION.minLength) {
      return '评论内容不能为空';
    }
    if (text.length > COMMENT_VALIDATION.maxLength) {
      return `评论内容不能超过${COMMENT_VALIDATION.maxLength}个字符`;
    }
    const lowerText = text.toLowerCase();
    const foundForbiddenWord = COMMENT_VALIDATION.forbiddenWords.find((word) =>
      lowerText.includes(word.toLowerCase())
    );
    if (foundForbiddenWord) {
      return '评论包含不当内容，请修改后重试';
    }
    return null;
  }, []);

  const fetchComments = useCallback(
    async (showLoading = true) => {
      if (!videoId) {
        console.warn('No videoId provided, skipping fetch');
        return;
      }

      if (showLoading) {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));
      }

      try {
        console.log('Fetching comments for videoId:', videoId);
        abortControllerRef.current = new AbortController();
        const response = await fetch(`/api/comments/${videoId}`, {
          headers: {
            'Cache-Control': 'no-cache',
          },
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Failed to fetch comments: HTTP ${response.status}`
          );
        }

        const data = await response.json();
        console.log('Fetched comments data:', data);

        let comments: Comment[] = [];
        let totalCount = 0;

        if (Array.isArray(data)) {
          comments = data;
          totalCount = data.length;
        } else if (data.comments && Array.isArray(data.comments)) {
          comments = data.comments;
          totalCount = data.totalCount || data.comments.length;
        }

        comments.sort((a, b) => b.timestamp - a.timestamp);

        setState((prev) => ({
          ...prev,
          comments,
          totalCount,
          hasMore: comments.length < totalCount,
          isLoading: false,
          error: null,
        }));
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('Fetch aborted due to component unmount');
          return;
        }
        console.error('Error fetching comments:', err);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to fetch comments',
        }));
      }
    },
    [videoId]
  );

  useEffect(() => {
    if (!autoRefresh || !videoId) return;

    const startAutoRefresh = () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }

      refreshTimerRef.current = setInterval(() => {
        fetchComments(false);
      }, refreshInterval);
    };

    startAutoRefresh();

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, fetchComments, videoId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const addComment = useCallback(
    async (
      newCommentData: NewCommentData
    ): Promise<{ success: boolean; error?: string }> => {
      console.log('[addComment] Starting to add comment:', {
        videoId,
        isConnected,
        address,
        newCommentData,
      });

      if (!videoId) {
        return { success: false, error: 'Video ID is missing' };
      }
      if (!isConnected || !address) {
        return { success: false, error: 'Please connect your wallet' };
      }
      if (!signMessageAsync) {
        return { success: false, error: 'Signature function unavailable, please refresh' };
      }

      const validationError = validateComment(newCommentData.text);
      if (validationError) {
        return { success: false, error: validationError };
      }

      setState((prev) => ({ ...prev, isSubmitting: true, error: null }));

      try {
        const timestamp = Date.now();
        const commentPayload = {
          videoId,
          author: address,
          text: newCommentData.text.trim(),
          timestamp,
          ...(newCommentData.parentId && { parentId: newCommentData.parentId }),
        };

        const messageToSign = JSON.stringify(
          commentPayload,
          Object.keys(commentPayload).sort()
        );
        console.log('[addComment] Requesting signature for:', messageToSign);

        const signature = await signMessageAsync({ message: messageToSign });
        if (!signature) {
          throw new Error('Signature not obtained');
        }

        console.log('[addComment] Signature obtained, submitting comment');

        const response = await fetch('/api/comments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...commentPayload,
            signature,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Failed to submit comment: HTTP ${response.status}`
          );
        }

        const responseData = await response.json();
        console.log('[addComment] Comment submitted successfully:', responseData);

        await fetchComments(false);
        setState((prev) => ({ ...prev, isSubmitting: false }));
        return { success: true };
      } catch (err: unknown) {
        console.error('[addComment] Error adding comment:', err);
        let errorMessage = 'Failed to add comment';
        if (typeof err === 'object' && err !== null && 'code' in err) {
          const code = (err as { code: unknown }).code;
          if (code === 4001) {
            errorMessage = 'User cancelled signature';
          } else if (code === -32603) {
            errorMessage = 'Wallet connection error, please try again';
          } else if (err instanceof Error) {
            errorMessage = err.message;
          }
        } else if (err instanceof Error) {
          errorMessage = err.message;
        }

        setState((prev) => ({
          ...prev,
          isSubmitting: false,
          error: errorMessage,
        }));
        return { success: false, error: errorMessage };
      }
    },
    [videoId, isConnected, address, signMessageAsync, validateComment, fetchComments]
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const refetchComments = useCallback(() => {
    return fetchComments(true);
  }, [fetchComments]);

  return {
    comments: state.comments,
    isLoading: state.isLoading,
    error: state.error,
    addComment,
    refetchComments,
    isConnected, 
    userAddress: address,
  };
}

export default useComments;