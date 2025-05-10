'use client'

import React, { useState, useEffect } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import Link from 'next/link'
import { usePinata, UploadStage } from '../hooks/usePinata'
import { encryptVideo } from '../lib/lit/encrypt'
import { accessControlConditions } from '../lib/lit/accessControl'

// Extend UploadStage to include encrypting
type ExtendedUploadStage = UploadStage | 'encrypting'

// ProgressButton 组件
const ProgressButton: React.FC<{
  progress: number
  stage: ExtendedUploadStage
  label: string
  disabled: boolean
  onClick: () => void
}> = ({ progress, stage, label, disabled, onClick }) => {
  // 统一主题颜色配置
  const stageStyles: Record<
    ExtendedUploadStage,
    { hue: number; text: string }
  > = {
    idle: { hue: 210, text: label },
    encrypting: { hue: 180, text: '视频加密中' }, // 新增加密阶段
    cover: { hue: 210, text: '上传封面' },
    video: { hue: 120, text: '上传视频' },
    metadata: { hue: 60, text: '提交元数据' },
    complete: { hue: 270, text: '上传完成' },
  }

  // 动态计算背景颜色（HSL）
  const getProgressColor = () => {
    const { hue } = stageStyles[stage]
    return `hsl(${hue}, 70%, ${50 + progress * 0.2}%)`
  }

  // 动态条纹颜色
  const getStripeColor = () => {
    const { hue } = stageStyles[stage]
    return `hsl(${hue}, 70%, 40%)`
  }

  // 获取按钮文本
  const getStageText = () => {
    const { text } = stageStyles[stage]
    return progress === 0 || stage === 'encrypting'
      ? text
      : `${text} (${Math.round(progress)}%)`
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="relative w-40 h-10 overflow-hidden text-white font-medium py-2 px-4 rounded-2xl transition-all duration-200 shadow-md hover:shadow-lg">
      {/* 底层按钮 - 灰色底 */}
      <div className="absolute inset-0 bg-gray-500 rounded-2xl"></div>

      {/* 进度层 - 动态颜色 */}
      <div
        className="absolute top-0 left-0 bottom-0 overflow-hidden rounded-2xl transition-all duration-300 z-10"
        style={{ width: `${progress}%`, backgroundColor: getProgressColor() }}>
        {/* 动态条纹效果 */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className={`h-full w-[200%] opacity-20`}
            style={{
              backgroundColor: getStripeColor(),
              backgroundImage:
                'linear-gradient(45deg, transparent 25%, rgba(255,255,255,0.4) 25%, rgba(255,255,255,0.4) 50%, transparent 50%, transparent 75%, rgba(255,255,255,0.4) 75%, rgba(255,255,255,0.4) 100%)',
              backgroundSize: '20px 20px',
              animation: 'moveStripes 1s linear infinite',
            }}></div>
        </div>
      </div>

      {/* 按钮文本 */}
      <span className="relative z-20">{getStageText()}</span>

      {/* 内联动画 */}
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
  const { isConnected, address } = useAccount()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [title, setTitle] = useState<string>('')
  const [coverImage, setCoverImage] = useState<File | null>(null)
  const [description, setDescription] = useState<string>('')
  const [isPublic, setIsPublic] = useState<boolean>(true)
  const [hasAttemptedUpload, setHasAttemptedUpload] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [showUploadSuccess, setShowUploadSuccess] = useState(false)
  const [isEncrypting, setIsEncrypting] = useState(false)
  const {
    ipfsHash,
    uploading,
    error,
    uploadFile,
    uploadProgress,
    uploadStage,
  } = usePinata()

  // 确保钱包已连接
  useEffect(() => {
    if (!isConnected) {
      setLocalError('请先连接钱包')
    }
  }, [isConnected])

  // 处理文件选择
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  // 处理封面图片选择
  const handleCoverImageChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (file) {
      setCoverImage(file)
    }
  }

  // 处理上传
  const handleUpload = async () => {
    if (!address) {
      setLocalError('请先连接钱包以获取地址')
      return
    }

    if (!selectedFile || !title || !coverImage || !description) {
      setHasAttemptedUpload(true)
      setLocalError('请填写所有必填字段：视频、标题、封面、描述')
      return
    }

    setLocalError(null)
    setHasAttemptedUpload(true)
    setIsModalOpen(false)

    try {
      let videoFile = selectedFile
      let dataToEncryptHash: string | undefined
      // 如果是非公开视频，先加密
      if (!isPublic) {
        setIsEncrypting(true)
        try {
          const result = await encryptVideo(
            selectedFile,
            accessControlConditions() // 使用已存在的 address 变量
          )

          videoFile = result.newFile
          dataToEncryptHash = result.dataToEncryptHash
        } finally {
          setIsEncrypting(false)
        }
      }

      // 上传文件到 Pinata
      await uploadFile(
        title,
        coverImage,
        videoFile,
        description,
        address,
        isPublic,
        dataToEncryptHash
      )

      setHasAttemptedUpload(false)
    } catch (error) {
      console.error('上传失败:', error)
      setHasAttemptedUpload(false)
      setIsEncrypting(false)
      setLocalError(
        `上传失败: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // 监控 ipfsHash 变化，处理上传成功
  useEffect(() => {
    if (ipfsHash && !error) {
      setShowUploadSuccess(true)
      setSelectedFile(null)
      setCoverImage(null)
      setTitle('')
      setDescription('')
      setIsPublic(true)
      setHasAttemptedUpload(false)

      // 触发自定义事件通知视频列表刷新
      window.dispatchEvent(new CustomEvent('video-upload-complete'))

      // 1.5秒后重置成功状态
      const timeoutId = setTimeout(() => setShowUploadSuccess(false), 1500)
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
          {isEncrypting || uploading ? (
            <ProgressButton
              progress={isEncrypting ? 50 : uploadProgress} // 加密阶段固定50%进度
              stage={isEncrypting ? 'encrypting' : uploadStage}
              label={isEncrypting ? '视频加密中...' : '上传中...'}
              disabled={true}
              onClick={() => {}}
            />
          ) : (
            <button
              onClick={() => setIsModalOpen(true)}
              disabled={!isConnected || !address}
              className={`${
                isConnected && address
                  ? showUploadSuccess
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-blue-500 hover:bg-blue-700'
                  : 'bg-gray-500 cursor-not-allowed'
              } text-white font-medium py-2 px-4 w-40 h-10 rounded-2xl transform hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg`}>
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

      {/* 显示错误信息 */}
      {hasAttemptedUpload && (error || localError) && (
        <div className="mt-2 text-sm text-black bg-red-50 p-2 rounded border border-red-200">
          <p>{localError || error || '上传失败，请重试'}</p>
        </div>
      )}

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
                className={`w-full text-white bg-gray-700 border ${
                  hasAttemptedUpload && !title
                    ? 'border-red-500'
                    : 'border-gray-600'
                } rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>

            {/* 封面图片输入框 */}
            <div className="mb-4 relative">
              <label className="text-white font-medium">上传封面图片：</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverImageChange}
                className={`mb-4 w-full text-white bg-gray-700 border ${
                  hasAttemptedUpload && !coverImage
                    ? 'border-red-500'
                    : 'border-gray-600'
                } rounded-md p-2`}
              />
            </div>

            {/* 视频文件输入框 */}
            <div className="mb-4 relative">
              <label className="text-white font-medium mb-2">上传视频：</label>
              <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className={`mb-4 w-full text-white bg-gray-700 border ${
                  hasAttemptedUpload && !selectedFile
                    ? 'border-red-500'
                    : 'border-gray-600'
                } rounded-md p-2`}
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
                className={`w-full text-white bg-gray-700 border ${
                  hasAttemptedUpload && !description
                    ? 'border-red-500'
                    : 'border-gray-600'
                } rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500`}></textarea>
            </div>

            {/* 访问权限切换开关 */}
            <div className="mb-4 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <label className="text-white font-medium mr-2">
                    公开视频
                  </label>
                  <div className="relative group">
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
                            公开视频可以被所有用户访问。非公开视频将使用加密技术保护，只有您授权的用户才能观看。
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPublic(!isPublic)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isPublic ? 'bg-green-500' : 'bg-gray-500'
                  }`}>
                  <span className="sr-only">切换视频访问权限</span>
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isPublic ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {isPublic
                  ? '所有人都可以观看此视频'
                  : '仅授权用户可以观看此视频'}
              </p>
            </div>

            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setIsModalOpen(false)}
                className="bg-gray-500 text-white font-medium py-2 px-4 rounded-md hover:bg-gray-600 transition-all duration-200 shadow-md hover:shadow-lg">
                取消
              </button>
              <button
                onClick={handleUpload}
                disabled={
                  uploading ||
                  isEncrypting ||
                  !selectedFile ||
                  !title ||
                  !coverImage ||
                  !description
                }
                className={`${
                  selectedFile &&
                  title &&
                  coverImage &&
                  description &&
                  !uploading &&
                  !isEncrypting
                    ? 'bg-blue-500 hover:bg-blue-700'
                    : 'bg-gray-500 cursor-not-allowed'
                } text-white font-medium py-2 px-4 rounded-md transition-all duration-200 shadow-md hover:shadow-lg`}>
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
