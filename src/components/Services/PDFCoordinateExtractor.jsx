import React, { useState } from 'react';
import AzureDocumentIntelligence from './AzureDocumentIntelligence';

/**
 * PDF Coordinate Extractor Component
 * Uses Azure Document Intelligence to extract PDF section coordinates and console log them
 */
const PDFCoordinateExtractor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [coordinates, setCoordinates] = useState(null);

  const extractCoordinates = async (file) => {
    if (!file) return;

    setIsProcessing(true);
    setProgress('Processing PDF with Azure Document Intelligence...');
    setCoordinates(null);

    try {
      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const pdfBuffer = new Uint8Array(arrayBuffer);

      // Initialize Azure Document Intelligence service
      const azureService = new AzureDocumentIntelligence();
      
      // Analyze document
      setProgress('Analyzing document structure...');
      const analysisResult = await azureService.analyzeDocument(pdfBuffer);
      
      // Extract and log coordinates using the service method
      setProgress('Extracting coordinates...');
      const extractedCoordinates = azureService.extractCoordinates(analysisResult);
      
      setCoordinates(extractedCoordinates);
      setProgress('Coordinates extracted successfully!');
      
    } catch (error) {
      console.error('Error extracting coordinates:', error);
      setProgress(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };


  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      extractCoordinates(file);
    } else {
      setProgress('Please select a valid PDF file');
    }
  };

  return (
    <div className="pdf-coordinate-extractor">
      <div className="extractor-header">
        <h2>PDF Coordinate Extractor</h2>
        <p>Upload a PDF to extract section coordinates using Azure Document Intelligence</p>
      </div>

      <div className="file-upload-section">
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          disabled={isProcessing}
          className="file-input"
        />
        <div className="upload-text">
          {isProcessing ? 'Processing...' : 'Click to upload PDF'}
        </div>
      </div>

      {progress && (
        <div className="progress-info">
          <p>{progress}</p>
        </div>
      )}

      {isProcessing && (
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      )}

      {coordinates && (
        <div className="coordinates-summary">
          <h3>Extracted Coordinates Summary</h3>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="label">Pages:</span>
              <span className="value">{coordinates.pages.length}</span>
            </div>
            <div className="summary-item">
              <span className="label">Tables:</span>
              <span className="value">{coordinates.tables.length}</span>
            </div>
            <div className="summary-item">
              <span className="label">Key-Value Pairs:</span>
              <span className="value">{coordinates.keyValuePairs.length}</span>
            </div>
            <div className="summary-item">
              <span className="label">Paragraphs:</span>
              <span className="value">{coordinates.paragraphs.length}</span>
            </div>
          </div>
          <p className="console-note">
            Check the browser console for detailed coordinate information
          </p>
        </div>
      )}

      <style>{`
        .pdf-coordinate-extractor {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          font-family: Arial, sans-serif;
        }

        .extractor-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .extractor-header h2 {
          color: #333;
          margin-bottom: 10px;
        }

        .file-upload-section {
          text-align: center;
          margin-bottom: 20px;
        }

        .file-input {
          margin-bottom: 10px;
          padding: 10px;
          border: 2px dashed #ccc;
          border-radius: 8px;
          width: 100%;
          max-width: 400px;
        }

        .upload-text {
          color: #666;
          font-size: 14px;
        }

        .progress-info {
          text-align: center;
          padding: 10px;
          background: #f0f8ff;
          border-radius: 4px;
          margin: 10px 0;
        }

        .loading-spinner {
          text-align: center;
          margin: 20px 0;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3498db;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .coordinates-summary {
          margin-top: 30px;
          padding: 20px;
          background: #f9f9f9;
          border-radius: 8px;
          border: 1px solid #ddd;
        }

        .coordinates-summary h3 {
          margin-bottom: 15px;
          color: #333;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 15px;
        }

        .summary-item {
          display: flex;
          justify-content: space-between;
          padding: 10px;
          background: white;
          border-radius: 4px;
          border: 1px solid #e0e0e0;
        }

        .summary-item .label {
          font-weight: bold;
          color: #555;
        }

        .summary-item .value {
          color: #2196f3;
          font-weight: bold;
        }

        .console-note {
          font-style: italic;
          color: #666;
          text-align: center;
          margin-top: 10px;
        }
      `}</style>
    </div>
  );
};

export default PDFCoordinateExtractor;
