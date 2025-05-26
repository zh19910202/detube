// app/components/VideoUploadModal.tsx
import React, { useState, ChangeEvent, FormEvent, useEffect } from 'react';

interface VideoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (
    title: string,
    description: string,
    file: File,
    coverImage: File,
    isPublic: boolean
  ) => Promise<void>; // Make onUpload async if it performs async operations before calling parent
  uploading: boolean; // From usePinata
  isEncrypting: boolean; // From Navbar's state, related to Lit Protocol
  error: string | null; // Error from usePinata or Navbar's upload process
  ipfsHash: string | null; // From usePinata
  uploadProgress: number; // From usePinata
  uploadStage: string | null; // From usePinata
  showUploadSuccess: boolean; // From Navbar, to show success message
  initialTitle?: string;
  initialDescription?: string;
  initialIsPublic?: boolean;
}

const VideoUploadModal: React.FC<VideoUploadModalProps> = ({
  isOpen,
  onClose,
  onUpload,
  uploading,
  isEncrypting,
  error, // This is the error from the parent (Navbar)
  ipfsHash,
  uploadProgress,
  uploadStage,
  showUploadSuccess,
  initialTitle = '',
  initialDescription = '',
  initialIsPublic = true,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [formError, setFormError] = useState<string | null>(null); // For local form validation

  // Reset form when initial values change (e.g. modal is reopened)
  useEffect(() => {
    setTitle(initialTitle);
    setDescription(initialDescription);
    setIsPublic(initialIsPublic);
    setSelectedFile(null);
    setCoverImageFile(null);
    setFormError(null);
  }, [isOpen, initialTitle, initialDescription, initialIsPublic]);


  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setFormError(null); 
    }
  };

  const handleCoverImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setCoverImageFile(event.target.files[0]);
      setFormError(null);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null); // Clear previous form errors

    if (!title.trim()) {
      setFormError('Title is required.');
      return;
    }
    if (!description.trim()) {
      setFormError('Description is required.');
      return;
    }
    if (!coverImageFile) {
      setFormError('Cover image is required.');
      return;
    }
    if (!selectedFile) {
      setFormError('Video file is required.');
      return;
    }

    // Call the onUpload prop which is Navbar's handleUpload function
    // No need for try-catch here if Navbar's handleUpload handles its own errors
    // and updates the 'error' prop passed to this modal.
    await onUpload(title, description, selectedFile, coverImageFile, isPublic);
  };

  if (!isOpen) {
    return null;
  }

  const effectiveError = formError || error; // Display form error first, then parent error

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-primary p-8 rounded-xl shadow-2xl w-full max-w-lg space-y-4 border border-secondary relative">
        <button
          onClick={() => {
            if (uploading || isEncrypting) return; // Prevent closing during critical ops
            onClose();
          }}
          className="absolute top-4 right-4 text-foreground hover:text-accent transition-colors"
          disabled={uploading || isEncrypting}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-2xl font-semibold text-foreground mb-6 text-center">Upload New Video</h2>

        {effectiveError && !showUploadSuccess && (
          <div className="bg-red-500/20 border border-red-700 text-red-300 p-3 rounded-md text-sm mb-4">
            <p>{effectiveError}</p>
          </div>
        )}

        {showUploadSuccess && ipfsHash && (
          <div className="mb-4 p-3 bg-green-500/20 border border-green-700 text-green-300 rounded-md text-sm text-center">
            <p className="font-semibold">Successfully uploaded!</p>
            <p className="mt-1">IPFS Hash:
              <a
                href={`https://${process.env.NEXT_PUBLIC_PINATA_GW}/ipfs/${ipfsHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-normal hover:underline ml-1 break-all"
              >
                {ipfsHash}
              </a>
            </p>
          </div>
        )}
        
        {/* Hide form if success message is shown and modal is about to auto-close or has finished its job */}
        {!showUploadSuccess && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full p-3 rounded-md bg-secondary text-foreground placeholder-gray-500 focus:ring-2 focus:ring-accent focus:border-transparent border ${formError && !title.trim() ? 'border-red-500' : 'border-secondary'}`}
              disabled={uploading || isEncrypting}
            />
            <textarea
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`w-full p-3 rounded-md bg-secondary text-foreground placeholder-gray-500 focus:ring-2 focus:ring-accent focus:border-transparent border ${formError && !description.trim() ? 'border-red-500' : 'border-secondary'}`}
              rows={3}
              disabled={uploading || isEncrypting}
            />

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-400">Cover Image:</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverImageChange}
                className={`w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-background hover:file:bg-accent-hover cursor-pointer ${formError && !coverImageFile ? 'ring-2 ring-red-500 rounded-md' : ''}`}
                disabled={uploading || isEncrypting}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-400">Video File:</label>
              <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className={`w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-background hover:file:bg-accent-hover cursor-pointer ${formError && !selectedFile ? 'ring-2 ring-red-500 rounded-md' : ''}`}
                disabled={uploading || isEncrypting}
              />
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="isPublicModal" // Ensure ID is unique if Navbar has one too
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 text-accent bg-secondary border-gray-500 rounded focus:ring-accent cursor-pointer"
                disabled={uploading || isEncrypting}
              />
              <label htmlFor="isPublicModal" className="text-sm text-gray-400 cursor-pointer select-none">
                Public Video (Uncheck for Private/Encrypted)
              </label>
            </div>
            
            {(uploading || isEncrypting) && (
              <div className="my-4 p-3 bg-secondary border border-secondary/50 rounded-md">
                <p className="text-sm text-center font-semibold text-accent mb-2">
                  {isEncrypting
                    ? 'Encrypting video, please hold on...'
                    : uploadStage === 'cover'
                    ? `Uploading cover image (${Math.round(uploadProgress)}%)...`
                    : uploadStage === 'video'
                    ? `Uploading video file (${Math.round(uploadProgress)}%)...`
                    : uploadStage === 'metadata'
                    ? 'Finalizing and uploading metadata to IPFS...'
                    : 'Processing...'}
                </p>
                <div className="w-full bg-primary rounded-full h-2.5 border border-secondary">
                  <div
                    className="bg-accent h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${isEncrypting ? 50 : uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={uploading || isEncrypting || showUploadSuccess}
              className="w-full bg-accent hover:bg-accent-hover text-background font-bold py-3 px-4 rounded-md transition-colors duration-300 shadow-lg focus:outline-none focus:ring-2 focus:ring-accent-hover focus:ring-opacity-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isEncrypting
                ? 'Encrypting...'
                : uploading
                ? uploadStage === 'cover' ? 'Uploading Cover...' : uploadStage === 'video' ? 'Uploading Video...' : 'Processing...'
                : 'Upload Video'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default VideoUploadModal;
