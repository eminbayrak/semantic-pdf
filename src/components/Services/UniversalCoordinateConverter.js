/**
 * Universal Coordinate Converter
 * Converts Azure Document Intelligence coordinates to PDF.js canvas coordinates
 * Works with any PDF template by dynamically detecting page dimensions
 */
export class UniversalCoordinateConverter {
  constructor() {
    this.debugMode = true;
  }

  /**
   * Convert Azure bounding region to PDF.js canvas coordinates
   * @param {Object} boundingRegion - Azure bounding region with polygon
   * @param {Object} pdfPage - PDF.js page object
   * @param {Object} viewport - PDF.js viewport
   * @param {number} scale - Current scale factor
   * @returns {Object} Canvas coordinates {x, y, width, height}
   */
  convertBoundingRegion(boundingRegion, pdfPage, viewport, scale = 1) {
    if (!boundingRegion || !boundingRegion.polygon || boundingRegion.polygon.length < 4) {
      console.warn('❌ Invalid bounding region:', boundingRegion);
      return null;
    }

    // Get actual PDF page dimensions from PDF.js
    const pageWidth = pdfPage.view[2] - pdfPage.view[0];  // PDF page width in points
    const pageHeight = pdfPage.view[3] - pdfPage.view[1]; // PDF page height in points
    
    // Azure coordinates - determine if they're normalized (0-1) or inches
    const polygon = boundingRegion.polygon;
    const minX = Math.min(...polygon.map(p => p.x));
    const maxX = Math.max(...polygon.map(p => p.x));
    const minY = Math.min(...polygon.map(p => p.y));
    const maxY = Math.max(...polygon.map(p => p.y));
    
    // Detect coordinate system: if max values are > 1, they're likely in inches
    const isNormalized = maxX <= 1 && maxY <= 1;
    const coordinateUnit = isNormalized ? 'normalized' : 'inches';
    
    let pdfX, pdfY, pdfWidth, pdfHeight;
    
    if (isNormalized) {
      // Azure coordinates are normalized (0-1), convert to PDF points
      pdfX = minX * pageWidth;
      pdfY = minY * pageHeight;
      pdfWidth = (maxX - minX) * pageWidth;
      pdfHeight = (maxY - minY) * pageHeight;
    } else {
      // Azure coordinates are in inches, convert to PDF points
      const dpi = 72;
      pdfX = minX * dpi;
      pdfY = minY * dpi;
      pdfWidth = (maxX - minX) * dpi;
      pdfHeight = (maxY - minY) * dpi;
    }
    
    // Convert PDF points to canvas coordinates
    // Note: PDF.js uses top-left origin, but Azure might use bottom-left
    // Try both coordinate systems to see which one works
    const canvasX = pdfX * scale;
    const canvasY = pdfY * scale;
    const canvasWidth = pdfWidth * scale;
    const canvasHeight = pdfHeight * scale;
    
    // Test: Try without Y-flip first (Azure might use top-left origin)
    const flippedY = (pageHeight - pdfY - pdfHeight) * scale;
    
    // Use original Y coordinate (test if Azure uses top-left origin)
    const finalY = canvasY;
    
    // Clamp to viewport bounds
    const clampedX = Math.max(0, Math.min(canvasX, viewport.width - canvasWidth));
    const clampedY = Math.max(0, Math.min(finalY, viewport.height - canvasHeight));
    const clampedWidth = Math.min(canvasWidth, viewport.width - clampedX);
    const clampedHeight = Math.min(canvasHeight, viewport.height - clampedY);
    
    const result = {
      x: clampedX,
      y: clampedY,
      width: clampedWidth,
      height: clampedHeight,
      // Store original coordinates for debugging
      original: {
        azure: { minX, maxX, minY, maxY },
        pdf: { x: pdfX, y: pdfY, width: pdfWidth, height: pdfHeight },
        page: { width: pageWidth, height: pageHeight }
      }
    };
    
    if (this.debugMode) {
      // Log each property separately to prevent collapsing
      console.log('🔄 Universal coordinate conversion:');
      console.log('  Azure coordinates:', { minX, maxX, minY, maxY, unit: coordinateUnit });
      console.log('  Coordinate system detected:', isNormalized ? 'normalized (0-1)' : 'inches');
      console.log('  Page dimensions (points):', { width: pageWidth, height: pageHeight });
      console.log('  PDF coordinates (points):', { x: pdfX, y: pdfY, width: pdfWidth, height: pdfHeight });
      console.log('  Canvas original (pixels):', { x: canvasX, y: canvasY, width: canvasWidth, height: canvasHeight });
      console.log('  Canvas flipped (pixels):', { x: canvasX, y: flippedY, width: canvasWidth, height: canvasHeight });
      console.log('  Canvas final (pixels):', { x: clampedX, y: clampedY, width: clampedWidth, height: clampedHeight });
      console.log('  Using original Y (no flip) - Azure might use top-left origin');
      console.log('  Viewport (pixels):', { width: viewport.width, height: viewport.height });
      console.log('  Scale:', scale);
      console.log('  Conversion path:', `Azure ${coordinateUnit} → PDF points → Canvas pixels (no Y-flip)`);
    }
    
    return result;
  }

