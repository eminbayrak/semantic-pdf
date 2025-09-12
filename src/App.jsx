import React, { useState, useCallback, useRef, useEffect } from 'react';
import { getEnvironmentStatus } from './utils/envChecker';
import EnvironmentTest from './components/Services/EnvironmentTest';
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
      <EnvironmentTest />
      
      {/* Modern Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo-section">
            <div className="logo-icon">📄</div>
            <div className="logo-text">
              <h1>PDF to Guided Presentation</h1>
              <p>Transform your PDFs into interactive, narrated presentations</p>
            </div>
          </div>
          
          {/* Mode Badge */}
          {conversionMode === 'guided-zoom' && (
            <div className="mode-badge">
              <span className="badge-icon">🔍</span>
              <span className="badge-text">Zoom-Enabled Mode</span>
            </div>
          )}
        </div>
        
        {/* Modern Settings */}
        <div className="header-right">
          <div className="status-indicator">
            <div className="status-dot"></div>
            <span>Ready</span>
          </div>
          
          <div className="settings-container">
            <button 
              className="settings-button"
              onClick={() => setShowSettings(!showSettings)}
              title="Conversion Options"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
            
            {showSettings && (
              <div className="settings-dropdown">
                <div className="settings-header">
                  <h3>Conversion Modes</h3>
                  <button 
                    className="close-settings"
                    onClick={() => setShowSettings(false)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
                <div className="settings-options">
                  <button 
                    className={`option ${conversionMode === 'guided-zoom' ? 'active' : ''}`}
                    onClick={() => handleConversionModeChange('guided-zoom')}
                  >
                    <div className="option-icon">🔍</div>
                    <div className="option-content">
                      <div className="option-title">Guided Presentation with Zoom</div>
                      <div className="option-description">AI-powered presentation with zoom controls for easy reading</div>
                    </div>
                    {conversionMode === 'guided-zoom' && <div className="option-check">✓</div>}
                  </button>
                  
                  <button 
                    className={`option ${conversionMode === 'guided' ? 'active' : ''}`}
                    onClick={() => handleConversionModeChange('guided')}
                  >
                    <div className="option-icon">🎬</div>
                    <div className="option-content">
                      <div className="option-title">Guided Presentation</div>
                      <div className="option-description">AI-powered step-by-step presentation with audio</div>
                    </div>
                    {conversionMode === 'guided' && <div className="option-check">✓</div>}
                  </button>
                  
                  <button 
                    className={`option ${conversionMode === 'layout' ? 'active' : ''}`}
                    onClick={() => handleConversionModeChange('layout')}
                  >
                    <div className="option-icon">📄</div>
                    <div className="option-content">
                      <div className="option-title">Layout Preservation</div>
                      <div className="option-description">Exact PDF layout with pixel-perfect conversion</div>
                    </div>
                    {conversionMode === 'layout' && <div className="option-check">✓</div>}
                  </button>
                  
                  <button 
                    className={`option ${conversionMode === 'semantic' ? 'active' : ''}`}
                    onClick={() => handleConversionModeChange('semantic')}
                  >
                    <div className="option-icon">🏷️</div>
                    <div className="option-content">
                      <div className="option-title">Semantic HTML</div>
                      <div className="option-description">Structured HTML with meaningful element IDs</div>
                    </div>
                    {conversionMode === 'semantic' && <div className="option-check">✓</div>}
                  </button>
                  
                  <button 
                    className={`option ${conversionMode === 'hybrid' ? 'active' : ''}`}
                    onClick={() => handleConversionModeChange('hybrid')}
                  >
                    <div className="option-icon">🖼️</div>
                    <div className="option-content">
                      <div className="option-title">Hybrid (Image + Semantic)</div>
                      <div className="option-description">PDF image background with semantic HTML overlay</div>
                    </div>
                    {conversionMode === 'hybrid' && <div className="option-check">✓</div>}
                  </button>
                </div>
              </div>
            )}
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

      {/* Modern Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-text">Powered by Azure AI Services</div>
          <div className="footer-tech">
            <span className="tech-item">GPT-4o</span>
            <span className="tech-separator">•</span>
            <span className="tech-item">Document Intelligence</span>
            <span className="tech-separator">•</span>
            <span className="tech-item">Speech Services</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;