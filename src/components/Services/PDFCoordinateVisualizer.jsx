import React, { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import AzureDocumentIntelligence from './AzureDocumentIntelligence';
import SemanticSectionGrouper from './SemanticSectionGrouper';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';

/**
 * PDF Coordinate Visualizer Component
 * Displays PDF with highlight boxes overlaid using Azure Document Intelligence coordinates
 */
const PDFCoordinateVisualizer = () => {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [coordinates, setCoordinates] = useState(null);
  const [groupedSections, setGroupedSections] = useState(null);
  const [scale, setScale] = useState(1.0);
  const [showHighlights, setShowHighlights] = useState(true);
  const [highlightType, setHighlightType] = useState('sections'); // 'sections', 'granular', 'tables', 'keyValuePairs', 'paragraphs'
  const [selectedElement, setSelectedElement] = useState(null);
  const [selectedSection, setSelectedSection] = useState('all');
  const [highlightSpecificText, setHighlightSpecificText] = useState(false);
  const [targetText, setTargetText] = useState('this is not a bill');
  const [sectionGrouper] = useState(new SemanticSectionGrouper());
  
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load PDF and extract coordinates
  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      setError('Please select a valid PDF file');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setCoordinates(null);
    setSelectedElement(null);

    try {
      // Load PDF document for display
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      setPdfDocument(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
      setPdfFile(file);

      // Load first page for display
      await loadPage(pdf, 1);

      // Extract coordinates using Azure Document Intelligence
      // Read the file again to get a fresh ArrayBuffer
      const fileBuffer = await file.arrayBuffer();
      const pdfBuffer = new Uint8Array(fileBuffer);
      const azureService = new AzureDocumentIntelligence();
      const analysisResult = await azureService.analyzeDocument(pdfBuffer);
      const extractedCoordinates = azureService.extractCoordinates(analysisResult);
      
      setCoordinates(extractedCoordinates);
      
      // Group elements into semantic sections
      const sections = sectionGrouper.groupIntoSections(extractedCoordinates);
      setGroupedSections(sections);
      
      // Log section statistics
      const stats = sectionGrouper.getSectionStatistics(sections);
      console.log('📊 PDF Analysis Complete!');
      console.log(`📄 Pages: ${extractedCoordinates.pages.length}`);
      console.log(`📋 Tables: ${extractedCoordinates.tables.length}`);
      console.log(`🔑 Key-Value Pairs: ${extractedCoordinates.keyValuePairs.length}`);
      console.log(`📝 Paragraphs: ${extractedCoordinates.paragraphs.length}`);
      console.log(`🎯 Sections Found: ${stats.sectionsWithElements}/${stats.totalSections}`);
      console.log(`📦 Total Elements Grouped: ${stats.totalElements}`);
      
      // Log each section with element count
      Object.keys(sections).forEach(sectionKey => {
        const section = sections[sectionKey];
        if (section.elements.length > 0) {
          console.log(`  ✅ ${section.name}: ${section.elements.length} elements`);
        }
      });
      
    } catch (err) {
      console.error('Error processing PDF:', err);
      setError(`Error processing PDF: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Load specific page
  const loadPage = async (pdf, pageNumber) => {
    try {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // Log PDF dimensions for debugging
      console.log('📐 PDF Dimensions:', {
        pageNumber: pageNumber,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        scale: scale,
        pageInfo: {
          width: page.view[2] - page.view[0],
          height: page.view[3] - page.view[1]
        }
      });
      
      // Render PDF page
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      setCurrentPage(pageNumber);
      
    } catch (err) {
      console.error('Error loading page:', err);
      setError(`Error loading page ${pageNumber}: ${err.message}`);
    }
  };

  // Convert Azure coordinates to canvas coordinates
  const convertToCanvasCoordinates = (polygon, canvasViewport) => {
    if (!polygon || polygon.length < 4) {
      console.log('❌ Invalid polygon for coordinate conversion:', polygon);
      return null;
    }
    
    // Azure coordinates are in inches, PDF.js uses points (1/72 inch)
    const minX = Math.min(...polygon.map(p => p.x));
    const maxX = Math.max(...polygon.map(p => p.x));
    const minY = Math.min(...polygon.map(p => p.y));
    const maxY = Math.max(...polygon.map(p => p.y));
    
    // Convert inches to points (1 inch = 72 points)
    const dpi = 72;
    const pointsX = minX * dpi;
    const pointsY = minY * dpi;
    const pointsWidth = (maxX - minX) * dpi;
    const pointsHeight = (maxY - minY) * dpi;
    
    // Get the actual page height from Azure (assuming 14 inches = 1008 points)
    // This is the key fix - use the actual page height instead of canvas height
    const pageHeightInches = 14; // Standard letter size height
    const pageHeightPoints = pageHeightInches * dpi; // 1008 points
    
    // Convert to canvas coordinates
    // Let's try both coordinate systems to see which one works
    // Option 1: Azure uses bottom-left origin (current assumption)
    const canvasX_bottom = pointsX * scale;
    const canvasY_bottom = (pageHeightPoints - pointsY - pointsHeight) * scale;
    
    // Option 2: Azure uses top-left origin (alternative)
    const canvasX_top = pointsX * scale;
    const canvasY_top = pointsY * scale;
    
    // Use the top-left origin approach for now
    const canvasX = canvasX_top;
    const canvasY = canvasY_top;
    const canvasWidth = pointsWidth * scale;
    const canvasHeight = pointsHeight * scale;
    
    // Clamp coordinates to viewport bounds
    const clampedX = Math.max(0, Math.min(canvasX, canvasViewport.width - canvasWidth));
    const clampedY = Math.max(0, Math.min(canvasY, canvasViewport.height - canvasHeight));
    const clampedWidth = Math.min(canvasWidth, canvasViewport.width - clampedX);
    const clampedHeight = Math.min(canvasHeight, canvasViewport.height - clampedY);
    
    const result = {
      x: clampedX,
      y: clampedY,
      width: clampedWidth,
      height: clampedHeight
    };
    
    // Debug logging for coordinate conversion
    console.log('🔄 Coordinate conversion:', {
      azureCoords: { minX, maxX, minY, maxY },
      pointsCoords: { x: pointsX, y: pointsY, width: pointsWidth, height: pointsHeight },
      pageHeight: { inches: pageHeightInches, points: pageHeightPoints },
      canvasViewport: { width: canvasViewport.width, height: canvasViewport.height },
      scale: scale,
      bottomOrigin: { x: canvasX_bottom, y: canvasY_bottom },
      topOrigin: { x: canvasX_top, y: canvasY_top },
      selected: 'topOrigin',
      finalCoords: result
    });
    
    return result;
  };

  // Filter elements by specific text content
  const filterElementsByText = (elements, targetText) => {
    if (!targetText) return elements;
    
    const targetLower = targetText.toLowerCase();
    return elements.filter(element => {
      const content = element.content || element.text || '';
      return content.toLowerCase().includes(targetLower);
    });
  };

  // Render highlight boxes
  const renderHighlights = () => {
    if (!showHighlights) return null;

    const highlights = [];
    const canvas = canvasRef.current;
    if (!canvas) return highlights;

    const viewport = { width: canvas.width, height: canvas.height };

    // Render semantic sections
    if (highlightType === 'sections' && groupedSections) {
      console.log(`🎯 Rendering highlights for: ${selectedSection === 'all' ? 'All Sections' : selectedSection}`);
      
      Object.keys(groupedSections).forEach(sectionKey => {
        const section = groupedSections[sectionKey];
        
        // Filter by selected section
        if (selectedSection !== 'all' && sectionKey !== selectedSection) {
          return;
        }
        
        if (section.elements.length > 0) {
          console.log(`📍 Processing section: ${section.name} (${section.elements.length} elements)`);
          
          // Apply text filtering if enabled
          let elementsToProcess = section.elements;
          if (highlightSpecificText && targetText) {
            elementsToProcess = filterElementsByText(section.elements, targetText);
            console.log(`🔍 Filtered to ${elementsToProcess.length} elements containing "${targetText}"`);
          }
          
          // Only proceed if we have elements after filtering
          if (elementsToProcess.length === 0) {
            return;
          }
          
          // Render main section bounding box
          if (section.boundingBox) {
            const coords = convertToCanvasCoordinates(section.boundingBox.polygon, viewport);
            
            if (coords && coords.width > 0 && coords.height > 0) {
              highlights.push({
                id: `section-${sectionKey}`,
                type: 'section',
                coords,
                content: `${section.name} (${elementsToProcess.length} elements)`,
                color: section.color,
                sectionKey,
                elementCount: elementsToProcess.length,
                isMainSection: true
              });
              console.log(`✅ Added main section highlight: ${section.name} at (${coords.x.toFixed(1)}, ${coords.y.toFixed(1)}) size ${coords.width.toFixed(1)}x${coords.height.toFixed(1)}`);
            }
          }

          // Render sub-sections for better spatial accuracy
          if (section.subSections && section.subSections.length > 1) {
            console.log(`  📦 Creating ${section.subSections.length} sub-sections`);
            section.subSections.forEach((subSection, subIndex) => {
              if (subSection.boundingBox) {
                const coords = convertToCanvasCoordinates(subSection.boundingBox.polygon, viewport);
                
                if (coords && coords.width > 0 && coords.height > 0) {
                  highlights.push({
                    id: `subsection-${sectionKey}-${subIndex}`,
                    type: 'subsection',
                    coords,
                    content: `${section.name} - Part ${subIndex + 1} (${subSection.elements.length} elements)`,
                    color: lightenColor(section.color, 0.3),
                    sectionKey,
                    elementCount: subSection.elements.length,
                    isMainSection: false
                  });
                  console.log(`  ✅ Added sub-section ${subIndex + 1}: ${coords.width.toFixed(1)}x${coords.height.toFixed(1)} at (${coords.x.toFixed(1)}, ${coords.y.toFixed(1)})`);
                }
              }
            });
          }
          
          // If text filtering is enabled, also highlight individual matching elements
          if (highlightSpecificText && targetText && elementsToProcess.length > 0) {
            console.log(`🎯 Highlighting individual elements containing "${targetText}"`);
            
            elementsToProcess.forEach((element, elementIndex) => {
              if (element.polygon) {
                const elementCoords = convertToCanvasCoordinates(element.polygon, viewport);
                
                if (elementCoords && elementCoords.width > 0 && elementCoords.height > 0) {
                  highlights.push({
                    id: `element-${sectionKey}-${elementIndex}`,
                    type: 'element',
                    coords: elementCoords,
                    content: element.content || element.text || 'Element',
                    color: '#ff0000', // Red for specific text matches
                    sectionKey,
                    elementIndex,
                    isSpecificText: true
                  });
                  console.log(`  🎯 Added specific text element: "${element.content || element.text}" at (${elementCoords.x.toFixed(1)}, ${elementCoords.y.toFixed(1)})`);
                }
              }
            });
          }
        }
      });
      
      console.log(`🎨 Total highlights created: ${highlights.length}`);
      return highlights;
    }

    // Render granular elements (original behavior)
    if (!coordinates) return highlights;

    // Add table highlights
    if (highlightType === 'granular' || highlightType === 'tables') {
      coordinates.tables.forEach((table, tableIndex) => {
        // Try boundingRegions first, then fall back to direct polygon
        let regions = table.boundingRegions || [];
        if (regions.length === 0 && table.polygon) {
          regions = [{ polygon: table.polygon }];
        }
        
        regions.forEach((region, regionIndex) => {
          if (region.polygon) {
            const coords = convertToCanvasCoordinates(region.polygon, viewport);
            if (coords && coords.width > 0 && coords.height > 0) {
              highlights.push({
                id: `table-${tableIndex}-${regionIndex}`,
                type: 'table',
                coords,
                content: `Table ${tableIndex + 1}`,
                color: '#ff6b6b'
              });
            }
          }
        });
      });
    }

    // Add key-value pair highlights
    if (highlightType === 'all' || highlightType === 'keyValuePairs') {
      coordinates.keyValuePairs.forEach((pair, pairIndex) => {
        // Try boundingRegions first, then fall back to direct polygon
        let regions = pair.boundingRegions || [];
        if (regions.length === 0 && pair.polygon) {
          regions = [{ polygon: pair.polygon }];
        }
        
        regions.forEach((region, regionIndex) => {
          if (region.polygon) {
            const coords = convertToCanvasCoordinates(region.polygon, viewport);
            if (coords && coords.width > 0 && coords.height > 0) {
              highlights.push({
                id: `kvp-${pairIndex}-${regionIndex}`,
                type: 'keyValuePair',
                coords,
                content: `${pair.key?.content || pair.key || 'Key'}: ${pair.value?.content || pair.value || 'Value'}`,
                color: '#4ecdc4'
              });
            }
          }
        });
      });
    }

    // Add paragraph highlights
    if (highlightType === 'all' || highlightType === 'paragraphs') {
      coordinates.paragraphs.forEach((paragraph, paragraphIndex) => {
        // Try boundingRegions first, then fall back to direct polygon
        let regions = paragraph.boundingRegions || [];
        if (regions.length === 0 && paragraph.polygon) {
          regions = [{ polygon: paragraph.polygon }];
        }
        
        regions.forEach((region, regionIndex) => {
          if (region.polygon) {
            const coords = convertToCanvasCoordinates(region.polygon, viewport);
            if (coords && coords.width > 0 && coords.height > 0) {
              highlights.push({
                id: `paragraph-${paragraphIndex}-${regionIndex}`,
                type: 'paragraph',
                coords,
                content: paragraph.content?.substring(0, 50) + (paragraph.content?.length > 50 ? '...' : ''),
                color: '#45b7d1'
              });
            }
          }
        });
      });
    }

    return highlights;
  };

  // Handle highlight click
  const handleHighlightClick = (highlight) => {
    setSelectedElement(highlight);
  };

  // Go to specific page
  const goToPage = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages && pdfDocument) {
      loadPage(pdfDocument, pageNumber);
    }
  };

  // Handle scale change
  const handleScaleChange = (newScale) => {
    setScale(newScale);
    if (pdfDocument) {
      loadPage(pdfDocument, currentPage);
    }
  };

  // Helper function to lighten colors
  const lightenColor = (color, factor) => {
    // Simple color lightening - you might want to use a proper color library
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + Math.floor(255 * factor));
      const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + Math.floor(255 * factor));
      const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + Math.floor(255 * factor));
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    return color;
  };

  const highlights = renderHighlights();

  return (
    <div className="pdf-coordinate-visualizer">
      <div className="visualizer-header">
        <h2>PDF Coordinate Visualizer</h2>
        <p>Upload a PDF to visualize Azure Document Intelligence coordinates as highlight boxes</p>
      </div>

      {/* File Upload */}
      <div className="file-upload-section">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          disabled={isProcessing}
          className="file-input"
        />
        <div className="upload-text">
          {isProcessing ? 'Processing PDF...' : 'Click to upload PDF'}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{error}</span>
          <button onClick={() => setError(null)} className="error-dismiss">×</button>
        </div>
      )}

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="processing-indicator">
          <div className="spinner"></div>
          <span>Processing PDF and extracting coordinates...</span>
        </div>
      )}

      {/* PDF Viewer and Controls */}
      {pdfDocument && (
        <div className="pdf-viewer-container">
          {/* Controls */}
          <div className="viewer-controls">
            <div className="page-controls">
              <button 
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="page-button"
              >
                ← Previous
              </button>
              
              <span className="page-info">
                Page {currentPage} of {totalPages}
              </span>
              
              <button 
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="page-button"
              >
                Next →
              </button>
            </div>

            <div className="scale-controls">
              <label>Scale:</label>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={scale}
                onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
              />
              <span>{scale.toFixed(1)}x</span>
            </div>

            <div className="highlight-controls">
              <label>
                <input
                  type="checkbox"
                  checked={showHighlights}
                  onChange={(e) => setShowHighlights(e.target.checked)}
                />
                Show Highlights
              </label>
              
              <select 
                value={highlightType} 
                onChange={(e) => {
                  console.log(`🔄 Highlight type changed to: ${e.target.value}`);
                  setHighlightType(e.target.value);
                }}
                disabled={!showHighlights}
              >
                <option value="sections">EOB Sections (9 main sections)</option>
                <option value="granular">All Granular Elements (82+ elements)</option>
                <option value="tables">Tables Only</option>
                <option value="keyValuePairs">Key-Value Pairs Only</option>
                <option value="paragraphs">Paragraphs Only</option>
              </select>
              
              {highlightType === 'sections' && groupedSections && (
                <select 
                  value={selectedSection} 
                  onChange={(e) => {
                    console.log(`🎯 Section filter changed to: ${e.target.value}`);
                    setSelectedSection(e.target.value);
                  }}
                  disabled={!showHighlights}
                >
                  <option value="all">All Sections</option>
                  {Object.keys(groupedSections).map(sectionKey => {
                    const section = groupedSections[sectionKey];
                    if (section.elements.length > 0) {
                      return (
                        <option key={sectionKey} value={sectionKey}>
                          {section.name} ({section.elements.length} elements)
                        </option>
                      );
                    }
                    return null;
                  })}
                </select>
              )}
              
              {highlightType === 'sections' && (
                <div className="text-filter-controls" style={{ marginTop: '10px', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={highlightSpecificText}
                      onChange={(e) => {
                        console.log(`🎯 Text filtering ${e.target.checked ? 'enabled' : 'disabled'}`);
                        setHighlightSpecificText(e.target.checked);
                      }}
                      disabled={!showHighlights}
                    />
                    Highlight specific text
                  </label>
                  
                  {highlightSpecificText && (
                    <div style={{ marginTop: '8px' }}>
                      <label>
                        Target text:
                        <input
                          type="text"
                          value={targetText}
                          onChange={(e) => {
                            console.log(`🎯 Target text changed to: "${e.target.value}"`);
                            setTargetText(e.target.value);
                          }}
                          placeholder="Enter text to highlight..."
                          style={{ marginLeft: '8px', padding: '4px', width: '200px' }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* PDF Canvas Container */}
          <div className="canvas-container">
            <div className="canvas-wrapper" style={{ position: 'relative', display: 'inline-block' }}>
              <canvas
                ref={canvasRef}
                className="pdf-canvas"
                style={{ border: '1px solid #ccc' }}
              />
              
              {/* Highlight Overlay */}
              {showHighlights && highlights && (
                <div className="highlight-overlay" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                  {highlights.map((highlight) => (
                    <div
                      key={highlight.id}
                      className={`highlight-box ${selectedElement?.id === highlight.id ? 'selected' : ''}`}
                      style={{
                        position: 'absolute',
                        left: highlight.coords.x,
                        top: highlight.coords.y,
                        width: highlight.coords.width,
                        height: highlight.coords.height,
                        border: `2px solid ${highlight.color}`,
                        backgroundColor: `${highlight.color}20`,
                        cursor: 'pointer',
                        pointerEvents: 'auto',
                        zIndex: 10
                      }}
                      onClick={() => handleHighlightClick(highlight)}
                      title={highlight.content}
                    >
                      <div 
                        className="highlight-label"
                        style={{
                          position: 'absolute',
                          top: '-20px',
                          left: '0',
                          background: highlight.color,
                          color: 'white',
                          padding: '2px 6px',
                          fontSize: '10px',
                          borderRadius: '3px',
                          whiteSpace: 'nowrap',
                          maxWidth: '200px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {highlight.type}: {highlight.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Element Details */}
          {selectedElement && (
            <div className="element-details">
              <h3>Selected Element Details</h3>
              <div className="details-content">
                <p><strong>Type:</strong> {selectedElement.type}</p>
                <p><strong>Content:</strong> {selectedElement.content}</p>
                <p><strong>Position:</strong> ({selectedElement.coords.x.toFixed(1)}, {selectedElement.coords.y.toFixed(1)})</p>
                <p><strong>Size:</strong> {selectedElement.coords.width.toFixed(1)} × {selectedElement.coords.height.toFixed(1)}</p>
              </div>
              <button onClick={() => setSelectedElement(null)} className="close-details">
                Close Details
              </button>
            </div>
          )}

          {/* Statistics */}
          {coordinates && (
            <div className="coordinate-stats">
              <h3>Coordinate Statistics</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">Pages:</span>
                  <span className="stat-value">{coordinates.pages.length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Tables:</span>
                  <span className="stat-value">{coordinates.tables.length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Key-Value Pairs:</span>
                  <span className="stat-value">{coordinates.keyValuePairs.length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Paragraphs:</span>
                  <span className="stat-value">{coordinates.paragraphs.length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Active Highlights:</span>
                  <span className="stat-value">{highlights?.length || 0}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        .pdf-coordinate-visualizer {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: Arial, sans-serif;
        }

        .visualizer-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .visualizer-header h2 {
          color: #333;
          margin-bottom: 10px;
        }

        .file-upload-section {
          text-align: center;
          margin-bottom: 20px;
        }

        .file-input {
          margin-bottom: 10px;
          padding: 10px;
          border: 2px dashed #ccc;
          border-radius: 8px;
          width: 100%;
          max-width: 400px;
        }

        .upload-text {
          color: #666;
          font-size: 14px;
        }

        .error-message {
          background: #ffebee;
          color: #c62828;
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .error-icon {
          font-size: 20px;
        }

        .error-dismiss {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          margin-left: auto;
        }

        .processing-indicator {
          text-align: center;
          padding: 20px;
          background: #f0f8ff;
          border-radius: 8px;
          margin: 20px 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid #f3f3f3;
          border-top: 2px solid #3498db;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .pdf-viewer-container {
          margin-top: 20px;
        }

        .viewer-controls {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          align-items: center;
          margin-bottom: 20px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .page-controls {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .page-button {
          padding: 8px 16px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
        }

        .page-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .page-info {
          font-weight: bold;
          color: #333;
        }

        .scale-controls {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .highlight-controls {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .highlight-controls label {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .canvas-container {
          text-align: center;
          margin-bottom: 20px;
        }

        .canvas-wrapper {
          position: relative;
          display: inline-block;
        }

        .pdf-canvas {
          max-width: 100%;
          height: auto;
        }

        .highlight-box {
          transition: all 0.2s ease;
        }

        .highlight-box:hover {
          background-color: rgba(255, 255, 255, 0.3) !important;
        }

        .highlight-box.selected {
          background-color: rgba(255, 255, 0, 0.3) !important;
          border-width: 3px !important;
        }

        .element-details {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }

        .element-details h3 {
          margin-bottom: 15px;
          color: #333;
        }

        .details-content p {
          margin: 5px 0;
        }

        .close-details {
          margin-top: 10px;
          padding: 8px 16px;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .coordinate-stats {
          background: #e9ecef;
          padding: 20px;
          border-radius: 8px;
          margin-top: 20px;
        }

        .coordinate-stats h3 {
          margin-bottom: 15px;
          color: #333;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 15px;
        }

        .stat-item {
          display: flex;
          justify-content: space-between;
          padding: 10px;
          background: white;
          border-radius: 4px;
        }

        .stat-label {
          font-weight: bold;
          color: #555;
        }

        .stat-value {
          color: #007bff;
          font-weight: bold;
        }

        @media (max-width: 768px) {
          .viewer-controls {
            flex-direction: column;
            align-items: stretch;
          }
          
          .page-controls, .scale-controls, .highlight-controls {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

export default PDFCoordinateVisualizer;
