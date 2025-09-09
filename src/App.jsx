import React, { useState, useCallback, useRef, useEffect } from 'react';
import PDFConverter from './components/PDFToHTML/PDFConverter';
import { generateHTML } from './components/PDFToHTML/HTMLGenerator';
import GPTNarrationMapper from './components/Services/GPTNarrationMapper';
import AzureDocumentIntelligence from './components/Services/AzureDocumentIntelligence';
import VideoComposition from './components/Remotion/VideoComposition';
import PowerPointPresentation from './components/Remotion/PowerPointPresentation';
import PDFPresentation from './components/Remotion/PDFPresentation';
import NarrationScriptGenerator from './components/Services/NarrationScriptGenerator';
import { getTemplate } from './utils/htmlTemplates';
import { getEnvironmentStatus } from './utils/envChecker';
import EnvironmentTest from './components/Services/EnvironmentTest';
import PDFToHTMLTest from './components/Test/PDFToHTMLTest';
import SemanticPDFConverter from './components/Test/SemanticPDFConverter';
import HybridPDFConverter from './components/Test/HybridPDFConverter';
import GuidedPresentation from './components/Test/GuidedPresentation';
import './App.css';

/**
 * Main App Component - PDF to Video Presentation System
 * Orchestrates the complete workflow from PDF upload to video generation
 */
