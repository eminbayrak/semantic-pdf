/**
 * PDF Coordinate Mapper
 * Maps Azure Document Intelligence coordinates to PDF.js canvas coordinates
 * Provides precise pixel-perfect targeting for PDF elements
 */

/**
 * Converts Azure Document Intelligence coordinates to PDF.js canvas coordinates
 * @param {Object} azureBounds - Azure bounding box {x, y, width, height}
 * @param {Object} pdfViewport - PDF.js viewport object
 * @param {number} scale - PDF scale factor
 * @returns {Object} Canvas coordinates
 */
export const convertAzureToCanvasCoordinates = (azureBounds, pdfViewport, scale) => {
  if (!azureBounds || !pdfViewport) return null;
  
  // Azure coordinates are in PDF coordinate system (bottom-left origin)
  // PDF.js canvas uses top-left origin
  const canvasX = azureBounds.x * scale;
  const canvasY = pdfViewport.height - (azureBounds.y + azureBounds.height) * scale;
  const canvasWidth = azureBounds.width * scale;
  const canvasHeight = azureBounds.height * scale;
  
  return {
    x: canvasX,
    y: canvasY,
    width: canvasWidth,
    height: canvasHeight,
    centerX: canvasX + canvasWidth / 2,
    centerY: canvasY + canvasHeight / 2,
    originalAzure: azureBounds
  };
};

/**
 * Maps Azure Document Intelligence results to precise PDF coordinates
 * @param {Object} azureResults - Azure Document Intelligence results
 * @param {Object} pdfViewport - PDF.js viewport
 * @param {number} scale - PDF scale factor
 * @returns {Object} Mapped coordinates for all elements
 */
export const mapAzureResultsToPDFCoordinates = (azureResults, pdfViewport, scale) => {
  const mappedElements = {};
  
  // Map tables
  if (azureResults.tables && azureResults.tables.length > 0) {
    azureResults.tables.forEach((table, tableIndex) => {
      if (table.boundingRegions && table.boundingRegions.length > 0) {
        const region = table.boundingRegions[0];
        const coords = convertAzureToCanvasCoordinates(region, pdfViewport, scale);
        
        if (coords) {
          mappedElements[`table-${tableIndex}`] = {
            ...coords,
            type: 'table',
            elementId: `table-${tableIndex}`,
            azureData: table
          };
        }
      }
    });
  }
  
  // Map key-value pairs
  if (azureResults.keyValuePairs && azureResults.keyValuePairs.length > 0) {
    azureResults.keyValuePairs.forEach((pair, index) => {
      if (pair.boundingRegions && pair.boundingRegions.length > 0) {
        const region = pair.boundingRegions[0];
        const coords = convertAzureToCanvasCoordinates(region, pdfViewport, scale);
        
        if (coords) {
          const elementId = `field-${pair.key?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || index}`;
          mappedElements[elementId] = {
            ...coords,
            type: 'field',
            elementId,
            key: pair.key,
            value: pair.value,
            azureData: pair
          };
        }
      }
    });
  }
  
  // Map paragraphs
  if (azureResults.paragraphs && azureResults.paragraphs.length > 0) {
    azureResults.paragraphs.forEach((paragraph, index) => {
      if (paragraph.boundingRegions && paragraph.boundingRegions.length > 0) {
        const region = paragraph.boundingRegions[0];
        const coords = convertAzureToCanvasCoordinates(region, pdfViewport, scale);
        
        if (coords) {
          const elementId = `paragraph-${index}`;
          mappedElements[elementId] = {
            ...coords,
            type: 'paragraph',
            elementId,
            content: paragraph.content,
            azureData: paragraph
          };
        }
      }
    });
  }
  
  return mappedElements;
};

/**
 * Creates highlight regions for PDF elements
 * @param {Object} elementCoords - Element coordinates
 * @param {string} highlightType - Type of highlight (border, spotlight, glow)
 * @param {number} padding - Padding around element
 * @returns {Object} Highlight region configuration
 */
