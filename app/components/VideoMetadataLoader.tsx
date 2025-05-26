import React from 'react';

const VideoMetadataLoader: React.FC = () => {
  return (
    <div className="flex justify-center items-center min-h-screen bg-background text-foreground">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
      <p className="ml-3">Loading video data...</p>
    </div>
  );
};

export default VideoMetadataLoader;