  /**
   * Convert multiple Azure elements to canvas coordinates
   * @param {Array} elements - Array of Azure elements with boundingRegions
   * @param {Object} pdfPage - PDF.js page object
   * @param {Object} viewport - PDF.js viewport
   * @param {number} scale - Current scale factor
   * @returns {Array} Array of converted elements with canvas coordinates
   */
  convertElements(elements, pdfPage, viewport, scale = 1) {
    return elements.map((element, index) => {
      if (!element.boundingRegions || element.boundingRegions.length === 0) {
        return null;
      }
      
      // Use the first bounding region
      const boundingRegion = element.boundingRegions[0];
      const coords = this.convertBoundingRegion(boundingRegion, pdfPage, viewport, scale);
      
      if (!coords) {
        return null;
      }
      
      return {
        ...element,
        canvasCoords: coords,
        elementIndex: index
      };
    }).filter(Boolean);
  }

  /**
   * Group elements by semantic sections using layout analysis
   * @param {Array} elements - Converted elements with canvas coordinates
   * @returns {Object} Grouped elements by section type
   */
  groupElementsBySection(elements) {
    const sections = {
      headers: [],
      tables: [],
      formFields: [],
      financial: [],
      other: []
    };
    
    elements.forEach(element => {
      const coords = element.canvasCoords;
      const content = element.content || '';
      const text = content.toLowerCase();
      
      // Classify by content and position
      if (this.isHeader(element, coords)) {
        sections.headers.push(element);
      } else if (this.isTable(element)) {
        sections.tables.push(element);
      } else if (this.isFormField(element)) {
        sections.formFields.push(element);
      } else if (this.isFinancial(element, text)) {
        sections.financial.push(element);
      } else {
        sections.other.push(element);
      }
    });
    
    return sections;
  }

  /**
   * Check if element is a header (large text, usually at top)
   */
  isHeader(element, coords) {
    const content = element.content || '';
    const text = content.toLowerCase();
    
    // Check for common header patterns
    const headerPatterns = [
      'explanation of benefits',
      'this is not a bill',
      'statement of benefits',
      'claim summary'
    ];
    
    return headerPatterns.some(pattern => text.includes(pattern)) || 
           (coords.height > 20 && coords.y < 100); // Large text near top
  }

  /**
   * Check if element is a table
   */
  isTable(element) {
    return element.type === 'table' || 
           (element.cells && element.cells.length > 0);
  }

  /**
   * Check if element is a form field (label-value pair)
   */
  isFormField(element) {
    const content = element.content || '';
    const text = content.toLowerCase();
    
    // Check for common field patterns
    const fieldPatterns = [
      'name:', 'address:', 'id:', 'date:', 'number:',
      'member:', 'subscriber:', 'patient:', 'group:',
      'claim:', 'policy:', 'account:'
    ];
    
    return fieldPatterns.some(pattern => text.includes(pattern));
  }

  /**
   * Check if element contains financial information
   */
  isFinancial(element, text) {
    const financialPatterns = [
      'total', 'amount', 'payment', 'charge', 'fee',
      'deductible', 'copay', 'coinsurance', 'balance',
      '$', 'paid', 'owed', 'due'
    ];
    
    return financialPatterns.some(pattern => text.includes(pattern)) ||
           /\$[\d,]+\.?\d*/.test(text) || // Dollar amounts
           /\d+\.\d{2}/.test(text); // Decimal numbers
  }

  /**
   * Enable/disable debug logging
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
  }
}

export default UniversalCoordinateConverter;
