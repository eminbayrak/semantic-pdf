import React, { useRef, useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';

/**
 * Semantic PDF Converter
 * Converts PDF to semantic HTML with meaningful IDs for Remotion targeting
 */
const SemanticPDFConverter = () => {
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [semanticHTML, setSemanticHTML] = useState('');
  const [textBlocks, setTextBlocks] = useState([]);
  const [scale, setScale] = useState(1.0);

  // Handle file selection
  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setIsLoading(true);
      setError(null);
      setSemanticHTML('');
      setTextBlocks([]);

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

  // Load specific page and generate semantic HTML
  const loadPage = async (pdf, pageNumber) => {
    try {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      
      // Set canvas dimensions for reference
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // Render PDF page to canvas for reference
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
      // Extract text content for semantic analysis
      const textContent = await page.getTextContent();
      
      // Generate semantic HTML
      const { html, blocks } = generateSemanticHTML(textContent, viewport, pageNumber);
      setSemanticHTML(html);
      setTextBlocks(blocks);
      
    } catch (err) {
      console.error('Error loading page:', err);
      setError(`Failed to load page ${pageNumber}: ${err.message}`);
    }
  };

  // Generate semantic HTML with meaningful IDs
  const generateSemanticHTML = (textContent, viewport, pageNumber) => {
    const blocks = [];
    const htmlSections = [];
    
    // Group text items by proximity and content type
    const textItems = textContent.items.filter(item => item.str && item.str.trim());
    
    // Sort by Y position (top to bottom)
    textItems.sort((a, b) => {
      const aY = viewport.height - a.transform[5];
      const bY = viewport.height - b.transform[5];
      return bY - aY; // Top to bottom
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
        Math.abs(y - (currentBlock.y + currentBlock.height)) > height * 2 || // Too far vertically
        Math.abs(x - currentBlock.x) > width * 3; // Too far horizontally
      
      if (shouldStartNewBlock) {
        // Finish current block
        if (currentBlock) {
          blocks.push(currentBlock);
          htmlSections.push(generateHTMLForBlock(currentBlock, blockIndex++));
        }
        
        // Start new block
        currentBlock = {
          id: `block-${blockIndex}`,
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
      htmlSections.push(generateHTMLForBlock(currentBlock, blockIndex++));
    }
    
    // Generate complete HTML document
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Semantic PDF - Page ${pageNumber}</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            font-family: Arial, sans-serif;
        }
        .pdf-page {
            position: relative;
            width: ${viewport.width}px;
            height: ${viewport.height}px;
            background: white;
            border: 1px solid #ccc;
            margin: 0 auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .text-block {
            position: absolute;
            pointer-events: none;
            border: 1px solid transparent;
            transition: border-color 0.3s ease;
        }
        .text-block:hover {
            border-color: #007bff;
            background-color: rgba(0, 123, 255, 0.1);
        }
        .text-block.highlighted {
            border-color: #ff6b35;
            background-color: rgba(255, 107, 53, 0.2);
            box-shadow: 0 0 10px rgba(255, 107, 53, 0.5);
        }
        .debug-info {
            position: absolute;
            top: -20px;
            left: 0;
            font-size: 10px;
            color: #666;
            background: rgba(255,255,255,0.8);
            padding: 2px 4px;
            border-radius: 2px;
            display: none;
        }
        .text-block:hover .debug-info {
            display: block;
        }
    </style>
</head>
<body>
    <div class="pdf-page">
        ${htmlSections.join('\n        ')}
    </div>
    
    <script>
        // Add click handlers for testing
        document.querySelectorAll('.text-block').forEach(block => {
            block.addEventListener('click', () => {
                // Remove previous highlights
                document.querySelectorAll('.text-block').forEach(b => b.classList.remove('highlighted'));
                // Add highlight to clicked block
                block.classList.add('highlighted');
                console.log('Highlighted block:', block.id, block.textContent.trim());
            });
        });
    </script>
</body>
</html>`;
    
    return { html, blocks };
  };

  // Generate HTML for a text block
  const generateHTMLForBlock = (block, index) => {
    const elementId = generateElementId(block.text, index);
    
    return `
    <div 
        class="text-block" 
        id="${elementId}"
        style="
            left: ${block.x}px;
            top: ${block.y}px;
            width: ${block.width}px;
            height: ${block.height}px;
            font-size: ${block.fontSize}px;
            font-family: ${block.fontFamily};
            line-height: 1;
            color: black;
        "
    >
        <div class="debug-info">
            ID: ${elementId} | Items: ${block.items.length}
        </div>
        ${block.text}
    </div>`;
  };

  // Generate meaningful IDs based on content
  const generateElementId = (text, index) => {
    // Clean text for ID generation
    const cleanText = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 30);
    
    // Identify content type
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

  // Download semantic HTML
  const downloadHTML = () => {
    if (!semanticHTML) return;

    const blob = new Blob([semanticHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `semantic-pdf-page-${currentPage}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Copy element IDs for Remotion
  const copyElementIds = () => {
    const ids = textBlocks.map(block => {
      const elementId = generateElementId(block.text, textBlocks.indexOf(block));
      return `"${elementId}": { x: ${block.x}, y: ${block.y}, width: ${block.width}, height: ${block.height} }`;
    }).join(',\n    ');
    
    const json = `{\n    ${ids}\n}`;
    navigator.clipboard.writeText(json);
    alert('Element IDs copied to clipboard!');
  };

  return (
    <div className="semantic-converter-container">
      <div className="converter-header">
        <h2>Semantic PDF Converter</h2>
        <p>Converts PDF to semantic HTML with meaningful IDs for Remotion targeting</p>
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
            
            <button onClick={copyElementIds} className="copy-btn">
              Copy Element IDs
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

        {semanticHTML && (
          <div className="html-container">
            <h3>Semantic HTML (Click blocks to highlight)</h3>
            <div 
              dangerouslySetInnerHTML={{ __html: semanticHTML }}
              style={{ maxHeight: '600px', overflow: 'auto' }}
            />
          </div>
        )}
      </div>

      {textBlocks.length > 0 && (
        <div className="blocks-info">
          <h3>Generated Text Blocks ({textBlocks.length})</h3>
          <div className="blocks-list">
            {textBlocks.map((block, index) => {
              const elementId = generateElementId(block.text, index);
              return (
                <div key={index} className="block-item">
                  <strong>ID:</strong> {elementId}<br/>
                  <strong>Text:</strong> {block.text.substring(0, 100)}{block.text.length > 100 ? '...' : ''}<br/>
                  <strong>Position:</strong> ({block.x}, {block.y}) Size: {block.width}×{block.height}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        .semantic-converter-container {
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
        
        .blocks-info {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin-top: 20px;
        }
        
        .blocks-info h3 {
          margin-top: 0;
          color: #333;
        }
        
        .blocks-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 15px;
          margin-top: 15px;
        }
        
        .block-item {
          background: white;
          padding: 15px;
          border-radius: 6px;
          border: 1px solid #e9ecef;
          font-size: 14px;
          line-height: 1.4;
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

export default SemanticPDFConverter;
