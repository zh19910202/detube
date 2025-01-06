'use client'

import VideoCard from './components/VideoCard';
import { usePinata } from './hooks/usePinata';


const HomePage = () => {
  // 使用自定义 Hook 获取 CID 列表
  const { videoIds, loading, error } = usePinata();  // 传入 limit 参数

  if (loading) {
    return <div>加载中...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto p-4">
        <h2 className="text-2xl font-semibold mb-4">推荐视频</h2>
        {/* 视频卡片列表 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {videoIds.map((videoId, index) => (
            <VideoCard
              key={index}
              title={`视频标题 ${index + 1}`}
              videoId={videoId}  // 将 CID 作为 videoId 传递给 VideoCard
            />
          ))}
        </div>
      </main>
    </div>
  );
};

export default HomePage;
