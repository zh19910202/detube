import React from 'react';

interface VideoMetadataErrorProps {
  errorMessage: string;
  onRetry?: () => void; // Optional retry function
  onGoBack?: () => void; // Optional go back function
}

const VideoMetadataError: React.FC<VideoMetadataErrorProps> = ({ 
  errorMessage, 
  onRetry,
  onGoBack = () => window.history.back() 
}) => {
  return (
    <div className="min-h-screen bg-background text-foreground flex justify-center items-center p-4">
      <div className="bg-primary p-6 rounded-lg shadow-xl border border-secondary text-center">
        <h2 className="text-xl text-foreground font-bold mb-3">
          Loading Error
        </h2>
        <p className="text-gray-400 mb-4">
          {errorMessage || 'Video failed to load. Please try again.'}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 bg-accent text-background px-4 py-2 rounded-lg hover:bg-accent-hover transition-colors mr-2"
          >
            Retry
          </button>
        )}
        <button
          onClick={onGoBack}
          className="mt-4 bg-secondary text-foreground px-4 py-2 rounded-lg hover:bg-primary transition-colors"
        >
          Go Back
        </button>
      </div>
    </div>
  );
};

export default VideoMetadataError;
