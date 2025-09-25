import React, { useRef, useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import GPTNarrativeGenerator from '../Services/GPTNarrativeGenerator';
import AzureTTSService from '../Services/AzureTTSService';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';

/**
 * Guided Presentation Component with Zoom Functionality
 * Creates Guide.com-style step-by-step highlighting presentation with zoom controls
 */
const GuidedPresentationWithZoom = () => {
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
  const [currentFile, setCurrentFile] = useState(null);
  const [isDataProcessing, setIsDataProcessing] = useState(false);
  const [isDataProcessingComplete, setIsDataProcessingComplete] = useState(false);

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
      setCurrentFile(file);
      setIsDataProcessing(false);
      setIsDataProcessingComplete(false);

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      setPdfDocument(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
      
      // Start data processing
      setIsDataProcessing(true);
      
      // Load first page
      await loadPage(pdf, 1, file);
      
    } catch (err) {
      console.error('Error loading PDF:', err);
      setError(`Failed to load PDF: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Load specific page and generate presentation
  const loadPage = async (pdf, pageNumber, file) => {
    try {
      const page = await pdf.getPage(pageNumber);
      
      // Use high resolution for crisp rendering
      const scaleFactor = 2.0; // 2x resolution for high DPI displays
      const baseViewport = page.getViewport({ scale: scale });
      const highResViewport = page.getViewport({ scale: scale * scaleFactor });
      
      // Set canvas dimensions with high resolution
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      // Set actual canvas size (high resolution)
      canvas.width = highResViewport.width;
      canvas.height = highResViewport.height;
      
      // Set display size (CSS pixels) - this is what we'll use for coordinates
      canvas.style.width = baseViewport.width + 'px';
      canvas.style.height = baseViewport.height + 'px';
      
      // Scale the drawing context to match the device pixel ratio
      context.scale(scaleFactor, scaleFactor);
      
      // Render PDF page to canvas with high resolution
      const renderContext = {
        canvasContext: context,
        viewport: baseViewport
      };
      
      await page.render(renderContext).promise;
      
      // Convert PDF to HTML using pdf2htmlEX
      const htmlData = await convertPDFToHTML(file);
      
      // Parse HTML elements with coordinates
      const htmlElements = parseHTMLElements(htmlData);
      setSemanticData(htmlElements);
      
      // Extract PDF text for GPT-4o analysis
      const pdfText = await extractPDFText(pdf, pageNumber);
      
      // Mark data processing as complete before starting AI analysis
      setIsDataProcessingComplete(true);
      setIsDataProcessing(false);
      
      // Small delay to show the completed state
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Generate GPT-4o narrative script
      const generatedNarrative = await generateNarrativeScript(pdfText, htmlElements);
      
      // Align HTML elements with narration sections
      let alignedHighlights = [];
      if (generatedNarrative && generatedNarrative.steps) {
        alignedHighlights = alignHTMLElementsWithNarration(htmlElements, generatedNarrative.steps);
      }
      
      // Small delay to show AI analysis completion
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Generate audio for the narrative script
      let generatedAudio = null;
      if (generatedNarrative && generatedNarrative.steps) {
        generatedAudio = await generateAudioForNarrative(generatedNarrative);
      }
      
      // Generate presentation HTML with zoom functionality
      const html = generatePresentationHTMLWithZoom(alignedHighlights, baseViewport, pageNumber, canvas, generatedNarrative, generatedAudio);
      setPresentationHTML(html);
      
    } catch (err) {
      console.error('Error loading page:', err);
      setError(`Failed to load page ${pageNumber}: ${err.message}`);
    }
  };

  // Convert PDF to HTML using pdf2htmlEX (simulated)
  const convertPDFToHTML = async (pdfFile) => {
    console.log('🔄 Converting PDF to HTML using pdf2htmlEX...');
    
    const pdf = await pdfjsLib.getDocument(URL.createObjectURL(pdfFile)).promise;
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    
    // Create HTML-like structure with coordinates
    const htmlElements = textContent.items.map((item, index) => {
      const x = item.transform[4];
      const y = viewport.height - item.transform[5] - item.height;
      const width = item.width;
      const height = item.height;
      const text = item.str.trim();
      
      return {
        id: `element-${index}`,
        x: x,
        y: y,
        width: width,
        height: height,
        text: text,
        fontSize: item.height,
        fontFamily: item.fontName || 'Arial',
        className: 'text-element',
        style: `position: absolute; left: ${x}px; top: ${y}px; width: ${width}px; height: ${height}px; font-size: ${item.height}px; font-family: ${item.fontName || 'Arial'};`
      };
    });
    
    return {
      html: htmlElements,
      viewport: viewport,
      pageWidth: viewport.width,
      pageHeight: viewport.height
    };
  };

  // Parse HTML elements and extract text with coordinates
  const parseHTMLElements = (htmlData) => {
    console.log('📄 PARSING HTML ELEMENTS:');
    
    const elements = htmlData.html.map(element => ({
      id: element.id,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      text: element.text,
      fontSize: element.fontSize,
      fontFamily: element.fontFamily,
      className: element.className
    }));
    
    console.log(`Found ${elements.length} HTML elements`);
    return elements;
  };

  // Normalize text for matching
  const normalizeText = (text) => {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Calculate similarity between two texts using fuzzy matching
  const calculateTextSimilarity = (text1, text2) => {
    const normalized1 = normalizeText(text1);
    const normalized2 = normalizeText(text2);
    
    if (normalized1 === normalized2) return 1.0;
    if (normalized1.length === 0 || normalized2.length === 0) return 0;
    
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return 0.9;
    }
    
    const words1 = normalized1.split(' ').filter(w => w.length > 1);
    const words2 = normalized2.split(' ').filter(w => w.length > 1);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    const jaccard = intersection.length / union.length;
    
    const shorter = words1.length < words2.length ? words1 : words2;
    const longer = words1.length >= words2.length ? words1 : words2;
    const containmentScore = shorter.filter(word => longer.includes(word)).length / shorter.length;
    
    return Math.max(jaccard, containmentScore * 0.8);
  };

  // Merge nearby HTML elements into one bounding box
  const mergeHTMLElements = (elements) => {
    if (elements.length === 0) return null;
    if (elements.length === 1) return elements[0];
    
    const minX = Math.min(...elements.map(e => e.x));
    const minY = Math.min(...elements.map(e => e.y));
    const maxX = Math.max(...elements.map(e => e.x + e.width));
    const maxY = Math.max(...elements.map(e => e.y + e.height));
    
    return {
      id: `merged-${elements.map(e => e.id).join('-')}`,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      text: elements.map(e => e.text).join(' '),
      fontSize: Math.max(...elements.map(e => e.fontSize)),
      fontFamily: elements[0].fontFamily,
      elements: elements,
      isMerged: true
    };
  };

  // Align HTML elements with narration sections
  const alignHTMLElementsWithNarration = (htmlElements, narrationSteps) => {
    if (!narrationSteps || narrationSteps.length === 0) {
      console.log('⚠️ No narration steps provided');
      return [];
    }

    const alignedHighlights = [];
    const usedElementIds = new Set();

    narrationSteps.forEach((step, stepIndex) => {
      const stepText = step.highlightText || step.narrative || '';
      const normalizedStepText = normalizeText(stepText);
      
      console.log(`\n🔍 STEP ${stepIndex + 1} ALIGNMENT:`);
      console.log(`GPT Step Number: ${step.stepNumber}`);
      console.log(`Array Index: ${stepIndex}`);
      console.log(`Final Step Number: ${step.stepNumber || (stepIndex + 1)}`);
      console.log(`Highlight Text: "${stepText}"`);
      
      const availableElements = htmlElements.filter(element => !usedElementIds.has(element.id));
      
      const elementScores = availableElements.map(element => ({
        element,
        similarity: calculateTextSimilarity(stepText, element.text),
        keywordMatch: normalizedStepText.split(' ').some(word => 
          word.length > 2 && normalizeText(element.text).includes(word)
        ),
        exactMatch: normalizeText(element.text).includes(normalizedStepText) || 
                   normalizedStepText.includes(normalizeText(element.text))
      }));

      elementScores.sort((a, b) => {
        if (a.exactMatch && !b.exactMatch) return -1;
        if (!a.exactMatch && b.exactMatch) return 1;
        if (a.keywordMatch && !b.keywordMatch) return -1;
        if (!a.keywordMatch && b.keywordMatch) return 1;
        return b.similarity - a.similarity;
      });

      const bestMatch = elementScores[0];
      
      if (bestMatch && 
          bestMatch.element.text.trim().length > 0 &&
          (bestMatch.similarity > 0.5 || bestMatch.exactMatch) &&
          bestMatch.element.width > 0 && bestMatch.element.height > 0) {
        
        const similarElements = elementScores.filter(es => 
          es.element.text.trim().length > 0 &&
          es.element.width > 0 && es.element.height > 0 &&
          (es.similarity > 0.7 || es.exactMatch) &&
          Math.abs(es.element.y - bestMatch.element.y) < 50 &&
          Math.abs(es.element.x - bestMatch.element.x) < 200
        ).map(es => es.element);

        const elementsToMerge = similarElements.length > 5 ? [bestMatch.element] : similarElements;
        
        const mergedElement = mergeHTMLElements(elementsToMerge);
        if (mergedElement) {
        const highlight = {
          id: `highlight-${stepIndex}`,
          step: step.stepNumber || (stepIndex + 1), // Use GPT's stepNumber if available
          x: mergedElement.x,
          y: mergedElement.y,
          width: mergedElement.width,
          height: mergedElement.height,
          text: mergedElement.text,
          narrationText: stepText,
          narrative: step.narrative,
          fontSize: mergedElement.fontSize,
          fontFamily: mergedElement.fontFamily,
          isMerged: mergedElement.isMerged,
          elements: mergedElement.elements || [mergedElement]
        };
          
          alignedHighlights.push(highlight);
          elementsToMerge.forEach(element => usedElementIds.add(element.id));
        }
      } else {
        const needsReviewHighlight = {
          id: `needs-review-${stepIndex}`,
          step: step.stepNumber || (stepIndex + 1), // Use GPT's stepNumber if available
          x: 50,
          y: 50 + (stepIndex * 100),
          width: 200,
          height: 30,
          text: stepText,
          narrationText: stepText,
          narrative: step.narrative,
          fontSize: 12,
          fontFamily: 'Arial',
          isMerged: false,
          elements: [],
          needsReview: true
        };
        alignedHighlights.push(needsReviewHighlight);
      }
    });

    return alignedHighlights;
  };

  // Extract PDF text
  const extractPDFText = async (pdf, pageNumber) => {
    try {
      const page = await pdf.getPage(pageNumber);
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
        return result.narrative;
      } else {
        setNarrativeError(result.error);
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
        return result;
      } else {
        setAudioError(result.error);
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

  // Generate presentation HTML with zoom functionality
  const generatePresentationHTMLWithZoom = (alignedHighlights, viewport, pageNumber, canvas, narrativeData, audioData) => {
    const imageDataUrl = canvas.toDataURL('image/png');
    // Use the display size (CSS pixels) for coordinates, not the high-res canvas size
    const canvasWidth = viewport.width;
    const canvasHeight = viewport.height;
    
    // Extract EOB summary data
    const eobSummary = narrativeData?.eobSummary || {
      serviceDate: "Date not available",
      providerName: "Provider not identified",
      services: [{ description: "Service details not available", amount: "$0.00" }],
      totalCharged: "$0.00",
      insurancePaid: "$0.00",
      adjustments: "$0.00",
      patientOwes: "$0.00",
      deductible: "$0.00",
      copay: "$0.00"
    };
    
    // Prepare audio data for embedding
    const audioDataForHTML = audioData && audioData.audioSteps ? audioData.audioSteps.map(step => {
      if (step.success && step.audioData) {
        try {
          const uint8Array = new Uint8Array(step.audioData);
          let binaryString = '';
          const chunkSize = 8192;
          
          for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.slice(i, i + chunkSize);
            binaryString += String.fromCharCode.apply(null, chunk);
          }
          
          const base64String = btoa(binaryString);
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
      return {
        stepNumber: step.stepNumber,
        audioData: null,
        duration: step.duration,
        text: step.text
      };
    }) : [];
    
    const scaleX = canvasWidth / viewport.width;
    const scaleY = canvasHeight / viewport.height;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Guided Presentation with Zoom - Page ${pageNumber}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; 
            background: #f1f5f9; 
            color: #1e293b; 
            overflow: hidden;
            height: 100vh;
            margin: 0;
            padding: 0;
            line-height: 1.6;
        }
        
        .container { 
            display: flex; 
            height: 100vh; 
            background: #f1f5f9;
            margin: 0;
            overflow: hidden;
            gap: 0;
        }
        
        /* PDF View Section - Main Content */
        .pdf-viewer { 
            flex: 1; 
            background: transparent; 
            position: relative; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            overflow: hidden;
            cursor: default;
            margin: 16px;
            border-radius: 0;
            box-shadow: none;
            border: none;
        }
        
         .pdf-container { 
             position: relative; 
             transform-origin: center center;
             transition: none;
             max-width: calc(100% - 20px);
             max-height: calc(100% - 20px);
             margin: 0 auto;
             background: transparent;
             border-radius: 0;
             overflow: visible;
         }
        
        .pdf-background { 
            width: ${canvasWidth}px; 
            height: ${canvasHeight}px; 
            z-index: 1; 
            user-select: none;
            pointer-events: none;
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            border-radius: 6px;
        }
        
        .highlight-overlay { 
            position: absolute; 
            top: 0; 
            left: 0; 
            width: ${canvasWidth}px; 
            height: ${canvasHeight}px; 
            z-index: 2; 
            pointer-events: none; 
        }
        
         .highlight-element { 
             position: absolute; 
             border: none; 
             border-radius: 0; 
             background: transparent; 
             opacity: 0; 
             transform: scale(0.9); 
             transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); 
             pointer-events: none; 
             min-width: 0; 
             min-height: 0; 
             box-shadow: none;
         }
        
        .highlight-element.needs-review { 
            border: none; 
            background: transparent; 
        }
        
        .highlight-label { 
            position: absolute; 
            left: -45px; 
            top: 50%; 
            transform: translateY(-50%); 
            background: linear-gradient(135deg, #ffd700, #ffed4e); 
            color: #333; 
            font-weight: 600; 
            font-size: 16px; 
            width: 36px; 
            height: 36px; 
            border-radius: 50%; 
            box-shadow: 0 4px 15px rgba(255, 215, 0, 0.4); 
            text-align: center; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            border: 3px solid #fff; 
            line-height: 1; 
            opacity: 1; /* Always visible when parent is active */
        }
        
        .highlight-element.needs-review .highlight-label { 
            background: linear-gradient(135deg, #ff6b6b, #ff8e8e); 
        }
        
        .highlight-element.active { 
            opacity: 1; 
            transform: scale(1); 
            box-shadow: none;
        }
        
        .highlight-element.prev { 
            opacity: 0; 
            transform: scale(0.9); 
        }
        
        /* Zoom Controls */
        .zoom-controls {
            position: absolute;
            top: 24px;
            right: 24px;
            z-index: 10;
            display: flex;
            flex-direction: column;
            gap: 6px;
            background: #ffffff;
            padding: 16px;
            border-radius: 12px;
            box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            border: 1px solid #e2e8f0;
        }
        
        .zoom-btn {
            width: 40px;
            height: 40px;
            border: none;
            border-radius: 50%;
            background: #002677;
            color: white;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 1px 3px 0 rgba(0, 38, 119, 0.3), 0 1px 2px 0 rgba(0, 38, 119, 0.06);
        }
        
        .zoom-btn:hover {
            background: #003d99;
            transform: translateY(-1px);
            box-shadow: 0 4px 6px -1px rgba(0, 38, 119, 0.4), 0 2px 4px -1px rgba(0, 38, 119, 0.06);
        }
        
        .zoom-btn:active {
            transform: translateY(0);
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
        }
        
        .zoom-btn:disabled {
            background: #e2e8f0;
            color: #94a3b8;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        .zoom-level {
            text-align: center;
            color: #64748b;
            font-weight: 500;
            font-size: 11px;
            margin-top: 6px;
            letter-spacing: 0.025em;
        }
        
        .zoom-to-fit-btn {
            width: 100%;
            padding: 8px 12px;
            background: #ff642b;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 500;
            transition: all 0.2s ease;
            margin-top: 4px;
        }
        
        .zoom-to-fit-btn:hover {
            background: #e55a2b;
            transform: translateY(-1px);
            box-shadow: 0 2px 4px -1px rgba(255, 100, 43, 0.3);
        }
        
        /* EOB Summary Sticky Note */
        .eob-summary-sticky {
            position: fixed;
            top: 24px;
            left: 24px;
            width: 300px;
            max-width: calc(100vw - 48px);
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 2px solid rgba(255, 255, 255, 0.5);
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            transform: rotate(0deg);
            transition: all 0.3s ease;
        }
        
        .eob-summary-sticky:hover {
            transform: translateY(-2px);
            box-shadow: none;
        }
        
        .eob-summary-header {
            display: flex;
            align-items: center;
            margin-bottom: 16px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 12px;
            position: relative;
        }

        .eob-toggle-btn {
            position: absolute;
            right: 0;
            top: 50%;
            transform: translateY(-50%);
            background: transparent;
            border: none;
            font-size: 16px;
            color: #64748b;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            transition: all 0.2s ease;
            display: none;
        }

        .eob-toggle-btn:hover {
            background: rgba(0, 0, 0, 0.1);
            color: #374151;
        }

        .eob-toggle-btn.rotated {
            transform: translateY(-50%) rotate(180deg);
        }
        
        .eob-summary-icon {
            font-size: 18px;
            margin-right: 10px;
            color: #3b82f6;
        }
        
        .eob-summary-title {
            font-size: 18px;
            font-weight: 600;
            color: #1e293b;
            margin: 0;
            letter-spacing: -0.025em;
        }
        
        .eob-summary-content {
            font-size: 14px;
            line-height: 1.5;
        }
        
        .eob-summary-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            padding: 6px 0;
            border-radius: 4px;
            transition: background-color 0.2s ease;
        }
        
        .eob-summary-row:hover {
            background-color: #f8fafc;
        }
        
        .eob-summary-label {
            color: #64748b;
            font-weight: 500;
            font-size: 13px;
        }
        
        .eob-summary-value {
            color: #1e293b;
            font-weight: 600;
            font-size: 14px;
        }
        
        .eob-summary-value.highlight {
            color: #dc2626;
            font-weight: 700;
            font-size: 16px;
        }
        
        .eob-summary-services {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid #e2e8f0;
            background-color: #f8fafc;
            border-radius: 6px;
            padding: 12px;
        }
        
        .eob-summary-service {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
            font-size: 13px;
            padding: 4px 0;
        }
        
        .eob-summary-service-label {
            color: #64748b;
            font-weight: 500;
        }
        
        .eob-summary-service-value {
            color: #1e293b;
            font-weight: 600;
        }
        
        /* Right Side Panel - Slide Navigation */
        .slide-navigation {
            width: 320px;
            background: rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px;
            padding: 0;
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            flex-shrink: 0;
            position: relative;
            margin: 8px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        }
        
        /* YouTube-style separator line */
        .slide-navigation::before {
            display: none;
        }
        
        .slide-navigation-header {
            padding: 24px 20px 16px;
            border-bottom: none;
            background: transparent;
        }
        
        .slide-navigation h3 { 
            margin: 0 0 8px 0; 
            color: #002677; 
            font-weight: 700;
            font-size: 20px;
            text-align: left;
            line-height: 1.2;
        }
        
        .slide-navigation-subtitle {
            color: #666;
            font-size: 14px;
            margin: 0;
        }
        
        .slide-list {
            flex: 1;
            padding: 16px 0;
            overflow-y: auto;
        }
        
        .slide-item {
            display: flex;
            align-items: center;
            padding: 12px 20px;
            cursor: pointer;
            transition: all 0.3s ease;
            border-left: 3px solid transparent;
            position: relative;
        }
        
        .slide-item:hover {
            background: #f8f9fa;
            border-left-color: #ff642b;
        }
        
        .slide-item.active {
            background: linear-gradient(135deg, #e3f2fd, #f3e5f5);
            border-left-color: #002677;
        }
        
        .slide-item.completed {
            background: linear-gradient(135deg, #e8f5e8, #f1f8e9);
            border-left-color: #22c55e;
        }
        
        .slide-number {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: #e0e0e0;
            color: #666;
            font-weight: 600;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;
            transition: all 0.3s ease;
        }
        
        .slide-item.active .slide-number {
            background: #002677;
            color: white;
            box-shadow: 0 4px 12px rgba(0, 38, 119, 0.3);
        }
        
        .slide-item.completed .slide-number {
            background: #4caf50;
            color: white;
        }
        
        .slide-content {
            flex: 1;
            min-width: 0;
        }
        
        .slide-title {
            font-size: 14px;
            font-weight: 600;
            color: #333;
            margin: 0 0 4px 0;
            line-height: 1.3;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        
        .slide-preview {
            font-size: 12px;
            color: #666;
            margin: 0;
            line-height: 1.4;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        
        .slide-status {
            position: absolute;
            right: 16px;
            top: 50%;
            transform: translateY(-50%);
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #e0e0e0;
        }
        
        .slide-item.active .slide-status {
            background: #002677;
            box-shadow: 0 0 8px rgba(0, 38, 119, 0.4);
        }
        
        .slide-item.completed .slide-status {
            background: #4caf50;
        }
        
        /* Bottom Controls */
        .bottom-controls {
            padding: 20px;
            border-top: none;
            background: transparent;
        }
        
        .navigation-arrows {
            display: flex;
            justify-content: center;
            gap: 12px;
            margin-bottom: 16px;
        }
        
        .nav-arrow {
            width: 44px;
            height: 44px;
            border: none;
            border-radius: 50%;
            background: #002677;
            color: white;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 4px -1px rgba(0, 38, 119, 0.3), 0 1px 2px -1px rgba(0, 38, 119, 0.06);
        }
        
        .nav-arrow:hover {
            background: #003d99;
            transform: translateY(-1px);
            box-shadow: 0 4px 6px -1px rgba(0, 38, 119, 0.4), 0 2px 4px -1px rgba(0, 38, 119, 0.06);
        }
        
        .nav-arrow:disabled {
            background: #e2e8f0;
            color: #94a3b8;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        .progress-section {
            text-align: center;
        }
        
        .progress-label {
            font-size: 13px;
            color: #64748b;
            margin-bottom: 10px;
            font-weight: 500;
        }
        
        /* YouTube-style Video Player Controls */
        .video-player-overlay {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: transparent;
            padding: 24px;
            z-index: 10;
            pointer-events: none;
            border-radius: 0 0 12px 12px;
        }
        
        .video-controls {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            pointer-events: auto;
        }
        
        .play-pause-btn {
            position: fixed !important;
            left: 20px !important;
            bottom: 30px !important;
            width: 60px !important;
            height: 60px !important;
            border-radius: 50% !important;
            border: none !important;
            background: #ff642b !important;
            color: white !important;
            font-size: 20px !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            box-shadow: 0 6px 12px rgba(255, 100, 43, 0.4) !important;
            z-index: 1000 !important;
        }
        
        .play-pause-btn:hover {
            background: #e55a2b !important;
            transform: scale(1.05) !important;
            box-shadow: 0 6px 8px -1px rgba(255, 100, 43, 0.4), 0 4px 6px -1px rgba(255, 100, 43, 0.06) !important;
        }
        
        .play-pause-btn.playing {
            background: #002677 !important;
            color: white !important;
            box-shadow: 0 4px 6px -1px rgba(0, 38, 119, 0.3), 0 2px 4px -1px rgba(0, 38, 119, 0.06) !important;
        }
        
        .video-subtitle {
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            color: #ffffff;
            font-size: 16px;
            font-weight: 600;
            line-height: 1.5;
            text-align: center;
            padding: 12px 20px;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
            max-width: 60%;
            word-wrap: break-word;
            overflow-wrap: break-word;
            white-space: normal;
            z-index: 999;
        }
        
        /* Center Play Button for Presentation Start */
        .center-play-button {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 80px;
            height: 80px;
            border-radius: 50%;
            border: none;
            background: #ff642b;
            color: white;
            font-size: 32px;
            cursor: pointer;
            z-index: 1001;
            box-shadow: 0 8px 24px rgba(255, 100, 43, 0.4);
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .center-play-button:hover {
            background: #e55a2b;
            transform: translate(-50%, -50%) scale(1.1);
            box-shadow: 0 12px 32px rgba(255, 100, 43, 0.6);
        }
        
        .center-play-button.hidden {
            display: none;
        }
        
        .center-play-button::before {
            content: '▶';
            margin-left: 4px;
        }
        
        .video-progress {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: rgba(255, 255, 255, 0.2);
            z-index: 11;
            border-radius: 0;
        }
        
        .video-progress-fill {
            height: 100%;
            background: #ff642b;
            width: 0%;
            transition: width 0.1s ease;
            border-radius: 0 0 12px 12px;
        }
        
        /* Audio Controls - Hidden */
        .audio-controls { 
            display: none;
        }
        
        /* Progress Bar */
        .progress-container { 
            background: #e2e8f0; 
            height: 8px; 
            border-radius: 4px; 
            margin-bottom: 20px; 
            overflow: hidden; 
        }
        
        .progress-fill { 
            height: 100%; 
            background: #ff642b; 
            width: 0%; 
            transition: width 0.3s ease; 
        }
        
        /* Responsive design */
        @media (max-width: 1024px) {
            /* EOB Summary - Tablet adjustments */
            .eob-summary-sticky {
                width: 280px;
                max-width: calc(50vw - 24px);
            }
        }

        @media (max-width: 768px) {
            .container {
                flex-direction: column;
            }
            
            .pdf-viewer {
                height: 60vh;
                margin: 8px;
                border-right: none;
                border-bottom: 1px solid #e2e8f0;
            }
            
            .pdf-container {
                max-width: calc(100vw - 32px);
                max-height: calc(60vh - 32px);
            }
            
            .slide-navigation {
                width: 100%;
                height: 40vh;
                border-left: none;
                border-top: 1px solid #e0e0e0;
            }
            
            .slide-navigation::before {
                display: none;
            }
            
            .slide-list {
                max-height: 200px;
            }
            
            .zoom-controls {
                top: 12px;
                right: 12px;
                padding: 12px;
            }
            
            .zoom-btn {
                width: 36px;
                height: 36px;
                font-size: 16px;
            }
            
            .bottom-play-button {
                width: 60px;
                height: 60px;
                font-size: 20px;
                bottom: 20px;
            }
            
            .subtitle-text {
                bottom: 100px;
                font-size: 16px;
                padding: 10px 16px;
            }
            
            .nav-arrow {
                width: 40px;
                height: 40px;
                font-size: 16px;
            }
            
            .slide-item {
                padding: 10px 16px;
            }
            
            .slide-number {
                width: 28px;
                height: 28px;
                font-size: 12px;
            }
            
            /* EOB Summary Sticky Note - Mobile - Collapsible */
            .eob-summary-sticky {
                position: fixed;
                top: 12px;
                left: 12px;
                right: 12px;
                width: auto;
                max-width: none;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border: 2px solid rgba(255, 255, 255, 0.5);
                border-radius: 12px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
                transform: translateY(-100%);
                z-index: 1001;
                max-height: 50vh;
                overflow-y: auto;
                padding: 16px;
                transition: transform 0.3s ease;
            }
            
            .eob-summary-sticky.show {
                transform: translateY(0);
            }
            
            .eob-summary-sticky:hover {
                transform: translateY(-100%);
            }

            .eob-toggle-btn {
                display: block;
            }

            .eob-summary-content {
                max-height: 0;
                overflow: hidden;
                transition: max-height 0.3s ease;
            }

            .eob-summary-sticky.show .eob-summary-content {
                max-height: 300px;
            }
            
            .eob-summary-content {
                font-size: 14px;
            }
            
            .eob-summary-row {
                margin-bottom: 8px;
            }
            
            .eob-summary-services {
                margin-top: 12px;
                padding-top: 12px;
            }
            
            .eob-summary-service {
                font-size: 13px;
                margin-bottom: 6px;
            }
        }

        @media (max-width: 480px) {
            /* EOB Summary - Small mobile - Always visible but compact */
            .eob-summary-sticky {
                position: fixed;
                top: 8px;
                left: 8px;
                right: 8px;
                width: auto;
                max-width: none;
                background: rgba(255, 255, 255, 0.98);
                backdrop-filter: blur(15px);
                -webkit-backdrop-filter: blur(15px);
                border: 3px solid rgba(255, 255, 255, 0.8);
                border-radius: 16px;
                box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
                transform: translateY(0);
                z-index: 1001;
                max-height: 40vh;
                overflow-y: auto;
                padding: 12px;
                font-size: 12px;
            }
            
            .eob-summary-header {
                margin-bottom: 12px;
                padding-bottom: 8px;
            }
            
            .eob-summary-title {
                font-size: 16px;
            }
            
            .eob-summary-content {
                font-size: 12px;
            }
            
            .eob-summary-row {
                margin-bottom: 6px;
                padding: 4px 0;
            }
            
            .eob-summary-services {
                margin-top: 8px;
                padding-top: 8px;
            }
            
            .eob-summary-service {
                font-size: 11px;
                margin-bottom: 4px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- EOB Summary Sticky Note -->
        <div class="eob-summary-sticky" id="eobSummary">
            <div class="eob-summary-header">
                <div class="eob-summary-icon">📋</div>
                <h3 class="eob-summary-title">EOB Summary</h3>
                <button class="eob-toggle-btn" id="eobToggle" aria-label="Toggle EOB summary visibility">▼</button>
            </div>
            <div class="eob-summary-content">
                <div class="eob-summary-row">
                    <span class="eob-summary-label">Date:</span>
                    <span class="eob-summary-value">${eobSummary.serviceDate}</span>
                </div>
                <div class="eob-summary-row">
                    <span class="eob-summary-label">Provider:</span>
                    <span class="eob-summary-value">${eobSummary.providerName}</span>
                </div>
                <div class="eob-summary-services">
                    ${eobSummary.services.map(service => `
                        <div class="eob-summary-service">
                            <span class="eob-summary-service-label">${service.description}</span>
                            <span class="eob-summary-service-value">${service.amount}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="eob-summary-row">
                    <span class="eob-summary-label">Total Charged:</span>
                    <span class="eob-summary-value">${eobSummary.totalCharged}</span>
                </div>
                <div class="eob-summary-row">
                    <span class="eob-summary-label">Insurance Paid:</span>
                    <span class="eob-summary-value">${eobSummary.insurancePaid}</span>
                </div>
                <div class="eob-summary-row">
                    <span class="eob-summary-label">Adjustments:</span>
                    <span class="eob-summary-value">${eobSummary.adjustments}</span>
                </div>
                <div class="eob-summary-row" style="border-top: 1px solid #fdcb6e; padding-top: 6px; margin-top: 6px;">
                    <span class="eob-summary-label" style="font-weight: 700; color: #2d3436;">You Owe:</span>
                    <span class="eob-summary-value highlight">${eobSummary.patientOwes}</span>
                </div>
                ${eobSummary.deductible !== "$0.00" ? `
                <div class="eob-summary-row">
                    <span class="eob-summary-label">Deductible:</span>
                    <span class="eob-summary-value">${eobSummary.deductible}</span>
                </div>
                ` : ''}
                ${eobSummary.copay !== "$0.00" ? `
                <div class="eob-summary-row">
                    <span class="eob-summary-label">Copay:</span>
                    <span class="eob-summary-value">${eobSummary.copay}</span>
                </div>
                ` : ''}
            </div>
        </div>

        <!-- PDF View Section - Main Content -->
        <div class="pdf-viewer" id="pdfViewer">
            <!-- Zoom Controls -->
            <div class="zoom-controls">
                <button class="zoom-btn" id="zoomIn" title="Zoom In (Ctrl + Plus)">+</button>
                <button class="zoom-btn" id="zoomOut" title="Zoom Out (Ctrl + Minus)">−</button>
                <button class="zoom-to-fit-btn" id="zoomToFit" title="Zoom to Fit (Ctrl + 0)">Fit</button>
                 <div class="zoom-level" id="zoomLevel">150%</div>
            </div>
            
            <!-- YouTube-style Video Player Controls -->
            <!-- Center Play Button for Presentation Start -->
            <button class="center-play-button" id="centerPlayBtn" onclick="startPresentation()"></button>
            
            <div class="video-player-overlay">
                <div class="video-progress">
                    <div class="video-progress-fill" id="progressFill"></div>
                </div>
            </div>
            
            <!-- Independent Floating Play Button (Left Side) -->
            <button class="play-pause-btn" id="playPauseBtn" onclick="togglePlay()">▶</button>
            
            <!-- Independent Floating Subtitle Text (Center) -->
            <div class="video-subtitle" id="videoSubtitle">Click play to start the presentation</div>
            
            <!-- PDF Container -->
            <div class="pdf-container" id="pdfContainer">
                <img src="${imageDataUrl}" alt="PDF Page ${pageNumber}" class="pdf-background">
                <div class="highlight-overlay" id="highlightOverlay">
                 ${alignedHighlights.map((highlight, index) => {
                     // Scale coordinates to match the PDF display size
                     const x = highlight.x * scaleX;
                     const y = highlight.y * scaleY;
                     const width = highlight.width * scaleX;
                     const height = highlight.height * scaleY;
                     const stepNumber = highlight.step;
                     const needsReview = highlight.needsReview ? 'needs-review' : '';
                     
                     return `
                         <div class="highlight-element ${needsReview}" id="highlight-${stepNumber - 1}" data-step="${stepNumber - 1}" style="left: ${x}px; top: ${y}px; width: ${width}px; height: ${height}px;">
                             <div class="highlight-label">${stepNumber}</div>
                         </div>
                     `;
                 }).join('')}
                </div>
            </div>
        </div>
        
        <!-- Right Side Panel - Slide Navigation -->
        <div class="slide-navigation">
            <!-- Header -->
            <div class="slide-navigation-header">
                <h3>Presentation Sections</h3>
                <p class="slide-navigation-subtitle">Navigate through your guided presentation</p>
            </div>
            
            <!-- Slide List -->
            <div class="slide-list" id="slideList">
                ${alignedHighlights.map((highlight, index) => {
                    const isActive = index === 0;
                    const isCompleted = false;
                    const stepNumber = highlight.step;
                    const title = highlight.narrationText || highlight.text || `Section ${stepNumber}`;
                    const preview = highlight.narrative || highlight.text || 'Click to view this section';
                    
                    return `
                        <div class="slide-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}" 
                             onclick="goToStep(${index})" 
                             data-step="${index}">
                            <div class="slide-number">${stepNumber}</div>
                            <div class="slide-content">
                                <div class="slide-title">${title}</div>
                                <div class="slide-preview">${preview}</div>
                            </div>
                            <div class="slide-status"></div>
                        </div>
                    `;
                }).join('')}
            </div>
            
            <!-- Bottom Controls -->
            <div class="bottom-controls">
                <!-- Navigation Arrows -->
                <div class="navigation-arrows">
                    <button class="nav-arrow" id="prevBtn" onclick="previousStep()" disabled>‹</button>
                    <button class="nav-arrow" id="nextBtn" onclick="nextStep()">›</button>
                </div>
                
                <!-- Progress Section -->
                <div class="progress-section">
                    <div class="progress-label">Progress</div>
                    <div class="progress-container">
                        <div class="progress-fill" id="progressFill"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        const elements = ${JSON.stringify(alignedHighlights)};
        const audioData = ${JSON.stringify(audioDataForHTML)};
        const narrativeScript = ${JSON.stringify(narrativeData)};
        const totalSteps = elements.length;
        let currentStep = 0;
        let isPlaying = false;
        let playInterval;
        let audioContext = null;
        let currentAudio = null;
        
         // Zoom functionality
         let currentZoom = 1.5; // Start at 150% as requested
         let minZoom = 0.5;
         let maxZoom = 2.0;
         let zoomStep = 0.25;
         let isDragging = false;
         let dragStart = { x: 0, y: 0 };
         let currentPan = { x: 0, y: 0 };
         let isPanning = false;
        
        function updateStep(step) {
            currentStep = step;
            
            // Update subtitle text above play button
            updateSubtitle();
            
            // Update progress
            const progress = ((step + 1) / totalSteps) * 100;
            const progressFill = document.getElementById('progressFill');
            if (progressFill) {
                progressFill.style.width = progress + '%';
            }
            
            // Update highlights - only show current step, hide all others
            document.querySelectorAll('.highlight-element').forEach((el) => {
                el.classList.remove('active', 'prev');
                const elementStep = parseInt(el.getAttribute('data-step')) || 0;
                if (elementStep === step) {
                    el.classList.add('active');
                }
                // All other elements remain hidden (opacity: 0)
            });
            
            // Update slide navigation
            document.querySelectorAll('.slide-item').forEach((el, index) => {
                el.classList.remove('active', 'completed');
                if (index === step) {
                    el.classList.add('active');
                } else if (index < step) {
                    el.classList.add('completed');
                }
            });
            
            // Update navigation buttons
            const prevBtn = document.getElementById('prevBtn');
            const nextBtn = document.getElementById('nextBtn');
            if (prevBtn) prevBtn.disabled = step === 0;
            if (nextBtn) nextBtn.disabled = step >= totalSteps - 1;
            
            // Auto-zoom to current element with a small delay to ensure proper rendering
            setTimeout(() => {
                zoomToElement(step);
            }, 100);
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
        
        function startPresentation() {
            // Hide center play button and show video controls
            const centerBtn = document.getElementById('centerPlayBtn');
            const videoControls = document.querySelector('.video-controls');
            
            if (centerBtn) {
                centerBtn.classList.add('hidden');
            }
            
            if (videoControls) {
                videoControls.style.display = 'flex';
            }
            
            // Start the presentation
            startPlay();
        }
        
        function togglePlay() {
            // YouTube-style behavior: single click toggles play/pause
            if (isPlaying) {
                pausePlay();
            } else {
                startPlay();
            }
        }
        
        // YouTube-style keyboard shortcuts
        function handleKeyPress(event) {
            // Space bar or Enter key toggles play/pause (YouTube standard)
            if (event.code === 'Space' || event.code === 'Enter') {
                event.preventDefault();
                togglePlay();
            }
            // Arrow keys for navigation (YouTube standard)
            else if (event.code === 'ArrowLeft') {
                event.preventDefault();
                goToPreviousStep();
            }
            else if (event.code === 'ArrowRight') {
                event.preventDefault();
                goToNextStep();
            }
        }
        
        function updatePlayButton() {
            const playBtn = document.getElementById('playPauseBtn');
            if (!playBtn) return;
            
            // YouTube-style icon updates with better visual feedback
            if (isPlaying) {
                playBtn.textContent = '⏸';
                playBtn.classList.add('playing');
                playBtn.setAttribute('aria-label', 'Pause presentation');
            } else {
                playBtn.textContent = '▶';
                playBtn.classList.remove('playing');
                playBtn.setAttribute('aria-label', 'Play presentation');
            }
        }
        
        // YouTube-style click anywhere to play/pause (on video area)
        function handleVideoClick(event) {
            // Only trigger if clicking on the video area, not on controls
            if (event.target.classList.contains('video-player-overlay') || 
                event.target.classList.contains('video-controls')) {
                return; // Don't trigger if clicking on controls
            }
            
            // Click on video area toggles play/pause (YouTube behavior)
            togglePlay();
        }
        
        function updateSubtitle() {
            const subtitleText = document.getElementById('videoSubtitle');
            if (!subtitleText) return;
            
            // Check if presentation has started (center button is hidden)
            const centerBtn = document.getElementById('centerPlayBtn');
            const isPresentationStarted = centerBtn && centerBtn.classList.contains('hidden');
            
            if (isPresentationStarted && narrativeScript && narrativeScript.steps && narrativeScript.steps[currentStep]) {
                const stepData = narrativeScript.steps[currentStep];
                subtitleText.textContent = stepData.narrative || elements[currentStep]?.text || 'No description available';
            } else if (isPresentationStarted && elements && elements[currentStep]) {
                subtitleText.textContent = elements[currentStep].text || 'No description available';
            } else if (isPresentationStarted) {
                subtitleText.textContent = 'Click play to start the presentation';
            } else {
                subtitleText.textContent = 'Click the play button to start the presentation';
            }
        }
        
        function startPlay() {
            // YouTube-style: immediate visual feedback
            isPlaying = true;
            updatePlayButton();
            
            // YouTube-style: start from current step
            updateStep(currentStep);
            
            if (audioData && audioData.length > 0 && audioData[currentStep] && audioData[currentStep].audioData) {
                playStepAudio(currentStep);
            } else {
                // YouTube-style: auto-advance with smooth transitions
                playInterval = setInterval(() => {
                    if (isPlaying) { // Check if still playing (YouTube behavior)
                        nextStep();
                    }
                }, 3000);
            }
        }
        
        function playStepAudio(stepIndex) {
            if (audioData && audioData[stepIndex] && audioData[stepIndex].audioData) {
                if (currentAudio) {
                    currentAudio.pause();
                }
                
                currentAudio = new Audio(audioData[stepIndex].audioData);
                currentAudio.play();
                
                currentAudio.onended = () => {
                    if (stepIndex < totalSteps - 1) {
                        nextStep();
                    } else {
                        stopPlay();
                    }
                };
            } else {
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
            // YouTube-style: immediate pause with visual feedback
            isPlaying = false;
            updatePlayButton();
            updateStep(currentStep);
            
            // YouTube-style: pause audio immediately
            if (currentAudio) {
                currentAudio.pause();
            }
            
            // YouTube-style: stop auto-advance
            if (playInterval) {
                clearInterval(playInterval);
                playInterval = null;
            }
        }
        
        function stopPlay() {
            isPlaying = false;
            updatePlayButton();
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
        
         // Zoom functionality - Allow Y-axis movement to follow highlights
         function updateZoom() {
             const container = document.getElementById('pdfContainer');
             const zoomLevel = document.getElementById('zoomLevel');
             
             if (container && zoomLevel) {
                 // Allow Y-axis movement but keep X-axis centered
                 container.style.transform = \`scale(\${currentZoom}) translate(0px, \${currentPan.y}px)\`;
                 zoomLevel.textContent = Math.round(currentZoom * 100) + '%';
                 
                 // Update button states
                 const zoomInBtn = document.getElementById('zoomIn');
                 const zoomOutBtn = document.getElementById('zoomOut');
                 
                 if (zoomInBtn) zoomInBtn.disabled = currentZoom >= maxZoom;
                 if (zoomOutBtn) zoomOutBtn.disabled = currentZoom <= minZoom;
             }
         }
        
        function zoomIn() {
            if (currentZoom < maxZoom) {
                currentZoom = Math.min(maxZoom, currentZoom + zoomStep);
                updateZoom();
            }
        }
        
        function zoomOut() {
            if (currentZoom > minZoom) {
                currentZoom = Math.max(minZoom, currentZoom - zoomStep);
                updateZoom();
            }
        }
        
        function zoomToFit() {
            const viewer = document.getElementById('pdfViewer');
            const container = document.getElementById('pdfContainer');
            
            if (viewer && container) {
                const viewerRect = viewer.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                
                const scaleX = viewerRect.width / containerRect.width;
                const scaleY = viewerRect.height / containerRect.height;
                const scale = Math.min(scaleX, scaleY) * 0.9; // 90% to leave some margin
                
                currentZoom = Math.max(minZoom, Math.min(maxZoom, scale));
                currentPan = { x: 0, y: 0 };
                updateZoom();
            }
        }
        
         function zoomToElement(elementIndex) {
             if (elementIndex >= 0 && elementIndex < elements.length) {
                 const element = elements[elementIndex];
                 const viewer = document.getElementById('pdfViewer');
                 const container = document.getElementById('pdfContainer');
                 
                 if (viewer && container && element) {
                     // Preserve current zoom level - don't reset it
                     // Only adjust pan position to center the element
                     
                     // Calculate the center of the element
                     const elementCenterX = element.x + element.width / 2;
                     const elementCenterY = element.y + element.height / 2;
                     
                     // Calculate the center of the viewer
                     const viewerRect = viewer.getBoundingClientRect();
                     const viewerCenterX = viewerRect.width / 2;
                     const viewerCenterY = viewerRect.height / 2;
                     
                     // Calculate pan to center the element in the viewer (Y-axis only)
                     // We need to account for the current zoom level
                     const panY = (viewerCenterY - elementCenterY) / currentZoom;
                     
                     // Keep X-axis centered, only move Y-axis
                     currentPan = {
                         x: 0, // Keep X-axis centered
                         y: panY
                     };
                     
                     updateZoom();
                 }
             }
         }
        
         // Pan functionality - Disabled to keep PDF stable
         function startPan(e) {
             // Disable panning to keep PDF stable
             e.preventDefault();
         }
         
         function doPan(e) {
             // Disable panning to keep PDF stable
             e.preventDefault();
         }
         
         function endPan(e) {
             // Disable panning to keep PDF stable
         }
        
        // Mouse wheel zoom
        function handleWheel(e) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -zoomStep : zoomStep;
            const newZoom = Math.max(minZoom, Math.min(maxZoom, currentZoom + delta));
            
            if (newZoom !== currentZoom) {
                currentZoom = newZoom;
                updateZoom();
            }
        }
        
        // Initialize zoom controls
        function initializeZoom() {
            const zoomInBtn = document.getElementById('zoomIn');
            const zoomOutBtn = document.getElementById('zoomOut');
            const zoomToFitBtn = document.getElementById('zoomToFit');
            const pdfViewer = document.getElementById('pdfViewer');
            
            if (zoomInBtn) {
                zoomInBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    zoomIn();
                });
            }
            if (zoomOutBtn) {
                zoomOutBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    zoomOut();
                });
            }
            if (zoomToFitBtn) {
                zoomToFitBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    zoomToFit();
                });
            }
            
            if (pdfViewer) {
                pdfViewer.addEventListener('mousedown', startPan);
                pdfViewer.addEventListener('mousemove', doPan);
                pdfViewer.addEventListener('mouseup', endPan);
                pdfViewer.addEventListener('mouseleave', endPan);
                pdfViewer.addEventListener('wheel', handleWheel, { passive: false });
            }
            
            updateZoom();
        }

        // Initialize EOB Summary Toggle
        function initializeEOBToggle() {
            const eobSummary = document.getElementById('eobSummary');
            const eobToggle = document.getElementById('eobToggle');
            
            if (eobSummary && eobToggle) {
                // Show EOB summary by default on mobile
                if (window.innerWidth <= 768) {
                    eobSummary.classList.add('show');
                }
                
                eobToggle.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    eobSummary.classList.toggle('show');
                    eobToggle.classList.toggle('rotated');
                    
                    // Update aria-label
                    const isExpanded = eobSummary.classList.contains('show');
                    eobToggle.setAttribute('aria-label', 
                        isExpanded ? 'Hide EOB summary' : 'Show EOB summary'
                    );
                });
            }
        }
        
        // Initialize with YouTube-style behavior
        updateStep(0);
        updatePlayButton();
        updateSubtitle();
        initializeZoom();
        initializeEOBToggle();
        
        // Hide video controls initially, show center play button
        const videoControls = document.querySelector('.video-controls');
        const centerBtn = document.getElementById('centerPlayBtn');
        
        if (videoControls) {
            videoControls.style.display = 'none';
        }
        
        if (centerBtn) {
            centerBtn.classList.remove('hidden');
        }
        
        // Add YouTube-style event listeners
        document.addEventListener('keydown', handleKeyPress);
        
        // Add click-to-play functionality on video area
        const videoContainer = document.querySelector('.pdf-container');
        if (videoContainer) {
            videoContainer.addEventListener('click', handleVideoClick);
        }
        
         // Set initial zoom to a reasonable level
         currentZoom = 1.5;
         updateZoom();
        
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
            
            // Zoom keyboard shortcuts
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case '=':
                    case '+':
                        e.preventDefault();
                        zoomIn();
                        break;
                    case '-':
                        e.preventDefault();
                        zoomOut();
                        break;
                    case '0':
                        e.preventDefault();
                        zoomToFit();
                        break;
                }
            }
        });
    </script>
</body>
</html>`;
  };

  return (
    <div className="guided-presentation-modern">

      {/* Main Upload Section */}
      <div className="main-upload-section">
        <div className="upload-container">
          {!currentFile ? (
            <div className="upload-zone" 
                 onClick={() => !isLoading && fileInputRef.current?.click()}
                 onDragOver={(e) => e.preventDefault()}
                 onDrop={(e) => {
                   e.preventDefault();
                   if (!isLoading && e.dataTransfer.files[0]) {
                     handleFileSelect({ target: { files: e.dataTransfer.files } });
                   }
                 }}
                 role="button"
                 tabIndex="0"
                 aria-label="Upload EOB PDF document by clicking or dragging and dropping"
                 onKeyDown={(e) => {
                   if (e.key === 'Enter' || e.key === ' ') {
                     e.preventDefault();
                     if (!isLoading) fileInputRef.current?.click();
                   }
                 }}>
              <div className="upload-icon">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14,2 14,8 20,8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10,9 9,9 8,9"></polyline>
                </svg>
              </div>
              <h2>Upload Your EOB Document</h2>
              <p>Drag and drop your PDF file here, or click to browse</p>
              <div className="file-requirements" role="list" aria-label="File requirements" id="file-requirements">
                <span role="listitem">Supported format: PDF only</span>
                <span role="listitem">Maximum size: 10MB</span>
              </div>
            </div>
          ) : (
            <div className="file-thumbnail" role="region" aria-label="Selected file information">
              <div className="thumbnail-icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14,2 14,8 20,8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10,9 9,9 8,9"></polyline>
                </svg>
              </div>
              <div className="file-info">
                <div className="file-name" aria-label={`File name: ${currentFile.name}`}>{currentFile.name}</div>
                <div className="file-size" aria-label={`File size: ${(currentFile.size / 1024 / 1024).toFixed(2)} MB`}>{(currentFile.size / 1024 / 1024).toFixed(2)} MB</div>
              </div>
              <button 
                className="reset-button"
                onClick={() => {
                  setCurrentFile(null);
                  setPdfDocument(null);
                  setSemanticData([]);
                  setCurrentStep(0);
                  setIsPlaying(false);
                  setNarrativeScript(null);
                  setAudioData(null);
                  setPresentationHTML('');
                  setIsDataProcessing(false);
                  setIsDataProcessingComplete(false);
                  setIsGeneratingNarrative(false);
                  setIsGeneratingAudio(false);
                  setError(null);
                  setNarrativeError(null);
                  setAudioError(null);
                }}
                title="Remove file and start over"
                aria-label="Remove selected file and start over"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          )}
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".pdf"
            style={{ display: 'none' }}
            aria-label="Upload EOB PDF document"
            aria-describedby="file-requirements"
          />
        </div>
      </div>

      {/* Process Steps Workflow */}
      {(isLoading || isGeneratingNarrative || isGeneratingAudio || presentationHTML) && (
        <div className="process-workflow" role="region" aria-label="Document processing workflow">
          <h3>Processing Your Document</h3>
          <div className="workflow-steps" role="list" aria-label="Processing steps">
            {/* Step 1: Document Upload */}
            <div className={`workflow-step ${currentFile ? 'completed' : ''}`} role="listitem" aria-label="Step 1: Document Upload">
              <div className="step-icon" aria-hidden="true">
                {currentFile ? (
                  <div className="step-checkmark">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20,6 9,17 4,12"></polyline>
              </svg>
                  </div>
                ) : (
                  <div className="step-number">1</div>
          )}
      </div>
              <div className="step-content">
                <div className="step-title">Document Upload</div>
                <div className="step-description">PDF file received and validated</div>
          </div>
              <div className="step-connector" aria-hidden="true"></div>
        </div>

            {/* Step 2: Data Processing */}
            <div className={`workflow-step ${isDataProcessing ? 'active' : isDataProcessingComplete ? 'completed' : ''}`} role="listitem" aria-label={`Step 2: Data Processing ${isDataProcessing ? 'in progress' : isDataProcessingComplete ? 'completed' : 'pending'}`}>
              <div className="step-icon" aria-hidden="true">
                {isDataProcessing ? (
                  <div className="step-loader">
                    <div className="loader-ring"></div>
                  </div>
                ) : isDataProcessingComplete ? (
                  <div className="step-checkmark">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20,6 9,17 4,12"></polyline>
                    </svg>
                  </div>
                ) : (
                  <div className="step-number">2</div>
                )}
              </div>
              <div className="step-content">
                <div className="step-title">Data Processing</div>
                <div className="step-description">Extracting text and coordinates from document</div>
              </div>
              <div className="step-connector" aria-hidden="true"></div>
            </div>

            {/* Step 3: AI Analysis */}
            <div className={`workflow-step ${isGeneratingNarrative ? 'active' : (narrativeScript ? 'completed' : '')}`} role="listitem" aria-label={`Step 3: AI Analysis ${isGeneratingNarrative ? 'in progress' : narrativeScript ? 'completed' : 'pending'}`}>
              <div className="step-icon" aria-hidden="true">
                {isGeneratingNarrative ? (
                  <div className="step-loader">
                    <div className="loader-ring"></div>
          </div>
                ) : narrativeScript ? (
                  <div className="step-checkmark">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20,6 9,17 4,12"></polyline>
                    </svg>
        </div>
                ) : (
                  <div className="step-number">3</div>
                )}
              </div>
              <div className="step-content">
                <div className="step-title">AI Analysis</div>
                <div className="step-description">Generating semantic narrative and EOB summary</div>
              </div>
              <div className="step-connector" aria-hidden="true"></div>
            </div>

            {/* Step 4: Audio Generation */}
            <div className={`workflow-step ${isGeneratingAudio ? 'active' : (audioData ? 'completed' : '')}`} role="listitem" aria-label={`Step 4: Audio Generation ${isGeneratingAudio ? 'in progress' : audioData ? 'completed' : 'pending'}`}>
              <div className="step-icon" aria-hidden="true">
                {isGeneratingAudio ? (
                  <div className="step-loader">
                    <div className="loader-ring"></div>
          </div>
                ) : audioData ? (
                  <div className="step-checkmark">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20,6 9,17 4,12"></polyline>
                    </svg>
        </div>
                ) : (
                  <div className="step-number">4</div>
                )}
            </div>
              <div className="step-content">
                <div className="step-title">Audio Generation</div>
                <div className="step-description">Creating synchronized narration for each step</div>
              </div>
              <div className="step-connector" aria-hidden="true"></div>
          </div>
          
            {/* Step 5: Presentation Ready */}
            <div className={`workflow-step ${presentationHTML ? 'completed' : ''}`} role="listitem" aria-label={`Step 5: Presentation Ready ${presentationHTML ? 'completed' : 'pending'}`}>
              <div className="step-icon" aria-hidden="true">
                {presentationHTML ? (
                  <div className="step-checkmark">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20,6 9,17 4,12"></polyline>
                </svg>
              </div>
                ) : (
                  <div className="step-number">5</div>
                )}
              </div>
              <div className="step-content">
                <div className="step-title">Presentation Ready</div>
                <div className="step-description">Interactive presentation with zoom controls generated</div>
              </div>
            </div>
            </div>
            
          {/* Download Button - Only show when presentation is ready */}
          {presentationHTML && (
            <div className="download-section">
              <button
                onClick={() => {
                  const blob = new Blob([presentationHTML], { type: 'text/html' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `guided-presentation-with-zoom-page-${currentPage}.html`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="download-btn"
                aria-label="Download interactive presentation with zoom controls"
                title="Download the generated presentation as an HTML file"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7,10 12,15 17,10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Download
              </button>
            </div>
          )}
          </div>
      )}

      {/* Status Messages */}
      {error && (
        <div className="status-message-modern error" role="alert" aria-live="polite">
          <div className="status-icon" aria-hidden="true">⚠️</div>
          <div className="status-content">
            <div className="status-title">Upload Error</div>
            <div className="status-description">{error}</div>
          </div>
        </div>
      )}

      {narrativeError && (
        <div className="status-message-modern error" role="alert" aria-live="polite">
          <div className="status-icon" aria-hidden="true">❌</div>
          <div className="status-content">
            <div className="status-title">Failed to generate narrative script</div>
            <div className="status-description">{narrativeError}</div>
          </div>
        </div>
      )}

      {audioError && (
        <div className="status-message-modern error" role="alert" aria-live="polite">
          <div className="status-icon" aria-hidden="true">❌</div>
          <div className="status-content">
            <div className="status-title">Failed to generate audio</div>
            <div className="status-description">{audioError}</div>
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
      />


      <style>{`
        .guided-presentation-modern {
          min-height: auto;
          background: transparent;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          padding: 0;
          margin: 0;
        }

        /* Main Upload Section - Compact Design */
        .main-upload-section {
          padding: 16px 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .upload-container {
          display: flex;
          justify-content: center;
        }

        .upload-zone {
          border: 3px dashed #ff642b;
          border-radius: 1.5rem;
          padding: 24px 20px;
          text-align: center;
          background: rgba(255, 255, 255, 0.6);
          backdrop-filter: blur(10px) saturate(180%);
          cursor: pointer;
          transition: all 0.3s ease;
          max-width: 500px;
          width: 100%;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08), 
                      inset 0 2px 12px rgba(255, 255, 255, 0.9);
          position: relative;
        }

        .upload-zone::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 1.5rem;
          backdrop-filter: blur(1px);
          box-shadow: inset -8px -6px 0px -9px rgba(255, 255, 255, 0.9),
                      inset 0px -7px 0px -6px rgba(255, 255, 255, 0.9);
          opacity: 0.9;
          z-index: -1;
          filter: blur(0.5px) brightness(105%);
        }

        .upload-zone:hover {
          border-color: #e55a2b;
          background: rgba(255, 247, 244, 0.8);
          transform: translateY(-2px);
          box-shadow: 0 16px 50px rgba(0, 0, 0, 0.12), 
                      inset 0 2px 12px rgba(255, 255, 255, 0.95);
        }

        .upload-zone:focus {
          outline: 4px solid #ff642b;
          outline-offset: 4px;
          border-color: #e55a2b;
        }

        .upload-zone:focus-visible {
          outline: 4px solid #ff642b;
          outline-offset: 4px;
        }

        .upload-icon {
          color: #ff642b;
          margin-bottom: 16px;
          display: flex;
          justify-content: center;
          font-size: 36px;
        }

        .upload-zone:hover .upload-icon {
          color: #e55a2b;
          transform: scale(1.05);
        }

        .upload-zone h2 {
          font-size: 22px;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 12px 0;
          letter-spacing: -0.025em;
          line-height: 1.3;
        }

        .upload-zone p {
          font-size: 16px;
          color: #374151;
          margin: 0 0 16px 0;
          font-weight: 500;
          line-height: 1.4;
        }

        .file-requirements {
          display: flex;
          gap: 24px;
          justify-content: center;
          font-size: 14px;
          color: #6b7280;
          font-weight: 600;
          margin-top: 4px;
        }

        .file-requirements span {
          background: #f3f4f6;
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
        }

        /* File Thumbnail - Compact Design with Liquid Glass */
        .file-thumbnail {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.6);
          backdrop-filter: blur(10px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.8);
          border-radius: 1.5rem;
          max-width: 450px;
          width: 100%;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08), 
                      inset 0 2px 12px rgba(255, 255, 255, 0.9);
          transition: all 0.3s ease;
          position: relative;
        }

        .file-thumbnail::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 1.5rem;
          backdrop-filter: blur(1px);
          box-shadow: inset -8px -6px 0px -9px rgba(255, 255, 255, 0.9),
                      inset 0px -7px 0px -6px rgba(255, 255, 255, 0.9);
          opacity: 0.9;
          z-index: -1;
          filter: blur(0.5px) brightness(105%);
        }

        .file-thumbnail:hover {
          border-color: #ff642b;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
        }

        .thumbnail-icon {
          color: #ff642b;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          background: #fff7f4;
          border-radius: 50%;
          flex-shrink: 0;
          font-size: 24px;
        }

        .file-info {
          flex: 1;
          min-width: 0;
        }

        .file-name {
          font-size: 16px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: -0.01em;
          line-height: 1.3;
        }

        .file-size {
          font-size: 14px;
          color: #374151;
          font-weight: 600;
        }

        .reset-button {
          background: #fef2f2 !important;
          color: #ef4444 !important;
          border: 2px solid #fecaca !important;
          border-radius: 8px;
          width: 48px !important;
          height: 48px !important;
          display: flex !important;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
          flex-shrink: 0;
          padding: 0 !important;
          font-size: 0 !important;
          font-weight: normal !important;
          gap: 0 !important;
          box-shadow: 0 2px 6px rgba(239, 68, 68, 0.2);
        }

        .reset-button svg {
          width: 20px !important;
          height: 20px !important;
          display: block !important;
          stroke: currentColor !important;
          stroke-width: 2.5 !important;
        }

        .reset-button:hover {
          background: #fee2e2 !important;
          color: #dc2626 !important;
          border-color: #fca5a5 !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        }

        .reset-button:active {
          transform: scale(0.95);
        }

        .reset-button:focus {
          outline: 4px solid #fecaca;
          outline-offset: 2px;
        }

        /* Process Workflow - Compact Design */
        .process-workflow {
          background: transparent;
          border-radius: 0;
          padding: 16px 0;
          margin: 16px 0;
          border: none;
          box-shadow: none;
        }

        .process-workflow h3 {
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 20px 0;
          text-align: center;
          letter-spacing: -0.025em;
          line-height: 1.2;
        }

        .workflow-steps {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          position: relative;
          margin-bottom: 20px;
          padding: 0 16px;
          gap: 8px;
        }

        .workflow-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
          position: relative;
          z-index: 2;
          transition: all 0.2s ease;
          padding: 8px;
          border-radius: 0;
          background: transparent;
        }

        .workflow-step:hover {
          transform: none;
          background: transparent;
          box-shadow: none;
        }

        .step-icon {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
          transition: all 0.2s ease;
          background: #f1f5f9;
          color: #64748b;
          border: 2px solid #e2e8f0;
          position: relative;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
        }

        .workflow-step.active .step-icon {
          background: #002677;
          color: #ffffff;
          border-color: #002677;
          box-shadow: 0 3px 8px rgba(0, 38, 119, 0.3);
          transform: scale(1.05);
        }

        .workflow-step.completed .step-icon {
          background: #22c55e;
          color: #ffffff;
          border-color: #22c55e;
          box-shadow: 0 3px 8px rgba(34, 197, 94, 0.3);
        }

        /* Step Number */
        .step-number {
          font-size: 18px;
          font-weight: 700;
          color: #64748b;
        }

        .workflow-step.active .step-number {
          color: #ffffff;
        }

        /* Step Checkmark */
        .step-checkmark {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
        }

        /* Step Loader */
        .step-loader {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .loader-ring {
          width: 28px;
          height: 28px;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-top: 3px solid #ffffff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .step-content {
          text-align: center;
          max-width: 140px;
        }

        .step-title {
          font-size: 14px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 4px;
          letter-spacing: -0.01em;
          line-height: 1.2;
        }

        .workflow-step.active .step-title {
          color: #002677;
        }

        .workflow-step.completed .step-title {
          color: #22c55e;
        }

        .step-description {
          font-size: 11px;
          color: #374151;
          line-height: 1.3;
          font-weight: 500;
        }

        .step-connector {
          position: absolute;
          top: 29px;
          left: calc(50% + 29px);
          right: calc(-50% + 29px);
          height: 2px;
          background: #e2e8f0;
          z-index: 1;
          border-radius: 1px;
        }

        .workflow-step.completed .step-connector {
          background: #22c55e;
        }

        /* Download Section - Compact Design */
        .download-section {
          text-align: center;
          padding-top: 16px;
        }

        .download-btn {
          background: rgba(0, 38, 119, 0.8);
          backdrop-filter: blur(10px) saturate(180%);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 1.5rem;
          padding: 16px 32px;
          font-size: 18px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 12px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 12px 40px rgba(0, 38, 119, 0.2), 
                      inset 0 2px 12px rgba(255, 255, 255, 0.2);
          letter-spacing: -0.01em;
          min-height: 48px;
          position: relative;
        }

        .download-btn::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 1.5rem;
          backdrop-filter: blur(1px);
          box-shadow: inset -8px -6px 0px -9px rgba(255, 255, 255, 0.6),
                      inset 0px -7px 0px -6px rgba(255, 255, 255, 0.6);
          opacity: 0.8;
          z-index: -1;
          filter: blur(0.5px) brightness(110%);
        }

        .download-btn:hover {
          background: rgba(0, 61, 153, 0.9);
          transform: translateY(-2px);
          box-shadow: 0 16px 50px rgba(0, 38, 119, 0.3), 
                      inset 0 2px 12px rgba(255, 255, 255, 0.3);
          border-color: rgba(255, 255, 255, 0.5);
        }

        .download-btn:active {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 38, 119, 0.3);
        }

        .download-btn:focus {
          outline: 3px solid rgba(0, 38, 119, 0.3);
          outline-offset: 3px;
          border-color: #60a5fa;
        }

        .download-btn svg {
          width: 20px;
          height: 20px;
        }

        /* Status Messages - Compact Design */
        .status-message-modern {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 24px;
          border-radius: 8px;
          margin: 12px 24px;
          font-weight: 600;
          border: 2px solid;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .status-message-modern.error {
          background: #fef2f2;
          border-color: #fecaca;
          color: #dc2626;
        }

        .status-message-modern.generating {
          background: #f0f9ff;
          border-color: #bae6fd;
          color: #0369a1;
        }

        .status-icon {
          font-size: 24px;
          flex-shrink: 0;
        }

        .status-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid #e0e7ff;
          border-top: 2px solid #2563eb;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .status-content {
          flex: 1;
        }

        .status-title {
          font-weight: 700;
          margin-bottom: 4px;
          font-size: 16px;
          line-height: 1.2;
        }

        .status-description {
          font-size: 14px;
          opacity: 0.9;
          line-height: 1.4;
        }

        /* Modern Footer 2025 */
        .modern-footer {
          background: #1e293b;
          color: #e2e8f0;
          margin-top: 80px;
        }

        .footer-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 48px 32px 24px;
        }

        .footer-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
          padding-bottom: 32px;
          border-bottom: 1px solid #334155;
        }

        .footer-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .footer-icon {
          color: #60a5fa;
          display: flex;
          align-items: center;
        }

        .footer-brand span {
          font-size: 16px;
          font-weight: 600;
          color: #f1f5f9;
        }

        .footer-tech {
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 14px;
          color: #94a3b8;
        }

        .tech-item {
          font-weight: 500;
        }

        .tech-separator {
          color: #475569;
        }

        .footer-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
          color: #94a3b8;
        }

        .footer-bottom p {
          margin: 0;
        }

        .footer-links {
          display: flex;
          gap: 24px;
        }

        .footer-link {
          color: #94a3b8;
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .footer-link:hover {
          color: #60a5fa;
        }

        /* High Contrast Mode Support */
        @media (prefers-contrast: high) {
          .upload-zone {
            border-width: 6px;
            border-color: #000;
          }
          
          .file-thumbnail {
            border-width: 4px;
            border-color: #000;
          }
          
          .download-btn {
            border-width: 4px;
            border-color: #000;
          }
          
          .status-message-modern {
            border-width: 4px;
          }
        }

        /* Reduced Motion Support */
        @media (prefers-reduced-motion: reduce) {
          .upload-zone,
          .file-thumbnail,
          .download-btn,
          .reset-button,
          .workflow-step,
          .step-icon {
            transition: none;
            transform: none;
          }
          
          .upload-zone:hover,
          .file-thumbnail:hover,
          .download-btn:hover,
          .reset-button:hover,
          .workflow-step:hover {
            transform: none;
          }
        }

        /* Responsive Design - Enhanced for Elderly Users */
        @media (max-width: 768px) {
          .header-container {
            padding: 12px 20px;
          }

          .main-upload-section {
            padding: 20px 16px;
          }

          .upload-zone {
            padding: 32px 20px;
            max-width: 100%;
          }

          .upload-zone h2 {
            font-size: 24px;
          }

          .upload-zone p {
            font-size: 18px;
          }

          .file-requirements {
            flex-direction: column;
            gap: 12px;
            font-size: 16px;
          }

          .file-thumbnail {
            padding: 20px 24px;
            max-width: 100%;
          }

          .file-name {
            font-size: 18px;
          }

          .file-size {
            font-size: 16px;
          }

          .reset-button {
            width: 56px;
            height: 56px;
          }

          .process-workflow {
            margin: 12px 8px;
            padding: 16px 12px;
          }

          .process-workflow h3 {
            font-size: 20px;
            margin-bottom: 16px;
          }

          .workflow-steps {
            flex-direction: column;
            gap: 16px;
            padding: 0 8px;
          }

          .step-connector {
            display: none;
          }

          .step-icon {
            width: 40px;
            height: 40px;
          }

          .step-number {
            font-size: 16px;
          }

          .step-content {
            max-width: 200px;
          }

          .step-title {
            font-size: 14px;
          }

          .step-description {
            font-size: 12px;
          }

          .download-btn {
            padding: 12px 24px;
            font-size: 16px;
            min-height: 44px;
          }

          .status-message-modern {
            margin: 8px 12px;
            padding: 12px 16px;
          }

          .status-title {
            font-size: 14px;
          }

          .status-description {
            font-size: 12px;
          }

          .footer-container {
            padding: 32px 20px 20px;
          }

          .footer-content {
            flex-direction: column;
            gap: 24px;
            text-align: center;
          }

          .footer-tech {
            flex-wrap: wrap;
            justify-content: center;
            gap: 12px;
          }

          .footer-bottom {
            flex-direction: column;
            gap: 16px;
            text-align: center;
          }

          .footer-links {
            gap: 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default GuidedPresentationWithZoom;
