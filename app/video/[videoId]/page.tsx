'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSendTransaction, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { parseEther } from 'viem';

const VideoPage = () => {
  const { videoId } = useParams();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<{ title: string; description: string } | null>(null);
  const [comments, setComments] = useState<string[]>([]);
  const [newComment, setNewComment] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false); // Loading state for transaction
  const [tipAmount, setTipAmount] = useState<string>('0.01'); // 默认打赏金额为 0.01 ETH
  const { data: hash, sendTransaction, error, isPending: isTransactionPending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });
  const { isConnected } = useAccount(); // 检查钱包连接状态
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    if (videoId) {
      setVideoUrl(`https://cyan-fast-mastodon-963.mypinata.cloud/ipfs/${videoId}`);
      setVideoInfo({ title: '动态加载的视频标题', description: '这是从服务器加载的描述信息。' });
      setComments(['动态评论1', '动态评论2']);
    }
  }, [videoId]);

  useEffect(() => {
    if (isConfirmed && hash) {
      setShowConfirmation(true); // 显示确认消息
      const timer = setTimeout(() => {
        setShowConfirmation(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isConfirmed, hash]);

  const handleAddComment = () => {
    if (newComment.trim()) {
      setComments((prev) => [...prev, newComment]);
      setNewComment('');
    }
  };

  const handleSendTip = async () => {
    if (!tipAmount || parseFloat(tipAmount) <= 0) {
      alert('请输入有效的打赏金额！');
      return;
    }

    setIsLoading(true); // Start loading state
    try {
      await sendTransaction({
        to: '0x4B8f2F91541814722B3F6a2FABC9Ae16C3D0050b', // 替换为创作者的钱包地址
        value: parseEther(tipAmount), // 使用自定义金额
      });
    } catch (err) {
      console.error('打赏失败:', err);
      alert('打赏失败，请重试！');
    } finally {
      setIsLoading(false); // Stop loading state
    }
  };

  if (!videoUrl) {
    return <div>加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white p-4">
        <h1 className="text-2xl font-semibold">视频播放</h1>
      </header>
      <main className="container mx-auto p-4">
        <div className="flex">
          {/* 视频播放器 */}
          <div className="w-3/4 pr-4">
            <iframe
              src={videoUrl}
              width="100%"
              height="500"
              frameBorder="0"
              allowFullScreen
            ></iframe>
            <h2 className="text-xl font-semibold mt-4">{videoInfo?.title}</h2>
            <p className="text-sm text-gray-600 mt-2">{videoInfo?.description}</p>
            <div className="mt-4">
              <label htmlFor="tipAmount" className="block text-sm font-medium text-gray-700">
                输入打赏金额 (ETH)
              </label>
              <input
                type="number"
                id="tipAmount"
                value={tipAmount}
                onChange={(e) => setTipAmount(e.target.value)}
                placeholder="0.01"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <button
              onClick={handleSendTip}
              className={`mt-4 px-4 py-2 rounded-lg ${
                isConnected ? 'bg-blue-500 text-white' : 'bg-gray-400 text-gray-600 cursor-not-allowed'
              }`}
              disabled={!isConnected || isTransactionPending || isLoading} // 禁用按钮直到钱包连接
            >
              {isTransactionPending || isLoading ? '打赏处理中...' : `打赏视频创作者 (${tipAmount} ETH)`}
            </button>
            {!isConnected && (
              <div className="mt-2 text-sm text-gray-600">请连接钱包以进行打赏。</div>
            )}
            {error && <div className="mt-4 text-sm text-red-600">交易失败：{(error as Error).message}</div>}
            {isConfirming && <div className="mt-4 text-sm text-green-600">交易确认中...</div>}
            {showConfirmation && <div className="mt-4 text-sm text-green-600">交易成功！</div>}
          </div>

          {/* 推荐视频 */}
          <div className="w-1/4">
            <h3 className="text-lg font-semibold">推荐视频</h3>
            <div className="space-y-4 mt-4">
              <div className="bg-white shadow-md p-4 rounded-lg">
                <h4 className="font-semibold">推荐视频 1</h4>
                <p className="text-sm text-gray-600">视频描述...</p>
              </div>
              <div className="bg-white shadow-md p-4 rounded-lg">
                <h4 className="font-semibold">推荐视频 2</h4>
                <p className="text-sm text-gray-600">视频描述...</p>
              </div>
            </div>
          </div>
        </div>

        {/* 评论区 */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold">用户评论</h3>
          <div className="space-y-4 mt-4">
            {comments.map((comment, index) => (
              <div key={index} className="bg-white shadow-md p-4 rounded-lg">
                <p className="text-sm text-gray-600">{comment}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="添加你的评论..."
              className="w-full p-2 border border-gray-300 rounded-lg"
            />
            <button
              onClick={handleAddComment}
              className="mt-2 bg-blue-500 text-white px-4 py-2 rounded-lg"
            >
              添加评论
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default VideoPage;
