import React, { useRef, useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';

/**
 * PDF to HTML Test Component
 * Demonstrates exact PDF layout preservation using PDF.js
 */
const PDFToHTMLTest = () => {
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pdfData, setPdfData] = useState(null);
  const [scale, setScale] = useState(1.0);
  const [textContent, setTextContent] = useState(null);
  const [images, setImages] = useState([]);

  // Handle file selection
  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setIsLoading(true);
      setError(null);
      resetPdfData();

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      setPdfDocument(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
      
      // Load first page
      await loadPage(pdf, 1);
      
    } catch (err) {
      console.error('Error loading PDF:', err);
      setError(`Failed to load PDF: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Load specific page
  const loadPage = async (pdf, pageNumber) => {
    try {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      
      // Set canvas dimensions
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // Render PDF page
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
      // Extract text content for HTML generation
      const textContent = await page.getTextContent();
      setTextContent(textContent);
      
      // Extract images from the page
      const pageImages = await extractImagesFromPage(page, viewport);
      console.log('Extracted images:', pageImages);
      
      setImages(pageImages);
      
      // Generate HTML representation with only text and extracted images
      generateHTMLFromPDF(page, textContent, viewport, pageImages);
      
    } catch (err) {
      console.error('Error loading page:', err);
      setError(`Failed to load page ${pageNumber}: ${err.message}`);
    }
  };

  // Extract images from PDF page
  const extractImagesFromPage = async (page, viewport) => {
    try {
      console.log('Starting image extraction...');
      const ops = await page.getOperatorList();
      const images = [];
      
      console.log('Total operators:', ops.fnArray.length);
      
      // Look for image operations
      for (let i = 0; i < ops.fnArray.length; i++) {
        const op = ops.fnArray[i];
        const args = ops.argsArray[i];
        
        // Check for various image operations
        if (op === pdfjsLib.OPS.paintImageXObject || 
            op === pdfjsLib.OPS.paintImageXObjectRepeat ||
            op === pdfjsLib.OPS.paintInlineImageXObject) {
          
          console.log('Found image operation:', op, 'args:', args);
          
          try {
            const imageName = args[0];
            console.log('Image name:', imageName);
            
            const imageObj = await page.objs.get(imageName);
            console.log('Image object:', imageObj);
            
            if (imageObj) {
              let dataUrl;
              
              // Handle different image data formats
              if (imageObj.data) {
                // Convert Uint8Array to base64
                const bytes = new Uint8Array(imageObj.data);
                const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
                const base64 = btoa(binary);
                dataUrl = `data:${imageObj.mimetype || 'image/jpeg'};base64,${base64}`;
              } else if (imageObj.getData) {
                // Alternative method for getting image data
                const data = await imageObj.getData();
                const bytes = new Uint8Array(data);
                const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
                const base64 = btoa(binary);
                dataUrl = `data:${imageObj.mimetype || 'image/jpeg'};base64,${base64}`;
              }
              
              if (dataUrl) {
                // Get image position from transformation matrix
                const transform = args[1] || [1, 0, 0, 1, 0, 0];
                const x = transform[4] || 0;
                const y = viewport.height - (transform[5] || 0) - (imageObj.height || 0);
                const width = imageObj.width || 0;
                const height = imageObj.height || 0;
                
                console.log('Extracted image:', { x, y, width, height, name: imageName });
                
                images.push({
                  id: `image-${images.length}`,
                  dataUrl,
                  x,
                  y,
                  width,
                  height,
                  name: imageName
                });
              }
            }
          } catch (imgErr) {
            console.warn('Error processing image:', imgErr);
          }
        }
      }
      
      console.log('Total images extracted:', images.length);
      return images;
    } catch (err) {
      console.error('Error extracting images:', err);
      return [];
    }
  };

  // Alternative method: Extract images from rendered canvas
  const extractImagesFromCanvas = async (canvas, viewport) => {
    try {
      console.log('Starting canvas image extraction...');
      const images = [];
      
      // Instead of using the entire canvas (which includes text), 
      // let's try to detect actual image regions
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Simple approach: look for non-white regions that might be images
      // This is a basic heuristic - in practice, you'd need more sophisticated detection
      const threshold = 240; // Consider pixels darker than this as potential image content
      let hasImageContent = false;
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        
        // Check if pixel is not white/transparent
        if (a > 0 && (r < threshold || g < threshold || b < threshold)) {
          hasImageContent = true;
          break;
        }
      }
      
      // Only add canvas image if we detect non-text content
      if (hasImageContent) {
        const dataUrl = canvas.toDataURL('image/png');
        
        if (dataUrl && dataUrl !== 'data:,') {
          images.push({
            id: 'canvas-image-0',
            dataUrl,
            x: 0,
            y: 0,
            width: canvas.width,
            height: canvas.height,
            name: 'canvas-extracted',
            isBackground: true // Mark as background so it renders behind text
          });
          
          console.log('Canvas image extracted:', { width: canvas.width, height: canvas.height });
        }
      } else {
        console.log('No significant image content detected in canvas');
      }
      
      return images;
    } catch (err) {
      console.error('Error extracting images from canvas:', err);
      return [];
    }
  };

  // Generate HTML from PDF page with exact positioning
  const generateHTMLFromPDF = (page, textContent, viewport, pageImages = []) => {
    console.log('Generating HTML with:', {
      textItems: textContent.items.length,
      images: pageImages.length,
      viewport: { width: viewport.width, height: viewport.height }
    });
    
    const htmlElements = [];
    
    // Create container with exact PDF dimensions
    const containerStyle = {
      position: 'relative',
      width: `${viewport.width}px`,
      height: `${viewport.height}px`,
      backgroundColor: 'white',
      border: '1px solid #ccc',
      margin: '20px auto',
      fontFamily: 'Arial, sans-serif'
    };

    // Process images first (so they appear behind text)
    pageImages.forEach((image, index) => {
      const elementStyle = {
        position: 'absolute',
        left: `${image.x}px`,
        top: `${image.y}px`,
        width: `${image.width}px`,
        height: `${image.height}px`,
        pointerEvents: 'none',
        zIndex: image.isBackground ? 1 : 5 // Background images go behind everything
      };

      htmlElements.push({
        id: `image-${index}`,
        type: 'image',
        src: image.dataUrl,
        style: elementStyle,
        boundingBox: {
          x: image.x,
          y: image.y,
          width: image.width,
          height: image.height
        },
        isBackground: image.isBackground
      });
    });

    // Process text items
    console.log('Processing text items...');
    textContent.items.forEach((item, index) => {
      if (item.str && item.str.trim()) {
        const transform = item.transform;
        const x = transform[4];
        const y = viewport.height - transform[5] - item.height;
        const width = item.width;
        const height = item.height;
        
        // Create HTML element with exact positioning
        const elementStyle = {
          position: 'absolute',
          left: `${x}px`,
          top: `${y}px`,
          width: `${width}px`,
          height: `${height}px`,
          fontSize: `${item.height}px`,
          fontFamily: item.fontName || 'Arial',
          color: 'black',
          lineHeight: '1',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 20, // Higher z-index to ensure text appears above images
          backgroundColor: 'transparent' // Ensure text has transparent background
        };

        htmlElements.push({
          id: `text-${index}`,
          type: 'text',
          text: item.str,
          style: elementStyle,
          boundingBox: {
            x, y, width, height
          }
        });
      }
    });

    console.log('Final HTML elements count:', htmlElements.length);
    console.log('Text elements:', htmlElements.filter(el => el.type === 'text').length);
    console.log('Image elements:', htmlElements.filter(el => el.type === 'image').length);
    
    setPdfData({
      containerStyle,
      elements: htmlElements,
      viewport: {
        width: viewport.width,
        height: viewport.height
      }
    });
  };

  // Handle page navigation
  const goToPage = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages && pdfDocument) {
      setCurrentPage(pageNumber);
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

  // Reset PDF data when starting new processing
  const resetPdfData = () => {
    setPdfData(null);
    setImages([]);
    setTextContent(null);
  };

  // Generate downloadable HTML
  const downloadHTML = () => {
    if (!pdfData) return;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PDF to HTML - Exact Layout</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            font-family: Arial, sans-serif;
        }
        .pdf-container {
            ${Object.entries(pdfData.containerStyle).map(([key, value]) => 
              `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value};`
            ).join('\n            ')}
        }
        .pdf-element {
          position: absolute;
          pointer-events: none;
        }
        
        .pdf-element img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        .controls {
            margin-bottom: 20px;
            text-align: center;
        }
        .controls button, .controls input {
            margin: 0 5px;
            padding: 8px 12px;
        }
    </style>
</head>
<body>
    <div class="controls">
        <h2>PDF to HTML - Exact Layout Preservation</h2>
        <p>This HTML maintains the exact positioning and layout of the original PDF</p>
    </div>
    
    <div class="pdf-container">
        ${pdfData.elements.map(element => 
          element.type === 'image' 
            ? `<img class="pdf-element" src="${element.src}" style="${Object.entries(element.style).map(([key, value]) => 
                `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value};`
              ).join(' ')}" alt="PDF Image" />`
            : `<div class="pdf-element" style="${Object.entries(element.style).map(([key, value]) => 
                `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value};`
              ).join(' ')}">${element.text}</div>`
        ).join('\n        ')}
    </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pdf-to-html-page-${currentPage}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pdf-test-container">
      <div className="test-header">
        <h2>PDF to HTML Test - Exact Layout Preservation</h2>
        <p>This demonstrates how PDF.js can preserve exact positioning and layout when converting PDF to HTML</p>
      </div>

      <div className="test-controls">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          style={{ marginBottom: '20px' }}
        />
        
        {pdfDocument && (
          <div className="page-controls">
            <button 
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              Previous
            </button>
            
            <span className="page-info">
              Page {currentPage} of {totalPages}
            </span>
            
            <button 
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              Next
            </button>
            
            <div className="scale-controls">
              <label>Scale: </label>
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
            
            <button onClick={downloadHTML} className="download-btn">
              Download HTML
            </button>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading PDF...</p>
        </div>
      )}

      {error && (
        <div className="error">
          <p>Error: {error}</p>
        </div>
      )}

      <div className="test-content">
        <div className="canvas-container">
          <h3>Original PDF (Canvas)</h3>
          <canvas
            ref={canvasRef}
            style={{
              border: '1px solid #ccc',
              margin: '10px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}
          />
        </div>

        {pdfData && (
          <div className="html-container">
            <h3>Generated HTML (Exact Layout)</h3>
            <div
              ref={containerRef}
              style={pdfData.containerStyle}
            >
              {pdfData.elements.map(element => 
                element.type === 'image' ? (
                  <img
                    key={element.id}
                    src={element.src}
                    alt="PDF Image"
                    style={element.style}
                    title={`Image: ${element.id} | Position: (${element.boundingBox.x}, ${element.boundingBox.y})`}
                  />
                ) : (
                  <div
                    key={element.id}
                    style={element.style}
                    title={`Text: "${element.text}" | Position: (${element.boundingBox.x}, ${element.boundingBox.y})`}
                  >
                    {element.text}
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {textContent && (
        <div className="text-analysis">
          <h3>Text Content Analysis</h3>
          <div className="stats">
            <p><strong>Total Text Items:</strong> {textContent.items.length}</p>
            <p><strong>Total Images:</strong> {images.length}</p>
            <p><strong>Characters:</strong> {textContent.items.reduce((sum, item) => sum + (item.str?.length || 0), 0)}</p>
            <p><strong>Fonts Used:</strong> {[...new Set(textContent.items.map(item => item.fontName).filter(Boolean))].length}</p>
            <p><strong>Image Types:</strong> {[...new Set(images.map(img => img.dataUrl.split(';')[0].split(':')[1]))].join(', ') || 'None'}</p>
          </div>
        </div>
      )}

      <style>{`
        .pdf-test-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .test-header {
          text-align: center;
          margin-bottom: 30px;
        }
        
        .test-header h2 {
          color: #333;
          margin-bottom: 10px;
        }
        
        .test-controls {
          text-align: center;
          margin-bottom: 30px;
        }
        
        .page-controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 15px;
          margin: 15px 0;
          flex-wrap: wrap;
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
        
        .download-btn {
          background: #4caf50;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .download-btn:hover {
          background: #45a049;
        }
        
        .test-content {
          display: flex;
          gap: 20px;
          margin-bottom: 30px;
        }
        
        .canvas-container, .html-container {
          flex: 1;
          text-align: center;
        }
        
        .canvas-container h3, .html-container h3 {
          margin-bottom: 15px;
          color: #333;
        }
        
        .loading {
          text-align: center;
          padding: 40px;
        }
        
        .spinner {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3498db;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 2s linear infinite;
          margin: 0 auto 20px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .error {
          background: #ffebee;
          color: #c62828;
          padding: 15px;
          border-radius: 4px;
          text-align: center;
          margin: 20px 0;
        }
        
        .text-analysis {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin-top: 20px;
        }
        
        .text-analysis h3 {
          margin-top: 0;
          color: #333;
        }
        
        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
        }
        
        .stats p {
          margin: 5px 0;
          color: #666;
        }
        
        @media (max-width: 768px) {
          .test-content {
            flex-direction: column;
          }
          
          .page-controls {
            flex-direction: column;
            gap: 10px;
          }
        }
      `}</style>
    </div>
  );
};

export default PDFToHTMLTest;
