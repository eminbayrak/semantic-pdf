export class CoordinateMapper {
  constructor() {
    this.coordinateCache = new Map();
    this.scaleFactor = 1.0;
    this.containerBounds = { x: 0, y: 0, width: 0, height: 0 };
  }

  // Get precise element coordinates for video positioning
  getElementBounds(elementId, containerRef) {
    if (this.coordinateCache.has(elementId)) {
      return this.coordinateCache.get(elementId);
    }

    const element = document.getElementById(elementId);
    if (!element) {
      console.warn(`Element with ID ${elementId} not found`);
      return null;
    }

    const container = containerRef?.current || document.body;
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    const bounds = {
      x: elementRect.left - containerRect.left,
      y: elementRect.top - containerRect.top,
      width: elementRect.width,
      height: elementRect.height,
      centerX: elementRect.left - containerRect.left + elementRect.width / 2,
      centerY: elementRect.top - containerRect.top + elementRect.height / 2,
      pageX: elementRect.left,
      pageY: elementRect.top,
      pageWidth: elementRect.width,
      pageHeight: elementRect.height
    };

    // Cache the result
    this.coordinateCache.set(elementId, bounds);
    return bounds;
  }

  // Get element bounds with zoom and pan transformations applied
  getTransformedBounds(elementId, containerRef, zoomLevel = 1.0, panX = 0, panY = 0) {
    const bounds = this.getElementBounds(elementId, containerRef);
    if (!bounds) return null;

    return {
      ...bounds,
      x: (bounds.x - panX) * zoomLevel,
      y: (bounds.y - panY) * zoomLevel,
      width: bounds.width * zoomLevel,
      height: bounds.height * zoomLevel,
      centerX: (bounds.centerX - panX) * zoomLevel,
      centerY: (bounds.centerY - panY) * zoomLevel
    };
  }

  // Calculate optimal zoom and pan to focus on an element
  calculateOptimalViewport(elementId, containerRef, targetZoomLevel = 2.0) {
    const bounds = this.getElementBounds(elementId, containerRef);
    if (!bounds) return null;

    const container = containerRef?.current || document.body;
    const containerRect = container.getBoundingClientRect();
    
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    // Calculate center point for the element
    const elementCenterX = bounds.centerX;
    const elementCenterY = bounds.centerY;

    // Calculate pan offset to center the element
    const panX = elementCenterX - containerWidth / 2;
    const panY = elementCenterY - containerHeight / 2;

    // Ensure element fits within viewport
    const maxZoomX = containerWidth / bounds.width;
    const maxZoomY = containerHeight / bounds.height;
    const maxZoom = Math.min(maxZoomX, maxZoomY, targetZoomLevel);

    return {
      zoomLevel: maxZoom,
      panX: panX,
      panY: panY,
      elementBounds: bounds,
      viewportBounds: {
        x: panX,
        y: panY,
        width: containerWidth,
        height: containerHeight
      }
    };
  }

  // Calculate smooth transition between two viewport states
  calculateTransition(startViewport, endViewport, duration = 1.0, frameRate = 30) {
    const totalFrames = Math.floor(duration * frameRate);
    const frames = [];

    for (let frame = 0; frame <= totalFrames; frame++) {
      const progress = frame / totalFrames;
      const easedProgress = this.easeInOutCubic(progress);

      const currentViewport = {
        zoomLevel: this.lerp(startViewport.zoomLevel, endViewport.zoomLevel, easedProgress),
        panX: this.lerp(startViewport.panX, endViewport.panX, easedProgress),
        panY: this.lerp(startViewport.panY, endViewport.panY, easedProgress)
      };

      frames.push({
        frame,
        viewport: currentViewport,
        progress: easedProgress
      });
    }

    return frames;
  }

  // Linear interpolation
  lerp(start, end, progress) {
    return start + (end - start) * progress;
  }

  // Easing function for smooth transitions
  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // Convert screen coordinates to video coordinates
  screenToVideo(screenX, screenY, videoWidth, videoHeight, containerRef) {
    const container = containerRef?.current || document.body;
    const containerRect = container.getBoundingClientRect();
    
    const scaleX = videoWidth / containerRect.width;
    const scaleY = videoHeight / containerRect.height;
    
    return {
      x: (screenX - containerRect.left) * scaleX,
      y: (screenY - containerRect.top) * scaleY
    };
  }

  // Convert video coordinates to screen coordinates
  videoToScreen(videoX, videoY, videoWidth, videoHeight, containerRef) {
    const container = containerRef?.current || document.body;
    const containerRect = container.getBoundingClientRect();
    
    const scaleX = containerRect.width / videoWidth;
    const scaleY = containerRect.height / videoHeight;
    
    return {
      x: videoX * scaleX + containerRect.left,
      y: videoY * scaleY + containerRect.top
    };
  }

  // Get all visible elements within a viewport
  getVisibleElements(viewport, containerRef) {
    const container = containerRef?.current || document.body;
    const elements = container.querySelectorAll('[id]');
    const visibleElements = [];

    for (const element of elements) {
      const bounds = this.getElementBounds(element.id, containerRef);
      if (!bounds) continue;

      // Check if element intersects with viewport
      const isVisible = this.rectIntersects(bounds, viewport);
      
      if (isVisible) {
        visibleElements.push({
          id: element.id,
          bounds: bounds,
          element: element
        });
      }
    }

    return visibleElements;
  }

  // Check if two rectangles intersect
  rectIntersects(rect1, rect2) {
    return !(rect1.x + rect1.width < rect2.x || 
             rect2.x + rect2.width < rect1.x || 
             rect1.y + rect1.height < rect2.y || 
             rect2.y + rect2.height < rect1.y);
  }

  // Calculate element importance for focus decisions
  calculateElementImportance(elementId, containerRef) {
    const element = document.getElementById(elementId);
    if (!element) return 0;

    const bounds = this.getElementBounds(elementId, containerRef);
    if (!bounds) return 0;

    let importance = 0;

    // Size factor (larger elements are more important)
    const area = bounds.width * bounds.height;
    importance += Math.log(area + 1) * 10;

    // Content factor (elements with more text are more important)
    const textContent = element.textContent || '';
    const wordCount = textContent.split(/\s+/).length;
    importance += wordCount * 2;

    // Semantic factor (certain element types are more important)
    const tagName = element.tagName.toLowerCase();
    const semanticWeights = {
      'h1': 50, 'h2': 40, 'h3': 30, 'h4': 20, 'h5': 15, 'h6': 10,
      'table': 30, 'tr': 20, 'td': 10,
      'div': 5, 'span': 3, 'p': 8
    };
    importance += semanticWeights[tagName] || 1;

    // ID factor (elements with semantic IDs are more important)
    if (elementId.includes('header') || elementId.includes('summary')) {
      importance += 25;
    } else if (elementId.includes('field') || elementId.includes('amount')) {
      importance += 15;
    }

    return importance;
  }

  // Clear coordinate cache
  clearCache() {
    this.coordinateCache.clear();
  }

  // Update container bounds
  updateContainerBounds(containerRef) {
    const container = containerRef?.current || document.body;
    const rect = container.getBoundingClientRect();
    
    this.containerBounds = {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    };
  }

  // Get viewport bounds for a given zoom and pan
  getViewportBounds(zoomLevel, panX, panY, containerRef) {
    const container = containerRef?.current || document.body;
    const rect = container.getBoundingClientRect();
    
    return {
      x: -panX / zoomLevel,
      y: -panY / zoomLevel,
      width: rect.width / zoomLevel,
      height: rect.height / zoomLevel
    };
  }

  // Check if an element is within the current viewport
  isElementInViewport(elementId, zoomLevel, panX, panY, containerRef) {
    const bounds = this.getElementBounds(elementId, containerRef);
    if (!bounds) return false;

    const viewport = this.getViewportBounds(zoomLevel, panX, panY, containerRef);
    return this.rectIntersects(bounds, viewport);
  }
}
