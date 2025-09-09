import React, { useRef, useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';

/**
 * Hybrid PDF Converter
 * Creates both image-based HTML (for display) and semantic HTML (for targeting)
 * Perfect for Remotion: visual fidelity + precise targeting
 */
const HybridPDFConverter = () => {
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hybridHTML, setHybridHTML] = useState('');
  const [semanticData, setSemanticData] = useState(null);
  const [scale, setScale] = useState(1.0);
  const [highlightedElement, setHighlightedElement] = useState(null);

  // Handle file selection
  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setIsLoading(true);
      setError(null);
      setHybridHTML('');
      setSemanticData(null);

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

  // Load specific page and generate hybrid HTML
  const loadPage = async (pdf, pageNumber) => {
    try {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      
      // Set canvas dimensions
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // Render PDF page to canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
      // Extract text content for semantic analysis
      const textContent = await page.getTextContent();
      
      // Generate hybrid HTML
      const { html, semanticData } = generateHybridHTML(textContent, viewport, pageNumber, canvas);
      setHybridHTML(html);
      setSemanticData(semanticData);
      
    } catch (err) {
      console.error('Error loading page:', err);
      setError(`Failed to load page ${pageNumber}: ${err.message}`);
    }
  };

  // Generate hybrid HTML with image background and semantic overlay
  const generateHybridHTML = (textContent, viewport, pageNumber, canvas) => {
    // Convert canvas to image
    const imageDataUrl = canvas.toDataURL('image/png');
    
    // Generate semantic blocks
    const semanticBlocks = generateSemanticBlocks(textContent, viewport);
    
    // Create hybrid HTML
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hybrid PDF - Page ${pageNumber}</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            font-family: Arial, sans-serif;
        }
        .pdf-container {
            position: relative;
            width: ${viewport.width}px;
            height: ${viewport.height}px;
            background: white;
            border: 1px solid #ccc;
            margin: 0 auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        /* Background image layer */
        .pdf-background {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1;
            pointer-events: none;
        }
        
        /* Semantic overlay layer */
        .semantic-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 2;
            pointer-events: auto;
        }
        
        .semantic-block {
            position: absolute;
            border: 2px solid transparent;
            transition: all 0.3s ease;
            cursor: pointer;
            background: rgba(0, 123, 255, 0.1);
            opacity: 0;
        }
        
        .semantic-block:hover {
            border-color: #007bff;
            background: rgba(0, 123, 255, 0.2);
            opacity: 1;
        }
        
        .semantic-block.highlighted {
            border-color: #ff6b35;
            background: rgba(255, 107, 53, 0.3);
            opacity: 1;
            box-shadow: 0 0 15px rgba(255, 107, 53, 0.6);
        }
        
        .block-info {
            position: absolute;
            top: -25px;
            left: 0;
            font-size: 11px;
            color: #333;
            background: rgba(255,255,255,0.9);
            padding: 2px 6px;
            border-radius: 3px;
            white-space: nowrap;
            display: none;
        }
        
        .semantic-block:hover .block-info {
            display: block;
        }
        
        .controls {
            text-align: center;
            margin: 20px 0;
        }
        
        .element-list {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
            max-height: 200px;
            overflow-y: auto;
        }
        
        .element-item {
            padding: 5px 10px;
            margin: 2px 0;
            background: white;
            border-radius: 4px;
            cursor: pointer;
            border: 1px solid #e9ecef;
            font-size: 12px;
        }
        
        .element-item:hover {
            background: #e9ecef;
        }
        
        .element-item.highlighted {
            background: #fff3cd;
            border-color: #ffc107;
        }
    </style>
</head>
<body>
    <div class="controls">
        <h2>Hybrid PDF Converter - Page ${pageNumber}</h2>
        <p>Image-based display with semantic targeting overlay</p>
        <button onclick="toggleOverlay()">Toggle Semantic Overlay</button>
        <button onclick="clearHighlights()">Clear Highlights</button>
    </div>
    
    <div class="pdf-container">
        <!-- Background image layer -->
        <img class="pdf-background" src="${imageDataUrl}" alt="PDF Page" />
        
        <!-- Semantic overlay layer -->
        <div class="semantic-overlay" id="semanticOverlay">
            ${semanticBlocks.map(block => `
                <div 
                    class="semantic-block" 
                    id="${block.id}"
                    style="
                        left: ${block.x}px;
                        top: ${block.y}px;
                        width: ${block.width}px;
                        height: ${block.height}px;
                    "
                    onclick="highlightElement('${block.id}')"
                >
                    <div class="block-info">
                        ${block.id} | ${block.text.substring(0, 30)}...
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
    
    <div class="element-list">
        <h3>Semantic Elements (${semanticBlocks.length})</h3>
        ${semanticBlocks.map(block => `
            <div 
                class="element-item" 
                onclick="highlightElement('${block.id}')"
                data-element-id="${block.id}"
            >
                <strong>${block.id}</strong><br/>
                <small>${block.text.substring(0, 60)}${block.text.length > 60 ? '...' : ''}</small>
            </div>
        `).join('')}
    </div>
    
    <script>
        let overlayVisible = true;
        
        function toggleOverlay() {
            overlayVisible = !overlayVisible;
            const overlay = document.getElementById('semanticOverlay');
            overlay.style.display = overlayVisible ? 'block' : 'none';
        }
        
        function highlightElement(elementId) {
            // Clear previous highlights
            clearHighlights();
            
            // Highlight the selected element
            const element = document.getElementById(elementId);
            if (element) {
                element.classList.add('highlighted');
                
                // Also highlight in the list
                const listItem = document.querySelector(\`[data-element-id="\${elementId}"]\`);
                if (listItem) {
                    listItem.classList.add('highlighted');
                }
                
                console.log('Highlighted element:', elementId, {
                    x: element.style.left,
                    y: element.style.top,
                    width: element.style.width,
                    height: element.style.height
                });
            }
        }
        
        function clearHighlights() {
            document.querySelectorAll('.semantic-block, .element-item').forEach(el => {
                el.classList.remove('highlighted');
            });
        }
        
        // Make functions globally available
        window.highlightElement = highlightElement;
        window.toggleOverlay = toggleOverlay;
        window.clearHighlights = clearHighlights;
    </script>
</body>
</html>`;
    
    return { html, semanticData: semanticBlocks };
  };

  // Generate semantic blocks from text content
  const generateSemanticBlocks = (textContent, viewport) => {
    const blocks = [];
    const textItems = textContent.items.filter(item => item.str && item.str.trim());
    
    // Sort by Y position (top to bottom)
    textItems.sort((a, b) => {
      const aY = viewport.height - a.transform[5];
      const bY = viewport.height - b.transform[5];
      return bY - aY;
    });
    
    let currentBlock = null;
    let blockIndex = 0;
    
    textItems.forEach((item, index) => {
      const x = item.transform[4];
      const y = viewport.height - item.transform[5] - item.height;
      const width = item.width;
      const height = item.height;
      const text = item.str.trim();
      
      // Determine if this should be part of current block or start new block
      const shouldStartNewBlock = !currentBlock || 
        Math.abs(y - (currentBlock.y + currentBlock.height)) > height * 2 ||
        Math.abs(x - currentBlock.x) > width * 3;
      
      if (shouldStartNewBlock) {
        // Finish current block
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        
        // Start new block
        currentBlock = {
          id: generateElementId(currentBlock?.text || text, blockIndex++),
          x,
          y,
          width,
          height,
          text: text,
          fontSize: item.height,
          fontFamily: item.fontName || 'Arial',
          items: [item]
        };
      } else {
        // Add to current block
        currentBlock.text += ' ' + text;
        currentBlock.width = Math.max(currentBlock.width, x + width - currentBlock.x);
        currentBlock.height = Math.max(currentBlock.height, y + height - currentBlock.y);
        currentBlock.items.push(item);
      }
    });
    
    // Add final block
    if (currentBlock) {
      blocks.push(currentBlock);
    }
    
    return blocks;
  };

  // Generate meaningful IDs based on content
  const generateElementId = (text, index) => {
    const cleanText = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 30);
    
    if (text.match(/^\d+\./)) return `numbered-item-${index}`;
    if (text.match(/^[A-Z][A-Z\s]+$/)) return `heading-${cleanText}`;
    if (text.match(/\$\d+/) || text.match(/total|cost|charge|payment/i)) return `financial-${cleanText}`;
    if (text.match(/date|time|service/i)) return `date-${cleanText}`;
    if (text.match(/name|address|phone/i)) return `contact-${cleanText}`;
    if (text.match(/table|row|column/i)) return `table-${cleanText}`;
    
    return `content-${cleanText || index}`;
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

  // Download hybrid HTML
  const downloadHTML = () => {
    if (!hybridHTML) return;

    const blob = new Blob([hybridHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hybrid-pdf-page-${currentPage}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Copy element data for Remotion
  const copyElementData = () => {
    if (!semanticData) return;
    
    const elementData = semanticData.map(block => ({
      id: block.id,
      x: block.x,
      y: block.y,
      width: block.width,
      height: block.height,
      text: block.text.substring(0, 100),
      centerX: block.x + block.width / 2,
      centerY: block.y + block.height / 2
    }));
    
    const json = JSON.stringify(elementData, null, 2);
    navigator.clipboard.writeText(json);
    alert('Element data copied to clipboard!');
  };

  return (
    <div className="hybrid-converter-container">
      <div className="converter-header">
        <h2>Hybrid PDF Converter</h2>
        <p>Image-based display with semantic targeting overlay - Perfect for Remotion!</p>
      </div>

      <div className="converter-controls">
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
            
            <button onClick={copyElementData} className="copy-btn">
              Copy Element Data
            </button>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Processing PDF...</p>
        </div>
      )}

      {error && (
        <div className="error">
          <p>Error: {error}</p>
        </div>
      )}

      <div className="converter-content">
        <div className="canvas-container">
          <h3>Original PDF (Reference)</h3>
          <canvas
            ref={canvasRef}
            style={{
              border: '1px solid #ccc',
              margin: '10px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}
          />
        </div>

        {hybridHTML && (
          <div className="html-container">
            <h3>Hybrid HTML (Click elements to highlight)</h3>
            <div 
              dangerouslySetInnerHTML={{ __html: hybridHTML }}
              style={{ maxHeight: '600px', overflow: 'auto' }}
            />
          </div>
        )}
      </div>

      {semanticData && (
        <div className="semantic-info">
          <h3>Semantic Data for Remotion ({semanticData.length} elements)</h3>
          <p>Each element has precise coordinates for targeting and zooming:</p>
          <div className="data-preview">
            <pre>{JSON.stringify(semanticData.slice(0, 3), null, 2)}</pre>
            {semanticData.length > 3 && <p>... and {semanticData.length - 3} more elements</p>}
          </div>
        </div>
      )}

      <style>{`
        .hybrid-converter-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .converter-header {
          text-align: center;
          margin-bottom: 30px;
        }
        
        .converter-header h2 {
          color: #333;
          margin-bottom: 10px;
        }
        
        .converter-controls {
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
        
        .download-btn, .copy-btn {
          background: #4caf50;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .copy-btn {
          background: #2196f3;
        }
        
        .download-btn:hover, .copy-btn:hover {
          opacity: 0.9;
        }
        
        .converter-content {
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
        
        .semantic-info {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin-top: 20px;
        }
        
        .semantic-info h3 {
          margin-top: 0;
          color: #333;
        }
        
        .data-preview {
          background: white;
          padding: 15px;
          border-radius: 6px;
          border: 1px solid #e9ecef;
          margin-top: 10px;
        }
        
        .data-preview pre {
          margin: 0;
          font-size: 12px;
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
        
        @media (max-width: 768px) {
          .converter-content {
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

export default HybridPDFConverter;
