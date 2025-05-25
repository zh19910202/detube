'use client'

import Image from 'next/image'
import Link from 'next/link'
import { VideoMetadata } from '../hooks/usePinata'
import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'

interface VideoCardProps {
  video: VideoMetadata
}

const formatDisplayAddress = (address?: string): string => {
  if (!address) return 'Unknown Creator'
  if (address.length <= 10) return address
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
}

const VideoCard: React.FC<VideoCardProps> = ({ video }) => {
  const {
    title,
    description,
    coverImageCid,
    cid,
    isPublic,
    timestamp,
    author,
  } = video
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    // console.log(`VideoCard: ${title}, isPublic: ${isPublic}`)
  }, [title, isPublic])

  const hasCoverImage = coverImageCid && coverImageCid.length > 0
  const coverImageUrl = hasCoverImage
    ? `https://${process.env.NEXT_PUBLIC_PINATA_GW}/ipfs/${coverImageCid}`
    : ''

  const handleImageError = () => {
    setImageError(true)
  }

  const timeAgo = timestamp
    ? formatDistanceToNow(new Date(timestamp), { addSuffix: true })
    : ''

  return (
    <div className="relative group bg-primary border border-secondary rounded-xl shadow-xl hover:shadow-2xl hover:border-accent/50 transform hover:-translate-y-1 transition-all duration-300 ease-in-out flex flex-col">
      <Link
        href={`/video/${cid}`}
        passHref
        className="block flex flex-col flex-grow">
        <div className="relative w-full aspect-video overflow-hidden rounded-t-xl bg-secondary">
          {hasCoverImage && !imageError ? (
            <Image
              src={coverImageUrl}
              alt={title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300 ease-in-out"
              onError={handleImageError}
              priority
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center p-4">
                <p className="text-gray-400 text-sm font-medium">
                  Cover not available
                </p>
              </div>
            </div>
          )}
          {/* Privacy Badge/Text */}
          <div className="absolute top-3 right-3 z-10">
            {!isPublic ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent text-background">
                {/* <LockClosedIcon className="h-4 w-4 mr-1.5" /> Optional Icon */}
                Private
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/70 text-gray-300">
                {/* <LockOpenIcon className="h-4 w-4 mr-1.5" /> Optional Icon */}
                Public
              </span>
            )}
          </div>
        </div>
        <div className="p-4 flex flex-col flex-grow">
          <h3 className="font-bold text-lg text-foreground group-hover:text-accent transition-colors duration-200 line-clamp-2 mb-2">
            {title}
          </h3>
          <p className="text-gray-400 text-sm line-clamp-3 mb-2 flex-grow">
            {description || 'No description available.'}
          </p>
          <div className="mt-auto pt-2 border-t border-secondary/30">
            <p
              className="text-xs text-gray-500 truncate"
              title={author ? author : 'Unknown Creator'}>
              By: {formatDisplayAddress(author)}
            </p>
            {timeAgo && (
              <p className="text-xs text-gray-500 mt-0.5">{timeAgo}</p>
            )}
          </div>
        </div>
      </Link>
    </div>
  )
}

export default VideoCard
