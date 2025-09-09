import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import PDFViewer from '../PDFToHTML/PDFViewer';
import { mapAzureResultsToPDFCoordinates, createHighlightRegion, calculateOptimalZoom } from '../../utils/PDFCoordinateMapper';
import AzureTTSService from '../Services/AzureTTSService';

/**
 * PDF Presentation Component
 * Uses actual PDF with precise coordinate mapping for pixel-perfect presentations
 */
const PDFPresentation = ({ 
  pdfFile,
  azureResults,
  narrationSegments, 
  audioData,
  currentSegmentIndex = 0,
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
  const [pdfViewport, setPdfViewport] = useState(null);
  const [mappedElements, setMappedElements] = useState({});

  // Initialize TTS service
  const ttsService = useRef(null);
  useEffect(() => {
    try {
      ttsService.current = new AzureTTSService();
    } catch (error) {
      console.error('TTS service initialization failed:', error);
    }
  }, []);

  // Map Azure results to PDF coordinates when viewport is available
  useEffect(() => {
    if (azureResults && pdfViewport) {
      const mapped = mapAzureResultsToPDFCoordinates(azureResults, pdfViewport, 1.0);
      setMappedElements(mapped);
      console.log('Mapped elements:', mapped);
    }
  }, [azureResults, pdfViewport]);

  // Handle element bounds updates from PDF viewer
  const handleElementBoundsUpdate = useCallback((bounds) => {
    setElementBounds(bounds);
    if (onElementBoundsUpdate) {
      onElementBoundsUpdate(bounds);
    }
  }, [onElementBoundsUpdate]);

  // Handle PDF viewport updates
  const handlePdfViewportUpdate = useCallback((viewport) => {
    setPdfViewport(viewport);
  }, []);

  // Calculate current animation state
  useEffect(() => {
    if (!narrationSegments || narrationSegments.length === 0) return;
    
    const currentSegment = narrationSegments[currentSegmentIndex];
    if (!currentSegment) return;
    
    const elementCoords = mappedElements[currentSegment.elementId];
    if (!elementCoords) return;
    
    // Calculate progress through current animation
    const progress = Math.max(0, Math.min(1, frame / (currentSegment.duration * fps)));
    
    // Interpolate zoom and position
    const targetZoom = currentSegment.zoomLevel || 2.0;
    const currentZoom = interpolate(progress, [0, 0.1, 0.9, 1], [1, targetZoom, targetZoom, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.easeInOut
    });
    
    // Calculate center position
    const centerX = videoWidth / 2 - elementCoords.centerX * currentZoom;
    const centerY = videoHeight / 2 - elementCoords.centerY * currentZoom;
    
    setCurrentTransform({
      scale: currentZoom,
      translateX: centerX,
      translateY: centerY,
      opacity: interpolate(progress, [0, 0.1, 0.9, 1], [0, 1, 1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp'
      })
    });
  }, [frame, narrationSegments, currentSegmentIndex, mappedElements, videoWidth, videoHeight, fps]);

  // Get current highlight configuration
  const getCurrentHighlight = () => {
    if (!narrationSegments || narrationSegments.length === 0) return null;
    
    const currentSegment = narrationSegments[currentSegmentIndex];
    if (!currentSegment) return null;
    
    const elementCoords = mappedElements[currentSegment.elementId];
    if (!elementCoords) return null;
    
    return createHighlightRegion(elementCoords, currentSegment.highlightType || 'border');
  };

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

    if (currentSegment) {
      const elementCoords = mappedElements[currentSegment.elementId];
      if (elementCoords) {
        const zoomLevel = currentSegment.zoomLevel || 2.0;
        const centerX = videoWidth / 2 - elementCoords.centerX * zoomLevel;
        const centerY = videoHeight / 2 - elementCoords.centerY * zoomLevel;

        setCurrentTransform({
          scale: zoomLevel,
          translateX: centerX,
          translateY: centerY,
          opacity: 1
        });
      }
    }
  }, [narrationSegments, mappedElements, videoWidth, videoHeight]);

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
      {/* PDF Viewer Container */}
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
      >
        <PDFViewer
          pdfFile={pdfFile}
          onElementBoundsUpdate={handleElementBoundsUpdate}
          onPdfViewportUpdate={handlePdfViewportUpdate}
          highlightRegions={[]}
          currentHighlight={getCurrentHighlight()}
          zoomLevel={currentTransform.scale}
        />
      </div>

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
      {narrationSegments && narrationSegments[currentSegmentIndex] && (
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
          <strong>Narration:</strong> {narrationSegments[currentSegmentIndex].phrase}
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
          <div>Segment: {currentSegmentIndex + 1}/{narrationSegments?.length || 0}</div>
          <div>Scale: {currentTransform.scale?.toFixed(2)}</div>
          <div>Translate: ({currentTransform.translateX?.toFixed(0)}, {currentTransform.translateY?.toFixed(0)})</div>
          <div>Elements: {Object.keys(mappedElements).length}</div>
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

export default PDFPresentation;
