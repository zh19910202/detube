'use client'

import React, { useState, useEffect } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import Link from 'next/link'
import { usePinata } from '../hooks/usePinata'
import { encryptVideo } from '../lib/lit/encrypt'
import { accessControlConditions } from '../lib/lit/accessControl'
import VideoUploadModal from './VideoUploadModal' // Import the new component

const Navbar: React.FC = () => {
  const { isConnected, address } = useAccount()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null) // For errors like wallet not connected
  const [showUploadSuccess, setShowUploadSuccess] = useState(false)
  const [isEncrypting, setIsEncrypting] = useState(false) // This specific state is for Lit encryption step

  const {
    ipfsHash,
    uploading, // This is true if Pinata upload is in progress
    error: pinataError, // Renamed to avoid conflict with localError
    uploadFile,
    uploadProgress,
    uploadStage,
  } = usePinata()

  // Effect to clear localError if wallet connects
  useEffect(() => {
    if (isConnected && localError === '请先连接钱包') {
      setLocalError(null)
    }
  }, [isConnected, localError])
  
  const openModal = () => {
    if (!isConnected) {
      setLocalError('请先连接钱包')
      // Optionally, prevent modal open if wallet not connected,
      // or let modal open and show this error message.
      // For now, we allow modal to open and display the error.
    } else {
      setLocalError(null) // Clear any previous errors
    }
    setShowUploadSuccess(false) // Reset success message visibility
    // Do NOT reset pinataError or ipfsHash here, they reflect the last operation's status
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    // Consider if `localError` or `showUploadSuccess` should be reset here.
    // `showUploadSuccess` is reset on openModal, which is good.
    // `localError` might show "please connect wallet" and user closes modal, it's fine.
  }

  // This function is passed to VideoUploadModal and called with form data
  const handleUploadInNavbar = async (
    title: string,
    description: string,
    selectedFile: File,
    coverImageFile: File,
    isPublicUpload: boolean
  ) => {
    if (!address) {
      setLocalError('请先连接钱包以获取地址')
      // Pinata hook's error state (pinataError) might also be set by usePinata if it checks address
      return 
    }

    // Basic validation already done in modal, but can double check here if needed.
    // e.g. if (!selectedFile || !title || !coverImageFile || !description) { ... }

    setLocalError(null) // Clear local errors before starting

    try {
      let videoToUpload = selectedFile
      let dataToEncryptHash: string | undefined

      if (!isPublicUpload) {
        setIsEncrypting(true) // Start Lit encryption visual state
        try {
          const result = await encryptVideo(
            selectedFile,
            accessControlConditions() 
          )
          videoToUpload = result.newFile
          dataToEncryptHash = result.dataToEncryptHash
        } finally {
          setIsEncrypting(false) // End Lit encryption visual state
        }
      }

      // Call usePinata's uploadFile
      // The usePinata hook will set its own `uploading`, `error`, `ipfsHash`, `uploadProgress`, `uploadStage`
      await uploadFile(
        title,
        coverImageFile,
        videoToUpload,
        description,
        address,
        isPublicUpload,
        dataToEncryptHash
      )
      
      // If uploadFile is successful (doesn't throw), ipfsHash will be set by the hook.
      // The useEffect below will handle setShowUploadSuccess and closing the modal.
      // No need to setIsModalOpen(false) directly here if success effect handles it.

    } catch (uploadError) {
      // This catch block will primarily catch errors from encryptVideo or other synchronous issues.
      // Errors from uploadFile (async Pinata interaction) are typically managed within the usePinata hook
      // and reflected in its `pinataError` state.
      console.error('上传准备失败 (Navbar):', uploadError)
      setIsEncrypting(false) // Ensure this is reset on error
      setLocalError(
        `上传准备失败: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`
      )
      // The `pinataError` from the hook will also be passed to the modal.
    }
  }

  // Monitor ipfsHash and pinataError to handle UI after upload attempt
  useEffect(() => {
    if (ipfsHash && !pinataError) { // Successfully uploaded
      setShowUploadSuccess(true)
      // Form fields are reset within VideoUploadModal via its useEffect on isOpen
      
      window.dispatchEvent(new CustomEvent('video-upload-complete'))

      // Optional: Auto-close modal after a delay
      const successCloseTimeout = setTimeout(() => {
        // setIsModalOpen(false); // Consider if auto-close is desired
        // setShowUploadSuccess(false); // Reset for next time if modal stays open
      }, 3000); // Keep success message for a bit longer

      // Reset success state for next upload IF modal isn't closed automatically
      // If modal auto-closes, this might not be strictly necessary as openModal resets it.
      const resetSuccessStateTimeout = setTimeout(() => setShowUploadSuccess(false), 5000);


      return () => {
        clearTimeout(successCloseTimeout);
        clearTimeout(resetSuccessStateTimeout);
      }
    }
    // No explicit action needed here for pinataError, as it's passed to the modal.
  }, [ipfsHash, pinataError])


  // The main error to pass to the modal, prioritizing local errors.
  const combinedError = localError || pinataError;

  return (
    <nav className="bg-primary shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-6 py-3 flex justify-between items-center">
        <Link
          href="/"
          className="text-2xl font-bold text-accent hover:text-accent-hover">
          DeTube
        </Link>
        <div className="flex items-center space-x-4">
          {isConnected && !uploading && !isEncrypting && ( // Check Navbar's isEncrypting too
            <button
              onClick={openModal}
              className="bg-accent hover:bg-accent-hover text-background font-semibold py-2 px-4 rounded-md transition-colors duration-300 shadow-lg focus:outline-none focus:ring-2 focus:ring-accent-hover focus:ring-opacity-50">
              Upload Video
            </button>
          )}
          {/* Display for Pinata uploading or Lit encrypting */}
          {isConnected && (uploading || isEncrypting) && ( 
            <div className="py-2 px-4 rounded-md bg-secondary border border-accent/30 text-sm">
              <p className="text-center font-semibold text-accent">
                {isEncrypting // Navbar's isEncrypting for Lit
                  ? '视频加密中...'
                  : uploading // usePinata's uploading
                  ? uploadStage === 'cover'
                    ? `封面上传中 (${Math.round(uploadProgress)}%)...`
                    : uploadStage === 'video'
                    ? `视频上传中 (${Math.round(uploadProgress)}%)...`
                    : uploadStage === 'metadata'
                    ? '元数据处理中...'
                    : '处理中...'
                  : '准备上传...'} 
              </p>
              <div className="w-full bg-primary rounded-full h-1.5 mt-1 border border-secondary/50">
                <div
                  className="bg-accent h-1 rounded-full transition-all duration-300 ease-out"
                  style={{
                    width: `${isEncrypting ? 50 : uploadProgress}%`, // Simple progress for encrypting
                  }}></div>
              </div>
            </div>
          )}
          <ConnectButton />
        </div>
      </div>

      <VideoUploadModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onUpload={handleUploadInNavbar}
        uploading={uploading} // from usePinata
        isEncrypting={isEncrypting} // from Navbar state (for Lit)
        error={combinedError} // Combined error from Navbar local and usePinata
        ipfsHash={ipfsHash} // from usePinata
        uploadProgress={uploadProgress} // from usePinata
        uploadStage={uploadStage} // from usePinata
        showUploadSuccess={showUploadSuccess} // from Navbar state
        // Initial values are handled by modal's useEffect on isOpen,
        // so no need to pass initialTitle, etc., unless specifically needed for re-opening.
      />
    </nav>
  )
}

export default Navbar
