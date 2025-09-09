import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';

/**
 * PDF Viewer Component - Renders actual PDF with precise coordinate mapping
 * Uses PDF.js for pixel-perfect coordinate extraction
 */
const PDFViewer = ({ 
  pdfFile, 
  onElementBoundsUpdate, 
  onError,
  highlightRegions = [],
  currentHighlight = null,
  zoomLevel = 1.0
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [page, setPage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [elementBounds, setElementBounds] = useState({});
  const [pdfScale, setPdfScale] = useState(1.0);

  // Load PDF document
  useEffect(() => {
    if (!pdfFile) return;

    const loadPDF = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const arrayBuffer = await pdfFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        setPdfDocument(pdf);
        
        // Load first page
        const firstPage = await pdf.getPage(1);
        setPage(firstPage);
        
        // Render the page
        await renderPage(firstPage);
        
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError(`Failed to load PDF: ${err.message}`);
        if (onError) onError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadPDF();
  }, [pdfFile, onError]);

  // Render PDF page
  const renderPage = useCallback(async (pageToRender) => {
    if (!pageToRender || !canvasRef.current) return;

    try {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      // Calculate scale to fit container
      const container = containerRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      const viewport = pageToRender.getViewport({ scale: 1.0 });
      const scale = Math.min(
        containerWidth / viewport.width,
        containerHeight / viewport.height
      ) * zoomLevel;
      
      setPdfScale(scale);
      
      const scaledViewport = pageToRender.getViewport({ scale });
      
      // Set canvas dimensions
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      
      // Render PDF page
      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport
      };
      
      await pageToRender.render(renderContext).promise;
      
      // Extract text content for coordinate mapping
      await extractTextContent(pageToRender, scaledViewport);
      
    } catch (err) {
      console.error('Error rendering PDF page:', err);
      setError(`Failed to render PDF: ${err.message}`);
    }
  }, [zoomLevel]);

  // Extract text content with precise coordinates
  const extractTextContent = useCallback(async (pageToRender, viewport) => {
    try {
      const textContent = await pageToRender.getTextContent();
      const bounds = {};
      
      // Process text items to create element bounds
      textContent.items.forEach((item, index) => {
        if (item.str && item.str.trim()) {
          const elementId = `text-item-${index}`;
          
          // Convert PDF coordinates to canvas coordinates
          const x = item.transform[4] * pdfScale;
          const y = viewport.height - (item.transform[5] * pdfScale) - (item.height * pdfScale);
          const width = item.width * pdfScale;
          const height = item.height * pdfScale;
          
          bounds[elementId] = {
            x,
            y,
            width,
            height,
            centerX: x + width / 2,
            centerY: y + height / 2,
            text: item.str,
            elementId
          };
        }
      });
      
      setElementBounds(bounds);
      if (onElementBoundsUpdate) {
        onElementBoundsUpdate(bounds);
      }
      
    } catch (err) {
      console.error('Error extracting text content:', err);
    }
  }, [pdfScale, onElementBoundsUpdate]);

  // Handle zoom changes
  useEffect(() => {
    if (page) {
      renderPage(page);
    }
  }, [zoomLevel, page, renderPage]);

  // Get precise coordinates for highlighting
  const getHighlightCoordinates = useCallback((region) => {
    if (!region || !canvasRef.current) return null;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    return {
      x: region.x * pdfScale,
      y: region.y * pdfScale,
      width: region.width * pdfScale,
      height: region.height * pdfScale,
      centerX: (region.x + region.width / 2) * pdfScale,
      centerY: (region.y + region.height / 2) * pdfScale
    };
  }, [pdfScale]);

  // Render highlight overlays
  const renderHighlights = useCallback(() => {
    if (!currentHighlight || !canvasRef.current) return null;
    
    const coords = getHighlightCoordinates(currentHighlight);
    if (!coords) return null;
    
    return (
      <div
        style={{
          position: 'absolute',
          left: coords.x,
          top: coords.y,
          width: coords.width,
          height: coords.height,
          border: '3px solid #ff6b35',
          borderRadius: '8px',
          pointerEvents: 'none',
          zIndex: 10,
          boxShadow: '0 0 20px rgba(255, 107, 53, 0.5)',
          animation: 'pulse 2s ease-in-out infinite'
        }}
      />
    );
  }, [currentHighlight, getHighlightCoordinates]);

  if (isLoading) {
    return (
      <div className="pdf-loading">
        <div className="spinner"></div>
        <p>Loading PDF...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pdf-error">
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="pdf-viewer-container"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: '#f5f5f5'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          margin: '0 auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          background: 'white'
        }}
      />
      
      {/* Highlight overlays */}
      {renderHighlights()}
      
      {/* Debug info */}
      {process.env.NODE_ENV === 'development' && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace',
            zIndex: 1000
          }}
        >
          <div>Scale: {pdfScale.toFixed(2)}</div>
          <div>Zoom: {zoomLevel.toFixed(2)}</div>
          <div>Elements: {Object.keys(elementBounds).length}</div>
        </div>
      )}
      
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
          
          .pdf-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: #666;
          }
          
          .pdf-error {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: #f44336;
          }
        `}
      </style>
    </div>
  );
};

export default PDFViewer;
