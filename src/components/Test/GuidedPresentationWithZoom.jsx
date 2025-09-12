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

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      setPdfDocument(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
      
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
      
      // Generate GPT-4o narrative script
      const generatedNarrative = await generateNarrativeScript(pdfText, htmlElements);
      
      // Align HTML elements with narration sections
      let alignedHighlights = [];
      if (generatedNarrative && generatedNarrative.steps) {
        alignedHighlights = alignHTMLElementsWithNarration(htmlElements, generatedNarrative.steps);
      }
      
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
            step: stepIndex + 1,
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
          step: stepIndex + 1,
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
            background: #f8fafc; 
            color: #333; 
            overflow: hidden;
            height: 100vh;
            margin: 0;
            padding: 0;
        }
        
        .container { 
            display: flex; 
            height: 100vh; 
            background: #f8fafc;
            margin: 0;
            overflow: hidden;
        }
        
        /* PDF View Section - Main Content */
         .pdf-viewer { 
             flex: 1; 
             background: #000; 
             position: relative; 
             display: flex; 
             align-items: center; 
             justify-content: center; 
             overflow: hidden;
             cursor: default; /* Changed from grab since panning is disabled */
             margin: 0;
             border-right: 1px solid #e0e0e0;
         }
        
         .pdf-container { 
             position: relative; 
             transform-origin: center center;
             transition: none; /* Remove transitions to keep PDF stable */
             max-width: calc(100% - 20px);
             max-height: calc(100% - 20px);
             /* Keep PDF centered and stable */
             margin: 0 auto;
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
            top: 20px;
            right: 20px;
            z-index: 10;
            display: flex;
            flex-direction: column;
            gap: 8px;
            background: rgba(255, 255, 255, 0.95);
            padding: 12px;
            border-radius: 16px;
            backdrop-filter: blur(20px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.2);
        }
        
        .zoom-btn {
            width: 36px;
            height: 36px;
            border: none;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }
        
        .zoom-btn:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }
        
        .zoom-btn:active {
            transform: scale(0.95);
        }
        
        .zoom-btn:disabled {
            background: #e9ecef;
            color: #6c757d;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        .zoom-level {
            text-align: center;
            color: #667eea;
            font-weight: 600;
            font-size: 12px;
            margin-top: 4px;
        }
        
        .zoom-to-fit-btn {
            width: 100%;
            padding: 6px 8px;
            background: linear-gradient(135deg, #28a745, #20c997);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 10px;
            font-weight: 600;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .zoom-to-fit-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
        }
        
        /* Right Side Panel - Slide Navigation */
        .slide-navigation {
            width: 320px;
            background: #fff;
            padding: 0;
            border-left: 1px solid #e0e0e0;
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            flex-shrink: 0;
            position: relative;
        }
        
        /* YouTube-style separator line */
        .slide-navigation::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 1px;
            background: linear-gradient(to bottom, transparent, #e0e0e0, transparent);
        }
        
        .slide-navigation-header {
            padding: 24px 20px 16px;
            border-bottom: 1px solid #f0f0f0;
            background: linear-gradient(135deg, #f8f9fa, #ffffff);
        }
        
        .slide-navigation h3 { 
            margin: 0 0 8px 0; 
            color: #1976d2; 
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
            border-left-color: #e3f2fd;
        }
        
        .slide-item.active {
            background: linear-gradient(135deg, #e3f2fd, #f3e5f5);
            border-left-color: #1976d2;
        }
        
        .slide-item.completed {
            background: linear-gradient(135deg, #e8f5e8, #f1f8e9);
            border-left-color: #4caf50;
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
            background: #1976d2;
            color: white;
            box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
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
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .slide-preview {
            font-size: 12px;
            color: #666;
            margin: 0;
            line-height: 1.4;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
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
            background: #1976d2;
            box-shadow: 0 0 8px rgba(25, 118, 210, 0.4);
        }
        
        .slide-item.completed .slide-status {
            background: #4caf50;
        }
        
        /* Bottom Controls */
        .bottom-controls {
            padding: 20px;
            border-top: 1px solid #f0f0f0;
            background: linear-gradient(135deg, #f8f9fa, #ffffff);
        }
        
        .navigation-arrows {
            display: flex;
            justify-content: center;
            gap: 12px;
            margin-bottom: 16px;
        }
        
        .nav-arrow {
            width: 40px;
            height: 40px;
            border: none;
            border-radius: 50%;
            background: #1976d2;
            color: white;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
        }
        
        .nav-arrow:hover {
            background: #1565c0;
            transform: scale(1.1);
            box-shadow: 0 6px 16px rgba(25, 118, 210, 0.4);
        }
        
        .nav-arrow:disabled {
            background: #e0e0e0;
            color: #9e9e9e;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        .progress-section {
            text-align: center;
        }
        
        .progress-label {
            font-size: 12px;
            color: #666;
            margin-bottom: 8px;
            font-weight: 500;
        }
        
        /* YouTube-style Video Player Controls */
        .video-player-overlay {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
            padding: 20px;
            z-index: 10;
            pointer-events: none;
        }
        
        .video-controls {
            display: flex;
            align-items: center;
            gap: 12px;
            pointer-events: auto;
        }
        
        .play-pause-btn {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            border: none;
            background: rgba(255, 255, 255, 0.9);
            color: #000;
            font-size: 18px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        
        .play-pause-btn:hover {
            background: #fff;
            transform: scale(1.05);
        }
        
        .play-pause-btn.playing {
            background: #ff0000;
            color: white;
        }
        
        .video-subtitle {
            flex: 1;
            color: white;
            font-size: 16px;
            font-weight: 500;
            line-height: 1.4;
            text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
            max-width: 60%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .video-progress {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: rgba(255, 255, 255, 0.3);
            z-index: 11;
        }
        
        .video-progress-fill {
            height: 100%;
            background: #ff0000;
            width: 0%;
            transition: width 0.1s ease;
        }
        
        /* Audio Controls - Hidden */
        .audio-controls { 
            display: none;
        }
        
        /* Progress Bar */
        .progress-container { 
            background: #e9ecef; 
            height: 6px; 
            border-radius: 3px; 
            margin-bottom: 20px; 
            overflow: hidden; 
        }
        
        .progress-fill { 
            height: 100%; 
            background: linear-gradient(135deg, #667eea, #764ba2); 
            width: 0%; 
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
        }
        
        /* Responsive design */
        @media (max-width: 768px) {
            .container {
                flex-direction: column;
            }
            
            .pdf-viewer {
                height: 60vh;
                margin: 0;
                border-right: none;
                border-bottom: 1px solid #e0e0e0;
            }
            
            .pdf-container {
                max-width: calc(100vw - 20px);
                max-height: calc(60vh - 20px);
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
                top: 10px;
                right: 10px;
                padding: 8px;
            }
            
            .zoom-btn {
                width: 32px;
                height: 32px;
                font-size: 14px;
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
                width: 36px;
                height: 36px;
                font-size: 14px;
            }
            
            .slide-item {
                padding: 10px 16px;
            }
            
            .slide-number {
                width: 28px;
                height: 28px;
                font-size: 12px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
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
            <div class="video-player-overlay">
                <div class="video-controls">
                    <button class="play-pause-btn" id="playPauseBtn" onclick="togglePlay()">▶</button>
                    <div class="video-subtitle" id="videoSubtitle">Click play to start the presentation</div>
                </div>
                <div class="video-progress">
                    <div class="video-progress-fill" id="progressFill"></div>
                </div>
            </div>
            
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
        
        function togglePlay() {
            if (isPlaying) {
                pausePlay();
            } else {
                startPlay();
            }
        }
        
        function updatePlayButton() {
            const playBtn = document.getElementById('playPauseBtn');
            if (!playBtn) return;
            
            if (isPlaying) {
                playBtn.textContent = '⏸';
                playBtn.classList.add('playing');
            } else {
                playBtn.textContent = '▶';
                playBtn.classList.remove('playing');
            }
        }
        
        function updateSubtitle() {
            const subtitleText = document.getElementById('videoSubtitle');
            if (!subtitleText) return;
            
            if (narrativeScript && narrativeScript.steps && narrativeScript.steps[currentStep]) {
                const stepData = narrativeScript.steps[currentStep];
                subtitleText.textContent = stepData.narrative || elements[currentStep]?.text || 'No description available';
            } else if (elements && elements[currentStep]) {
                subtitleText.textContent = elements[currentStep].text || 'No description available';
            } else {
                subtitleText.textContent = 'Click play to start the presentation';
            }
        }
        
        function startPlay() {
            isPlaying = true;
            updatePlayButton();
            updateStep(currentStep);
            
            if (audioData && audioData.length > 0 && audioData[currentStep] && audioData[currentStep].audioData) {
                playStepAudio(currentStep);
            } else {
                // Auto-advance without audio
                playInterval = setInterval(() => {
                    nextStep();
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
            isPlaying = false;
            updatePlayButton();
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
                     // Set moderate zoom
                     currentZoom = 1.5;
                     
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
        
        // Initialize
        updateStep(0);
        updatePlayButton();
        updateSubtitle();
        initializeZoom();
        
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
      {/* Modern Upload Section */}
      <div className="upload-section-modern">
        <div className="upload-content">
          <div className="upload-icon">📄</div>
          <div className="upload-text">
            <h3>Upload Your PDF</h3>
            <p>Transform your document into an interactive, narrated presentation</p>
          </div>
        </div>
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept=".pdf"
          style={{ display: 'none' }}
        />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="upload-btn-modern"
        >
          {isLoading ? (
            <>
              <div className="btn-spinner"></div>
              <span>Processing...</span>
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7,10 12,15 17,10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Choose PDF File</span>
            </>
          )}
        </button>
      </div>

      {/* Modern Status Messages */}
      {error && (
        <div className="status-message-modern error">
          <div className="status-icon">⚠️</div>
          <div className="status-content">
            <div className="status-title">Upload Error</div>
            <div className="status-description">{error}</div>
          </div>
        </div>
      )}

      {isGeneratingNarrative && (
        <div className="status-message-modern generating">
          <div className="status-spinner"></div>
          <div className="status-content">
            <div className="status-title">Generating narrative script...</div>
            <div className="status-description">Using GPT-4o to create step-by-step presentation</div>
          </div>
        </div>
      )}

      {narrativeError && (
        <div className="status-message-modern error">
          <div className="status-icon">❌</div>
          <div className="status-content">
            <div className="status-title">Failed to generate narrative script</div>
            <div className="status-description">{narrativeError}</div>
          </div>
        </div>
      )}

      {isGeneratingAudio && (
        <div className="status-message-modern generating">
          <div className="status-spinner"></div>
          <div className="status-content">
            <div className="status-title">Generating audio narration...</div>
            <div className="status-description">Creating synchronized audio for each step</div>
          </div>
        </div>
      )}

      {audioError && (
        <div className="status-message-modern error">
          <div className="status-icon">❌</div>
          <div className="status-content">
            <div className="status-title">Failed to generate audio</div>
            <div className="status-description">{audioError}</div>
          </div>
        </div>
      )}

      {/* Modern Presentation Section */}
      {presentationHTML && (
        <div className="presentation-section-modern">
          <div className="presentation-header-modern">
            <div className="presentation-icon">🎬</div>
            <div className="presentation-text">
              <h2>Your Guided Presentation is Ready!</h2>
              <p>Interactive presentation with zoom controls and audio narration</p>
            </div>
          </div>
          
          <div className="presentation-controls-modern">
            <div className="page-controls-modern">
              <button 
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="page-button-modern"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15,18 9,12 15,6"></polyline>
                </svg>
                Previous
              </button>
              <div className="page-info-modern">
                <span className="page-current">{currentPage}</span>
                <span className="page-separator">of</span>
                <span className="page-total">{totalPages}</span>
              </div>
              <button 
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                className="page-button-modern"
              >
                Next
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9,18 15,12 9,6"></polyline>
                </svg>
              </button>
            </div>
            
            <div className="action-section-modern">
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
                className="action-button-modern"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7,10 12,15 17,10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Download HTML with Zoom
              </button>
            </div>
          </div>
          
          <div className="presentation-preview-modern">
            <iframe
              srcDoc={presentationHTML}
              title="Guided Presentation with Zoom"
              className="presentation-iframe-modern"
            />
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default GuidedPresentationWithZoom;
