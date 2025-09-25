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
            <div>
            <div>
              <img 
                src="/src/assets/optum-logo-ora-rgb1.svg" 
                alt="Optum Logo" 
                width="120" 
                height="35"
              />
            </div>
              {/* <h1>Optum</h1> */}
              <span className="brand-subtitle">Smart Document Processing</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {/* Error Display with Liquid Glass */}
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
            <p>&copy; 2025 Optum. All rights reserved.</p>
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