'use client'

import Image from 'next/image'
import Link from 'next/link'
import { VideoMetadata } from '../hooks/usePinata'
import { useState, useEffect } from 'react'

interface VideoCardProps {
  video: VideoMetadata
}

const VideoCard: React.FC<VideoCardProps> = ({ video }) => {
  const { title, description, coverImageCid, videoCid, cid, isPublic } = video
  const [imageError, setImageError] = useState(false)
  console.log('isPublic', isPublic, title)
  // 调试：记录 isPublic 状态
  useEffect(() => {
    console.log(`VideoCard: ${title}, isPublic: ${isPublic}`)
  }, [title, isPublic])

  // 判断是否有封面图片CID
  const hasCoverImage = coverImageCid && coverImageCid.length > 0

  // 如果有封面图，使用它；否则使用默认图片
  const coverImageUrl = hasCoverImage
    ? `https://${process.env.NEXT_PUBLIC_PINATA_GW}/ipfs/${coverImageCid}`
    : 'https://via.placeholder.com/300x200?text=无封面'

  // 当图片加载失败时调用
  const handleImageError = () => {
    setImageError(true)
    console.log(`封面图片加载失败: ${coverImageUrl}`)
  }

  return (
    <div
      className={`relative rounded-lg overflow-hidden cursor-pointer transition-all duration-300 shadow-lg ${
        isPublic
          ? 'bg-white hover:shadow-2xl'
          : 'bg-red-50 opacity-85 hover:opacity-100'
      }`}
      aria-label={isPublic ? '公开视频' : '私有视频'}
      data-testid={isPublic ? 'public-video' : 'private-video'}>
      {/* 通过 Link 跳转到 VideoPage */}
      <Link href={`/video/${cid}`} passHref>
        <div>
          <div className="relative w-full h-48 bg-gray-200">
            {!imageError ? (
              <>
                <Image
                  src={coverImageUrl}
                  alt={title}
                  fill
                  className="object-cover"
                  onError={handleImageError}
                />
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-300">
                <div className="text-center p-4">
                  <p className="text-black text-sm font-medium">封面不可用</p>
                  <p className="text-black text-xs mt-1">
                    视频ID: {videoCid.substring(0, 8)}...
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="p-5">
            <div className="flex items-center">
              <h3
                className={`text-xl font-bold line-clamp-1 flex-grow ${
                  isPublic ? 'text-black' : 'text-red-700'
                }`}>
                {title}
              </h3>
            </div>
            <p
              className={`text-base mt-3 line-clamp-2 ${
                isPublic ? 'text-gray-800' : 'text-red-700'
              }`}>
              {description}
            </p>
          </div>
        </div>
      </Link>
    </div>
  )
}

export default VideoCard
