import React from 'react';
import { injectSemanticIDs, extractElementIds } from './SemanticIDInjector';

/**
 * Generates HTML content from Azure Document Intelligence results
 * with strategic DOM ID placement for video animations
 */
export const generateHTML = (azureResults, documentType = 'general') => {
  if (!azureResults) {
    throw new Error('Azure results are required to generate HTML');
  }

  const { pages, tables, keyValuePairs, paragraphs } = azureResults;
  
  // Choose template based on document type
  const template = getDocumentTemplate(documentType);
  
  let html = template.structure;
  
  // Process and inject content
  html = injectDocumentContent(html, azureResults);
  
  // Add semantic IDs
  const { enhancedHTML, idMappings } = injectSemanticIDs(html, azureResults);
  
  return {
    html: enhancedHTML,
    idMappings,
    elementIds: extractElementIds(enhancedHTML)
  };
};

/**
 * Gets the appropriate HTML template for the document type
 */
const getDocumentTemplate = (documentType) => {
  const templates = {
    eob: {
      structure: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Explanation of Benefits</title>
          <style>
            ${getEOBStyles()}
          </style>
        </head>
        <body>
          <div class="document-container">
            <div id="header-section" class="header-section">
              <h1>Explanation of Benefits</h1>
              <div class="document-info">
                <span id="document-date" class="document-date"></span>
                <span id="member-id" class="member-id"></span>
              </div>
            </div>
            
            <div id="member-info" class="member-info">
              <h2>Member Information</h2>
              <div class="member-details">
                <div class="field-group">
                  <div class="field-item">
                    <span class="field-label">Member Name:</span>
                    <span id="field-member-name" class="field-value"></span>
                  </div>
                  <div class="field-item">
                    <span class="field-label">Policy Number:</span>
                    <span id="field-policy-number" class="field-value"></span>
                  </div>
                  <div class="field-item">
                    <span class="field-label">Group Number:</span>
                    <span id="field-group-number" class="field-value"></span>
                  </div>
                </div>
              </div>
            </div>
            
            <div id="claims-table" class="claims-section">
              <h2>Claims Summary</h2>
              <table class="claims-table">
                <thead>
                  <tr>
                    <th>Service Date</th>
                    <th>Provider</th>
                    <th>Service</th>
                    <th>Amount Billed</th>
                    <th>Amount Covered</th>
                    <th>Your Responsibility</th>
                  </tr>
                </thead>
                <tbody id="claims-tbody">
                  <!-- Claims will be populated here -->
                </tbody>
              </table>
            </div>
            
            <div id="summary-section" class="summary-section">
              <h2>Summary</h2>
              <div class="summary-totals">
                <div class="total-item">
                  <span class="total-label">Total Billed:</span>
                  <span id="amount-total-billed" class="amount-total"></span>
                </div>
                <div class="total-item">
                  <span class="total-label">Total Covered:</span>
                  <span id="amount-total-covered" class="amount-total"></span>
                </div>
                <div class="total-item highlight">
                  <span class="total-label">Your Responsibility:</span>
                  <span id="amount-your-responsibility" class="amount-total highlight-amount"></span>
                </div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    },
    
    invoice: {
      structure: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invoice</title>
          <style>
            ${getInvoiceStyles()}
          </style>
        </head>
        <body>
          <div class="document-container">
            <div id="header-section" class="header-section">
              <h1>Invoice</h1>
              <div class="invoice-info">
                <span id="invoice-number" class="invoice-number"></span>
                <span id="invoice-date" class="invoice-date"></span>
              </div>
            </div>
            
            <div id="billing-info" class="billing-info">
              <h2>Billing Information</h2>
              <div class="billing-details">
                <div class="field-group">
                  <div class="field-item">
                    <span class="field-label">Bill To:</span>
                    <span id="field-bill-to" class="field-value"></span>
                  </div>
                  <div class="field-item">
                    <span class="field-label">Due Date:</span>
                    <span id="field-due-date" class="field-value"></span>
                  </div>
                </div>
              </div>
            </div>
            
            <div id="items-table" class="items-section">
              <h2>Items</h2>
              <table class="items-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody id="items-tbody">
                  <!-- Items will be populated here -->
                </tbody>
              </table>
            </div>
            
            <div id="summary-section" class="summary-section">
              <h2>Total</h2>
              <div class="summary-totals">
                <div class="total-item">
                  <span class="total-label">Subtotal:</span>
                  <span id="amount-subtotal" class="amount-total"></span>
                </div>
                <div class="total-item">
                  <span class="total-label">Tax:</span>
                  <span id="amount-tax" class="amount-total"></span>
                </div>
                <div class="total-item highlight">
                  <span class="total-label">Total Due:</span>
                  <span id="amount-total-due" class="amount-total highlight-amount"></span>
                </div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    },
    
    general: {
      structure: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Document</title>
          <style>
            ${getGeneralStyles()}
          </style>
        </head>
        <body>
          <div class="document-container">
            <div id="header-section" class="header-section">
              <h1>Document</h1>
            </div>
            
            <div id="content-section" class="content-section">
              <!-- Content will be populated here -->
            </div>
            
            <div id="summary-section" class="summary-section">
              <h2>Summary</h2>
              <div class="summary-content">
                <!-- Summary will be populated here -->
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    }
  };
  
  return templates[documentType] || templates.general;
};

