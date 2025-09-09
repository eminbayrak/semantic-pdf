import React, { useRef, useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import GPTNarrativeGenerator from '../Services/GPTNarrativeGenerator';
import AzureTTSService from '../Services/AzureTTSService';

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
  const [narrativeScript, setNarrativeScript] = useState(null);
  const [isGeneratingNarrative, setIsGeneratingNarrative] = useState(false);
  const [narrativeError, setNarrativeError] = useState(null);
  const [audioData, setAudioData] = useState(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioError, setAudioError] = useState(null);

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
      setNarrativeScript(null);
      setAudioData(null);

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
      
      // Extract PDF text for GPT-4o analysis
      const pdfText = await extractPDFText(pdf, pageNumber);
      console.log('📄 Extracted PDF text:', pdfText.substring(0, 200) + '...');
      
      // Generate GPT-4o narrative script
      const generatedNarrative = await generateNarrativeScript(pdfText, semanticBlocks);
      
      // Generate audio for the narrative script
      let generatedAudio = null;
      if (generatedNarrative && generatedNarrative.steps) {
        generatedAudio = await generateAudioForNarrative(generatedNarrative);
      }
      
      // Generate presentation HTML with the generated data
      const html = generatePresentationHTMLWithData(semanticBlocks, viewport, pageNumber, canvas, generatedNarrative, generatedAudio);
      setPresentationHTML(html);
      
    } catch (err) {
      console.error('Error loading page:', err);
      setError(`Failed to load page ${pageNumber}: ${err.message}`);
    }
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
      if (b.importance !== a.importance) {
        return b.importance - a.importance;
      }
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
    
    const highImportance = [
      'this is not a bill', 'explanation of benefits', 'member information',
      'patient name', 'subscriber number', 'total claim cost', 'what you owe',
      'paid by insurer', 'provider charges', 'allowed charges', 'co pay',
      'deductible', 'coinsurance', 'customer service', 'phone number',
      'appeals', 'coverage', 'payment', 'claim number', 'date of service',
      'service description'
    ];
    
    highImportance.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        score += 3;
      }
    });
    
    if (lowerText.match(/\$\d+/) || lowerText.match(/total|cost|charge|payment|owe/)) {
      score += 2;
    }
    
    if (lowerText.match(/\d{3}-\d{3}-\d{4}/) || lowerText.match(/phone|call|contact/)) {
      score += 2;
    }
    
    return Math.min(score / 10, 1);
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

  // Extract text from PDF page
  const extractPDFText = async (pdfDocument, pageNumber) => {
    try {
      const page = await pdfDocument.getPage(pageNumber);
      const textContent = await page.getTextContent();
      
      const fullText = textContent.items
        .map(item => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      return fullText;
    } catch (error) {
      console.error('❌ Error extracting PDF text:', error);
      return '';
    }
  };

  // Generate GPT-4o narrative script
  const generateNarrativeScript = async (pdfText, semanticBlocks) => {
    try {
      setIsGeneratingNarrative(true);
      setNarrativeError(null);
      
      const narrativeGenerator = new GPTNarrativeGenerator();
      const result = await narrativeGenerator.generateNarrativeScript(pdfText, semanticBlocks);
      
      if (result.success) {
        setNarrativeScript(result.narrative);
        console.log('🎬 Generated narrative script:', result.narrative);
        return result.narrative;
      } else {
        setNarrativeError(result.error);
        console.error('❌ Failed to generate narrative:', result.error);
        return null;
      }
    } catch (error) {
      console.error('❌ Error generating narrative script:', error);
      setNarrativeError(error.message);
      return null;
    } finally {
      setIsGeneratingNarrative(false);
    }
  };

  // Generate audio for narrative script
  const generateAudioForNarrative = async (narrative) => {
    try {
      setIsGeneratingAudio(true);
      setAudioError(null);
      
      const ttsService = new AzureTTSService();
      const result = await ttsService.generateNarrativeAudio(narrative);
      
      if (result.success) {
        setAudioData(result);
        console.log('🎵 Generated audio for narrative:', result);
        return result;
      } else {
        setAudioError(result.error);
        console.error('❌ Failed to generate audio:', result.error);
        return null;
      }
    } catch (error) {
      console.error('❌ Error generating audio:', error);
      setAudioError(error.message);
      return null;
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Generate presentation HTML with passed data
  const generatePresentationHTMLWithData = (semanticBlocks, viewport, pageNumber, canvas, narrativeData, audioData) => {
    const imageDataUrl = canvas.toDataURL('image/png');
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Debug logging
    console.log('🎵 Audio data for HTML generation:', audioData);
    console.log('📝 Narrative script for HTML generation:', narrativeData);
    
    // Prepare audio data for embedding - convert ArrayBuffer to base64
    const audioDataForHTML = audioData && audioData.audioSteps ? audioData.audioSteps.map(step => {
      console.log('🎵 Processing step audio:', step);
      if (step.success && step.audioData) {
        try {
          // Convert ArrayBuffer to base64 string for embedding
          const uint8Array = new Uint8Array(step.audioData);
          // Convert ArrayBuffer to base64 string for embedding (safer method)
          let binaryString = '';
          const chunkSize = 8192; // Process in chunks to avoid stack overflow
          
          for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.slice(i, i + chunkSize);
            binaryString += String.fromCharCode.apply(null, chunk);
          }
          
          const base64String = btoa(binaryString);
          console.log('🎵 Converted to base64, length:', base64String.length);
          return {
            stepNumber: step.stepNumber,
            audioData: `data:audio/mpeg;base64,${base64String}`,
            duration: step.duration,
            text: step.text
          };
        } catch (error) {
          console.error('🎵 Error converting audio to base64:', error);
          return {
            stepNumber: step.stepNumber,
            audioData: null,
            duration: step.duration,
            text: step.text
          };
        }
      }
      console.log('🎵 No audio data for step:', step.stepNumber);
      return {
        stepNumber: step.stepNumber,
        audioData: null,
        duration: step.duration,
        text: step.text
      };
    }) : [];
    
    console.log('🎵 Final audio data for HTML:', audioDataForHTML);
    
    const scaleX = canvasWidth / viewport.width;
    const scaleY = canvasHeight / viewport.height;
    
    return `

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Guided Presentation - Page ${pageNumber}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #1a1a1a; color: white; }
        .container { display: flex; height: 100vh; }
        .pdf-viewer { flex: 1; background: white; position: relative; display: flex; align-items: center; justify-content: center; }
        .pdf-background { width: ${canvasWidth}px; height: ${canvasHeight}px; z-index: 1; }
        .highlight-overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: ${canvasWidth}px; height: ${canvasHeight}px; z-index: 2; pointer-events: none; }
        .highlight-element { position: absolute; border: 4px solid #ffd700; border-radius: 12px; background: transparent; opacity: 0; transform: scale(0.8); transition: all 0.5s; pointer-events: none; min-width: 120px; min-height: 60px; }
        .highlight-label { position: absolute; left: -50px; top: 50%; transform: translateY(-50%); background: #ffd700; color: #1a1a1a; font-weight: bold; font-size: 18px; width: 40px; height: 40px; border-radius: 50%; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4); text-align: center; display: flex; align-items: center; justify-content: center; border: 3px solid #fff; line-height: 1; }
        .highlight-element.active { opacity: 1; transform: scale(1); }
        .highlight-element.prev { opacity: 0; transform: scale(0.8); }
        .controls { width: 300px; background: #2a2a2a; padding: 20px; overflow-y: auto; }
        .controls h3 { margin-bottom: 20px; color: #ffd700; }
        .step-info { background: #333; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .step-number { font-size: 24px; font-weight: bold; color: #ffd700; margin-bottom: 10px; }
        .step-title { font-size: 18px; margin-bottom: 10px; }
        .step-narrative { font-size: 14px; color: #ccc; line-height: 1.4; }
        .audio-controls { display: flex; gap: 10px; margin-bottom: 20px; }
        .btn { padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; font-weight: bold; transition: all 0.3s; }
        .btn-play { background: #4CAF50; color: white; }
        .btn-pause { background: #ff9800; color: white; }
        .btn-stop { background: #f44336; color: white; }
        .btn:hover { opacity: 0.8; transform: translateY(-2px); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .progress-container { background: #444; height: 8px; border-radius: 4px; margin-bottom: 20px; overflow: hidden; }
        .progress-fill { height: 100%; background: #ffd700; width: 0%; transition: width 0.3s; }
        .element-list { max-height: 300px; overflow-y: auto; }
        .element-item { padding: 10px; border: 1px solid #444; margin-bottom: 5px; border-radius: 4px; cursor: pointer; transition: all 0.3s; }
        .element-item:hover { background: #444; }
        .element-item.active { background: #444; border-left: 4px solid #ffd700; }
        .element-id { font-weight: bold; color: #ffd700; font-size: 12px; }
        .element-text { color: #ccc; font-size: 11px; margin-top: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="pdf-viewer">
            <img src="${imageDataUrl}" alt="PDF Page ${pageNumber}" class="pdf-background">
            <div class="highlight-overlay" id="highlightOverlay">
                ${semanticBlocks.map((block, index) => {
                    const x = block.x * scaleX;
                    const y = block.y * scaleY;
                    const width = block.width * scaleX;
                    const height = block.height * scaleY;
                    return `
                        <div class="highlight-element" id="highlight-${index}" style="left: ${x}px; top: ${y}px; width: ${width}px; height: ${height}px;">
                            <div class="highlight-label">${index + 1}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        
        <div class="controls">
            <h3>Guided Presentation</h3>
            
            <div class="step-info">
                <div class="step-number" id="stepNumber">01</div>
                <div class="step-title" id="stepTitle">Step 1</div>
                <div class="step-narrative" id="stepDescription">Click play to start the presentation</div>
            </div>
            
            <div class="audio-controls">
                <button class="btn btn-play" id="playBtn" onclick="togglePlay()">Play</button>
                <button class="btn btn-pause" id="pauseBtn" onclick="pausePlay()" disabled>Pause</button>
                <button class="btn btn-stop" id="stopBtn" onclick="stopPlay()" disabled>Stop</button>
            </div>
            
            <div class="progress-container">
                <div class="progress-fill" id="progressFill"></div>
            </div>
            
            <div class="element-list" id="elementList">
                ${semanticBlocks.map((block, index) => `
                    <div class="element-item" onclick="goToStep(${index})">
                        <div class="element-id">${block.id}</div>
                        <div class="element-text">${block.text.substring(0, 100)}...</div>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>

    <script>
        const elements = ${JSON.stringify(semanticBlocks)};
        const audioData = ${JSON.stringify(audioDataForHTML)};
        const narrativeScript = ${JSON.stringify(narrativeData)};
        const totalSteps = elements.length;
        let currentStep = 0;
        let isPlaying = false;
        let playInterval;
        let audioContext = null;
        let currentAudio = null;
        
        function updateStep(step) {
            currentStep = step;
            
            // Update step info with narrative script data
            document.getElementById('stepNumber').textContent = String(step + 1).padStart(2, '0');
            
            if (narrativeScript && narrativeScript.steps && narrativeScript.steps[step]) {
                const stepData = narrativeScript.steps[step];
                document.getElementById('stepTitle').textContent = stepData.title || \`Step \${step + 1}\`;
                document.getElementById('stepDescription').textContent = stepData.narrative || elements[step]?.text || 'No description';
            } else {
                document.getElementById('stepTitle').textContent = elements[step]?.id || 'Step ' + (step + 1);
                document.getElementById('stepDescription').textContent = elements[step]?.text || 'No description';
            }
            
            // Update progress
            const progress = ((step + 1) / totalSteps) * 100;
            document.getElementById('progressFill').style.width = progress + '%';
            
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
                el.classList.toggle('active', index === step);
            });
        }
        
        function nextStep() {
            if (currentStep < totalSteps - 1) {
                updateStep(currentStep + 1);
                if (isPlaying) {
                    playStepAudio(currentStep);
                }
            } else {
                stopPlay();
            }
        }
        
        function previousStep() {
            if (currentStep > 0) {
                updateStep(currentStep - 1);
                if (isPlaying) {
                    playStepAudio(currentStep);
                }
            }
        }
        
        function goToStep(step) {
            updateStep(step);
            if (isPlaying) {
                playStepAudio(step);
            }
        }
        
        function togglePlay() {
            if (isPlaying) {
                pausePlay();
            } else {
                startPlay();
            }
        }
        
        function startPlay() {
            console.log('🎮 ===== START PLAY CALLED =====');
            console.log('🎮 isPlaying:', isPlaying);
            console.log('🎮 currentStep:', currentStep);
            console.log('🎮 totalSteps:', totalSteps);
            console.log('🎮 audioData exists:', !!audioData);
            console.log('🎮 audioData length:', audioData ? audioData.length : 'null');
            console.log('🎮 audioData type:', typeof audioData);
            console.log('🎮 audioData[currentStep] exists:', !!(audioData && audioData[currentStep]));
            console.log('🎮 audioData[currentStep].audioData exists:', !!(audioData && audioData[currentStep] && audioData[currentStep].audioData));
            
            isPlaying = true;
            updateStep(currentStep);
            
            // Check if we have audio data
            if (audioData && audioData.length > 0 && audioData[currentStep] && audioData[currentStep].audioData) {
                console.log('✅ Playing with audio');
                playStepAudio(currentStep);
            } else {
                console.log('❌ Playing without audio - using timed progression');
                console.log('❌ Audio check failed:');
                console.log('❌ - audioData exists:', !!audioData);
                console.log('❌ - audioData.length > 0:', !!(audioData && audioData.length > 0));
                console.log('❌ - audioData[currentStep] exists:', !!(audioData && audioData[currentStep]));
                console.log('❌ - audioData[currentStep].audioData exists:', !!(audioData && audioData[currentStep] && audioData[currentStep].audioData));
                playInterval = setInterval(() => {
                    if (currentStep < totalSteps - 1) {
                        nextStep();
                    } else {
                        stopPlay();
                    }
                }, 3000);
            }
        }
        
        async function playStepAudio(stepIndex) {
            console.log('🎵 ===== PLAY STEP AUDIO CALLED =====');
            console.log('🎵 Step index:', stepIndex);
            console.log('🎵 Total steps:', totalSteps);
            console.log('🎵 Audio data available:', !!audioData);
            console.log('🎵 Audio data type:', typeof audioData);
            console.log('🎵 Audio data length:', audioData ? audioData.length : 'null');
            console.log('🎵 Audio data keys:', audioData ? Object.keys(audioData) : 'null');
            console.log('🎵 Step audio data exists:', !!(audioData && audioData[stepIndex]));
            console.log('🎵 Step audio data:', audioData ? audioData[stepIndex] : 'No audio data');
            
            if (audioData && audioData[stepIndex]) {
                console.log('🎵 Step audio data details:');
                console.log('🎵 - success:', audioData[stepIndex].success);
                console.log('🎵 - has audioData:', !!audioData[stepIndex].audioData);
                console.log('🎵 - audioData type:', typeof audioData[stepIndex].audioData);
                console.log('🎵 - audioData length:', audioData[stepIndex].audioData ? audioData[stepIndex].audioData.length : 'null');
                console.log('🎵 - text:', audioData[stepIndex].text);
                console.log('🎵 - duration:', audioData[stepIndex].duration);
            }
            
            if (!audioData || !audioData[stepIndex] || !audioData[stepIndex].audioData) {
                console.log('❌ No audio data for step', stepIndex, '- using fallback timing');
                console.log('❌ Reasons:');
                console.log('❌ - audioData exists:', !!audioData);
                console.log('❌ - audioData[stepIndex] exists:', !!(audioData && audioData[stepIndex]));
                console.log('❌ - audioData[stepIndex].audioData exists:', !!(audioData && audioData[stepIndex] && audioData[stepIndex].audioData));
                setTimeout(() => {
                    if (stepIndex < totalSteps - 1) {
                        nextStep();
                    } else {
                        stopPlay();
                    }
                }, 3000);
                return;
            }
            
            try {
                // Create audio element for base64 data
                const audio = new Audio(audioData[stepIndex].audioData);
                
                audio.onended = () => {
                    console.log('Audio finished for step', stepIndex);
                    if (stepIndex < totalSteps - 1) {
                        setTimeout(() => {
                            nextStep();
                        }, 500);
                    } else {
                        stopPlay();
                    }
                };
                
                audio.onerror = (error) => {
                    console.error('Audio playback error:', error);
                    setTimeout(() => {
                        if (stepIndex < totalSteps - 1) {
                            nextStep();
                        } else {
                            stopPlay();
                        }
                    }, 3000);
                };
                
                // Stop current audio
                if (currentAudio) {
                    currentAudio.pause();
                    currentAudio.currentTime = 0;
                }
                
                currentAudio = audio;
                await audio.play();
                console.log('Successfully started audio for step', stepIndex);
                
            } catch (error) {
                console.error('Error playing audio:', error);
                setTimeout(() => {
                    if (stepIndex < totalSteps - 1) {
                        nextStep();
                    } else {
                        stopPlay();
                    }
                }, 3000);
            }
        }
        
        function pausePlay() {
            isPlaying = false;
            updateStep(currentStep);
            
            if (currentAudio) {
                currentAudio.pause();
            }
            
            if (playInterval) {
                clearInterval(playInterval);
                playInterval = null;
            }
        }
        
        function stopPlay() {
            isPlaying = false;
            currentStep = 0;
            updateStep(0);
            
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
                currentAudio = null;
            }
            
            if (playInterval) {
                clearInterval(playInterval);
                playInterval = null;
            }
        }
        
        // Initialize
        updateStep(0);
        
        // Debug logging
        console.log('🎬 Presentation loaded');
        console.log('🎵 Audio data:', audioData);
        console.log('📝 Narrative script:', narrativeScript);
        console.log('📍 Elements:', elements);
        console.log('🎵 Audio data type:', typeof audioData);
        console.log('🎵 Audio data length:', audioData ? audioData.length : 'null');
        console.log('🎵 Audio data keys:', audioData ? Object.keys(audioData) : 'null');
        if (audioData && audioData[0]) {
            console.log('🎵 First audio step:', audioData[0]);
            console.log('🎵 First audio step has audioData:', !!audioData[0].audioData);
            console.log('🎵 First audio step audioData type:', typeof audioData[0].audioData);
            console.log('🎵 First audio step audioData length:', audioData[0].audioData ? audioData[0].audioData.length : 'null');
        }
        
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

  // Generate presentation HTML
  const generatePresentationHTML = (semanticBlocks, viewport, pageNumber, canvas) => {
    const imageDataUrl = canvas.toDataURL('image/png');
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Debug logging
    console.log('🎵 Audio data for HTML generation:', audioData);
    console.log('📝 Narrative script for HTML generation:', narrativeScript);
    
    // Prepare audio data for embedding - convert ArrayBuffer to base64
    const audioDataForHTML = audioData && audioData.audioSteps ? audioData.audioSteps.map(step => {
      console.log('🎵 Processing step audio:', step);
      if (step.success && step.audioData) {
        try {
          // Convert ArrayBuffer to base64 string for embedding
          const uint8Array = new Uint8Array(step.audioData);
          // Convert ArrayBuffer to base64 string for embedding (safer method)
          let binaryString = '';
          const chunkSize = 8192; // Process in chunks to avoid stack overflow
          
          for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.slice(i, i + chunkSize);
            binaryString += String.fromCharCode.apply(null, chunk);
          }
          
          const base64String = btoa(binaryString);
          console.log('🎵 Converted to base64, length:', base64String.length);
          return {
            stepNumber: step.stepNumber,
            audioData: `data:audio/mpeg;base64,${base64String}`,
            duration: step.duration,
            text: step.text
          };
        } catch (error) {
          console.error('🎵 Error converting audio to base64:', error);
          return {
            stepNumber: step.stepNumber,
            audioData: null,
            duration: step.duration,
            text: step.text
          };
        }
      }
      console.log('🎵 No audio data for step:', step.stepNumber);
      return {
        stepNumber: step.stepNumber,
        audioData: null,
        duration: step.duration,
        text: step.text
      };
    }) : [];
    
    console.log('🎵 Final audio data for HTML:', audioDataForHTML);
    
    const scaleX = canvasWidth / viewport.width;
    const scaleY = canvasHeight / viewport.height;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Guided Presentation - Page ${pageNumber}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #1a1a1a; color: white; }
        .container { display: flex; height: 100vh; }
        .pdf-viewer { flex: 1; background: white; position: relative; display: flex; align-items: center; justify-content: center; }
        .pdf-background { width: ${canvasWidth}px; height: ${canvasHeight}px; z-index: 1; }
        .highlight-overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: ${canvasWidth}px; height: ${canvasHeight}px; z-index: 2; pointer-events: none; }
        .highlight-element { position: absolute; border: 4px solid #ffd700; border-radius: 12px; background: transparent; opacity: 0; transform: scale(0.8); transition: all 0.5s; pointer-events: none; min-width: 120px; min-height: 60px; }
        .highlight-label { position: absolute; left: -50px; top: 50%; transform: translateY(-50%); background: #ffd700; color: #1a1a1a; font-weight: bold; font-size: 18px; width: 40px; height: 40px; border-radius: 50%; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4); text-align: center; display: flex; align-items: center; justify-content: center; border: 3px solid #fff; line-height: 1; }
        .highlight-element.active { opacity: 1; transform: scale(1); }
        .highlight-element.prev { opacity: 0; transform: scale(0.8); }
        .controls { width: 300px; background: #2a2a2a; padding: 20px; overflow-y: auto; }
        .controls h3 { margin-bottom: 20px; color: #ffd700; }
        .step-info { background: #333; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .step-number { font-size: 24px; font-weight: bold; color: #ffd700; margin-bottom: 10px; }
        .step-title { font-size: 16px; margin-bottom: 10px; }
        .step-description { font-size: 14px; color: #ccc; line-height: 1.4; }
        .controls-buttons { display: flex; gap: 10px; margin-bottom: 20px; }
        .btn { padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; }
        .btn-primary { background: #007bff; color: white; }
        .btn-success { background: #28a745; color: white; }
        .btn-danger { background: #dc3545; color: white; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .progress-bar { width: 100%; height: 4px; background: #333; border-radius: 2px; margin-bottom: 20px; }
        .progress-fill { height: 100%; background: #ffd700; width: 0%; transition: width 0.3s; }
        .elements-list { max-height: 400px; overflow-y: auto; }
        .element-item { padding: 10px; margin: 5px 0; background: #333; border-radius: 5px; cursor: pointer; transition: background 0.2s; }
        .element-item:hover { background: #444; }
        .element-item.active { background: #444; border-left: 4px solid #ffd700; }
        .element-id { font-size: 12px; color: #ffd700; margin-bottom: 5px; }
        .element-text { font-size: 13px; color: #ccc; }
    </style>
</head>
<body>
    <div class="container">
        <div class="pdf-viewer">
            <img class="pdf-background" src="${imageDataUrl}" alt="PDF Page" />
            <div class="highlight-overlay" id="highlightOverlay">
                ${semanticBlocks.map((block, index) => {
                    const padding = 30;
                    const scaledX = (block.x * scaleX) - padding;
                    const scaledY = (block.y * scaleY) - padding;
                    const scaledWidth = (block.width * scaleX) + (padding * 2);
                    const scaledHeight = (block.height * scaleY) + (padding * 2);
                    const minWidth = 180;
                    const minHeight = 100;
                    const finalWidth = Math.max(scaledWidth, minWidth);
                    const finalHeight = Math.max(scaledHeight, minHeight);
                    
                    return `
                    <div class="highlight-element" id="highlight-${block.id}" data-step="${index}" style="left: ${scaledX}px; top: ${scaledY}px; width: ${finalWidth}px; height: ${finalHeight}px;">
                        <div class="highlight-label">${index + 1}</div>
                    </div>
                    `;
                }).join('')}
            </div>
        </div>
        
        <div class="controls">
            <h3>Guided Presentation</h3>
            
            <div class="step-info">
                <div class="step-number" id="stepNumber">01</div>
                <div class="step-title" id="stepTitle">Ready to start</div>
                <div class="step-description" id="stepDescription">Click Play to begin</div>
            </div>
            
            <div class="progress-bar">
                <div class="progress-fill" id="progressFill"></div>
            </div>
            
            <div class="controls-buttons">
                <button class="btn btn-primary" id="playBtn" onclick="togglePlay()">▶ Play</button>
                <button class="btn btn-danger" id="pauseBtn" onclick="pausePlay()" disabled>⏸ Pause</button>
                <button class="btn btn-danger" id="stopBtn" onclick="stopPlay()" disabled>⏹ Stop</button>
            </div>
            
            <div class="elements-list" id="elementsList">
                ${semanticBlocks.map((block, index) => `
                    <div class="element-item" data-step="${index}" onclick="goToStep(${index})">
                        <div class="element-id">${block.id}</div>
                        <div class="element-text">${block.text.substring(0, 80)}${block.text.length > 80 ? '...' : ''}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>

    <script>
        const audioData = ${JSON.stringify(audioDataForHTML)};
        const narrativeScript = ${JSON.stringify(narrativeScript)};
        const elements = ${JSON.stringify(semanticBlocks)};
        
        let currentStep = 0;
        let totalSteps = ${semanticBlocks.length};
        let isPlaying = false;
        let playInterval;
        let audioContext = null;
        let currentAudio = null;
        
        function updateStep(step) {
            currentStep = step;
            
            // Update step info with narrative script data
            document.getElementById('stepNumber').textContent = String(step + 1).padStart(2, '0');
            
            if (narrativeScript && narrativeScript.steps && narrativeScript.steps[step]) {
                const stepData = narrativeScript.steps[step];
                document.getElementById('stepTitle').textContent = stepData.title || \`Step \${step + 1}\`;
                document.getElementById('stepDescription').textContent = stepData.narrative || elements[step]?.text || 'No description';
            } else {
                document.getElementById('stepTitle').textContent = elements[step]?.id || 'Step ' + (step + 1);
                document.getElementById('stepDescription').textContent = elements[step]?.text || 'No description';
            }
            
            // Update progress
            const progress = ((step + 1) / totalSteps) * 100;
            document.getElementById('progressFill').style.width = progress + '%';
            
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
                el.classList.remove('active');
                if (index === step) {
                    el.classList.add('active');
                }
            });
            
            // Update buttons
            document.getElementById('playBtn').disabled = false;
            document.getElementById('pauseBtn').disabled = !isPlaying;
            document.getElementById('stopBtn').disabled = !isPlaying;
        }
        
        function nextStep() {
            if (currentStep < totalSteps - 1) {
                currentStep++;
                updateStep(currentStep);
            }
        }
        
        function previousStep() {
            if (currentStep > 0) {
                currentStep--;
                updateStep(currentStep);
            }
        }
        
        function goToStep(step) {
            updateStep(step);
        }
        
        function togglePlay() {
            if (isPlaying) {
                pausePlay();
            } else {
                startPlay();
            }
        }
        
        function startPlay() {
            console.log('🎮 ===== START PLAY CALLED =====');
            console.log('🎮 isPlaying:', isPlaying);
            console.log('🎮 currentStep:', currentStep);
            console.log('🎮 totalSteps:', totalSteps);
            console.log('🎮 audioData exists:', !!audioData);
            console.log('🎮 audioData length:', audioData ? audioData.length : 'null');
            console.log('🎮 audioData type:', typeof audioData);
            console.log('🎮 audioData[currentStep] exists:', !!(audioData && audioData[currentStep]));
            console.log('🎮 audioData[currentStep].audioData exists:', !!(audioData && audioData[currentStep] && audioData[currentStep].audioData));
            
            isPlaying = true;
            updateStep(currentStep);
            
            // Check if we have audio data
            if (audioData && audioData.length > 0 && audioData[currentStep] && audioData[currentStep].audioData) {
                console.log('✅ Playing with audio');
                playStepAudio(currentStep);
            } else {
                console.log('❌ Playing without audio - using timed progression');
                console.log('❌ Audio check failed:');
                console.log('❌ - audioData exists:', !!audioData);
                console.log('❌ - audioData.length > 0:', !!(audioData && audioData.length > 0));
                console.log('❌ - audioData[currentStep] exists:', !!(audioData && audioData[currentStep]));
                console.log('❌ - audioData[currentStep].audioData exists:', !!(audioData && audioData[currentStep] && audioData[currentStep].audioData));
                playInterval = setInterval(() => {
                    if (currentStep < totalSteps - 1) {
                        nextStep();
                    } else {
                        stopPlay();
                    }
                }, 3000);
            }
        }
        
        async function playStepAudio(stepIndex) {
            console.log('🎵 ===== PLAY STEP AUDIO CALLED =====');
            console.log('🎵 Step index:', stepIndex);
            console.log('🎵 Total steps:', totalSteps);
            console.log('🎵 Audio data available:', !!audioData);
            console.log('🎵 Audio data type:', typeof audioData);
            console.log('🎵 Audio data length:', audioData ? audioData.length : 'null');
            console.log('🎵 Audio data keys:', audioData ? Object.keys(audioData) : 'null');
            console.log('🎵 Step audio data exists:', !!(audioData && audioData[stepIndex]));
            console.log('🎵 Step audio data:', audioData ? audioData[stepIndex] : 'No audio data');
            
            if (audioData && audioData[stepIndex]) {
                console.log('🎵 Step audio data details:');
                console.log('🎵 - success:', audioData[stepIndex].success);
                console.log('🎵 - has audioData:', !!audioData[stepIndex].audioData);
                console.log('🎵 - audioData type:', typeof audioData[stepIndex].audioData);
                console.log('🎵 - audioData length:', audioData[stepIndex].audioData ? audioData[stepIndex].audioData.length : 'null');
                console.log('🎵 - text:', audioData[stepIndex].text);
                console.log('🎵 - duration:', audioData[stepIndex].duration);
            }
            
            if (!audioData || !audioData[stepIndex] || !audioData[stepIndex].audioData) {
                console.log('❌ No audio data for step', stepIndex, '- using fallback timing');
                console.log('❌ Reasons:');
                console.log('❌ - audioData exists:', !!audioData);
                console.log('❌ - audioData[stepIndex] exists:', !!(audioData && audioData[stepIndex]));
                console.log('❌ - audioData[stepIndex].audioData exists:', !!(audioData && audioData[stepIndex] && audioData[stepIndex].audioData));
                setTimeout(() => {
                    if (stepIndex < totalSteps - 1) {
                        nextStep();
                    } else {
                        stopPlay();
                    }
                }, 3000);
                return;
            }
            
            try {
                // Create audio element for base64 data
                const audio = new Audio(audioData[stepIndex].audioData);
                
                audio.onended = () => {
                    console.log('Audio finished for step', stepIndex);
                    if (stepIndex < totalSteps - 1) {
                        setTimeout(() => {
                            nextStep();
                        }, 500);
                    } else {
                        stopPlay();
                    }
                };
                
                audio.onerror = (error) => {
                    console.error('Audio playback error:', error);
                    setTimeout(() => {
                        if (stepIndex < totalSteps - 1) {
                            nextStep();
                        } else {
                            stopPlay();
                        }
                    }, 3000);
                };
                
                // Stop current audio
                if (currentAudio) {
                    currentAudio.pause();
                    currentAudio.currentTime = 0;
                }
                
                currentAudio = audio;
                await audio.play();
                console.log('Successfully started audio for step', stepIndex);
                
            } catch (error) {
                console.error('Error playing audio:', error);
                setTimeout(() => {
                    if (stepIndex < totalSteps - 1) {
                        nextStep();
                    } else {
                        stopPlay();
                    }
                }, 3000);
            }
        }
        
        function pausePlay() {
            isPlaying = false;
            updateStep(currentStep);
            
            if (currentAudio) {
                currentAudio.pause();
            }
            
            if (playInterval) {
                clearInterval(playInterval);
                playInterval = null;
            }
        }
        
        function stopPlay() {
            isPlaying = false;
            currentStep = 0;
            updateStep(0);
            
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
                currentAudio = null;
            }
            
            if (playInterval) {
                clearInterval(playInterval);
                playInterval = null;
            }
        }
        
        // Initialize
        updateStep(0);
        
        // Debug logging
        console.log('🎬 Presentation loaded');
        console.log('🎵 Audio data:', audioData);
        console.log('📝 Narrative script:', narrativeScript);
        console.log('📍 Elements:', elements);
        console.log('🎵 Audio data type:', typeof audioData);
        console.log('🎵 Audio data length:', audioData ? audioData.length : 'null');
        console.log('🎵 Audio data keys:', audioData ? Object.keys(audioData) : 'null');
        if (audioData && audioData[0]) {
            console.log('🎵 First audio step:', audioData[0]);
            console.log('🎵 First audio step has audioData:', !!audioData[0].audioData);
            console.log('🎵 First audio step audioData type:', typeof audioData[0].audioData);
            console.log('🎵 First audio step audioData length:', audioData[0].audioData ? audioData[0].audioData.length : 'null');
        }
        
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
          className="file-input"
        />

        {/* Status Messages */}
        {isGeneratingNarrative && (
          <div className="status-message generating">
            <div className="spinner"></div>
            <span>🤖 GPT-4o is analyzing your PDF and generating narrative script...</span>
          </div>
        )}

        {narrativeError && (
          <div className="status-message error">
            <strong>❌ Narrative Generation Failed:</strong> {narrativeError}
          </div>
        )}

        {narrativeScript && (
          <div className="status-message success">
            <strong>✅ GPT-4o Narrative Generated!</strong>
            <div className="details">
              <div><strong>Title:</strong> {narrativeScript.title}</div>
              <div><strong>Steps:</strong> {narrativeScript.steps?.length || 0}</div>
              <div><strong>Total Duration:</strong> {narrativeScript.totalDuration || 0} seconds</div>
            </div>
          </div>
        )}

        {isGeneratingAudio && (
          <div className="status-message generating">
            <div className="spinner"></div>
            <span>🎵 Azure TTS is generating audio narration...</span>
          </div>
        )}

        {audioError && (
          <div className="status-message error">
            <strong>❌ Audio Generation Failed:</strong> {audioError}
          </div>
        )}

        {audioData && (
          <div className="status-message success">
            <strong>🎵 Audio Narration Ready!</strong>
            <div className="details">
              <div><strong>Audio Steps:</strong> {audioData.successSteps || 0} / {audioData.totalSteps || 0}</div>
              <div><strong>Total Duration:</strong> {audioData.totalDuration || 0} seconds</div>
              <div><strong>Status:</strong> {audioData.readyToPlay ? '✅ Ready to Play' : '⚠️ Partial Audio'}</div>
            </div>
          </div>
        )}
        
        {/* Manual Audio Generation Button */}
        {narrativeScript && !audioData && (
          <div className="status-message">
            <button
              onClick={generateAudioForNarrative}
              disabled={isGeneratingAudio}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium"
            >
              {isGeneratingAudio ? 'Generating Audio...' : '🎵 Generate Audio for Presentation'}
            </button>
          </div>
        )}
        
        {/* Regenerate HTML Button */}
        {audioData && semanticData && (
          <div className="status-message">
            <button
              onClick={() => {
                if (pdfDocument) {
                  loadPage(pdfDocument, currentPage);
                }
              }}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              🔄 Regenerate HTML with Audio
            </button>
          </div>
        )}
        
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
            className="pdf-canvas"
          />
        </div>

        {presentationHTML && (
          <div className="presentation-container">
            <h3>Guided Presentation Preview</h3>
            <div 
              dangerouslySetInnerHTML={{ __html: presentationHTML }}
              className="presentation-iframe"
            />
          </div>
        )}
      </div>

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
        
        .file-input {
          margin-bottom: 20px;
          padding: 10px;
          border: 2px dashed #ccc;
          border-radius: 8px;
          width: 100%;
          max-width: 400px;
        }
        
        .status-message {
          padding: 15px;
          border-radius: 8px;
          margin: 10px 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .status-message.generating {
          background: #e3f2fd;
          color: #1976d2;
          border: 1px solid #bbdefb;
        }
        
        .status-message.success {
          background: #e8f5e8;
          color: #2e7d32;
          border: 1px solid #c8e6c9;
        }
        
        .status-message.error {
          background: #ffebee;
          color: #c62828;
          border: 1px solid #ffcdd2;
        }
        
        .status-message .details {
          margin-top: 10px;
          font-size: 14px;
        }
        
        .status-message .details div {
          margin: 2px 0;
        }
        
        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid #f3f3f3;
          border-top: 2px solid #1976d2;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
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
        
        .pdf-canvas {
          border: 1px solid #ccc;
          margin: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .presentation-iframe {
          width: 100%;
          height: 600px;
          border: 1px solid #ccc;
          border-radius: 8px;
          overflow: hidden;
        }
        
        .loading {
          text-align: center;
          padding: 40px;
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