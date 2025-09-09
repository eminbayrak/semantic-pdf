import React, { useRef, useEffect, useState } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { getElementBounds, calculateTransform, interpolate as coordInterpolate } from '../../utils/CoordinateMapper';
import HighlightOverlay from './HighlightOverlay';

/**
 * DocumentPresentation - Core Remotion component for PDF to Video presentations
 * Embeds HTML content and handles zoom/pan animations with precise element targeting
 */
const DocumentPresentation = ({ 
  htmlContent, 
  animationTimeline, 
  currentSectionIndex = 0,
  onElementBoundsUpdate 
}) => {
  const frame = useCurrentFrame();
  const { width: videoWidth, height: videoHeight, fps } = useVideoConfig();
  const containerRef = useRef(null);
  const [elementBounds, setElementBounds] = useState({});
  const [currentTransform, setCurrentTransform] = useState({
    scale: 1,
    translateX: 0,
    translateY: 0
  });

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

  // Calculate current animation state
  useEffect(() => {
    if (!animationTimeline || animationTimeline.length === 0) return;
    
    const currentAnimation = animationTimeline[currentSectionIndex];
    if (!currentAnimation) return;
    
    const { elementId, startFrame, endFrame, keyframes } = currentAnimation;
    const elementBounds = getElementBounds(elementId, containerRef);
    
    if (!elementBounds) return;
    
    // Calculate progress through current animation
    const progress = Math.max(0, Math.min(1, (frame - startFrame) / (endFrame - startFrame)));
    
    // Interpolate between keyframes
    const currentKeyframe = getCurrentKeyframe(keyframes, frame, startFrame);
    const nextKeyframe = getNextKeyframe(keyframes, frame, startFrame);
    
    if (currentKeyframe && nextKeyframe) {
      const keyframeProgress = (frame - currentKeyframe.frame) / (nextKeyframe.frame - currentKeyframe.frame);
      const easedProgress = Easing.easeInOut(keyframeProgress);
      
      const transform = calculateTransform(
        elementBounds,
        { width: videoWidth, height: videoHeight },
        interpolate(currentKeyframe.scale, nextKeyframe.scale, easedProgress)
      );
      
      // Apply translation interpolation
      const translateX = coordInterpolate(
        currentKeyframe.translateX || 0,
        nextKeyframe.translateX || 0,
        easedProgress,
        'easeInOut'
      );
      
      const translateY = coordInterpolate(
        currentKeyframe.translateY || 0,
        nextKeyframe.translateY || 0,
        easedProgress,
        'easeInOut'
      );
      
      const opacity = coordInterpolate(
        currentKeyframe.opacity || 1,
        nextKeyframe.opacity || 1,
        easedProgress,
        'easeInOut'
      );
      
      setCurrentTransform({
        scale: transform.scale,
        translateX: translateX,
        translateY: translateY,
        opacity: opacity
      });
    }
  }, [frame, animationTimeline, currentSectionIndex, videoWidth, videoHeight]);

  // Get current keyframe based on frame
  const getCurrentKeyframe = (keyframes, currentFrame, startFrame) => {
    const relativeFrame = currentFrame - startFrame;
    return keyframes.find(kf => kf.frame <= relativeFrame) || keyframes[0];
  };

  // Get next keyframe for interpolation
  const getNextKeyframe = (keyframes, currentFrame, startFrame) => {
    const relativeFrame = currentFrame - startFrame;
    const nextKeyframe = keyframes.find(kf => kf.frame > relativeFrame);
    return nextKeyframe || keyframes[keyframes.length - 1];
  };

  // Get current highlight configuration
  const getCurrentHighlight = () => {
    if (!animationTimeline || animationTimeline.length === 0) return null;
    
    const currentAnimation = animationTimeline[currentSectionIndex];
    if (!currentAnimation) return null;
    
    const { elementId, highlightType } = currentAnimation;
    const bounds = elementBounds[elementId];
    
    if (!bounds) return null;
    
    return {
      elementId,
      bounds,
      type: highlightType || 'border',
      opacity: currentTransform.opacity || 1
    };
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
          transition: 'transform 0.1s ease-out'
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
      
      {/* Debug Information (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace',
            zIndex: 1000
          }}
        >
          <div>Frame: {frame}</div>
          <div>Section: {currentSectionIndex + 1}/{animationTimeline?.length || 0}</div>
          <div>Scale: {currentTransform.scale?.toFixed(2)}</div>
          <div>Translate: ({currentTransform.translateX?.toFixed(0)}, {currentTransform.translateY?.toFixed(0)})</div>
          <div>Opacity: {currentTransform.opacity?.toFixed(2)}</div>
        </div>
      )}
    </div>
  );
};

export default DocumentPresentation;