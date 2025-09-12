import React, { useState, useCallback, useRef, useEffect } from 'react';
import PDFToHTMLTest from './components/Test/PDFToHTMLTest';
import SemanticPDFConverter from './components/Test/SemanticPDFConverter';
import HybridPDFConverter from './components/Test/HybridPDFConverter';
import GuidedPresentation from './components/Test/GuidedPresentation';
import GuidedPresentationWithZoom from './components/Test/GuidedPresentationWithZoom';
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
  const [conversionMode, setConversionMode] = useState('guided-zoom'); // 'layout', 'semantic', 'hybrid', 'guided', 'guided-zoom'
  const [showAdvanced, setShowAdvanced] = useState(false);


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
      case 'layout':
        return <PDFToHTMLTest />;
      case 'semantic':
        return <SemanticPDFConverter />;
      case 'hybrid':
        return <HybridPDFConverter />;
      case 'guided-zoom':
        return <GuidedPresentationWithZoom />;
      case 'guided':
      default:
        return <GuidedPresentation />;
    }
  };

  return (
    <div className="app">
      {/* Modern Flat Header */}
      <header className="flat-header">
        <div className="header-container">
          <div className="header-brand">
            <div className="brand-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10,9 9,9 8,9"></polyline>
              </svg>
            </div>
            <div className="brand-text">
              <h1>DocuFlow</h1>
              <span className="brand-subtitle">Smart Document Processing</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {/* Error Display */}
        {error && (
          <div className="error-message">
            <div className="error-content">
              <div className="error-icon">⚠️</div>
              <div className="error-text">{error}</div>
              <button onClick={() => setError(null)} className="error-dismiss">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="processing-indicator">
            <div className="processing-content">
              <div className="spinner"></div>
              <div className="processing-text">
                <div className="processing-title">Processing...</div>
                <div className="processing-subtitle">Generating narrative script...</div>
              </div>
            </div>
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
              Start Over
            </button>
          </div>
        )}
      </main>

      {/* Compact Footer */}
      <footer className="modern-footer">
        <div className="footer-container">
          <div className="footer-bottom">
            <p>&copy; 2025 EOB Document Processor. All rights reserved.</p>
            <div className="footer-links">
              <a href="#" className="footer-link">Privacy Policy</a>
              <a href="#" className="footer-link">Terms of Service</a>
              <a href="#" className="footer-link">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;