function App() {
  // State management
  const [currentStep, setCurrentStep] = useState('upload'); // upload, process, map, generate, render
  const [htmlContent, setHtmlContent] = useState('');
  const [azureResults, setAzureResults] = useState(null);
  const [narrationMappings, setNarrationMappings] = useState(null);
  const [narrationText, setNarrationText] = useState('');
  const [narrationScript, setNarrationScript] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [documentType, setDocumentType] = useState('eob');
  const [presentationMode, setPresentationMode] = useState('video'); // 'video', 'powerpoint', or 'pdf'
  const [pdfFile, setPdfFile] = useState(null);
  const [showTestPage, setShowTestPage] = useState(false);
  const [testPageType, setTestPageType] = useState('guided'); // 'layout', 'semantic', 'hybrid', or 'guided'
  
  // Refs
  const gptMapperRef = useRef(null);
  const azureServiceRef = useRef(null);
  const narrationGeneratorRef = useRef(null);

  // Check environment variables and initialize services
  React.useEffect(() => {
    const envStatus = getEnvironmentStatus();
    console.log('Environment Status:', envStatus);
    
    if (envStatus.status === 'error') {
      setError(`Configuration Error: ${envStatus.message}. Please check your environment variables.`);
      return;
    }
    
    try {
      gptMapperRef.current = new GPTNarrationMapper();
      azureServiceRef.current = new AzureDocumentIntelligence();
      narrationGeneratorRef.current = new NarrationScriptGenerator();
      console.log('Services initialized successfully');
    } catch (err) {
      setError(`Service initialization failed: ${err.message}`);
    }
  }, []);

  // Handle PDF processing completion
  const handleHTMLGenerated = useCallback(async (html, results, file) => {
    try {
      setCurrentStep('process');
      setHtmlContent(html);
      setAzureResults(results);
      setPdfFile(file);
      setError(null);
      
      // Auto-advance to mapping step if narration is provided
      if (narrationText.trim()) {
        await handleNarrationMapping(html, narrationText);
      }
    } catch (err) {
      setError(`HTML generation failed: ${err.message}`);
    }
  }, [narrationText]);

  // Handle presentation mode change
  const handlePresentationModeChange = useCallback((mode) => {
    setPresentationMode(mode);
    
    // If switching to PDF mode and we have a PDF file, advance to presentation
    if (mode === 'pdf' && pdfFile && azureResults) {
      setCurrentStep('present');
    }
  }, [pdfFile, azureResults]);

  // Handle narration mapping
  const handleNarrationMapping = useCallback(async (html, narration) => {
    if (!gptMapperRef.current || !html || !narration.trim()) {
      return;
    }

    try {
      setIsProcessing(true);
      setCurrentStep('map');
      setError(null);

      const mappings = await gptMapperRef.current.mapNarrationToElements(narration, html);
      setNarrationMappings(mappings);
      setCurrentStep('generate');
      
    } catch (err) {
      setError(`Narration mapping failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Generate complete narration script with audio
  const handleGenerateNarrationScript = useCallback(async () => {
    if (!narrationGeneratorRef.current || !htmlContent || !narrationText.trim()) {
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      setProgress('Generating narration script with audio...');

      const script = await narrationGeneratorRef.current.generateNarrationScript(
        htmlContent,
        narrationText,
        {
          voice: 'en-US-AriaNeural',
          rate: '0%',
          pitch: '0%',
          volume: '100%'
        }
      );

      setNarrationScript(script);
      setCurrentStep('present');
      
    } catch (err) {
      setError(`Narration script generation failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [htmlContent, narrationText]);

  // Handle narration text change
  const handleNarrationChange = useCallback((event) => {
    const text = event.target.value;
    setNarrationText(text);
    
    // Auto-map if HTML is already available
    if (htmlContent && text.trim()) {
      handleNarrationMapping(htmlContent, text);
    }
  }, [htmlContent, handleNarrationMapping]);

  // Handle document type change
  const handleDocumentTypeChange = useCallback((event) => {
    setDocumentType(event.target.value);
  }, []);

  // Reset the entire process
  const handleReset = useCallback(() => {
    setCurrentStep('upload');
    setHtmlContent('');
    setAzureResults(null);
    setNarrationMappings(null);
    setNarrationText('');
    setError(null);
  }, []);

  // Render current step
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'upload':
        return (
          <div className="step-container">
            <h2>Step 1: Upload PDF Document</h2>
            <div className="document-type-selector">
              <label htmlFor="document-type">Document Type:</label>
              <select 
                id="document-type" 
                value={documentType} 
                onChange={handleDocumentTypeChange}
                className="document-type-select"
              >
                <option value="eob">Explanation of Benefits (EOB)</option>
                <option value="invoice">Invoice</option>
                <option value="report">Report</option>
                <option value="custom">Custom Document</option>
              </select>
            </div>
            <PDFConverter 
              onHTMLGenerated={handleHTMLGenerated}
              onError={setError}
            />
          </div>
        );

      case 'process':
        return (
          <div className="step-container">
            <h2>Step 2: Document Processed</h2>
            <div className="success-message">
              <p>✅ PDF successfully converted to HTML with semantic structure</p>
              <div className="document-stats">
                {azureResults && (
                  <>
                    <p>Pages: {azureResults.pages?.length || 0}</p>
                    <p>Tables: {azureResults.tables?.length || 0}</p>
                    <p>Key-Value Pairs: {azureResults.keyValuePairs?.length || 0}</p>
                  </>
                )}
              </div>
            </div>
            <div className="html-preview">
              <h3>HTML Preview:</h3>
              <div 
                className="preview-container"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            </div>
          </div>
        );

      case 'map':
        return (
          <div className="step-container">
            <h2>Step 3: Narration Mapping</h2>
            <div className="narration-input">
              <label htmlFor="narration-text">Enter your narration text:</label>
              <textarea
                id="narration-text"
                value={narrationText}
                onChange={handleNarrationChange}
                placeholder="Enter the narration text that will guide the video presentation..."
                className="narration-textarea"
                rows={6}
              />
              {isProcessing && (
                <div className="processing-indicator">
                  <div className="spinner"></div>
                  <p>Mapping narration to document elements...</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'generate':
        return (
          <div className="step-container">
            <h2>Step 4: Generate Presentation</h2>
            <div className="presentation-options">
              <h3>Choose Presentation Mode:</h3>
              <div className="mode-selector">
                <label className="mode-option">
                  <input
                    type="radio"
                    name="presentationMode"
                    value="video"
                    checked={presentationMode === 'video'}
                    onChange={(e) => handlePresentationModeChange(e.target.value)}
                  />
                  <div className="mode-card">
                    <h4>Video Generation</h4>
                    <p>Generate MP4 video with Remotion</p>
                  </div>
                </label>
                <label className="mode-option">
                  <input
                    type="radio"
                    name="presentationMode"
                    value="powerpoint"
                    checked={presentationMode === 'powerpoint'}
                    onChange={(e) => handlePresentationModeChange(e.target.value)}
                  />
                  <div className="mode-card">
                    <h4>PowerPoint Style</h4>
                    <p>Interactive presentation with audio narration</p>
                  </div>
                </label>
                <label className="mode-option">
                  <input
                    type="radio"
                    name="presentationMode"
                    value="pdf"
                    checked={presentationMode === 'pdf'}
                    onChange={(e) => handlePresentationModeChange(e.target.value)}
                  />
                  <div className="mode-card">
                    <h4>PDF Presentation</h4>
                    <p>Exact PDF view with precise coordinate targeting</p>
                  </div>
                </label>
              </div>
            </div>
            
            {presentationMode === 'video' && (
              <div className="video-preview">
                <h3>Video Preview:</h3>
                <VideoComposition
                  htmlContent={htmlContent}
                  narrationMappings={narrationMappings}
                  videoConfig={{
                    width: 1920,
                    height: 1080,
                    fps: 30,
                    durationInFrames: narrationMappings?.totalDuration || 600
                  }}
                />
              </div>
            )}

            {presentationMode === 'pdf' && (
              <div className="pdf-preview">
                <h3>PDF Presentation Mode Selected</h3>
                <p>This will show the actual PDF document with precise coordinate targeting.</p>
                <button
                  onClick={() => setCurrentStep('present')}
                  className="btn btn-primary"
                >
                  Go to PDF Presentation
                </button>
              </div>
            )}

            {presentationMode === 'powerpoint' && (
              <div className="powerpoint-options">
                <h3>PowerPoint Presentation Options:</h3>
                <button
                  onClick={handleGenerateNarrationScript}
                  disabled={isProcessing}
                  className="generate-script-button"
                >
                  {isProcessing ? 'Generating...' : 'Generate Narration Script with Audio'}
                </button>
              </div>
            )}
          </div>
        );

      case 'present':
        return (
          <div className="step-container">
            <h2>Step 5: Presentation</h2>
            {narrationScript && (
              <div className="presentation-container">
                <div className="presentation-controls">
                  <h3>Presentation Controls</h3>
                  <div className="script-info">
                    <p><strong>Mode:</strong> {presentationMode === 'pdf' ? 'PDF Presentation' : 'PowerPoint Style'}</p>
                    <p><strong>Total Duration:</strong> {narrationScript.totalDuration.toFixed(1)} seconds</p>
                    <p><strong>Segments:</strong> {narrationScript.segments.length}</p>
                    <p><strong>Audio Generated:</strong> {narrationScript.combinedAudio ? 'Yes' : 'No'}</p>
                  </div>
                </div>
                
                <div className="presentation-viewer">
                  {presentationMode === 'pdf' ? (
                    <PDFPresentation
                      pdfFile={pdfFile}
                      azureResults={azureResults}
                      narrationSegments={narrationScript.segments}
                      audioData={narrationScript.combinedAudio}
                      currentSegmentIndex={0}
                    />
                  ) : (
                    <PowerPointPresentation
                      htmlContent={htmlContent}
                      narrationSegments={narrationScript.segments}
                      audioData={narrationScript.combinedAudio}
                      currentSlideIndex={0}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // Show test page if requested
  if (showTestPage) {
    return (
      <div className="app">
        <div className="test-page-header">
          <button 
            onClick={() => setShowTestPage(false)}
            className="back-button"
          >
            ← Back to Main App
          </button>
          <h1>PDF Conversion Test Page</h1>
          <div className="test-page-tabs">
            <button 
              className={testPageType === 'layout' ? 'active' : ''}
              onClick={() => setTestPageType('layout')}
            >
              Layout Preservation
            </button>
            <button 
              className={testPageType === 'semantic' ? 'active' : ''}
              onClick={() => setTestPageType('semantic')}
            >
              Semantic HTML
            </button>
            <button 
              className={testPageType === 'hybrid' ? 'active' : ''}
              onClick={() => setTestPageType('hybrid')}
            >
              Hybrid (Image + Semantic)
            </button>
            <button 
              className={testPageType === 'guided' ? 'active' : ''}
              onClick={() => setTestPageType('guided')}
            >
              Guided Presentation
            </button>
          </div>
        </div>
        {testPageType === 'layout' ? <PDFToHTMLTest /> : 
         testPageType === 'semantic' ? <SemanticPDFConverter /> : 
         testPageType === 'hybrid' ? <HybridPDFConverter /> :
         <GuidedPresentation />}
      </div>
    );
  }

  return (
    <div className="app">
      <EnvironmentTest />
      <header className="app-header">
        <div className="header-top">
          <h1>PDF to Video Presentation System</h1>
          <button 
            onClick={() => setShowTestPage(true)}
            className="test-page-button"
          >
            Test PDF to HTML
          </button>
        </div>
        <p>Convert PDFs to professional video presentations with AI-powered narration mapping</p>
        <div className="security-warning">
          <strong>⚠️ Security Notice:</strong> This demo runs AI services in the browser for convenience. 
          In production, use a backend proxy to protect API credentials.
        </div>
      </header>

      <main className="app-main">
        {/* Progress Indicator */}
        <div className="progress-indicator">
          <div className={`step ${currentStep === 'upload' ? 'active' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">Upload PDF</span>
          </div>
          <div className={`step ${currentStep === 'process' ? 'active' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">Process</span>
          </div>
          <div className={`step ${currentStep === 'map' ? 'active' : ''}`}>
            <span className="step-number">3</span>
            <span className="step-label">Map Narration</span>
          </div>
          <div className={`step ${currentStep === 'generate' ? 'active' : ''}`}>
            <span className="step-number">4</span>
            <span className="step-label">Generate</span>
          </div>
          <div className={`step ${currentStep === 'present' ? 'active' : ''}`}>
            <span className="step-number">5</span>
            <span className="step-label">Present</span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-message">
            <h3>Error:</h3>
            <p>{error}</p>
            <button onClick={() => setError(null)} className="dismiss-button">
              Dismiss
            </button>
          </div>
        )}

        {/* Current Step Content */}
        {renderCurrentStep()}

        {/* Action Buttons */}
        <div className="action-buttons">
          {currentStep !== 'upload' && (
            <button onClick={handleReset} className="reset-button">
              Start Over
            </button>
          )}
          
          {currentStep === 'process' && narrationText.trim() && (
            <button 
              onClick={() => handleNarrationMapping(htmlContent, narrationText)}
              className="continue-button"
            >
              Map Narration
            </button>
          )}
        </div>
      </main>

      <footer className="app-footer">
        <p>Powered by Azure Document Intelligence, GPT-4o, and Remotion</p>
      </footer>
    </div>
  );
}

export default App;