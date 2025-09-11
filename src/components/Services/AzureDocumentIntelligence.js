import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';

/**
 * Azure Document Intelligence Service
 * Handles PDF analysis and document structure extraction
 */
class AzureDocumentIntelligence {
  constructor() {
    this.endpoint = import.meta.env.VITE_AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
    this.key = import.meta.env.VITE_AZURE_DOCUMENT_INTELLIGENCE_KEY;
    
    // Environment variables are configured
    
    if (!this.endpoint || !this.key) {
      throw new Error(`Azure Document Intelligence credentials not configured. Endpoint: ${this.endpoint ? 'Set' : 'Missing'}, Key: ${this.key ? 'Set' : 'Missing'}`);
    }
    
    this.client = new DocumentAnalysisClient(
      this.endpoint, 
      new AzureKeyCredential(this.key)
    );
  }

  /**
   * Analyzes a PDF document using Azure Document Intelligence
   * @param {Uint8Array} pdfBuffer - PDF file as byte array
   * @param {string} model - Model to use for analysis (default: prebuilt-document)
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeDocument(pdfBuffer, model = 'prebuilt-document') {
    try {
      const poller = await this.client.beginAnalyzeDocument(model, pdfBuffer);
      const result = await poller.pollUntilDone();
      
      return this.processAnalysisResult(result);
      
    } catch (error) {
      console.error('Error analyzing document:', error);
      throw new Error(`Document analysis failed: ${error.message}`);
    }
  }

  /**
   * Processes and structures the analysis result
   */
  processAnalysisResult(result) {
    const processed = {
      pages: result.pages || [],
      tables: result.tables || [],
      keyValuePairs: result.keyValuePairs || [],
      paragraphs: result.paragraphs || [],
      styles: result.styles || [],
      documents: result.documents || [],
      metadata: {
        modelId: result.modelId,
        apiVersion: result.apiVersion,
        requestId: result.requestId
      }
    };

    // Enhance key-value pairs with confidence scores
    processed.keyValuePairs = processed.keyValuePairs.map(pair => ({
      ...pair,
      confidence: pair.confidence || 0.8,
      category: this.categorizeKeyValuePair(pair.key)
    }));

    // Enhance tables with structure information
    processed.tables = processed.tables.map((table, index) => ({
      ...table,
      tableIndex: index,
      rowCount: this.getTableRowCount(table),
      columnCount: this.getTableColumnCount(table),
      hasHeaders: this.hasTableHeaders(table)
    }));

    // Enhance paragraphs with semantic information
    processed.paragraphs = processed.paragraphs.map(paragraph => ({
      ...paragraph,
      semanticType: this.categorizeParagraph(paragraph.content),
      importance: this.calculateParagraphImportance(paragraph)
    }));

    return processed;
  }

  /**
   * Categorizes key-value pairs for better semantic understanding
   */
  categorizeKeyValuePair(key) {
    if (!key) return 'unknown';
    
    // Handle both string keys and object keys with content property
    const keyText = typeof key === 'string' ? key : (key.content || '');
    if (!keyText) return 'unknown';
    
    const keyLower = keyText.toLowerCase();
    
    if (/member|patient|client|customer/i.test(keyLower)) {
      return 'member-info';
    }
    if (/amount|total|cost|price|fee|charge|billed|covered/i.test(keyLower)) {
      return 'financial';
    }
    if (/date|time|period/i.test(keyLower)) {
      return 'temporal';
    }
    if (/policy|group|id|number/i.test(keyLower)) {
      return 'identifier';
    }
    if (/provider|doctor|facility/i.test(keyLower)) {
      return 'provider';
    }
    
    return 'general';
  }

