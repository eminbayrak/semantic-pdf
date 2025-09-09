import React, { useRef, useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';

/**
 * Guided Presentation Component
 * Creates Guide.com-style step-by-step highlighting presentation
 */
const GuidedPresentation = () => {
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [semanticData, setSemanticData] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scale, setScale] = useState(1.0);
  const [presentationHTML, setPresentationHTML] = useState('');

  // Handle file selection
  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setIsLoading(true);
      setError(null);
      setSemanticData([]);
      setCurrentStep(0);
      setIsPlaying(false);

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

  // Load specific page and generate presentation
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
      
      // Generate semantic data
      const semanticBlocks = generateSemanticBlocks(textContent, viewport);
      setSemanticData(semanticBlocks);
      
      // Generate presentation HTML
      const html = generatePresentationHTML(semanticBlocks, viewport, pageNumber, canvas);
      setPresentationHTML(html);
      
    } catch (err) {
      console.error('Error loading page:', err);
      setError(`Failed to load page ${pageNumber}: ${err.message}`);
    }
  };

  // Generate semantic blocks from text content - focusing on important sections
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
      // More generous grouping to create larger, more meaningful sections
      const shouldStartNewBlock = !currentBlock || 
        Math.abs(y - (currentBlock.y + currentBlock.height)) > height * 4 ||
        Math.abs(x - currentBlock.x) > width * 5;
      
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
          items: [item],
          step: blockIndex,
          importance: calculateImportance(text)
        };
      } else {
        // Add to current block
        currentBlock.text += ' ' + text;
        currentBlock.width = Math.max(currentBlock.width, x + width - currentBlock.x);
        currentBlock.height = Math.max(currentBlock.height, y + height - currentBlock.y);
        currentBlock.items.push(item);
        // Update importance based on combined text
        currentBlock.importance = calculateImportance(currentBlock.text);
      }
    });
    
    // Add final block
    if (currentBlock) {
      blocks.push(currentBlock);
    }
    
    // Filter to only include important sections for presentation
    const importantBlocks = blocks.filter(block => block.importance > 0.5);
    
    // Reorder by importance and position
    importantBlocks.sort((a, b) => {
      // First sort by importance (higher first)
      if (b.importance !== a.importance) {
        return b.importance - a.importance;
      }
      // Then by position (top to bottom)
      return a.y - b.y;
    });
    
    // Reassign step numbers
    importantBlocks.forEach((block, index) => {
      block.step = index + 1;
    });
    
    return importantBlocks;
  };

  // Calculate importance score for text content
  const calculateImportance = (text) => {
    const lowerText = text.toLowerCase();
    let score = 0;
    
    // High importance keywords
    const highImportance = [
      'this is not a bill',
      'explanation of benefits',
      'member information',
      'patient name',
      'subscriber number',
      'total claim cost',
      'what you owe',
      'paid by insurer',
      'provider charges',
      'allowed charges',
      'co pay',
      'deductible',
      'coinsurance',
      'customer service',
      'phone number',
      'appeals',
      'coverage',
      'payment',
      'claim number',
      'date of service',
      'service description'
    ];
    
    // Medium importance keywords
    const mediumImportance = [
      'statement date',
      'document number',
      'group number',
      'address',
      'city',
      'state',
      'zip',
      'remark code',
      'billing',
      'insurance',
      'health plan'
    ];
    
    // Check for high importance
    highImportance.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        score += 3;
      }
    });
    
    // Check for medium importance
    mediumImportance.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        score += 1;
      }
    });
    
    // Boost score for financial amounts
    if (lowerText.match(/\$\d+/) || lowerText.match(/total|cost|charge|payment|owe/)) {
      score += 2;
    }
    
    // Boost score for contact information
    if (lowerText.match(/\d{3}-\d{3}-\d{4}/) || lowerText.match(/phone|call|contact/)) {
      score += 2;
    }
    
    // Boost score for important headers
    if (lowerText.match(/^[A-Z][A-Z\s]+$/) && text.length > 10) {
      score += 1;
    }
    
    // Normalize score to 0-1 range
    return Math.min(score / 10, 1);
  };

  // Extract keywords that triggered importance scoring
  const getKeywords = (text) => {
    const lowerText = text.toLowerCase();
    const keywords = [];
    
    const allKeywords = [
      'this is not a bill', 'explanation of benefits', 'member information',
      'patient name', 'subscriber number', 'total claim cost', 'what you owe',
      'paid by insurer', 'provider charges', 'allowed charges', 'co pay',
      'deductible', 'coinsurance', 'customer service', 'phone number',
      'appeals', 'coverage', 'payment', 'claim number', 'date of service',
      'service description', 'statement date', 'document number', 'group number',
      'address', 'city', 'state', 'zip', 'remark code', 'billing', 'insurance',
      'health plan'
    ];
    
    allKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        keywords.push(keyword);
      }
    });
    
    return keywords.slice(0, 3); // Show max 3 keywords
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

  // Generate presentation HTML with Guide.com-style highlighting
  const generatePresentationHTML = (semanticBlocks, viewport, pageNumber, canvas) => {
    const imageDataUrl = canvas.toDataURL('image/png');
    
    // Use the actual canvas dimensions for precise positioning
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Calculate scaling factors between PDF viewport and actual image
    const scaleX = canvasWidth / viewport.width;
    const scaleY = canvasHeight / viewport.height;
    
    console.log('Coordinate Scaling Debug:', {
      viewport: { width: viewport.width, height: viewport.height },
      canvas: { width: canvasWidth, height: canvasHeight },
      scaleX,
      scaleY,
      semanticBlocksCount: semanticBlocks.length
    });
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Guided Presentation - Page ${pageNumber}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a1a;
            color: white;
            overflow: hidden;
        }
        
        .presentation-container {
            position: relative;
            width: 100vw;
            height: 100vh;
            display: flex;
        }
        
        .pdf-viewer {
            position: relative;
            width: 70%;
            height: 100%;
            background: white;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .pdf-background {
            width: ${canvasWidth}px;
            height: ${canvasHeight}px;
            z-index: 1;
        }
        
        .highlight-overlay {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: ${canvasWidth}px;
            height: ${canvasHeight}px;
            z-index: 2;
            pointer-events: none;
        }
        
        .highlight-element {
            position: absolute;
            border: 4px solid #ffd700;
            border-radius: 12px;
            background: rgba(255, 215, 0, 0.3);
            opacity: 0;
            transform: scale(0.8);
            transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: none;
            min-width: 120px;
            min-height: 60px;
        }
        
        .highlight-label {
            position: absolute;
            left: -50px;
            top: 50%;
            transform: translateY(-50%);
            background: #ffd700;
            color: #1a1a1a;
            font-weight: bold;
            font-size: 18px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid #fff;
            line-height: 1;
        }
        
        .highlight-element.active {
            opacity: 1;
            transform: scale(1);
        }
        
        .highlight-element.prev {
            opacity: 0;
            transform: scale(0.8);
        }
        
        
        .arrow {
            position: absolute;
            z-index: 3;
            pointer-events: none;
            opacity: 0;
            transform: scale(0.5);
            transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .arrow.active {
            opacity: 1;
            transform: scale(1);
        }
        
        .arrow svg {
            width: 60px;
            height: 60px;
            filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
        }
        
        .controls-panel {
            width: 30%;
            background: #2a2a2a;
            padding: 20px;
            display: flex;
            flex-direction: column;
            overflow-y: auto;
        }
        
        .step-indicator {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            padding: 15px;
            background: #333;
            border-radius: 10px;
        }
        
        .step-number {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #ffd700;
            color: #1a1a1a;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 18px;
            margin-right: 15px;
        }
        
        .step-content {
            flex: 1;
        }
        
        .step-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 5px;
        }
        
        .step-description {
            font-size: 14px;
            color: #ccc;
            line-height: 1.4;
        }
        
        .navigation {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        
        .nav-btn {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 8px;
            background: #444;
            color: white;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s;
        }
        
        .nav-btn:hover:not(:disabled) {
            background: #555;
        }
        
        .nav-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .play-btn {
            background: #4caf50;
        }
        
        .play-btn:hover:not(:disabled) {
            background: #45a049;
        }
        
        .elements-list {
            flex: 1;
            overflow-y: auto;
        }
        
        .element-item {
            padding: 12px;
            margin: 5px 0;
            background: #333;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            border-left: 4px solid transparent;
        }
        
        .element-item:hover {
            background: #444;
        }
        
        .element-item.active {
            background: #444;
            border-left-color: #ffd700;
        }
        
        .element-item.completed {
            opacity: 0.6;
        }
        
        .element-id {
            font-size: 12px;
            color: #ffd700;
            font-weight: 500;
            margin-bottom: 4px;
        }
        
        .element-text {
            font-size: 13px;
            color: #ccc;
            line-height: 1.3;
        }
        
        .progress-bar {
            width: 100%;
            height: 4px;
            background: #333;
            border-radius: 2px;
            margin-bottom: 20px;
            overflow: hidden;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #ffd700, #ffed4e);
            width: 0%;
            transition: width 0.3s ease;
        }
    </style>
</head>
<body>
    <div class="presentation-container">
        <div class="pdf-viewer">
            <img class="pdf-background" src="${imageDataUrl}" alt="PDF Page" />
            <div class="highlight-overlay" id="highlightOverlay">
                ${semanticBlocks.map((block, index) => {
                    // Add even more generous padding for better visibility
                    const padding = 30; // pixels of padding - even bigger
                    
                    const scaledX = (block.x * scaleX) - padding;
                    const scaledY = (block.y * scaleY) - padding;
                    const scaledWidth = (block.width * scaleX) + (padding * 2);
                    const scaledHeight = (block.height * scaleY) + (padding * 2);
                    
                    // Ensure much larger minimum size for better visibility
                    const minWidth = 180;
                    const minHeight = 100;
                    const finalWidth = Math.max(scaledWidth, minWidth);
                    const finalHeight = Math.max(scaledHeight, minHeight);
                    
                    console.log(`Block ${index} (${block.id}):`, {
                        original: { x: block.x, y: block.y, width: block.width, height: block.height },
                        scaled: { x: scaledX, y: scaledY, width: scaledWidth, height: scaledHeight },
                        final: { x: scaledX, y: scaledY, width: finalWidth, height: finalHeight },
                        text: block.text.substring(0, 50) + '...'
                    });
                    
                    return `
                    <div 
                        class="highlight-element" 
                        id="highlight-${block.id}"
                        data-step="${index}"
                        style="
                            left: ${scaledX}px;
                            top: ${scaledY}px;
                            width: ${finalWidth}px;
                            height: ${finalHeight}px;
                        "
                        title="${block.text.substring(0, 100)}..."
                    >
                        <div class="highlight-label">${index + 1}</div>
                    </div>
                `;
                }).join('')}
            </div>
            <div class="arrow" id="arrow">
                <svg viewBox="0 0 100 100">
                    <path d="M20 50 L80 50 M60 30 L80 50 L60 70" stroke="#ffd700" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
        </div>
        
        <div class="controls-panel">
            <div class="progress-bar">
                <div class="progress-fill" id="progressFill"></div>
            </div>
            
            <div class="navigation">
                <button class="nav-btn" id="prevBtn" onclick="previousStep()">← Previous</button>
                <button class="nav-btn play-btn" id="playBtn" onclick="togglePlay()">▶ Play</button>
                <button class="nav-btn" id="nextBtn" onclick="nextStep()">Next →</button>
            </div>
            
            <div class="step-indicator" id="stepIndicator">
                <div class="step-number" id="stepNumber">01</div>
                <div class="step-content">
                    <div class="step-title" id="stepTitle">Ready to start</div>
                    <div class="step-description" id="stepDescription">Click Play to begin the guided presentation</div>
                </div>
            </div>
            
            <div class="elements-list" id="elementsList">
                ${semanticBlocks.map((block, index) => `
                    <div 
                        class="element-item" 
                        data-step="${index}"
                        onclick="goToStep(${index})"
                    >
                        <div class="element-id">${block.id}</div>
                        <div class="element-text">${block.text.substring(0, 80)}${block.text.length > 80 ? '...' : ''}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>
    
    <script>
        let currentStep = 0;
        let totalSteps = ${semanticBlocks.length};
        let isPlaying = false;
        let playInterval;
        
        const elements = ${JSON.stringify(semanticBlocks)};
        
        function updateStep(step) {
            currentStep = step;
            
            // Update progress
            const progress = ((step + 1) / totalSteps) * 100;
            document.getElementById('progressFill').style.width = progress + '%';
            
            // Update step indicator
            document.getElementById('stepNumber').textContent = String(step + 1).padStart(2, '0');
            document.getElementById('stepTitle').textContent = elements[step]?.id || 'Step ' + (step + 1);
            document.getElementById('stepDescription').textContent = elements[step]?.text || 'No description available';
            
            // Update highlights
            document.querySelectorAll('.highlight-element').forEach((el, index) => {
                el.classList.remove('active', 'prev');
                if (index === step) {
                    el.classList.add('active');
                } else if (index < step) {
                    el.classList.add('prev');
                }
            });
            
            // Update element list
            document.querySelectorAll('.element-item').forEach((el, index) => {
                el.classList.remove('active', 'completed');
                if (index === step) {
                    el.classList.add('active');
                } else if (index < step) {
                    el.classList.add('completed');
                }
            });
            
            // Update navigation buttons
            document.getElementById('prevBtn').disabled = step === 0;
            document.getElementById('nextBtn').disabled = step === totalSteps - 1;
            
            // Position arrow
            if (elements[step]) {
                const element = document.getElementById('highlight-' + elements[step].id);
                const arrow = document.getElementById('arrow');
                const rect = element.getBoundingClientRect();
                const container = document.querySelector('.pdf-viewer');
                const containerRect = container.getBoundingClientRect();
                
                // Calculate arrow position relative to the centered PDF
                const pdfCenterX = containerRect.left + containerRect.width / 2;
                const pdfCenterY = containerRect.top + containerRect.height / 2;
                
                const arrowX = rect.left - pdfCenterX - 80;
                const arrowY = rect.top - pdfCenterY + rect.height / 2 - 30;
                
                arrow.style.left = arrowX + 'px';
                arrow.style.top = arrowY + 'px';
                arrow.classList.add('active');
            }
        }
        
        function nextStep() {
            if (currentStep < totalSteps - 1) {
                updateStep(currentStep + 1);
            }
        }
        
        function previousStep() {
            if (currentStep > 0) {
                updateStep(currentStep - 1);
            }
        }
        
        function goToStep(step) {
            updateStep(step);
        }
        
        function togglePlay() {
            isPlaying = !isPlaying;
            const playBtn = document.getElementById('playBtn');
            
            if (isPlaying) {
                playBtn.textContent = '⏸ Pause';
                playInterval = setInterval(() => {
                    if (currentStep < totalSteps - 1) {
                        nextStep();
                    } else {
                        togglePlay();
                    }
                }, 3000); // 3 seconds per step
            } else {
                playBtn.textContent = '▶ Play';
                clearInterval(playInterval);
            }
        }
        
        // Initialize
        updateStep(0);
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === ' ') {
                e.preventDefault();
                nextStep();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                previousStep();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                togglePlay();
            }
        });
    </script>
</body>
</html>`;
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

  // Download presentation HTML
  const downloadPresentation = () => {
    if (!presentationHTML) return;

    const blob = new Blob([presentationHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guided-presentation-page-${currentPage}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="guided-presentation-container">
      <div className="presentation-header">
        <h2>Guided Presentation Creator</h2>
        <p>Create Guide.com-style step-by-step highlighting presentations</p>
      </div>

      <div className="presentation-controls">
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
              Previous Page
            </button>
            
            <span className="page-info">
              Page {currentPage} of {totalPages}
            </span>
            
            <button 
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              Next Page
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
            
            <button onClick={downloadPresentation} className="download-btn">
              Download Presentation
            </button>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Creating presentation...</p>
        </div>
      )}

      {error && (
        <div className="error">
          <p>Error: {error}</p>
        </div>
      )}

      <div className="presentation-content">
        <div className="canvas-container">
          <h3>PDF Preview</h3>
          <canvas
            ref={canvasRef}
            style={{
              border: '1px solid #ccc',
              margin: '10px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}
          />
        </div>

        {presentationHTML && (
          <div className="presentation-container">
            <h3>Guided Presentation Preview</h3>
            <div 
              dangerouslySetInnerHTML={{ __html: presentationHTML }}
              style={{ 
                width: '100%', 
                height: '600px', 
                border: '1px solid #ccc',
                borderRadius: '8px',
                overflow: 'hidden'
              }}
            />
          </div>
        )}
      </div>

      {semanticData.length > 0 && (
        <div className="presentation-info">
          <h3>Important Sections Found ({semanticData.length})</h3>
          <p>These are the key sections that will be highlighted in the presentation:</p>
          <div className="steps-preview">
            {semanticData.map((block, index) => (
              <div key={index} className="step-preview">
                <div className="step-header">
                  <strong>Step {index + 1}:</strong> {block.id}
                  <span className="importance-score">Importance: {(block.importance * 100).toFixed(0)}%</span>
                </div>
                <div className="step-text">
                  {block.text.substring(0, 120)}...
                </div>
                <div className="step-keywords">
                  {getKeywords(block.text).join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .guided-presentation-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .presentation-header {
          text-align: center;
          margin-bottom: 30px;
        }
        
        .presentation-header h2 {
          color: #333;
          margin-bottom: 10px;
        }
        
        .presentation-controls {
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
          opacity: 0.9;
        }
        
        .presentation-content {
          display: flex;
          gap: 20px;
          margin-bottom: 30px;
        }
        
        .canvas-container, .presentation-container {
          flex: 1;
          text-align: center;
        }
        
        .canvas-container h3, .presentation-container h3 {
          margin-bottom: 15px;
          color: #333;
        }
        
        .presentation-info {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin-top: 20px;
        }
        
        .presentation-info h3 {
          margin-top: 0;
          color: #333;
        }
        
        .steps-preview {
          background: white;
          padding: 15px;
          border-radius: 6px;
          border: 1px solid #e9ecef;
          margin-top: 10px;
        }
        
        .step-preview {
          padding: 12px;
          margin: 8px 0;
          background: #f8f9fa;
          border-radius: 6px;
          font-size: 14px;
          border-left: 4px solid #ffd700;
        }
        
        .step-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        
        .importance-score {
          background: #e3f2fd;
          color: #1976d2;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }
        
        .step-text {
          color: #333;
          line-height: 1.4;
          margin-bottom: 6px;
        }
        
        .step-keywords {
          font-size: 12px;
          color: #666;
          font-style: italic;
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
          .presentation-content {
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

export default GuidedPresentation;
