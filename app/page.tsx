'use client'

import VideoCard from './components/VideoCard'
import { usePinata } from './hooks/usePinata'
import { useEffect } from 'react'

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
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-black">正在从IPFS加载视频数据...</p>
        </div>
      </div>
    )
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
          <div className="text-center p-8 bg-white rounded-lg shadow-sm">
            <p className="text-black mb-4">暂无视频内容，请上传一些视频！</p>
            <p className="text-sm text-black mb-4">
              如果您刚刚上传了视频但未显示，请刷新页面尝试重新加载。
            </p>
            <div className="text-sm bg-yellow-50 p-3 rounded border border-yellow-200">
              <p className="font-semibold text-black">提示：</p>
              <ul className="list-disc pl-5 text-black">
                <li>确保上传已完成</li>
                <li>尝试刷新页面</li>
                <li>查看是否有网络问题</li>
                <li>内容可能需要一些时间才能显示</li>
              </ul>
            </div>
          </div>
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
