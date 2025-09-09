import React from 'react';
import { interpolate, Easing } from 'remotion';

/**
 * HighlightOverlay - Visual emphasis component for video presentations
 * Provides animated borders, spotlights, and glow effects around target elements
 */
const HighlightOverlay = ({ 
  highlight, 
  videoWidth, 
  videoHeight, 
  currentTransform 
}) => {
  if (!highlight || !highlight.bounds) return null;

  const { elementId, bounds, type, opacity = 1 } = highlight;
  const { x, y, width, height, centerX, centerY } = bounds;

  // Apply current transform to highlight position
  const transformedX = (x - videoWidth / 2) * currentTransform.scale + videoWidth / 2 + currentTransform.translateX;
  const transformedY = (y - videoHeight / 2) * currentTransform.scale + videoHeight / 2 + currentTransform.translateY;
  const transformedWidth = width * currentTransform.scale;
  const transformedHeight = height * currentTransform.scale;
  const transformedCenterX = (centerX - videoWidth / 2) * currentTransform.scale + videoWidth / 2 + currentTransform.translateX;
  const transformedCenterY = (centerY - videoHeight / 2) * currentTransform.scale + videoHeight / 2 + currentTransform.translateY;

  const renderHighlight = () => {
    switch (type) {
      case 'spotlight':
        return renderSpotlight();
      case 'glow':
        return renderGlow();
      case 'border':
      default:
        return renderBorder();
    }
  };

  const renderBorder = () => {
    const padding = 8;
    const borderWidth = 3;
    const borderRadius = 8;

    return (
      <div
        style={{
          position: 'absolute',
          left: transformedX - padding,
          top: transformedY - padding,
          width: transformedWidth + (padding * 2),
          height: transformedHeight + (padding * 2),
          border: `${borderWidth}px solid #ff6b35`,
          borderRadius: borderRadius,
          opacity: opacity,
          pointerEvents: 'none',
          zIndex: 100,
          boxShadow: '0 0 20px rgba(255, 107, 53, 0.5)',
          animation: 'pulse 2s ease-in-out infinite'
        }}
      />
    );
  };

  const renderSpotlight = () => {
    const radius = Math.max(transformedWidth, transformedHeight) / 2 + 20;
    
    return (
      <div
        style={{
          position: 'absolute',
          left: transformedCenterX - radius,
          top: transformedCenterY - radius,
          width: radius * 2,
          height: radius * 2,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(255, 107, 53, 0.3) 0%, rgba(255, 107, 53, 0.1) 50%, transparent 70%)`,
          opacity: opacity,
          pointerEvents: 'none',
          zIndex: 100,
          animation: 'spotlight-pulse 3s ease-in-out infinite'
        }}
      />
    );
  };

  const renderGlow = () => {
    const padding = 12;
    const blur = 8;
    const spread = 4;

    return (
      <div
        style={{
          position: 'absolute',
          left: transformedX - padding,
          top: transformedY - padding,
          width: transformedWidth + (padding * 2),
          height: transformedHeight + (padding * 2),
          borderRadius: 8,
          boxShadow: `0 0 ${blur}px ${spread}px rgba(255, 107, 53, 0.6)`,
          opacity: opacity,
          pointerEvents: 'none',
          zIndex: 100,
          animation: 'glow-pulse 2.5s ease-in-out infinite'
        }}
      />
    );
  };

  return (
    <>
      {renderHighlight()}
      
      {/* CSS Animations */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
              opacity: 0.8;
            }
            50% {
              transform: scale(1.05);
              opacity: 1;
            }
          }
          
          @keyframes spotlight-pulse {
            0%, 100% {
              transform: scale(1);
              opacity: 0.6;
            }
            50% {
              transform: scale(1.1);
              opacity: 0.9;
            }
          }
          
          @keyframes glow-pulse {
            0%, 100% {
              box-shadow: 0 0 8px 4px rgba(255, 107, 53, 0.6);
              opacity: 0.8;
            }
            50% {
              box-shadow: 0 0 16px 8px rgba(255, 107, 53, 0.8);
              opacity: 1;
            }
          }
        `}
      </style>
    </>
  );
};

export default HighlightOverlay;