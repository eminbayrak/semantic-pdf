import React from 'react';

/**
 * Injects semantic IDs into HTML content based on Azure Document Intelligence results
 * This creates strategic targeting points for video animations
 */
export const injectSemanticIDs = (htmlContent, azureResults) => {
  if (!htmlContent || !azureResults) {
    return htmlContent;
  }

  let enhancedHTML = htmlContent;
  
  // Extract key information from Azure results
  const { pages, tables, keyValuePairs, paragraphs } = azureResults;
  
  // Map Azure results to HTML elements and add strategic IDs
  const idMappings = [];
  
  // 1. Process key-value pairs for form fields
  if (keyValuePairs && keyValuePairs.length > 0) {
    keyValuePairs.forEach((pair, index) => {
      if (pair && pair.key && pair.value && typeof pair.key === 'string') {
        const fieldName = pair.key.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const fieldId = `field-${fieldName}`;
        const amountId = `amount-${fieldName}`;
        
        // Check if this looks like an amount field
        const isAmount = /amount|total|cost|price|fee|charge/i.test(pair.key);
        
        idMappings.push({
          originalText: pair.key,
          elementId: isAmount ? amountId : fieldId,
          type: isAmount ? 'amount' : 'field',
          confidence: pair.confidence || 0.8
        });
      }
    });
  }
  
  // 2. Process tables for structured data
  if (tables && tables.length > 0) {
    tables.forEach((table, tableIndex) => {
      if (table.cells && table.cells.length > 0) {
        // Add table-level ID
        const tableId = `table-${tableIndex}`;
        idMappings.push({
          originalText: `Table ${tableIndex + 1}`,
          elementId: tableId,
          type: 'table',
          confidence: 0.9
        });
        
        // Process table rows
        const rowGroups = {};
        table.cells.forEach(cell => {
          if (!rowGroups[cell.rowIndex]) {
            rowGroups[cell.rowIndex] = [];
          }
          rowGroups[cell.rowIndex].push(cell);
        });
        
        Object.entries(rowGroups).forEach(([rowIndex, cells]) => {
          const rowId = `table-row-${rowIndex}`;
          idMappings.push({
            originalText: `Row ${parseInt(rowIndex) + 1}`,
            elementId: rowId,
            type: 'table-row',
            confidence: 0.8
          });
          
          // Process individual cells
          cells.forEach(cell => {
            const cellId = `cell-${cell.rowIndex}-${cell.columnIndex}`;
            idMappings.push({
              originalText: cell.content || '',
              elementId: cellId,
              type: 'table-cell',
              confidence: cell.confidence || 0.7
            });
          });
        });
      }
    });
  }
  
  // 3. Process paragraphs for content sections
  if (paragraphs && paragraphs.length > 0) {
    paragraphs.forEach((paragraph, index) => {
      if (paragraph.content) {
        const paragraphId = `paragraph-${index}`;
        
        // Determine section type based on content
        let sectionType = 'content';
        if (/summary|conclusion|overview/i.test(paragraph.content)) {
          sectionType = 'summary';
        } else if (/header|title|heading/i.test(paragraph.content)) {
          sectionType = 'header';
        } else if (/member|patient|client/i.test(paragraph.content)) {
          sectionType = 'member-info';
        }
        
        idMappings.push({
          originalText: paragraph.content.substring(0, 50) + '...',
          elementId: paragraphId,
          type: sectionType,
          confidence: paragraph.confidence || 0.8
        });
      }
    });
  }
  
  // 4. Add strategic section IDs based on document structure
  const strategicSections = [
    { id: 'header-section', type: 'header', priority: 1 },
    { id: 'member-info', type: 'member-info', priority: 2 },
    { id: 'claims-table', type: 'table', priority: 3 },
    { id: 'summary-section', type: 'summary', priority: 4 }
  ];
  
  strategicSections.forEach(section => {
    idMappings.push({
      originalText: section.type.replace('-', ' '),
      elementId: section.id,
      type: section.type,
      priority: section.priority,
      confidence: 1.0
    });
  });
  
  // 5. Enhance HTML with additional semantic attributes
  enhancedHTML = enhancedHTML.replace(
    /<div id="([^"]*)" class="([^"]*)"([^>]*)>/g,
    (match, id, className, attributes) => {
      const mapping = idMappings.find(m => m.elementId === id);
      if (mapping) {
        const semanticAttrs = [
          `data-semantic-type="${mapping.type}"`,
          `data-confidence="${mapping.confidence}"`,
          `data-priority="${mapping.priority || 5}"`
        ].join(' ');
        
        return `<div id="${id}" class="${className}" ${semanticAttrs}${attributes}>`;
      }
      return match;
    }
  );
  
  // 6. Add data attributes to table elements
  enhancedHTML = enhancedHTML.replace(
    /<td id="([^"]*)"([^>]*)>/g,
    (match, id, attributes) => {
      const mapping = idMappings.find(m => m.elementId === id);
      if (mapping) {
        const semanticAttrs = [
          `data-semantic-type="${mapping.type}"`,
          `data-confidence="${mapping.confidence}"`
        ].join(' ');
        
        return `<td id="${id}" ${semanticAttrs}${attributes}>`;
      }
      return match;
    }
  );
  
  return {
    enhancedHTML,
    idMappings,
    strategicTargets: idMappings.filter(m => m.priority && m.priority <= 4)
  };
};

/**
 * Extracts all element IDs from HTML content for GPT mapping
 */
export const extractElementIds = (htmlContent) => {
  const idRegex = /id="([^"]*)"/g;
  const ids = [];
  let match;
  
  while ((match = idRegex.exec(htmlContent)) !== null) {
    ids.push(match[1]);
  }
  
  return ids;
};

/**
 * Gets element bounds for precise video targeting
 */
export const getElementBounds = (elementId, containerRef) => {
  if (!containerRef?.current) return null;
  
  const element = containerRef.current.querySelector(`#${elementId}`);
  if (!element) return null;
  
  const rect = element.getBoundingClientRect();
  const containerRect = containerRef.current.getBoundingClientRect();
  
  return {
    x: rect.left - containerRect.left,
    y: rect.top - containerRect.top,
    width: rect.width,
    height: rect.height,
    centerX: rect.left - containerRect.left + rect.width / 2,
    centerY: rect.top - containerRect.top + rect.height / 2
  };
};

export default injectSemanticIDs;