  /**
   * Categorizes paragraphs based on content
   */
  categorizeParagraph(content) {
    if (!content) return 'unknown';
    
    const contentLower = content.toLowerCase();
    
    if (/summary|conclusion|overview/i.test(contentLower)) {
      return 'summary';
    }
    if (/header|title|heading/i.test(contentLower)) {
      return 'header';
    }
    if (/member|patient|client/i.test(contentLower)) {
      return 'member-info';
    }
    if (/claim|service|procedure/i.test(contentLower)) {
      return 'claims';
    }
    if (/total|amount|cost|billed/i.test(contentLower)) {
      return 'financial';
    }
    
    return 'content';
  }

  /**
   * Calculates importance score for paragraphs
   */
  calculateParagraphImportance(paragraph) {
    if (!paragraph.content) return 0;
    
    let importance = 0.5; // Base importance
    
    // Increase importance for financial information
    if (/total|amount|cost|billed|covered|responsibility/i.test(paragraph.content)) {
      importance += 0.3;
    }
    
    // Increase importance for member information
    if (/member|patient|client|policy|group/i.test(paragraph.content)) {
      importance += 0.2;
    }
    
    // Increase importance for summary information
    if (/summary|conclusion|overview/i.test(paragraph.content)) {
      importance += 0.2;
    }
    
    // Decrease importance for very short content
    if (paragraph.content.length < 20) {
      importance -= 0.2;
    }
    
    return Math.max(0, Math.min(1, importance));
  }

  /**
   * Gets the number of rows in a table
   */
  getTableRowCount(table) {
    if (!table.cells) return 0;
    
    const rowIndices = new Set(table.cells.map(cell => cell.rowIndex));
    return rowIndices.size;
  }

  /**
   * Gets the number of columns in a table
   */
  getTableColumnCount(table) {
    if (!table.cells) return 0;
    
    const columnIndices = new Set(table.cells.map(cell => cell.columnIndex));
    return columnIndices.size;
  }

  /**
   * Checks if a table has headers
   */
  hasTableHeaders(table) {
    if (!table.cells) return false;
    
    return table.cells.some(cell => cell.kind === 'columnHeader');
  }

  /**
   * Extracts specific document types using specialized models
   */
  async analyzeDocumentWithModel(pdfBuffer, modelType) {
    const models = {
      'prebuilt-document': 'prebuilt-document',
      'prebuilt-invoice': 'prebuilt-invoice',
      'prebuilt-receipt': 'prebuilt-receipt',
      'prebuilt-businessCard': 'prebuilt-businessCard',
      'prebuilt-idDocument': 'prebuilt-idDocument',
      'prebuilt-tax.us.w2': 'prebuilt-tax.us.w2',
      'prebuilt-tax.us.1098': 'prebuilt-tax.us.1098',
      'prebuilt-tax.us.1098E': 'prebuilt-tax.us.1098E',
      'prebuilt-tax.us.1098T': 'prebuilt-tax.us.1098T'
    };

    const model = models[modelType] || 'prebuilt-document';
    return await this.analyzeDocument(pdfBuffer, model);
  }

  /**
   * Validates document analysis results
   */
  validateAnalysisResult(result) {
    const errors = [];
    
    if (!result.pages || result.pages.length === 0) {
      errors.push('No pages found in document');
    }
    
    if (!result.tables && !result.keyValuePairs && !result.paragraphs) {
      errors.push('No structured data found in document');
    }
    
    // Validation completed
    
    return {
      isValid: errors.length === 0,
      errors: errors,
      hasContent: !!(result.tables?.length || result.keyValuePairs?.length || result.paragraphs?.length)
    };
  }

  /**
   * Gets document statistics
   */
  getDocumentStatistics(result) {
    return {
      pageCount: result.pages?.length || 0,
      tableCount: result.tables?.length || 0,
      keyValuePairCount: result.keyValuePairs?.length || 0,
      paragraphCount: result.paragraphs?.length || 0,
      hasFinancialData: this.hasFinancialData(result),
      hasMemberData: this.hasMemberData(result),
      hasTableData: this.hasTableData(result)
    };
  }

