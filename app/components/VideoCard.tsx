// components/VideoCard.tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { VideoMetadata } from '../hooks/usePinata'
import { useState } from 'react'

interface VideoCardProps {
  video: VideoMetadata
}

const VideoCard: React.FC<VideoCardProps> = ({ video }) => {
  const { title, description, coverImageCid, videoCid, cid } = video
  const [imageError, setImageError] = useState(false)

  // 判断是否有封面图片CID
  const hasCoverImage = coverImageCid && coverImageCid.length > 0

  // 如果有封面图，使用它；否则使用默认图片
  const coverImageUrl = hasCoverImage
    ? `https://cyan-fast-mastodon-963.mypinata.cloud/ipfs/${coverImageCid}`
    : 'https://via.placeholder.com/300x200?text=No+Cover'

  // 当图片加载失败时调用
  const handleImageError = () => {
    setImageError(true)
    // console.log(`封面图片加载失败: ${coverImageUrl}`)
  }

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow">
      {/* 通过 Link 跳转到 VideoPage */}
      <Link href={`/video/${cid}`} passHref>
        <div>
          <div className="relative w-full h-48 bg-gray-200">
            {!imageError ? (
              <Image
                src={coverImageUrl}
                alt={title}
                fill
                className="object-cover"
                onError={handleImageError}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center p-4">
                  <p className="text-black text-sm">封面不可用</p>
                  <p className="text-black text-xs mt-1">
                    视频ID: {videoCid.substring(0, 8)}...
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="p-4">
            <h3 className="text-lg font-semibold line-clamp-1 text-black">
              {title}
            </h3>
            <p className="text-black text-sm mt-2 line-clamp-2">
              {description}
            </p>
          </div>
        </div>
      </Link>
    </div>
  )
}

export default VideoCard
