import React, { useState, useCallback, useRef, useEffect } from 'react';
import { getEnvironmentStatus } from './utils/envChecker';
import EnvironmentTest from './components/Services/EnvironmentTest';
import PDFToHTMLTest from './components/Test/PDFToHTMLTest';
import SemanticPDFConverter from './components/Test/SemanticPDFConverter';
import HybridPDFConverter from './components/Test/HybridPDFConverter';
import GuidedPresentation from './components/Test/GuidedPresentation';
import PDFCoordinateExtractor from './components/Services/PDFCoordinateExtractor';
import PDFCoordinateVisualizer from './components/Services/PDFCoordinateVisualizer';
import PDFTextHighlighter from './components/Services/PDFTextHighlighter';
import EOBNarrativeGenerator from './components/Services/EOBNarrativeGenerator';
import './App.css';

/**
 * Main App Component - PDF to Guided Presentation System
 * Focused on core functionality: Upload PDF → Generate Guided Presentation
 */
function App() {
  // State management
  const [pdfFile, setPdfFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [conversionMode, setConversionMode] = useState('narrativeGenerator'); // 'layout', 'semantic', 'hybrid', 'guided', 'coordinates', 'visualizer', 'textHighlighter', 'narrativeGenerator'
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Check environment variables
  React.useEffect(() => {
    const envStatus = getEnvironmentStatus();
    // console.log('Environment Status:', envStatus);

    if (envStatus.status === 'error') {
      setError(`Configuration Error: ${envStatus.message}. Please check your environment variables.`);
    }
  }, []);

  // Handle file upload
  const handleFileSelect = useCallback((file) => {
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setError(null);
      setIsProcessing(true);
      
      // Auto-generate guided presentation
      setTimeout(() => {
        setIsProcessing(false);
      }, 1000);
    } else {
      setError('Please select a valid PDF file.');
    }
  }, []);

  // Handle conversion mode change
  const handleConversionModeChange = useCallback((mode) => {
    setConversionMode(mode);
    setShowSettings(false);
  }, []);

  // Reset the entire process
  const handleReset = useCallback(() => {
    setPdfFile(null);
    setError(null);
    setIsProcessing(false);
  }, []);

  // Render conversion component based on mode
  const renderConversionComponent = () => {
    switch (conversionMode) {
      case 'visualizer':
        return <PDFCoordinateVisualizer />;
      case 'coordinates':
        return <PDFCoordinateExtractor />;
      case 'textHighlighter':
        return <PDFTextHighlighter />;
      case 'narrativeGenerator':
        return <EOBNarrativeGenerator />;
      case 'layout':
        return <PDFToHTMLTest />;
      case 'semantic':
        return <SemanticPDFConverter />;
      case 'hybrid':
        return <HybridPDFConverter />;
      case 'guided':
      default:
        return <GuidedPresentation />;
    }
  };

  return (
    <div className="app">
      <EnvironmentTest />
      
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <h1>PDF Analysis & Presentation System</h1>
          <p>Extract coordinates, analyze documents, and create interactive presentations</p>
        </div>
        
        {/* Settings Dropdown */}
        <div className="settings-container">
          <button 
            className="settings-button"
            onClick={() => setShowSettings(!showSettings)}
            title="Conversion Options"
          >
            ⚙️
          </button>
          
          {showSettings && (
            <div className="settings-dropdown">
              <div className="settings-header">
                <h3>Conversion Options</h3>
                <button 
                  className="close-settings"
                  onClick={() => setShowSettings(false)}
                >
                  ×
                </button>
              </div>
              <div className="settings-options">
                <button 
                  className={`option ${conversionMode === 'visualizer' ? 'active' : ''}`}
                  onClick={() => handleConversionModeChange('visualizer')}
                >
                  🎯 PDF Coordinate Visualizer
                  <span>Visualize PDF with highlight boxes using Azure Document Intelligence coordinates</span>
                </button>
                <button 
                  className={`option ${conversionMode === 'coordinates' ? 'active' : ''}`}
                  onClick={() => handleConversionModeChange('coordinates')}
                >
                  📍 PDF Coordinate Extractor
                  <span>Extract and log PDF section coordinates using Azure Document Intelligence</span>
                </button>
                <button 
                  className={`option ${conversionMode === 'textHighlighter' ? 'active' : ''}`}
                  onClick={() => handleConversionModeChange('textHighlighter')}
                >
                  🎯 PDF Text Highlighter (PDF.js)
                  <span>Direct text search and highlighting using PDF.js - much more accurate!</span>
                </button>
                <button 
                  className={`option ${conversionMode === 'narrativeGenerator' ? 'active' : ''}`}
                  onClick={() => handleConversionModeChange('narrativeGenerator')}
                >
                  📖 EOB Narrative Generator
                  <span>Generate HTML with narrative text and synchronized PDF highlights</span>
                </button>
                <button 
                  className={`option ${conversionMode === 'guided' ? 'active' : ''}`}
                  onClick={() => handleConversionModeChange('guided')}
                >
                  🎬 Guided Presentation
                  <span>AI-powered step-by-step presentation with audio</span>
                </button>
                <button 
                  className={`option ${conversionMode === 'layout' ? 'active' : ''}`}
                  onClick={() => handleConversionModeChange('layout')}
                >
                  📄 Layout Preservation
                  <span>Exact PDF layout with pixel-perfect conversion</span>
                </button>
                <button 
                  className={`option ${conversionMode === 'semantic' ? 'active' : ''}`}
                  onClick={() => handleConversionModeChange('semantic')}
                >
                  🏷️ Semantic HTML
                  <span>Structured HTML with meaningful element IDs</span>
                </button>
                <button 
                  className={`option ${conversionMode === 'hybrid' ? 'active' : ''}`}
                  onClick={() => handleConversionModeChange('hybrid')}
                >
                  🖼️ Hybrid (Image + Semantic)
                  <span>PDF image background with semantic HTML overlay</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {/* Error Display */}
        {error && (
          <div className="error-message">
            <div className="error-content">
              <span className="error-icon">⚠️</span>
              <span className="error-text">{error}</span>
              <button onClick={() => setError(null)} className="error-dismiss">
                ×
              </button>
            </div>
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="processing-indicator">
            <div className="spinner"></div>
            <span>Processing your PDF...</span>
          </div>
        )}

        {/* Conversion Component */}
        <div className="conversion-container">
          {renderConversionComponent()}
        </div>

        {/* Reset Button */}
        {pdfFile && (
          <div className="reset-container">
            <button onClick={handleReset} className="reset-button">
              🔄 Start Over
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>Powered by Azure AI Services • GPT-4o • Document Intelligence • Speech Services</p>
      </footer>
    </div>
  );
}

export default App;