  /**
   * Checks if document contains financial data
   */
  hasFinancialData(result) {
    if (!result.keyValuePairs) return false;
    
    return result.keyValuePairs.some(pair => {
      const keyText = typeof pair.key === 'string' ? pair.key : (pair.key?.content || '');
      return pair.category === 'financial' || 
        /amount|total|cost|price|fee|charge|billed|covered/i.test(keyText);
    });
  }

  /**
   * Checks if document contains member data
   */
  hasMemberData(result) {
    if (!result.keyValuePairs) return false;
    
    return result.keyValuePairs.some(pair => {
      const keyText = typeof pair.key === 'string' ? pair.key : (pair.key?.content || '');
      return pair.category === 'member-info' || 
        /member|patient|client|customer/i.test(keyText);
    });
  }

  /**
   * Checks if document contains table data
   */
  hasTableData(result) {
    return result.tables && result.tables.length > 0;
  }

  /**
   * Extracts coordinates from analysis result and logs them to console
   * @param {Object} result - Analysis result from Azure Document Intelligence
   * @returns {Object} Extracted coordinates organized by type
   */
  extractCoordinates(result) {
    const coordinates = {
      pages: [],
      tables: [],
      keyValuePairs: [],
      paragraphs: []
    };

    // Extract page coordinates
    if (result.pages && result.pages.length > 0) {
      result.pages.forEach((page, pageIndex) => {
        const pageCoords = {
          pageNumber: page.pageNumber,
          width: page.width,
          height: page.height,
          unit: page.unit,
          spans: page.spans || []
        };
        
        coordinates.pages.push(pageCoords);
      });
    }

    // Extract table coordinates
    if (result.tables && result.tables.length > 0) {
      result.tables.forEach((table, tableIndex) => {
        const tableCoords = {
          tableIndex,
          rowCount: table.rowCount,
          columnCount: table.columnCount,
          cells: [],
          boundingRegions: table.boundingRegions || []
        };

        if (table.boundingRegions && table.boundingRegions.length > 0) {
          table.boundingRegions.forEach((region, regionIndex) => {
            // Store region data without logging
          });
        }

        if (table.cells && table.cells.length > 0) {
          table.cells.forEach((cell, cellIndex) => {
            const cellCoords = {
              cellIndex,
              rowIndex: cell.rowIndex,
              columnIndex: cell.columnIndex,
              content: cell.content,
              confidence: cell.confidence,
              boundingRegions: cell.boundingRegions || []
            };

            if (cell.boundingRegions && cell.boundingRegions.length > 0) {
              cell.boundingRegions.forEach((region, regionIndex) => {
                // Store region data without logging
              });
            }

            tableCoords.cells.push(cellCoords);
          });
        }

        coordinates.tables.push(tableCoords);
      });
    }

    // Extract key-value pair coordinates
    if (result.keyValuePairs && result.keyValuePairs.length > 0) {
      result.keyValuePairs.forEach((pair, pairIndex) => {
        const pairCoords = {
          pairIndex,
          key: pair.key?.content || '',
          value: pair.value?.content || '',
          confidence: pair.confidence,
          boundingRegions: pair.boundingRegions || []
        };

        if (pair.boundingRegions && pair.boundingRegions.length > 0) {
          pair.boundingRegions.forEach((region, regionIndex) => {
            // Store region data without logging
          });
        }

        coordinates.keyValuePairs.push(pairCoords);
      });
    }

    // Extract paragraph coordinates
    if (result.paragraphs && result.paragraphs.length > 0) {
      result.paragraphs.forEach((paragraph, paragraphIndex) => {
        const paragraphCoords = {
          paragraphIndex,
          content: paragraph.content,
          confidence: paragraph.confidence,
          boundingRegions: paragraph.boundingRegions || []
        };

        if (paragraph.boundingRegions && paragraph.boundingRegions.length > 0) {
          paragraph.boundingRegions.forEach((region, regionIndex) => {
            // Store region data without logging
          });
        }

        coordinates.paragraphs.push(paragraphCoords);
      });
    }

    return coordinates;
  }
}

export default AzureDocumentIntelligence;