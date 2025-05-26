'use client'

import React, { useState, useEffect } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import Link from 'next/link'
import { usePinata } from '../hooks/usePinata'
import { encryptVideo } from '../lib/lit/encrypt'
import { accessControlConditions } from '../lib/lit/accessControl'

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
      setIsModalOpen(false)
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
    <nav className="bg-primary shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-6 py-3 flex justify-between items-center">
        <Link
          href="/"
          className="text-2xl font-bold text-accent hover:text-accent-hover">
          DeTube
        </Link>
        <div className="flex items-center space-x-4">
          {isConnected && !uploading && !isEncrypting && (
            <button
              onClick={() => {
                setIsModalOpen(true)
                setLocalError(null)
                setHasAttemptedUpload(false)
                setShowUploadSuccess(false)
              }}
              className="bg-accent hover:bg-accent-hover text-background font-semibold py-2 px-4 rounded-md transition-colors duration-300 shadow-lg focus:outline-none focus:ring-2 focus:ring-accent-hover focus:ring-opacity-50">
              Upload Video
            </button>
          )}
          {isConnected && (uploading || isEncrypting) && (
            <div className="py-2 px-4 rounded-md bg-secondary border border-accent/30 text-sm">
              <p className="text-center font-semibold text-accent">
                {isEncrypting
                  ? '视频加密中...'
                  : uploadStage === 'cover'
                  ? `封面上传中 (${Math.round(uploadProgress)}%)...`
                  : uploadStage === 'video'
                  ? `视频上传中 (${Math.round(uploadProgress)}%)...`
                  : uploadStage === 'metadata'
                  ? '元数据处理中...'
                  : '处理中...'}
              </p>
              <div className="w-full bg-primary rounded-full h-1.5 mt-1 border border-secondary/50">
                <div
                  className="bg-accent h-1 rounded-full transition-all duration-300 ease-out"
                  style={{
                    width: `${isEncrypting ? 50 : uploadProgress}%`,
                  }}></div>
              </div>
            </div>
          )}
          <ConnectButton />
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-primary p-8 rounded-xl shadow-2xl w-full max-w-lg space-y-4 border border-secondary relative">
            <button
              onClick={() => {
                if (uploading || isEncrypting) {
                  console.log('Upload in progress, cannot close modal yet.')
                  return
                }
                setIsModalOpen(false)
                if (!showUploadSuccess) {
                  setLocalError(null)
                  setHasAttemptedUpload(false)
                }
              }}
              className="absolute top-4 right-4 text-foreground hover:text-accent transition-colors">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <h2 className="text-2xl font-semibold text-foreground mb-6 text-center">
              Upload New Video
            </h2>

            {/* Combined Error Display Area */}
            {(localError || error) && (
              <div className="bg-red-500/20 border border-red-700 text-red-300 p-3 rounded-md text-sm mb-4">
                <p>{localError}</p>
                {localError && error && (
                  <hr className="my-2 border-red-700/50" />
                )}{' '}
                {/* Separator if both errors exist */}
                <p>{error}</p> {/* This is the error from usePinata hook */}
              </div>
            )}

            {/* Success Message - moved up for visibility before form potentially resets */}
            {showUploadSuccess && ipfsHash && (
              <div className="mb-4 p-3 bg-green-500/20 border border-green-700 text-green-300 rounded-md text-sm text-center">
                <p className="font-semibold">Successfully uploaded!</p>
                <p className="mt-1">
                  IPFS Hash:
                  <a
                    href={`https://${process.env.NEXT_PUBLIC_PINATA_GW}/ipfs/${ipfsHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-normal hover:underline ml-1 break-all">
                    {ipfsHash}
                  </a>
                </p>
              </div>
            )}

            {/* Conditional rendering to hide form if success message is shown and we want a clean state */}
            {/* Or, allow form to persist for "Upload another" type flow. For now, form persists. */}

            <input
              type="text"
              placeholder="Title"
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full p-3 rounded-md bg-secondary text-foreground placeholder-gray-500 focus:ring-2 focus:ring-accent focus:border-transparent border ${
                hasAttemptedUpload && !title
                  ? 'border-red-500'
                  : 'border-secondary'
              }`}
            />
            <textarea
              placeholder="Description"
              onChange={(e) => setDescription(e.target.value)}
              className={`w-full p-3 rounded-md bg-secondary text-foreground placeholder-gray-500 focus:ring-2 focus:ring-accent focus:border-transparent border ${
                hasAttemptedUpload && !description
                  ? 'border-red-500'
                  : 'border-secondary'
              }`}
              rows={3}></textarea>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-400">
                Cover Image:
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverImageChange}
                className={`w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-background hover:file:bg-accent-hover cursor-pointer ${
                  hasAttemptedUpload && !coverImage
                    ? 'ring-2 ring-red-500 rounded-md'
                    : ''
                }`}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-400">
                Video File:
              </label>
              <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className={`w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-background hover:file:bg-accent-hover cursor-pointer ${
                  hasAttemptedUpload && !selectedFile
                    ? 'ring-2 ring-red-500 rounded-md'
                    : ''
                }`}
              />
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="isPublic"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 text-accent bg-secondary border-gray-500 rounded focus:ring-accent cursor-pointer"
              />
              <label
                htmlFor="isPublic"
                className="text-sm text-gray-400 cursor-pointer select-none">
                Public Video (Uncheck for Private/Encrypted)
              </label>
            </div>

            {/* Upload Progress and Stage Information */}
            {(uploading || isEncrypting) && (
              <div className="my-4 p-3 bg-secondary border border-secondary/50 rounded-md">
                <p className="text-sm text-center font-semibold text-accent mb-2">
                  {isEncrypting
                    ? 'Encrypting video, please hold on...'
                    : uploadStage === 'cover'
                    ? `Uploading cover image (${Math.round(
                        uploadProgress
                      )}%)...`
                    : uploadStage === 'video'
                    ? `Uploading video file (${Math.round(uploadProgress)}%)...`
                    : uploadStage === 'metadata'
                    ? 'Finalizing and uploading metadata to IPFS...'
                    : 'Processing...'}
                </p>
                <div className="w-full bg-primary rounded-full h-2.5 border border-secondary">
                  <div
                    className="bg-accent h-2 rounded-full transition-all duration-300 ease-out"
                    style={{
                      width: `${isEncrypting ? 50 : uploadProgress}%`,
                    }}></div>
                </div>
              </div>
            )}

            {/* Conditionally render ProgressButton OR standard Upload button */}
            {/* The ProgressButton seems to be more of a visual flair than a functional button when `disabled` is true. */}
            {/* Let's use a standard disabled button text during upload, and the detailed progress above. */}
            <button
              onClick={handleUpload}
              disabled={
                uploading || isEncrypting || !isConnected || showUploadSuccess
              }
              className="w-full bg-accent hover:bg-accent-hover text-background font-bold py-3 px-4 rounded-md transition-colors duration-300 shadow-lg focus:outline-none focus:ring-2 focus:ring-accent-hover focus:ring-opacity-50 disabled:opacity-60 disabled:cursor-not-allowed">
              {isEncrypting
                ? 'Encrypting...'
                : uploading
                ? uploadStage === 'cover'
                  ? 'Uploading Cover...'
                  : uploadStage === 'video'
                  ? 'Uploading Video...'
                  : 'Processing...'
                : 'Upload'}
            </button>

            {/* Removed the explicit ProgressButton rendering here to avoid redundancy if the main button handles stages */}
            {/* Original logic for ProgressButton (can be re-added if preferred over text changes on main button) */}
            {/* {uploading || isEncrypting ? (
              <ProgressButton
                progress={isEncrypting ? 50 : uploadProgress} 
                stage={isEncrypting ? 'encrypting' : uploadStage}
                label={isEncrypting ? 'Encrypting...' : 'Uploading...'}
                disabled={true}
                onClick={() => {}}
              />
            ) : (
              <button ...> Upload </button>
            )} */}

            {/* The success message was moved up, so it's not needed here again */}
            {/* {showUploadSuccess && ipfsHash && ( ... )} */}
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navbar
