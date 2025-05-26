'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { VideoMetadata } from '../hooks/usePinata' // Adjust path if necessary
import { formatDisplayAddress } from '../lib/utils' // Adjust path if necessary
import { formatDistanceToNow } from 'date-fns'

interface RecommendedVideoCardProps {
  video: VideoMetadata
}

const RecommendedVideoCard: React.FC<RecommendedVideoCardProps> = ({ video }) => {
  const { title, coverImageCid, cid, timestamp, author } = video
  const [imageError, setImageError] = useState(false)

  const hasCoverImage = coverImageCid && coverImageCid.length > 0
  const coverImageUrl = hasCoverImage
    ? `https://${process.env.NEXT_PUBLIC_PINATA_GW?.replace(/^['"]|['"]$/g, '')}/ipfs/${coverImageCid}`
    : ''

  const handleImageError = () => {
    setImageError(true)
  }

  // Reset imageError when video changes
  useEffect(() => {
    setImageError(false)
  }, [video.cid])

  const timeAgo = timestamp
    ? formatDistanceToNow(new Date(timestamp), { addSuffix: true })
    : ''

  return (
    <Link href={`/video/${cid}`} passHref>
      <div className="flex space-x-2 sm:space-x-3 p-2 rounded-lg hover:bg-secondary/60 transition-colors items-start group w-full">
        {/* Thumbnail */}
        <div className="w-32 sm:w-36 aspect-video rounded-md overflow-hidden relative flex-shrink-0 bg-secondary">
          {hasCoverImage && !imageError ? (
            <Image
              src={coverImageUrl}
              alt={title || 'Video thumbnail'}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" // Consider adjusting if this card is always small
              className="object-cover"
              onError={handleImageError}
              priority // Consider removing if many cards are rendered, for performance
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-gray-500"
                viewBox="0 0 24 24"
                fill="currentColor">
                <path d="M8 5.14v14l11-7-11-7z" />
              </svg>
            </div>
          )}
        </div>
        {/* Info */}
        <div className="flex-grow min-w-0"> {/* min-w-0 helps flex child truncation */}
          <h3 className="text-sm font-semibold text-foreground line-clamp-2 mb-0.5 group-hover:text-accent transition-colors duration-200">
            {title || 'Untitled Video'}
          </h3>
          <p
            className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors duration-200 truncate"
            title={author ? author : 'Unknown Creator'}>
            {formatDisplayAddress(author)}
          </p>
          {timeAgo && (
            <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors duration-200">
              {timeAgo}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}

export default RecommendedVideoCard
