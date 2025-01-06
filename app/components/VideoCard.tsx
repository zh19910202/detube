// components/VideoCard.tsx
'use client'

import Image from 'next/image';
import Link from 'next/link';

interface VideoCardProps {
  title: string;
  videoId: string;  // 完整的视频 URL
}

const VideoCard: React.FC<VideoCardProps> = ({ title, videoId }) => {
  //const videoId = videoUrl.split('/').pop();  // 从视频 URL 中提取出 videoId（即 CID）

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden cursor-pointer">
      {/* 通过 Link 跳转到 VideoPage */}
      <Link href={`/video/${videoId}`} passHref>
        <div>
          <Image
            src="https://via.placeholder.com/300x200"
            alt="视频"
            width={300}
            height={200}
            className="w-full h-48 object-cover"
          />
          <div className="p-4">
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-gray-500 text-sm mt-2">视频描述...</p>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default VideoCard;
