'use client'

import VideoCard from './components/VideoCard'
import { usePinata } from './hooks/usePinata'
import { useEffect } from 'react'
import PageLoader from './components/PageLoader' // Import PageLoader
import EmptyVideoMessage from './components/EmptyVideoMessage' // Import EmptyVideoMessage

const HomePage = () => {
  // 使用自定义 Hook 获取视频元数据列表
  const { videos, loading, getLatestCIDs } = usePinata(10) // 增加检索数量

  // 每次组件挂载时刷新视频列表
  useEffect(() => {
    // 立即获取一次
    getLatestCIDs()

    // 监听视频上传完成事件
    const handleVideoUploadComplete = () => {
      console.log('收到视频上传完成事件，刷新视频列表')
      getLatestCIDs()
    }

    // 添加事件监听器
    window.addEventListener('video-upload-complete', handleVideoUploadComplete)

    // 清理函数
    return () => {
      window.removeEventListener(
        'video-upload-complete',
        handleVideoUploadComplete
      )
    }
  }, [getLatestCIDs])

  if (loading) {
    return <PageLoader message="正在从IPFS加载视频数据..." />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <h2 className="text-2xl font-semibold text-black">推荐视频</h2>
          </div>
        </div>

        {videos.length === 0 ? (
          <EmptyVideoMessage />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {videos.map((video) => (
              <VideoCard key={video.cid} video={video} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default HomePage
