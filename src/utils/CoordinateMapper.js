/**
 * Coordinate Mapper Utility
 * Handles precise positioning and animation calculations for video presentations
 */

/**
 * Gets precise element bounds for video targeting
 * @param {string} elementId - The ID of the element to target
 * @param {React.RefObject} containerRef - Reference to the container element
 * @returns {Object|null} Element bounds or null if not found
 */
export const getElementBounds = (elementId, containerRef) => {
  if (!containerRef?.current) {
    console.warn('Container ref not available');
    return null;
  }
  
  const element = containerRef.current.querySelector(`#${elementId}`);
  if (!element) {
    console.warn(`Element with ID "${elementId}" not found`);
    return null;
  }
  
  const rect = element.getBoundingClientRect();
  const containerRect = containerRef.current.getBoundingClientRect();
  
  return {
    x: rect.left - containerRect.left,
    y: rect.top - containerRect.top,
    width: rect.width,
    height: rect.height,
    centerX: rect.left - containerRect.left + rect.width / 2,
    centerY: rect.top - containerRect.top + rect.height / 2,
    elementId: elementId,
    element: element
  };
};

/**
 * Calculates transform values for centering and zooming
 * @param {Object} targetBounds - Target element bounds
 * @param {Object} videoSize - Video dimensions {width, height}
 * @param {number} zoomLevel - Zoom level (1.0-3.0)
 * @returns {Object} Transform values for CSS
 */
export const calculateTransform = (targetBounds, videoSize, zoomLevel = 2.0) => {
  if (!targetBounds || !videoSize) {
    return { scale: 1, translateX: 0, translateY: 0 };
  }
  
  const { centerX, centerY, width, height } = targetBounds;
  const { width: videoWidth, height: videoHeight } = videoSize;
  
  // Calculate scale based on zoom level
  const scale = Math.max(0.5, Math.min(3.0, zoomLevel));
  
  // Calculate translation to center the element
  const translateX = videoWidth / 2 - centerX;
  const translateY = videoHeight / 2 - centerY;
  
  // Apply scale compensation to translation
  const scaledTranslateX = translateX * scale;
  const scaledTranslateY = translateY * scale;
  
  return {
    scale,
    translateX: scaledTranslateX,
    translateY: scaledTranslateY,
    centerX,
    centerY,
    originalWidth: width,
    originalHeight: height
  };
};

/**
 * Creates smooth animation sequence for Remotion
 * @param {Array} sections - Array of section mappings from GPT
 * @param {Object} videoConfig - Video configuration
 * @returns {Array} Animation timeline
 */
export const createAnimationSequence = (sections, videoConfig = {}) => {
  const {
    width = 1920,
    height = 1080,
    fps = 30
  } = videoConfig;
  
  const timeline = [];
  let currentFrame = 0;
  
  sections.forEach((section, index) => {
    const startFrame = currentFrame;
    const duration = section.duration || 90; // 3 seconds at 30fps
    const endFrame = startFrame + duration;
    
    // Create animation keyframes
    const keyframes = {
      start: {
        frame: startFrame,
        scale: 1.0,
        translateX: 0,
        translateY: 0,
        opacity: 0
      },
      focus: {
        frame: startFrame + 15, // 0.5 second transition
        scale: section.zoomLevel || 2.0,
        translateX: 0, // Will be calculated based on element position
        translateY: 0, // Will be calculated based on element position
        opacity: 1
      },
      end: {
        frame: endFrame - 15, // 0.5 second transition out
        scale: section.zoomLevel || 2.0,
        translateX: 0,
        translateY: 0,
        opacity: 1
      },
      exit: {
        frame: endFrame,
        scale: 1.0,
        translateX: 0,
        translateY: 0,
        opacity: 0
      }
    };
    
    timeline.push({
      id: `animation-${index}`,
      elementId: section.elementId,
      startFrame,
      endFrame,
      duration,
      keyframes,
      highlightType: section.highlightType || 'border',
      transitionType: section.transitionType || 'smooth',
      phrase: section.phrase,
      confidence: section.confidence || 0.8
    });
    
    currentFrame = endFrame;
  });
  
  return timeline;
};

/**
 * Interpolates between two values for smooth animation
 * @param {number} startValue - Starting value
 * @param {number} endValue - Ending value
 * @param {number} progress - Progress (0-1)
 * @param {string} easing - Easing function name
 * @returns {number} Interpolated value
 */
export const interpolate = (startValue, endValue, progress, easing = 'easeInOut') => {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  
  let easedProgress;
  switch (easing) {
    case 'easeIn':
      easedProgress = clampedProgress * clampedProgress;
      break;
    case 'easeOut':
      easedProgress = 1 - Math.pow(1 - clampedProgress, 2);
      break;
    case 'easeInOut':
      easedProgress = clampedProgress < 0.5 
        ? 2 * clampedProgress * clampedProgress
        : 1 - Math.pow(-2 * clampedProgress + 2, 2) / 2;
      break;
    case 'linear':
    default:
      easedProgress = clampedProgress;
      break;
  }
  
  return startValue + (endValue - startValue) * easedProgress;
};

