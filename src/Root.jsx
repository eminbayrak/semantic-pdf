import React from 'react';
import { registerRoot } from 'remotion';
import VideoComposition from './components/Remotion/VideoComposition';

// Register the main video composition for Remotion
registerRoot(() => {
  return (
    <VideoComposition
      htmlContent=""
      narrationMappings={null}
      audioFile={null}
      videoConfig={{
        width: 1920,
        height: 1080,
        fps: 30,
        durationInFrames: 600
      }}
    />
  );
});