/**
 * Injects content from Azure results into HTML template
 */
const injectDocumentContent = (html, azureResults) => {
  const { pages, tables, keyValuePairs, paragraphs } = azureResults;
  
  // Process key-value pairs
  if (keyValuePairs && keyValuePairs.length > 0) {
    keyValuePairs.forEach(pair => {
      if (pair && pair.key && pair.value && typeof pair.key === 'string') {
        const fieldName = pair.key.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const fieldId = `field-${fieldName}`;
        
        // Replace placeholder with actual value
        html = html.replace(
          new RegExp(`<span id="${fieldId}"[^>]*></span>`, 'g'),
          `<span id="${fieldId}" class="field-value">${pair.value}</span>`
        );
      }
    });
  }
  
  // Process tables
  if (tables && tables.length > 0) {
    tables.forEach((table, tableIndex) => {
      if (table.cells && table.cells.length > 0) {
        const tbodyId = tableIndex === 0 ? 'claims-tbody' : 'items-tbody';
        let tableRows = '';
        
        const rowGroups = {};
        table.cells.forEach(cell => {
          if (!rowGroups[cell.rowIndex]) {
            rowGroups[cell.rowIndex] = [];
          }
          rowGroups[cell.rowIndex].push(cell);
        });
        
        Object.values(rowGroups).forEach((row, rowIndex) => {
          tableRows += `<tr id="table-row-${rowIndex}">`;
          row.forEach(cell => {
            const cellId = `cell-${cell.rowIndex}-${cell.columnIndex}`;
            tableRows += `<td id="${cellId}">${cell.content || ''}</td>`;
          });
          tableRows += '</tr>';
        });
        
        html = html.replace(
          new RegExp(`<tbody id="${tbodyId}">[\\s\\S]*?</tbody>`, 'g'),
          `<tbody id="${tbodyId}">${tableRows}</tbody>`
        );
      }
    });
  }
  
  // Process paragraphs
  if (paragraphs && paragraphs.length > 0) {
    let contentHtml = '';
    paragraphs.forEach((paragraph, index) => {
      if (paragraph.content) {
        const paragraphId = `paragraph-${index}`;
        contentHtml += `<p id="${paragraphId}">${paragraph.content}</p>`;
      }
    });
    
    html = html.replace(
      /<div id="content-section"[^>]*>[\s\S]*?<\/div>/g,
      `<div id="content-section" class="content-section">${contentHtml}</div>`
    );
  }
  
  return html;
};

/**
 * CSS styles for EOB documents
 */
const getEOBStyles = () => `
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
  .highlight-amount {
    color: #d32f2f;
    font-size: 1.4em;
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
`;

/**
 * CSS styles for Invoice documents
 */
const getInvoiceStyles = () => `
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
  .billing-info {
    background: #fff3e0;
    padding: 15px;
    margin: 10px 0;
    border-left: 4px solid #ff9800;
  }
  .items-table {
    margin: 20px 0;
    border-collapse: collapse;
    width: 100%;
  }
  .items-table th,
  .items-table td {
    border: 1px solid #ddd;
    padding: 12px;
    text-align: left;
  }
  .items-table th {
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
  .highlight-amount {
    color: #d32f2f;
    font-size: 1.4em;
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
`;

/**
 * CSS styles for general documents
 */
const getGeneralStyles = () => `
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
  .content-section {
    padding: 20px;
  }
  .summary-section {
    background: #f1f8e9;
    padding: 20px;
    margin: 20px 0;
    border-radius: 8px;
    border-left: 4px solid #4caf50;
  }
  .highlight-target {
    transition: all 0.3s ease;
  }
  .highlight-target:hover {
    background: rgba(255, 235, 59, 0.3);
  }
`;

export default generateHTML;