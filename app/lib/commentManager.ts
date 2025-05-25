export interface Comment {
  id?: string // CID of the comment itself
  videoId: string
  author: string // User identifier (e.g., wallet address)
  text: string
  timestamp: number
  signature?: string // Optional: for comment verification
}

interface CommentIndex {
  videoId: string
  commentCIDs: string[]
  lastUpdated: number
}

export class CommentManager {
  private pinataJWT: string
  private indexCache: Map<string, { cid: string; data: CommentIndex }> =
    new Map()

  constructor(pinataJWT: string) {
    if (!pinataJWT) {
      throw new Error('Pinata JWT is required')
    }
    console.log(
      'CommentManager initialized with JWT:',
      pinataJWT ? 'present' : 'missing'
    )
    this.pinataJWT = pinataJWT
  }

  private async queryPinata(query: string): Promise<any[]> {
    try {
      console.log('Querying Pinata with:', query)
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
        console.error('Pinata query failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        })
        throw new Error(
          `Pinata query failed: ${response.status} ${response.statusText} - ${errorText}`
        )
      }

      const data = await response.json()
      console.log('Pinata query response:', data)
      return data.rows || []
    } catch (error) {
      console.error('Error querying Pinata:', error)
      throw error
    }
  }

  private async findCommentIndex(
    videoId: string
  ): Promise<{ cid: string; data: CommentIndex } | null> {
    console.log('Finding comment index for video:', videoId)

    // Check cache first
    const cached = this.indexCache.get(videoId)
    if (cached) {
      console.log('Found cached index:', cached)
      return cached
    }

    // Query Pinata for the index file
    const query = `metadata[keyvalues]={"videoId":{"value":"${videoId}","op":"eq"},"type":{"value":"comment-index","op":"eq"}}`
    console.log('Querying Pinata for index with query:', query)
    const pins = await this.queryPinata(query)

    if (pins.length === 0) {
      console.log('No index found for video:', videoId)
      return null
    }

    // Get the most recent index file
    const latestPin = pins.reduce((latest, current) => {
      return !latest || current.timestamp > latest.timestamp ? current : latest
    })
    console.log('Found latest index pin:', latestPin)

    try {
      console.log('Fetching index file from IPFS:', latestPin.ipfs_pin_hash)
      const response = await fetch(
        `https://gateway.pinata.cloud/ipfs/${latestPin.ipfs_pin_hash}`
      )
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to fetch index file:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        })
        throw new Error(
          `Failed to fetch index file: ${response.status} ${response.statusText} - ${errorText}`
        )
      }
      const data = await response.json()
      console.log('Fetched index data:', data)
      const result = { cid: latestPin.ipfs_pin_hash, data }
      this.indexCache.set(videoId, result)
      return result
    } catch (error) {
      console.error('Error fetching index file:', error)
      return null
    }
  }

  private async createOrUpdateIndex(
    videoId: string,
    newCommentCID: string
  ): Promise<string> {
    console.log(
      'Creating/updating index for video:',
      videoId,
      'with new comment:',
      newCommentCID
    )
    const existingIndex = await this.findCommentIndex(videoId)

    const updatedIndex: CommentIndex = {
      videoId,
      commentCIDs: existingIndex
        ? [...existingIndex.data.commentCIDs, newCommentCID]
        : [newCommentCID],
      lastUpdated: Date.now(),
    }
    console.log('Updated index data:', updatedIndex)

    const indexData = {
      pinataOptions: {
        cidVersion: 1,
      },
      pinataMetadata: {
        name: `Comment index for video ${videoId}`,
        keyvalues: {
          videoId: videoId,
          type: 'comment-index',
          lastUpdated: Date.now().toString(),
        },
      },
      pinataContent: updatedIndex,
    }

    console.log('Sending index update to Pinata:', indexData)
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
      const errorText = await response.text()
      console.error('Failed to update comment index:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      })
      throw new Error(
        `Failed to update comment index: ${response.status} ${response.statusText} - ${errorText}`
      )
    }

    const result = await response.json()
    console.log('Index update response:', result)
    const newIndexCID = result.IpfsHash

    // Update cache
    this.indexCache.set(videoId, { cid: newIndexCID, data: updatedIndex })

    return newIndexCID
  }

  async uploadCommentToIPFS(comment: Omit<Comment, 'id'>): Promise<string> {
    console.log('Uploading comment to IPFS:', comment)
    const commentData = {
      pinataOptions: {
        cidVersion: 1,
      },
      pinataMetadata: {
        name: `Comment for video ${comment.videoId} by ${comment.author}`,
        keyvalues: {
          videoId: comment.videoId,
          author: comment.author,
          timestamp: comment.timestamp.toString(),
          type: 'comment',
        },
      },
      pinataContent: comment,
    }

    try {
      console.log('Sending comment to Pinata:', commentData)
      const response = await fetch(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.pinataJWT}`,
          },
          body: JSON.stringify(commentData),
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to pin comment to IPFS:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        })
        throw new Error(
          `Failed to pin comment to IPFS: ${response.status} ${response.statusText} - ${errorText}`
        )
      }

      const result = await response.json()
      console.log('Pinata upload response:', result)

      if (!result.IpfsHash) {
        throw new Error('IPFS hash not found in Pinata response')
      }

      // Update the index with the new comment CID
      console.log('Updating index with new comment CID:', result.IpfsHash)
      await this.createOrUpdateIndex(comment.videoId, result.IpfsHash)

      console.log('Comment uploaded to IPFS. CID:', result.IpfsHash)
      return result.IpfsHash
    } catch (error) {
      console.error('Error uploading comment to IPFS:', error)
      throw error
    }
  }

  async getCommentCIDsForVideo(videoId: string): Promise<string[]> {
    console.log('Getting comment CIDs for video:', videoId)
    const index = await this.findCommentIndex(videoId)
    const cids = index ? index.data.commentCIDs : []
    console.log('Found comment CIDs:', cids)
    return cids
  }

  async fetchCommentFromIPFS(cid: string): Promise<Comment> {
    console.log('Fetching comment from IPFS:', cid)
    // Use a public IPFS gateway or your preferred one
    const gateways = [
      'https://gateway.pinata.cloud/ipfs/',
      'https://ipfs.io/ipfs/',
      // Add other gateways if needed
    ]

    for (const gateway of gateways) {
      try {
        console.log('Trying gateway:', gateway)
        const response = await fetch(`${gateway}${cid}`)
        if (!response.ok) {
          const errorText = await response.text()
          console.warn(`Failed to fetch from ${gateway}:`, {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
          })
          continue
        }
        const comment = await response.json()
        console.log('Successfully fetched comment:', comment)
        return { ...comment, id: cid }
      } catch (error) {
        console.warn(`Could not fetch comment ${cid} from ${gateway}:`, error)
      }
    }
    throw new Error(`Failed to fetch comment ${cid} from all gateways.`)
  }
}

// Initialize with environment variable
// This should be done in the API route, not globally here if PINATA_JWT is sensitive
// For now, this illustrates how it might be instantiated.
// const commentManager = new CommentManager(process.env.PINATA_JWT || '');
// export default commentManager;

// Export the class directly so it can be instantiated in API routes
// with the JWT passed from server-side environment variables.
