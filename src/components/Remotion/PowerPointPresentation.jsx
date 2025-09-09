import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { getElementBounds, calculateTransform, interpolate as coordInterpolate } from '../../utils/CoordinateMapper';
import HighlightOverlay from './HighlightOverlay';
import AzureTTSService from '../Services/AzureTTSService';

/**
 * PowerPoint-style Presentation Component
 * Synchronizes audio narration with visual animations and highlighting
 */
const PowerPointPresentation = ({ 
  htmlContent, 
  narrationSegments, 
  audioData,
  currentSlideIndex = 0,
  onSlideChange,
  onElementBoundsUpdate 
}) => {
  const frame = useCurrentFrame();
  const { width: videoWidth, height: videoHeight, fps } = useVideoConfig();
  const containerRef = useRef(null);
  const audioRef = useRef(null);
  const [elementBounds, setElementBounds] = useState({});
  const [currentTransform, setCurrentTransform] = useState({
    scale: 1,
    translateX: 0,
    translateY: 0
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Initialize TTS service
  const ttsService = useRef(null);
  useEffect(() => {
    try {
      ttsService.current = new AzureTTSService();
    } catch (error) {
      console.error('TTS service initialization failed:', error);
    }
  }, []);

  // Update element bounds when HTML content changes
  useEffect(() => {
    if (htmlContent && containerRef.current) {
      const bounds = {};
      const allElements = containerRef.current.querySelectorAll('[id]');
      
      allElements.forEach(element => {
        const rect = element.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        
        bounds[element.id] = {
          x: rect.left - containerRect.left,
          y: rect.top - containerRect.top,
          width: rect.width,
          height: rect.height,
          centerX: rect.left - containerRect.left + rect.width / 2,
          centerY: rect.top - containerRect.top + rect.height / 2
        };
      });
      
      setElementBounds(bounds);
      if (onElementBoundsUpdate) {
        onElementBoundsUpdate(bounds);
      }
    }
  }, [htmlContent, onElementBoundsUpdate]);

  // Handle audio playback
  useEffect(() => {
    if (audioData && audioRef.current) {
      const audio = audioRef.current;
      
      const handleTimeUpdate = () => {
        setCurrentTime(audio.currentTime);
        updatePresentationForCurrentTime(audio.currentTime);
      };

      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      const handleEnded = () => setIsPlaying(false);

      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('ended', handleEnded);

      return () => {
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('ended', handleEnded);
      };
    }
  }, [audioData]);

  // Update presentation based on current audio time
  const updatePresentationForCurrentTime = useCallback((audioTime) => {
    if (!narrationSegments || narrationSegments.length === 0) return;

    // Find current segment based on audio time
    const currentSegment = narrationSegments.find(segment => 
      audioTime >= segment.startTime && audioTime <= segment.endTime
    );

    if (currentSegment && currentSegment.elementId) {
      const bounds = elementBounds[currentSegment.elementId];
      if (bounds) {
        const transform = calculateTransform(
          bounds,
          { width: videoWidth, height: videoHeight },
          currentSegment.zoomLevel || 2.0
        );

        setCurrentTransform({
          scale: transform.scale,
          translateX: transform.translateX,
          translateY: transform.translateY,
          opacity: 1
        });
      }
    }
  }, [narrationSegments, elementBounds, videoWidth, videoHeight]);

  // Get current highlight configuration
  const getCurrentHighlight = () => {
    if (!narrationSegments || narrationSegments.length === 0) return null;
    
    const currentSegment = narrationSegments.find(segment => 
      currentTime >= segment.startTime && currentTime <= segment.endTime
    );

    if (!currentSegment || !currentSegment.elementId) return null;
    
    const bounds = elementBounds[currentSegment.elementId];
    if (!bounds) return null;
    
    return {
      elementId: currentSegment.elementId,
      bounds,
      type: currentSegment.highlightType || 'border',
      opacity: 1,
      phrase: currentSegment.text
    };
  };

  // Play/pause audio
  const toggleAudio = useCallback(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  }, [isPlaying]);

  // Seek to specific time
  const seekTo = useCallback((time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, []);

  // Get progress percentage
  const getProgress = () => {
    if (!audioData || !audioRef.current) return 0;
    return (currentTime / audioData.duration) * 100;
  };

  return (
    <div
      style={{
        width: videoWidth,
        height: videoHeight,
        backgroundColor: '#ffffff',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* HTML Content Container */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          transform: `scale(${currentTransform.scale}) translate(${currentTransform.translateX}px, ${currentTransform.translateY}px)`,
          transformOrigin: 'center center',
          opacity: currentTransform.opacity || 1,
          transition: 'transform 0.5s ease-out'
        }}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
      
      {/* Highlight Overlay */}
      {getCurrentHighlight() && (
        <HighlightOverlay
          highlight={getCurrentHighlight()}
          videoWidth={videoWidth}
          videoHeight={videoHeight}
          currentTransform={currentTransform}
        />
      )}

      {/* Audio Controls */}
      {audioData && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            right: 20,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '15px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '15px'
          }}
        >
          <button
            onClick={toggleAudio}
            style={{
              background: isPlaying ? '#f44336' : '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '50px',
              height: '50px',
              cursor: 'pointer',
              fontSize: '20px'
            }}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>

          <div style={{ flex: 1 }}>
            <div
              style={{
                width: '100%',
                height: '4px',
                background: '#333',
                borderRadius: '2px',
                cursor: 'pointer',
                position: 'relative'
              }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const percentage = clickX / rect.width;
                const newTime = percentage * audioData.duration;
                seekTo(newTime);
              }}
            >
              <div
                style={{
                  width: `${getProgress()}%`,
                  height: '100%',
                  background: '#4caf50',
                  borderRadius: '2px',
                  transition: 'width 0.1s ease'
                }}
              />
            </div>
          </div>

          <div style={{ fontSize: '14px', minWidth: '100px' }}>
            {formatTime(currentTime)} / {formatTime(audioData.duration)}
          </div>
        </div>
      )}

      {/* Current Narration Text */}
      {getCurrentHighlight() && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            right: 20,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '15px',
            borderRadius: '10px',
            fontSize: '16px',
            lineHeight: '1.4'
          }}
        >
          <strong>Narration:</strong> {getCurrentHighlight().phrase}
        </div>
      )}

      {/* Debug Information */}
      {process.env.NODE_ENV === 'development' && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace',
            zIndex: 1000
          }}
        >
          <div>Frame: {frame}</div>
          <div>Time: {currentTime.toFixed(2)}s</div>
          <div>Scale: {currentTransform.scale?.toFixed(2)}</div>
          <div>Playing: {isPlaying ? 'Yes' : 'No'}</div>
        </div>
      )}

      {/* Hidden Audio Element */}
      {audioData && (
        <audio
          ref={audioRef}
          src={audioData.audioUrl}
          preload="auto"
          style={{ display: 'none' }}
        />
      )}
    </div>
  );
};

// Helper function to format time
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default PowerPointPresentation;
