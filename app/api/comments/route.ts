import { NextRequest, NextResponse } from 'next/server'
import { CommentManager, Comment } from '@/app/lib/commentManager'
import { ethers } from 'ethers'

// Ensure PINATA_JWT is set in your environment variables
const pinataJWT = process.env.PINATA_JWT || process.env.NEXT_PUBLIC_PINATA_JWT

if (!pinataJWT) {
  console.error('PINATA_JWT environment variable is not set.')
}

// Helper function to verify signature (optional but recommended)
async function verifySignature(
  comment: Omit<Comment, 'id' | 'signature'>,
  signature: string,
  authorAddress: string
): Promise<boolean> {
  console.log('Verifying signature for comment:', {
    comment,
    authorAddress,
    signatureProvided: !!signature,
  })

  // Ensure property order matches the frontend's commentPayload for stringification
  const messagePayload = {
    videoId: comment.videoId,
    author: comment.author,
    text: comment.text,
    timestamp: comment.timestamp,
  }
  const message = JSON.stringify(messagePayload)
  console.log('Message to verify (ordered):', message)

  try {
    const signerAddr = ethers.verifyMessage(message, signature)
    const isValid = signerAddr.toLowerCase() === authorAddress.toLowerCase()
    console.log('Signature verification result:', {
      signerAddr,
      authorAddress,
      isValid,
    })
    return isValid
  } catch (error) {
    console.error('Error verifying signature:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  console.log('POST /api/comments - Starting comment submission')
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

  try {
    const body = await request.json()
    console.log('Received comment data:', {
      ...body,
      signature: body.signature ? '(signature present)' : '(no signature)',
    })

    const { videoId, author, text, timestamp, signature } = body

    if (!videoId || !author || !text || !timestamp) {
      console.error('Missing required fields:', {
        videoId,
        author,
        text,
        timestamp,
      })
      return NextResponse.json(
        { error: 'Missing required comment fields' },
        { status: 400 }
      )
    }

    // Ensure timestamp is a number before passing to verifySignature and CommentManager
    const numericTimestamp = parseInt(timestamp, 10)
    if (isNaN(numericTimestamp)) {
      console.error('Invalid timestamp format:', timestamp)
      return NextResponse.json(
        { error: 'Invalid timestamp format' },
        { status: 400 }
      )
    }

    const newCommentData: Omit<Comment, 'id' | 'signature'> = {
      videoId,
      author,
      text,
      timestamp: numericTimestamp,
    }

    // Optional: Signature verification
    if (signature) {
      console.log('Verifying comment signature')
      const isValidSignature = await verifySignature(
        newCommentData, // This object now has a numeric timestamp
        signature,
        author
      )
      if (!isValidSignature) {
        console.error('Invalid signature for comment')
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }
      console.log('Signature verified successfully')
    } else {
      // Depending on your app's logic, you might want to reject comments without signatures
      console.log(
        'No signature provided for comment - proceeding without verification as per current logic'
      )
      // If signatures are mandatory, you should return an error here:
      // return NextResponse.json({ error: 'Signature is required' }, { status: 400 });
    }

    const commentToUpload: Omit<Comment, 'id'> = {
      ...newCommentData,
      signature, // Include signature if provided, will be undefined otherwise
    }

    console.log('Uploading comment to IPFS')
    const cid = await commentManager.uploadCommentToIPFS(commentToUpload)
    console.log('Comment uploaded successfully, CID:', cid)

    return NextResponse.json(
      { message: 'Comment added successfully', cid },
      { status: 201 }
    )
  } catch (error: unknown) {
    console.error('Error in POST /api/comments:', error)
    const err =
      error instanceof Error ? error : new Error('Unknown error occurred')
    return NextResponse.json(
      {
        error: 'Failed to add comment',
        details: err.message,
        stack: err.stack, // Be cautious about exposing stack traces in production
      },
      { status: 500 }
    )
  }
}