/**
 * Calculates highlight overlay dimensions and position
 * @param {Object} elementBounds - Target element bounds
 * @param {string} highlightType - Type of highlight (border, spotlight, glow)
 * @param {number} padding - Padding around element
 * @returns {Object} Highlight overlay properties
 */
export const calculateHighlightOverlay = (elementBounds, highlightType = 'border', padding = 10) => {
  if (!elementBounds) return null;
  
  const { x, y, width, height } = elementBounds;
  
  switch (highlightType) {
    case 'spotlight':
      return {
        type: 'spotlight',
        x: x - padding,
        y: y - padding,
        width: width + (padding * 2),
        height: height + (padding * 2),
        centerX: x + width / 2,
        centerY: y + height / 2,
        radius: Math.max(width, height) / 2 + padding
      };
      
    case 'glow':
      return {
        type: 'glow',
        x: x - padding,
        y: y - padding,
        width: width + (padding * 2),
        height: height + (padding * 2),
        blur: 8,
        spread: 4
      };
      
    case 'border':
    default:
      return {
        type: 'border',
        x: x - padding,
        y: y - padding,
        width: width + (padding * 2),
        height: height + (padding * 2),
        borderWidth: 3,
        borderRadius: 8
      };
  }
};

/**
 * Validates coordinate calculations
 * @param {Object} transform - Transform values
 * @param {Object} videoSize - Video dimensions
 * @returns {Object} Validation result
 */
export const validateTransform = (transform, videoSize) => {
  const { scale, translateX, translateY } = transform;
  const { width, height } = videoSize;
  
  const errors = [];
  const warnings = [];
  
  // Check scale bounds
  if (scale < 0.1 || scale > 5.0) {
    errors.push(`Scale ${scale} is outside acceptable range (0.1-5.0)`);
  }
  
  // Check translation bounds (with some tolerance)
  const maxTranslateX = width * 2;
  const maxTranslateY = height * 2;
  
  if (Math.abs(translateX) > maxTranslateX) {
    warnings.push(`TranslateX ${translateX} is very large, may cause positioning issues`);
  }
  
  if (Math.abs(translateY) > maxTranslateY) {
    warnings.push(`TranslateY ${translateY} is very large, may cause positioning issues`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Creates smooth transition between two elements
 * @param {Object} fromElement - Source element bounds
 * @param {Object} toElement - Target element bounds
 * @param {number} duration - Transition duration in frames
 * @returns {Array} Transition keyframes
 */
export const createElementTransition = (fromElement, toElement, duration = 30) => {
  if (!fromElement || !toElement) return [];
  
  const keyframes = [];
  const steps = Math.max(10, duration / 3); // At least 10 steps
  
  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    const easedProgress = interpolate(0, 1, progress, 'easeInOut');
    
    keyframes.push({
      frame: Math.round(progress * duration),
      scale: interpolate(1, 1, easedProgress), // Keep scale constant during transition
      translateX: interpolate(fromElement.centerX, toElement.centerX, easedProgress),
      translateY: interpolate(fromElement.centerY, toElement.centerY, easedProgress),
      opacity: 1
    });
  }
  
  return keyframes;
};

/**
 * Calculates optimal zoom level based on element size
 * @param {Object} elementBounds - Element bounds
 * @param {Object} videoSize - Video dimensions
 * @param {number} targetFillRatio - Desired fill ratio (0.1-0.9)
 * @returns {number} Optimal zoom level
 */
export const calculateOptimalZoom = (elementBounds, videoSize, targetFillRatio = 0.6) => {
  if (!elementBounds || !videoSize) return 1.0;
  
  const { width: elementWidth, height: elementHeight } = elementBounds;
  const { width: videoWidth, height: videoHeight } = videoSize;
  
  const elementAspectRatio = elementWidth / elementHeight;
  const videoAspectRatio = videoWidth / videoHeight;
  
  let scaleX, scaleY;
  
  if (elementAspectRatio > videoAspectRatio) {
    // Element is wider, scale based on width
    scaleX = (videoWidth * targetFillRatio) / elementWidth;
    scaleY = scaleX;
  } else {
    // Element is taller, scale based on height
    scaleY = (videoHeight * targetFillRatio) / elementHeight;
    scaleX = scaleY;
  }
  
  return Math.max(0.5, Math.min(3.0, Math.min(scaleX, scaleY)));
};

export default {
  getElementBounds,
  calculateTransform,
  createAnimationSequence,
  interpolate,
  calculateHighlightOverlay,
  validateTransform,
  createElementTransition,
  calculateOptimalZoom
};