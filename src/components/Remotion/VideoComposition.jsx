import React, { useRef, useEffect, useState } from 'react';
import { Composition, continueRender, delayRender } from 'remotion';
import DocumentPresentation from './DocumentPresentation';
import { createAnimationSequence } from '../../utils/CoordinateMapper';

/**
 * VideoComposition - Main Remotion composition for PDF to Video presentations
 * Orchestrates the entire video generation process
 */
const VideoComposition = ({ 
  htmlContent, 
  narrationMappings, 
  audioFile,
  videoConfig = {}
}) => {
  const [animationTimeline, setAnimationTimeline] = useState([]);
  const [elementBounds, setElementBounds] = useState({});
  const [isReady, setIsReady] = useState(false);
  const containerRef = useRef(null);
  const handle = useRef(null);

  const {
    width = 1920,
    height = 1080,
    fps = 30,
    durationInFrames = 600
  } = videoConfig;

  // Create animation timeline from narration mappings
  useEffect(() => {
    if (narrationMappings && narrationMappings.mappings) {
      const timeline = createAnimationSequence(narrationMappings.mappings, {
        width,
        height,
        fps
      });
      setAnimationTimeline(timeline);
    }
  }, [narrationMappings, width, height, fps]);

  // Handle element bounds updates
  const handleElementBoundsUpdate = (bounds) => {
    setElementBounds(bounds);
  };

  // Calculate total video duration
  const calculateTotalDuration = () => {
    if (animationTimeline.length === 0) return durationInFrames;
    
    const lastAnimation = animationTimeline[animationTimeline.length - 1];
    return lastAnimation.endFrame + 30; // Add 1 second buffer
  };

  // Render video composition
  const renderComposition = () => {
    if (!isReady || !htmlContent || animationTimeline.length === 0) {
      return (
        <div
          style={{
            width,
            height,
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            color: '#666'
          }}
        >
          {!htmlContent ? 'Loading HTML content...' : 
           animationTimeline.length === 0 ? 'Preparing animation timeline...' : 
           'Initializing video composition...'}
        </div>
      );
    }

    return (
      <DocumentPresentation
        htmlContent={htmlContent}
        animationTimeline={animationTimeline}
        currentSectionIndex={0} // This would be controlled by Remotion's frame system
        onElementBoundsUpdate={handleElementBoundsUpdate}
      />
    );
  };

  // Initialize composition
  useEffect(() => {
    if (htmlContent && animationTimeline.length > 0) {
      handle.current = delayRender();
      
      // Simulate initialization delay
      setTimeout(() => {
        setIsReady(true);
        continueRender(handle.current);
      }, 100);
    }
  }, [htmlContent, animationTimeline]);

  return (
    <div
      ref={containerRef}
      style={{
        width,
        height,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {renderComposition()}
    </div>
  );
};

/**
 * Main Video Composition Component for Remotion
 * This is the root component that Remotion will render
 */
export const MainVideoComposition = ({ 
  htmlContent, 
  narrationMappings, 
  audioFile,
  videoConfig = {}
}) => {
  return (
    <Composition
      id="DocumentPresentation"
      component={VideoComposition}
      durationInFrames={videoConfig.durationInFrames || 600}
      fps={videoConfig.fps || 30}
      width={videoConfig.width || 1920}
      height={videoConfig.height || 1080}
      defaultProps={{
        htmlContent,
        narrationMappings,
        audioFile,
        videoConfig
      }}
    />
  );
};

export default VideoComposition;