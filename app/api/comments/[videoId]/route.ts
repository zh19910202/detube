import { NextRequest, NextResponse } from 'next/server'
import { CommentManager, Comment } from '@/app/lib/commentManager'

const pinataJWT = process.env.PINATA_JWT || process.env.NEXT_PUBLIC_PINATA_JWT

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ videoId: string }> }
) {
  console.log('GET /api/comments/[videoId] - Starting comment fetch')
  console.log('Pinata JWT status:', !!pinataJWT)

  if (!pinataJWT) {
    console.error('Pinata JWT is missing in environment')
    return NextResponse.json(
      { error: 'Server configuration error: Pinata JWT not set.' },
      { status: 500 }
    )
  }

  console.log('Initializing CommentManager')
  const commentManager = new CommentManager(pinataJWT)
  
  // 等待 params Promise 解析
  const params = await context.params
  const videoId = params.videoId

  if (!videoId) {
    console.error('No videoId provided in request')
    return NextResponse.json({ error: 'Video ID is required' }, { status: 400 })
  }

  console.log(`Fetching comments for video: ${videoId}`)

  try {
    // Get the list of comment CIDs using the new method
    console.log('Getting comment CIDs from CommentManager')
    const commentCIDs = await commentManager.getCommentCIDsForVideo(videoId)
    console.log(`Found ${commentCIDs.length} comment CIDs`)

    if (commentCIDs.length === 0) {
      console.log('No comments found for this video')
      return NextResponse.json([], { status: 200 }) // No comments found, return empty array
    }

    // Fetch each comment from IPFS using its CID
    console.log('Fetching individual comments from IPFS')
    const comments: Comment[] = []
    for (const cid of commentCIDs) {
      try {
        console.log(`Fetching comment with CID: ${cid}`)
        const comment = await commentManager.fetchCommentFromIPFS(cid)
        console.log('Successfully fetched comment:', {
          cid,
          author: comment.author,
          timestamp: comment.timestamp,
        })
        comments.push(comment)
      } catch (fetchError) {
        console.error(
          `Failed to fetch comment ${cid} for video ${videoId}:`,
          fetchError
        )
        // Skip failed comments but continue with others
      }
    }

    // Sort comments by timestamp, newest first
    comments.sort((a, b) => b.timestamp - a.timestamp)
    console.log(`Successfully fetched ${comments.length} comments`)

    return NextResponse.json(comments, { status: 200 })
  } catch (error: unknown) {
    console.error(`Error in GET /api/comments/${videoId}:`, error)
    const err =
      error instanceof Error ? error : new Error('Unknown error occurred')
    return NextResponse.json(
      {
        error: 'Failed to fetch comments',
        details: err.message,
        stack: err.stack,
      },
      { status: 500 }
    )
  }
}