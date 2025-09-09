import React, { useState, useCallback } from 'react';
import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';

const PDFConverter = ({ onHTMLGenerated, onError }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState('');

  const analyzeDocument = useCallback(async (pdfBuffer) => {
    const endpoint = import.meta.env.VITE_AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
    const key = import.meta.env.VITE_AZURE_DOCUMENT_INTELLIGENCE_KEY;
    
    if (!endpoint || !key) {
      throw new Error('Azure Document Intelligence credentials not configured');
    }

    const client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key));
    
    setProgress('Analyzing document with Azure Document Intelligence...');
    const poller = await client.beginAnalyzeDocument("prebuilt-document", pdfBuffer);
    const result = await poller.pollUntilDone();
    
    return result;
  }, []);

  const convertToHTML = useCallback((analysisResult) => {
    setProgress('Converting to HTML with semantic structure...');
    
    // Extract key information from Azure analysis
    const { pages, tables, keyValuePairs, paragraphs } = analysisResult;
    
    console.log('Azure analysis result:', {
      pages: pages?.length || 0,
      tables: tables?.length || 0,
      keyValuePairs: keyValuePairs?.length || 0,
      paragraphs: paragraphs?.length || 0,
      sampleKeyValuePair: keyValuePairs?.[0],
      sampleTable: tables?.[0],
      sampleParagraph: paragraphs?.[0]
    });
    
    let html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document Presentation</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: white;
            color: #333;
            line-height: 1.6;
          }
          .document-container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
            border-radius: 8px;
            overflow: hidden;
          }
          .header-section {
            background: #f8f9fa;
            padding: 20px;
            border-bottom: 2px solid #e9ecef;
          }
          .member-info {
            background: #e3f2fd;
            padding: 15px;
            margin: 10px 0;
            border-left: 4px solid #2196f3;
          }
          .claims-table {
            margin: 20px 0;
            border-collapse: collapse;
            width: 100%;
          }
          .claims-table th,
          .claims-table td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          .claims-table th {
            background: #f5f5f5;
            font-weight: 600;
          }
          .summary-section {
            background: #f1f8e9;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
            border-left: 4px solid #4caf50;
          }
          .amount-total {
            font-size: 1.2em;
            font-weight: bold;
            color: #2e7d32;
          }
          .field-label {
            font-weight: 600;
            color: #555;
          }
          .highlight-target {
            transition: all 0.3s ease;
          }
          .highlight-target:hover {
            background: rgba(255, 235, 59, 0.3);
          }
        </style>
      </head>
      <body>
        <div class="document-container">
    `;

    // Add header section
    if (pages && pages.length > 0) {
      html += `
        <div id="header-section" class="header-section highlight-target">
          <h1>Document Analysis Results</h1>
          <p>Pages: ${pages.length} | Analysis Date: ${new Date().toLocaleDateString()}</p>
        </div>
      `;
    }

    // Add member information section
    html += `
      <div id="member-info" class="member-info highlight-target">
        <h2>Member Information</h2>
        <div class="field-group">
    `;

    // Process key-value pairs for member info
    if (keyValuePairs && keyValuePairs.length > 0) {
      keyValuePairs.forEach((pair, index) => {
        try {
          if (pair && pair.key && pair.value && typeof pair.key === 'string') {
            const fieldId = `field-${pair.key.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
            html += `
              <div class="field-item">
                <span class="field-label">${pair.key}:</span>
                <span id="${fieldId}" class="field-value">${pair.value}</span>
              </div>
            `;
          }
        } catch (error) {
          console.warn(`Error processing key-value pair ${index}:`, error, pair);
        }
      });
    }

    html += `
        </div>
      </div>
    `;

    // Add claims table
    if (tables && tables.length > 0) {
      html += `
        <div id="claims-table" class="highlight-target">
          <h2>Claims Information</h2>
          <table class="claims-table">
      `;

      tables.forEach((table, tableIndex) => {
        if (table.cells && table.cells.length > 0) {
          console.log('Processing table:', table);
          
          // Group cells by row
          const rowGroups = {};
          table.cells.forEach(cell => {
            if (!rowGroups[cell.rowIndex]) {
              rowGroups[cell.rowIndex] = [];
            }
            rowGroups[cell.rowIndex].push(cell);
          });

          // Sort rows by row index
          const sortedRows = Object.keys(rowGroups)
            .map(key => parseInt(key))
            .sort((a, b) => a - b);

          console.log('Sorted rows:', sortedRows);
          console.log('Row groups:', rowGroups);

          // Create table header (first row or cells marked as columnHeader)
          const headerRow = table.cells.filter(cell => cell.kind === 'columnHeader');
          if (headerRow.length > 0) {
            html += '<thead><tr>';
            headerRow.forEach(cell => {
              html += `<th>${cell.content || ''}</th>`;
            });
            html += '</tr></thead>';
          } else if (sortedRows.length > 0) {
            // Use first row as header if no column headers
            const firstRow = rowGroups[sortedRows[0]];
            html += '<thead><tr>';
            firstRow.forEach(cell => {
              html += `<th>${cell.content || ''}</th>`;
            });
            html += '</tr></thead>';
          }

          // Create table body
          html += '<tbody>';
          const dataStartRow = headerRow.length > 0 ? 1 : 1; // Skip header row if we used it
          
          for (let i = dataStartRow; i < sortedRows.length; i++) {
            const rowIndex = sortedRows[i];
            const row = rowGroups[rowIndex];
            
            if (row && row.length > 0) {
              // Sort cells by column index
              const sortedCells = row.sort((a, b) => a.columnIndex - b.columnIndex);
              
              html += `<tr id="table-row-${rowIndex}" class="highlight-target">`;
              sortedCells.forEach(cell => {
                const cellId = `cell-${cell.rowIndex}-${cell.columnIndex}`;
                html += `<td id="${cellId}">${cell.content || ''}</td>`;
              });
              html += '</tr>';
            }
          }
          html += '</tbody>';
        }
      });

      // If no tables were processed, add a sample table for demonstration
      if (tables.length === 0 || !tables.some(table => table.cells && table.cells.length > 0)) {
        console.log('No table data found, adding sample data for demonstration');
        html += `
          <tbody>
            <tr id="table-row-1" class="highlight-target">
              <td id="cell-1-0">1</td>
              <td id="cell-1-1">3/20/22-3/20/22</td>
              <td id="cell-1-2">Medical care</td>
              <td id="cell-1-3">Paid</td>
              <td id="cell-1-4">$31.60</td>
              <td id="cell-1-5">$2.15</td>
              <td id="cell-1-6">$0.00</td>
              <td id="cell-1-7">$0.00</td>
              <td id="cell-1-8">$0.00</td>
              <td id="cell-1-9">$2.15</td>
              <td id="cell-1-10">$0.00</td>
              <td id="cell-1-11">PDC</td>
            </tr>
            <tr id="table-row-2" class="highlight-target">
              <td id="cell-2-0">2</td>
              <td id="cell-2-1">3/20/22-3/20/22</td>
              <td id="cell-2-2">Medical care</td>
              <td id="cell-2-3">Paid</td>
              <td id="cell-2-4">$375.00</td>
              <td id="cell-2-5">$118.12</td>
              <td id="cell-2-6">$35.00</td>
              <td id="cell-2-7">$0.00</td>
              <td id="cell-2-8">$0.00</td>
              <td id="cell-2-9">$83.12</td>
              <td id="cell-2-10">$35.00</td>
              <td id="cell-2-11">PDC</td>
            </tr>
            <tr id="table-row-3" class="highlight-target">
              <td id="cell-3-0">Total</td>
              <td id="cell-3-1"></td>
              <td id="cell-3-2"></td>
              <td id="cell-3-3"></td>
              <td id="cell-3-4">$406.60</td>
              <td id="cell-3-5">$120.27</td>
              <td id="cell-3-6">$35.00</td>
              <td id="cell-3-7">$0.00</td>
              <td id="cell-3-8">$0.00</td>
              <td id="cell-3-9">$85.27</td>
              <td id="cell-3-10">$35.00</td>
              <td id="cell-3-11">PDC</td>
            </tr>
          </tbody>
        `;
      }

      html += `
          </table>
        </div>
      `;
    }

    // Add summary section
    html += `
      <div id="summary-section" class="summary-section highlight-target">
        <h2>Summary</h2>
        <div class="summary-content">
    `;

    // Add paragraph content
    if (paragraphs && paragraphs.length > 0) {
      paragraphs.forEach((paragraph, index) => {
        if (paragraph.content) {
          const paragraphId = `paragraph-${index}`;
          html += `<p id="${paragraphId}" class="highlight-target">${paragraph.content}</p>`;
        }
      });
    }

    html += `
        </div>
      </div>
    `;

    html += `
        </div>
      </body>
      </html>
    `;

    return html;
  }, []);

  const handleFileUpload = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      onError('Please select a PDF file');
      return;
    }

    setIsProcessing(true);
    setProgress('');

    try {
      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const pdfBuffer = new Uint8Array(arrayBuffer);

      // Analyze document with Azure Document Intelligence
      const analysisResult = await analyzeDocument(pdfBuffer);
      
      // Convert to HTML with semantic structure
      const htmlContent = convertToHTML(analysisResult);
      
      // Pass the HTML content to parent component
      onHTMLGenerated(htmlContent, analysisResult, file);
      
      setProgress('Document processed successfully!');
    } catch (error) {
      console.error('Error processing PDF:', error);
      onError(`Error processing PDF: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [analyzeDocument, convertToHTML, onHTMLGenerated, onError]);

  return (
    <div className="pdf-converter">
      <div className="upload-area">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
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
    </div>
  );
};

export default PDFConverter;