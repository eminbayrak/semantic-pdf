/**
 * HTML Templates for different document types
 * Provides reusable templates with strategic DOM ID placement for video animations
 */

/**
 * EOB (Explanation of Benefits) Template
 */
export const eobTemplate = {
  name: 'EOB',
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
        <div id="header-section" class="header-section highlight-target">
          <h1>Explanation of Benefits</h1>
          <div class="document-info">
            <span id="document-date" class="document-date"></span>
            <span id="member-id" class="member-id"></span>
          </div>
        </div>
        
        <div id="member-info" class="member-info highlight-target">
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
              <div class="field-item">
                <span class="field-label">Date of Birth:</span>
                <span id="field-date-of-birth" class="field-value"></span>
              </div>
            </div>
          </div>
        </div>
        
        <div id="claims-table" class="claims-section highlight-target">
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
        
        <div id="summary-section" class="summary-section highlight-target">
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
  `,
  targetElements: [
    'header-section',
    'member-info',
    'claims-table',
    'summary-section',
    'field-member-name',
    'field-policy-number',
    'field-group-number',
    'amount-total-billed',
    'amount-total-covered',
    'amount-your-responsibility'
  ]
};

/**
 * Invoice Template
 */
export const invoiceTemplate = {
  name: 'Invoice',
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
        <div id="header-section" class="header-section highlight-target">
          <h1>Invoice</h1>
          <div class="invoice-info">
            <span id="invoice-number" class="invoice-number"></span>
            <span id="invoice-date" class="invoice-date"></span>
          </div>
        </div>
        
        <div id="billing-info" class="billing-info highlight-target">
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
              <div class="field-item">
                <span class="field-label">Payment Terms:</span>
                <span id="field-payment-terms" class="field-value"></span>
              </div>
            </div>
          </div>
        </div>
        
        <div id="items-table" class="items-section highlight-target">
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
        
        <div id="summary-section" class="summary-section highlight-target">
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
  `,
  targetElements: [
    'header-section',
    'billing-info',
    'items-table',
    'summary-section',
    'field-bill-to',
    'field-due-date',
    'field-payment-terms',
    'amount-subtotal',
    'amount-tax',
    'amount-total-due'
  ]
};

/**
 * Report Template
 */
export const reportTemplate = {
  name: 'Report',
  structure: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Report</title>
      <style>
        ${getReportStyles()}
      </style>
    </head>
    <body>
      <div class="document-container">
        <div id="header-section" class="header-section highlight-target">
          <h1 id="report-title">Report</h1>
          <div class="report-info">
            <span id="report-date" class="report-date"></span>
            <span id="report-author" class="report-author"></span>
          </div>
        </div>
        
        <div id="executive-summary" class="executive-summary highlight-target">
          <h2>Executive Summary</h2>
          <div id="summary-content" class="summary-content">
            <!-- Summary content will be populated here -->
          </div>
        </div>
        
        <div id="data-section" class="data-section highlight-target">
          <h2>Data Analysis</h2>
          <div class="data-tables">
            <!-- Data tables will be populated here -->
          </div>
        </div>
        
        <div id="conclusions-section" class="conclusions-section highlight-target">
          <h2>Conclusions</h2>
          <div id="conclusions-content" class="conclusions-content">
            <!-- Conclusions will be populated here -->
          </div>
        </div>
      </div>
    </body>
    </html>
  `,
  targetElements: [
    'header-section',
    'executive-summary',
    'data-section',
    'conclusions-section',
    'report-title',
    'report-date',
    'report-author',
    'summary-content',
    'conclusions-content'
  ]
};

/**
 * Custom Document Template
 */
export const customTemplate = {
  name: 'Custom',
  structure: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Document</title>
      <style>
        ${getCustomStyles()}
      </style>
    </head>
    <body>
      <div class="document-container">
        <div id="header-section" class="header-section highlight-target">
          <h1 id="document-title">Document</h1>
        </div>
        
        <div id="content-section" class="content-section highlight-target">
          <!-- Content will be populated here -->
        </div>
        
        <div id="summary-section" class="summary-section highlight-target">
          <h2>Summary</h2>
          <div id="summary-content" class="summary-content">
            <!-- Summary will be populated here -->
          </div>
        </div>
      </div>
    </body>
    </html>
  `,
  targetElements: [
    'header-section',
    'content-section',
    'summary-section',
    'document-title',
    'summary-content'
  ]
};

/**
 * Get template by name
 */
export const getTemplate = (templateName) => {
  const templates = {
    'eob': eobTemplate,
    'invoice': invoiceTemplate,
    'report': reportTemplate,
    'custom': customTemplate
  };
  
  return templates[templateName] || customTemplate;
};

/**
 * Get all available templates
 */
export const getAllTemplates = () => {
  return [eobTemplate, invoiceTemplate, reportTemplate, customTemplate];
};

/**
 * CSS Styles for EOB documents
 */
function getEOBStyles() {
  return `
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
}

/**
 * CSS Styles for Invoice documents
 */
function getInvoiceStyles() {
  return `
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
}

/**
 * CSS Styles for Report documents
 */
function getReportStyles() {
  return `
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
    .executive-summary {
      background: #e8f5e8;
      padding: 20px;
      margin: 10px 0;
      border-left: 4px solid #4caf50;
    }
    .data-section {
      background: #f3e5f5;
      padding: 20px;
      margin: 10px 0;
      border-left: 4px solid #9c27b0;
    }
    .conclusions-section {
      background: #fff3e0;
      padding: 20px;
      margin: 10px 0;
      border-left: 4px solid #ff9800;
    }
    .highlight-target {
      transition: all 0.3s ease;
    }
    .highlight-target:hover {
      background: rgba(255, 235, 59, 0.3);
    }
  `;
}

/**
 * CSS Styles for Custom documents
 */
function getCustomStyles() {
  return `
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
}

export default {
  eobTemplate,
  invoiceTemplate,
  reportTemplate,
  customTemplate,
  getTemplate,
  getAllTemplates
};