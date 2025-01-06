'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import Link from 'next/link' // 导入 Link 组件
import { usePinata } from '../hooks/usePinata'

const Navbar: React.FC = () => {
  const { isConnected } = useAccount() // 钱包是否连接
  const [selectedFile, setSelectedFile] = useState<File | null>(null) // 存储选中的文件
  const [isModalOpen, setIsModalOpen] = useState(false) // 控制模态框是否打开
  const [toastMessage, setToastMessage] = useState<string | null>(null) // 控制提示消息

  const { ipfsHash, uploading, error, uploadFile } = usePinata()

  // 处理文件选择
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file) // 保存选择的文件
    }
  }

  // 处理上传
  const handleUpload = () => {
    if (selectedFile) {
      uploadFile(selectedFile)
        .then(() => console.log('上传成功'))
        .catch((error) => console.log('上传失败', error));
      setIsModalOpen(false) // 上传开始后关闭模态框
    }
  }

  // 使用 useCallback 确保该函数不会在每次渲染时重新定义
  const handleUploadSuccess = useCallback(() => {
    if (ipfsHash) {
      setToastMessage(`视频已上传至 IPFS！哈希值：${ipfsHash}`)
    }
  }, [ipfsHash])

  // 当 ipfsHash 变更时，显示成功消息，并设置 2 秒后自动消失
  useEffect(() => {
    if (ipfsHash) {
      handleUploadSuccess()
      const timeoutId = setTimeout(() => {
        setToastMessage(null) // 在2秒后关闭提示消息
      }, 2000) // 提示框停留时间设置为2秒

      return () => clearTimeout(timeoutId) // 清理定时器
    }
  }, [ipfsHash, handleUploadSuccess]) // 监听 ipfsHash 变化

  return (
    <nav className="bg-gray-800 text-white p-4 flex items-center justify-between">
      {/* Detube 链接到主页 */}
      <Link href="/" className="text-xl font-bold">
        Detube
      </Link>

      <div className="ml-auto flex items-center space-x-4">
        <button
          onClick={() => setIsModalOpen(true)} // 点击上传按钮时打开模态框
          disabled={!isConnected || uploading} // 禁用上传按钮，除非钱包连接且没有上传进行中
          className={`${
            isConnected && !uploading
              ? 'bg-blue-500 hover:bg-blue-700'
              : 'bg-gray-500 cursor-not-allowed'
          } text-white py-2 px-4 rounded-2xl transform hover:scale-105 transition-transform duration-200`}
        >
          {uploading ? '上传中...' : '上传视频'}
        </button>

        {/* 连接钱包按钮 */}
        <ConnectButton />
      </div>

      {/* 显示错误信息 */}
      {error && (
        <div className="mt-2 text-sm text-red-500">
          <p>{error}</p>
        </div>
      )}

      {/* 模态框：文件选择和上传 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-96 max-w-sm">
            <h2 className="text-xl font-semibold text-white mb-4">选择视频文件</h2>
            <input
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="mb-4 w-full text-white bg-gray-700 border border-gray-600 rounded-md p-2"
            />
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setIsModalOpen(false)} // 取消按钮，关闭模态框
                className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition duration-200"
              >
                取消
              </button>
              <button
                onClick={() => {
                  handleUpload(); // 上传文件
                  setIsModalOpen(false); // 上传后关闭模态框
                }}
                disabled={!selectedFile} // 如果没有选择文件则禁用
                className={`${
                  selectedFile
                    ? 'bg-blue-500 hover:bg-blue-700'
                    : 'bg-gray-500 cursor-not-allowed'
                } text-white py-2 px-4 rounded-md transition duration-200`}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 系统提示框：上传成功的提示，居中显示在导航栏下方 */}
      {toastMessage && (
        <div className="absolute top-22 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white py-2 px-4 rounded-lg shadow-lg z-50 max-w-xl flex items-center justify-center">
          <p className="text-sm font-semibold">{toastMessage}</p>
        </div>
      )}
    </nav>
  )
}

export default Navbar