export const createHighlightRegion = (elementCoords, highlightType = 'border', padding = 10) => {
  if (!elementCoords) return null;
  
  const { x, y, width, height } = elementCoords;
  
  switch (highlightType) {
    case 'spotlight':
      return {
        type: 'spotlight',
        x: x - padding,
        y: y - padding,
        width: width + (padding * 2),
        height: height + (padding * 2),
        centerX: elementCoords.centerX,
        centerY: elementCoords.centerY,
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
 * Calculates optimal zoom level for element
 * @param {Object} elementCoords - Element coordinates
 * @param {Object} containerSize - Container dimensions
 * @param {number} targetFillRatio - Desired fill ratio (0.1-0.9)
 * @returns {number} Optimal zoom level
 */
export const calculateOptimalZoom = (elementCoords, containerSize, targetFillRatio = 0.6) => {
  if (!elementCoords || !containerSize) return 1.0;
  
  const { width: elementWidth, height: elementHeight } = elementCoords;
  const { width: containerWidth, height: containerHeight } = containerSize;
  
  const elementAspectRatio = elementWidth / elementHeight;
  const containerAspectRatio = containerWidth / containerHeight;
  
  let scaleX, scaleY;
  
  if (elementAspectRatio > containerAspectRatio) {
    // Element is wider, scale based on width
    scaleX = (containerWidth * targetFillRatio) / elementWidth;
    scaleY = scaleX;
  } else {
    // Element is taller, scale based on height
    scaleY = (containerHeight * targetFillRatio) / elementHeight;
    scaleX = scaleY;
  }
  
  return Math.max(0.5, Math.min(3.0, Math.min(scaleX, scaleY)));
};

/**
 * Creates animation sequence for PDF elements
 * @param {Array} narrationSegments - Narration segments with element mappings
 * @param {Object} pdfViewport - PDF viewport
 * @param {number} scale - PDF scale
 * @returns {Array} Animation timeline
 */
export const createPDFAnimationSequence = (narrationSegments, pdfViewport, scale) => {
  const timeline = [];
  let currentTime = 0;
  
  narrationSegments.forEach((segment, index) => {
    const startTime = currentTime;
    const duration = segment.duration || 3; // seconds
    const endTime = startTime + duration;
    
    // Find element coordinates
    const elementCoords = segment.elementCoords;
    if (!elementCoords) return;
    
    // Calculate zoom level
    const zoomLevel = segment.zoomLevel || 2.0;
    
    // Create animation keyframes
    const keyframes = {
      start: {
        time: startTime,
        scale: 1.0,
        translateX: 0,
        translateY: 0,
        opacity: 0
      },
      focus: {
        time: startTime + 0.5,
        scale: zoomLevel,
        translateX: pdfViewport.width / 2 - elementCoords.centerX,
        translateY: pdfViewport.height / 2 - elementCoords.centerY,
        opacity: 1
      },
      end: {
        time: endTime - 0.5,
        scale: zoomLevel,
        translateX: pdfViewport.width / 2 - elementCoords.centerX,
        translateY: pdfViewport.height / 2 - elementCoords.centerY,
        opacity: 1
      },
      exit: {
        time: endTime,
        scale: 1.0,
        translateX: 0,
        translateY: 0,
        opacity: 0
      }
    };
    
    timeline.push({
      id: `pdf-animation-${index}`,
      elementId: segment.elementId,
      elementCoords,
      startTime,
      endTime,
      duration,
      keyframes,
      highlightType: segment.highlightType || 'border',
      phrase: segment.phrase,
      confidence: segment.confidence || 0.8
    });
    
    currentTime = endTime;
  });
  
  return timeline;
};

/**
 * Validates PDF coordinates
 * @param {Object} coords - Coordinates to validate
 * @param {Object} pdfViewport - PDF viewport
 * @returns {Object} Validation result
 */
export const validatePDFCoordinates = (coords, pdfViewport) => {
  if (!coords || !pdfViewport) {
    return { isValid: false, errors: ['Missing coordinates or viewport'] };
  }
  
  const errors = [];
  const warnings = [];
  
  // Check bounds
  if (coords.x < 0 || coords.x > pdfViewport.width) {
    errors.push(`X coordinate ${coords.x} is outside viewport bounds (0-${pdfViewport.width})`);
  }
  
  if (coords.y < 0 || coords.y > pdfViewport.height) {
    errors.push(`Y coordinate ${coords.y} is outside viewport bounds (0-${pdfViewport.height})`);
  }
  
  if (coords.width <= 0 || coords.height <= 0) {
    errors.push('Width and height must be positive');
  }
  
  // Check if element is too small
  if (coords.width < 10 || coords.height < 10) {
    warnings.push('Element is very small, may be difficult to highlight');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

export default {
  convertAzureToCanvasCoordinates,
  mapAzureResultsToPDFCoordinates,
  createHighlightRegion,
  calculateOptimalZoom,
  createPDFAnimationSequence,
  validatePDFCoordinates
};
