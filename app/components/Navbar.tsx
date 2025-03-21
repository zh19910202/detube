'use client'

import React, { useState, useEffect } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import Link from 'next/link' // 导入 Link 组件
import { usePinata } from '../hooks/usePinata'

// 进度条按钮组件
const ProgressButton = ({
  progress,
  stage,
  label,
  disabled,
  onClick,
}: {
  progress: number
  stage: string
  label: string
  disabled: boolean
  onClick: () => void
}) => {
  // 根据上传阶段设置不同颜色
  const getStageColor = () => {
    switch (stage) {
      case 'cover':
        return 'bg-blue-500'
      case 'video':
        return 'bg-green-500'
      case 'metadata':
        return 'bg-yellow-500'
      case 'complete':
        return 'bg-purple-500'
      default:
        return 'bg-blue-500'
    }
  }

  // 根据上传阶段设置不同条纹颜色
  const getStageStripeColor = () => {
    switch (stage) {
      case 'cover':
        return 'bg-blue-600'
      case 'video':
        return 'bg-green-600'
      case 'metadata':
        return 'bg-yellow-600'
      case 'complete':
        return 'bg-purple-600'
      default:
        return 'bg-blue-600'
    }
  }

  // 获取上传阶段的文本
  const getStageText = () => {
    if (progress === 0) return label
    return `${
      stage === 'cover'
        ? '上传封面'
        : stage === 'video'
        ? '上传视频'
        : stage === 'metadata'
        ? '提交元数据'
        : '上传完成'
    } (${Math.round(progress)}%)`
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="relative w-40 overflow-hidden text-white py-2 px-4 rounded-2xl transition-all duration-200">
      {/* 底层按钮 - 总是灰色 */}
      <div className="absolute inset-0 bg-gray-500 rounded-2xl"></div>

      {/* 进度层 - 根据进度和阶段变化 */}
      <div
        className={`absolute top-0 left-0 bottom-0 ${getStageColor()} overflow-hidden rounded-2xl transition-all duration-300 z-10`}
        style={{ width: `${progress}%` }}>
        {/* 动态流动效果层 */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className={`h-full w-[200%] ${getStageStripeColor()} opacity-20`}
            style={{
              backgroundImage:
                'linear-gradient(45deg, transparent 25%, rgba(255,255,255,0.4) 25%, rgba(255,255,255,0.4) 50%, transparent 50%, transparent 75%, rgba(255,255,255,0.4) 75%, rgba(255,255,255,0.4) 100%)',
              backgroundSize: '20px 20px',
              animation: 'moveStripes 1s linear infinite',
            }}></div>
        </div>
      </div>

      {/* 按钮文本 - 保持在最上层 */}
      <span className="relative z-20">{getStageText()}</span>

      {/* 内联定义动画 */}
      <style jsx>{`
        @keyframes moveStripes {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-20px);
          }
        }
      `}</style>
    </button>
  )
}

const Navbar: React.FC = () => {
  const { isConnected, address } = useAccount() // 钱包是否连接及其地址
  const [selectedFile, setSelectedFile] = useState<File | null>(null) // 存储选中的文件
  const [isModalOpen, setIsModalOpen] = useState(false) // 控制模态框是否打开

  // 新增字段：标题、封面和描述
  const [title, setTitle] = useState<string>('')
  const [coverImage, setCoverImage] = useState<File | null>(null)
  const [description, setDescription] = useState<string>('')

  const {
    ipfsHash,
    uploading,
    error,
    uploadFile,
    uploadProgress,
    uploadStage,
  } = usePinata()
  // 添加本地错误状态，用于处理UI相关错误
  const [localError, setLocalError] = useState<string | null>(null)

  // 新增一个状态来标记用户是否尝试过上传
  const [hasAttemptedUpload, setHasAttemptedUpload] = useState(false)

  // 添加状态来跟踪上传成功
  const [showUploadSuccess, setShowUploadSuccess] = useState(false)

  // 处理文件选择
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file) // 保存选择的文件
    }
  }

  // 处理封面图片选择
  const handleCoverImageChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (file) {
      setCoverImage(file) // 保存选择的封面文件
    }
  }

  // 处理上传
  const handleUpload = () => {
    if (!address) {
      setLocalError('请先连接钱包以获取地址')
      return // 没有钱包地址就不继续
    }

    setLocalError(null) // 清除之前的错误

    if (selectedFile && title && coverImage && description) {
      setHasAttemptedUpload(true) // 标记用户已尝试上传

      // 确保使用实际的钱包地址
      uploadFile(title, coverImage, selectedFile, description, address)
      setIsModalOpen(false) // 上传开始后关闭模态框
    }
  }

  // 监控ipfsHash变化，当获取到新的ipfsHash时，更新按钮状态
  useEffect(() => {
    if (ipfsHash && !error) {
      // 上传成功，立即显示上传成功状态
      setShowUploadSuccess(true)
      // 重置表单
      setSelectedFile(null)
      setCoverImage(null)
      setTitle('')
      setDescription('')
      setHasAttemptedUpload(false)

      // 触发一个自定义事件，通知页面组件刷新视频列表
      const refreshEvent = new CustomEvent('video-upload-complete')
      window.dispatchEvent(refreshEvent)
      console.log('已触发视频上传完成事件')

      // 1.5秒后重置成功状态
      const timeoutId = setTimeout(() => {
        setShowUploadSuccess(false)
      }, 1500)

      return () => clearTimeout(timeoutId)
    }
  }, [ipfsHash, error])

  return (
    <nav className="bg-gray-800 text-white p-4 flex flex-col">
      <div className="flex items-center justify-between">
        {/* Detube 链接到主页 */}
        <Link href="/" className="text-xl font-bold">
          Detube
        </Link>

        <div className="ml-auto flex items-center space-x-4">
          {/* 集成了进度条的上传按钮 */}
          {uploading ? (
            <ProgressButton
              progress={uploadProgress}
              stage={uploadStage}
              label="上传中..."
              disabled={true}
              onClick={() => {}}
            />
          ) : (
            <button
              onClick={() => setIsModalOpen(true)} // 点击上传按钮时打开模态框
              disabled={!isConnected || !address} // 必须有钱包连接和地址才能上传
              className={`${
                isConnected && address
                  ? showUploadSuccess
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-blue-500 hover:bg-blue-700'
                  : 'bg-gray-500 cursor-not-allowed'
              } text-white py-2 px-4 w-40 rounded-2xl transform hover:scale-105 transition-transform duration-200`}>
              {showUploadSuccess
                ? '上传成功'
                : !address
                ? '请先连接钱包'
                : '上传视频'}
            </button>
          )}

          {/* 连接钱包按钮 */}
          <ConnectButton />
        </div>
      </div>

      {/* 显示错误信息 - 显示本地错误或上传错误 */}
      {(hasAttemptedUpload && error) || localError ? (
        <div className="mt-2 text-sm text-black bg-red-50 p-2 rounded border border-red-200">
          <p>{localError || error || '上传失败，请重试'}</p>
        </div>
      ) : null}

      {/* 模态框：文件选择和上传 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-96 max-w-sm">
            {/* 标题输入框 */}
            <div className="mb-4 relative">
              <div className="flex items-center mb-1">
                <label className="text-white font-medium">视频标题</label>
                <div className="relative ml-2 group">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-blue-400 cursor-help"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 z-10">
                    <div className="bg-gray-900 text-white text-xs rounded p-2 shadow-lg">
                      <div className="relative">
                        <div className="absolute -bottom-1 left-0 w-3 h-3 bg-gray-900 transform rotate-45"></div>
                        <p>
                          标题应简洁明了地描述视频内容，好的标题能吸引更多观众点击观看。建议控制在5-30个字符之间。
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="输入视频标题"
                className="w-full text-white bg-gray-700 border border-gray-600 rounded-md p-2"
              />
            </div>
            {/* 封面图片输入框 */}
            <div className="mb-4 relative">
              <label className=" text-white font-medium">上传封面图片：</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverImageChange}
                className="mb-4 w-full text-white bg-gray-700 border border-gray-600 rounded-md p-2"
              />
            </div>
            {/* <h2 className="text-xl font-semibold text-white mb-4">选择视频文件</h2> */}
            <div className="mb-4 relative">
              <label className=" text-white font-medium mb-2">上传视频：</label>
              <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="mb-4 w-full text-white bg-gray-700 border border-gray-600 rounded-md p-2"
              />
            </div>

            {/* 描述输入框 */}
            <div className="mb-4 relative">
              <div className="flex items-center mb-1">
                <label className="text-white font-medium">视频描述</label>
                <div className="relative ml-2 group">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-blue-400 cursor-help"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 z-10">
                    <div className="bg-gray-900 text-white text-xs rounded p-2 shadow-lg">
                      <div className="relative">
                        <div className="absolute -bottom-1 left-0 w-3 h-3 bg-gray-900 transform rotate-45"></div>
                        <p>
                          添加详细的视频描述有助于观众了解视频内容，也有利于视频在平台内被更好地推荐。可以包含关键词、主要内容要点等信息。
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="描述视频内容..."
                className="w-full text-white bg-gray-700 border border-gray-600 rounded-md p-2"></textarea>
            </div>

            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setIsModalOpen(false)} // 取消按钮，关闭模态框
                className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition duration-200">
                取消
              </button>
              <button
                onClick={() => {
                  handleUpload() // 上传文件
                  setIsModalOpen(false) // 上传后关闭模态框
                }}
                disabled={
                  !selectedFile || !title || !coverImage || !description
                } // 如果有任一字段未填写则禁用
                className={`${
                  selectedFile && title && coverImage && description
                    ? 'bg-blue-500 hover:bg-blue-700'
                    : 'bg-gray-500 cursor-not-allowed'
                } text-white py-2 px-4 rounded-md transition duration-200`}>
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navbar
