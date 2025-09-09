// Animation utility functions for Remotion video presentations

export const AnimationHelpers = {
  // Easing functions
  easing: {
    linear: (t) => t,
    easeIn: (t) => t * t,
    easeOut: (t) => 1 - Math.pow(1 - t, 2),
    easeInOut: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    easeInCubic: (t) => t * t * t,
    easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
    easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    easeInQuart: (t) => t * t * t * t,
    easeOutQuart: (t) => 1 - Math.pow(1 - t, 4),
    easeInOutQuart: (t) => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,
    easeInBack: (t) => 2.7 * t * t * t - 1.7 * t * t,
    easeOutBack: (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2),
    easeInOutBack: (t) => t < 0.5 
      ? (2 * t) * (2 * t) * (3.5 * (2 * t) - 2.5) / 2
      : ((2 * t - 2) * (2 * t - 2) * (3.5 * (2 * t - 2) + 2.5) + 2) / 2,
    easeInElastic: (t) => t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * (2 * Math.PI) / 3),
    easeOutElastic: (t) => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1,
    easeInOutElastic: (t) => t === 0 ? 0 : t === 1 ? 1 : t < 0.5 
      ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * (2 * Math.PI) / 4.5)) / 2
      : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * (2 * Math.PI) / 4.5)) / 2 + 1
  },

  // Interpolation helpers
  interpolate: {
    // Linear interpolation
    lerp: (start, end, progress) => start + (end - start) * progress,
    
    // Interpolate between multiple values
    lerpArray: (values, progress) => {
      if (values.length === 0) return 0;
      if (values.length === 1) return values[0];
      
      const scaledProgress = progress * (values.length - 1);
      const index = Math.floor(scaledProgress);
      const localProgress = scaledProgress - index;
      
      if (index >= values.length - 1) return values[values.length - 1];
      
      return this.lerp(values[index], values[index + 1], localProgress);
    },
    
    // Interpolate with easing
    lerpEased: (start, end, progress, easing = 'easeInOut') => {
      const easedProgress = AnimationHelpers.easing[easing](progress);
      return AnimationHelpers.interpolate.lerp(start, end, easedProgress);
    }
  },

  // Frame-based animation helpers
  frame: {
    // Convert seconds to frames
    secondsToFrames: (seconds, fps = 30) => Math.floor(seconds * fps),
    
    // Convert frames to seconds
    framesToSeconds: (frames, fps = 30) => frames / fps,
    
    // Get current time in seconds from frame
    getCurrentTime: (frame, fps = 30) => frame / fps,
    
    // Calculate duration between two frames
    getDuration: (startFrame, endFrame, fps = 30) => (endFrame - startFrame) / fps
  },

  // Zoom and pan animations
  viewport: {
    // Calculate smooth zoom transition
    calculateZoomTransition: (startZoom, endZoom, progress, easing = 'easeInOut') => {
      return AnimationHelpers.interpolate.lerpEased(startZoom, endZoom, progress, easing);
    },
    
    // Calculate smooth pan transition
    calculatePanTransition: (startPan, endPan, progress, easing = 'easeInOut') => {
      return {
        x: AnimationHelpers.interpolate.lerpEased(startPan.x, endPan.x, progress, easing),
        y: AnimationHelpers.interpolate.lerpEased(startPan.y, endPan.y, progress, easing)
      };
    },
    
    // Calculate optimal zoom level for element
    calculateOptimalZoom: (elementBounds, containerBounds, maxZoom = 3.0) => {
      const scaleX = containerBounds.width / elementBounds.width;
      const scaleY = containerBounds.height / elementBounds.height;
      const optimalScale = Math.min(scaleX, scaleY, maxZoom);
      
      return Math.max(1.0, optimalScale);
    },
    
    // Calculate center point for element
    calculateCenterPoint: (elementBounds, containerBounds) => {
      return {
        x: elementBounds.centerX - containerBounds.width / 2,
        y: elementBounds.centerY - containerBounds.height / 2
      };
    }
  },

  // Highlight animations
  highlight: {
    // Calculate highlight opacity based on frame
    calculateOpacity: (frame, startFrame, duration, fadeInDuration = 0.5, fadeOutDuration = 0.5) => {
      const relativeFrame = frame - startFrame;
      const totalDuration = duration;
      const fadeInFrames = fadeInDuration * 30; // Assuming 30fps
      const fadeOutFrames = fadeOutDuration * 30;
      
      if (relativeFrame < 0) return 0;
      if (relativeFrame < fadeInFrames) {
        return relativeFrame / fadeInFrames;
      }
      if (relativeFrame < totalDuration - fadeOutFrames) {
        return 1;
      }
      if (relativeFrame < totalDuration) {
        return (totalDuration - relativeFrame) / fadeOutFrames;
      }
      return 0;
    },
    
    // Calculate pulse scale
    calculatePulseScale: (frame, startFrame, pulseDuration = 2.0, minScale = 1.0, maxScale = 1.1) => {
      const relativeFrame = frame - startFrame;
      const pulseFrames = pulseDuration * 30; // Assuming 30fps
      
      if (relativeFrame < 0) return minScale;
      
      const cycleProgress = (relativeFrame % pulseFrames) / pulseFrames;
      const pulseProgress = Math.sin(cycleProgress * Math.PI * 2);
      
      return minScale + (maxScale - minScale) * (pulseProgress + 1) / 2;
    },
    
    // Calculate spotlight radius
    calculateSpotlightRadius: (elementBounds, zoomLevel, baseRadius = 100) => {
      const elementSize = Math.max(elementBounds.width, elementBounds.height);
      return baseRadius + elementSize * zoomLevel * 0.5;
    }
  },

  // Audio synchronization helpers
  audio: {
    // Calculate frame offset for audio sync
    calculateAudioOffset: (audioStartTime, videoStartTime, fps = 30) => {
      const offsetSeconds = audioStartTime - videoStartTime;
      return Math.floor(offsetSeconds * fps);
    },
    
    // Calculate audio timing for section
    calculateSectionTiming: (section, totalDuration, fps = 30) => {
      const startTime = section.startFrame / fps;
      const endTime = section.endFrame / fps;
      const duration = endTime - startTime;
      
      return {
        startTime,
        endTime,
        duration,
        startFrame: section.startFrame,
        endFrame: section.endFrame
      };
    }
  },

  // Transition helpers
  transition: {
    // Calculate crossfade between two elements
    calculateCrossfade: (frame, startFrame, duration, fadeDuration = 0.5) => {
      const relativeFrame = frame - startFrame;
      const fadeFrames = fadeDuration * 30; // Assuming 30fps
      
      if (relativeFrame < 0) return { in: 0, out: 1 };
      if (relativeFrame < fadeFrames) {
        const progress = relativeFrame / fadeFrames;
        return { in: progress, out: 1 - progress };
      }
      if (relativeFrame < duration - fadeFrames) {
        return { in: 1, out: 0 };
      }
      if (relativeFrame < duration) {
        const progress = (relativeFrame - (duration - fadeFrames)) / fadeFrames;
        return { in: 1 - progress, out: progress };
      }
      return { in: 0, out: 1 };
    },
    
    // Calculate slide transition
    calculateSlideTransition: (frame, startFrame, duration, direction = 'right', easing = 'easeInOut') => {
      const relativeFrame = frame - startFrame;
      const progress = Math.min(relativeFrame / (duration * 30), 1); // Assuming 30fps
      const easedProgress = AnimationHelpers.easing[easing](progress);
      
      const directions = {
        right: { x: 100, y: 0 },
        left: { x: -100, y: 0 },
        up: { x: 0, y: -100 },
        down: { x: 0, y: 100 }
      };
      
      const offset = directions[direction] || directions.right;
      
      return {
        x: offset.x * (1 - easedProgress),
        y: offset.y * (1 - easedProgress),
        opacity: easedProgress
      };
    }
  },

  // Performance helpers
  performance: {
    // Throttle function calls
    throttle: (func, limit) => {
      let inThrottle;
      return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
          func.apply(context, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    },
    
    // Debounce function calls
    debounce: (func, delay) => {
      let timeoutId;
      return function() {
        const args = arguments;
        const context = this;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(context, args), delay);
      };
    },
    
    // Memoize expensive calculations
    memoize: (func) => {
      const cache = new Map();
      return function() {
        const key = JSON.stringify(arguments);
        if (cache.has(key)) {
          return cache.get(key);
        }
        const result = func.apply(this, arguments);
        cache.set(key, result);
        return result;
      };
    }
  }
};

// Export individual helpers for easier importing
export const {
  easing,
  interpolate,
  frame,
  viewport,
  highlight,
  audio,
  transition,
  performance
} = AnimationHelpers;
