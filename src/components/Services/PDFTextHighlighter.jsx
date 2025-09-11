import React, { useRef, useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';

/**
 * PDF Text Highlighter Component
 * Uses PDF.js to directly extract text with precise coordinates
 * Much more reliable than Azure Document Intelligence for text targeting
 */
const PDFTextHighlighter = () => {
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(1.0);
  const [searchText, setSearchText] = useState('this is not a bill');
  const [searchResults, setSearchResults] = useState([]);
  const [showHighlights, setShowHighlights] = useState(true);
  const [highlightType, setHighlightType] = useState('text'); // 'text', 'sections', 'tables'
  const [selectedSection, setSelectedSection] = useState('all');
  const [sectionResults, setSectionResults] = useState([]);
  const [tableResults, setTableResults] = useState([]);

  // EOB Section definitions for PDF.js text search
  const eobSections = {
    whatIsThis: {
      name: '1. What This Document Is',
      keywords: ['this is not a bill', 'explanation of benefits', 'eob', 'not a bill', 'explains how your insurance', 'document explains', 'insurance handled'],
      color: '#ff6b6b'
    },
    patientMemberInfo: {
      name: '2. Patient and Member Information',
      keywords: ['member name', 'patient name', 'address', 'city', 'state', 'zip', 'group', 'group number', 'subscriber number', 'member id', 'patient id', 'date received', 'statement date', 'document number'],
      color: '#4ecdc4'
    },
    serviceDescription: {
      name: '3. Service Description',
      keywords: ['service description', 'medical service', 'doctor visit', 'blood test', 'physical therapy', 'medical care', 'service', 'procedure', 'treatment', 'date of service', 'line no'],
      color: '#45b7d1'
    },
    totalCharges: {
      name: '4. Total Charges',
      keywords: ['total charges', 'provider charges', 'total claim cost', 'billed amount', 'charges', 'total', 'provider billed', 'amount charged'],
      color: '#f39c12'
    },
    discountsAdjustments: {
      name: '5. Discounts / Adjustments',
      keywords: ['discounts', 'adjustments', 'not your responsibility', 'insurance adjustment', 'plan discount', 'contractual adjustment', 'write-off', 'adjustment'],
      color: '#9b59b6'
    },
    insurancePayment: {
      name: '6. Insurance Payment (Paid by Plan)',
      keywords: ['paid by insurer', 'insurance payment', 'paid by plan', 'plan payment', 'insurance covered', 'allowed charges', 'plan paid', 'insurer paid'],
      color: '#27ae60'
    },
    yourResponsibility: {
      name: '7. Your Responsibility (What You Owe)',
      keywords: ['your responsibility', 'what you owe', 'patient responsibility', 'amount due', 'you owe', 'patient owes', 'balance due', 'outstanding'],
      color: '#e74c3c'
    },
    remarkCodes: {
      name: '8. Remark Codes or Notes',
      keywords: ['remark codes', 'notes', 'explanation', 'code', 'remark', 'note', 'additional information', 'special notes'],
      color: '#8e44ad'
    },
    whatToDoNext: {
      name: '9. What To Do Next',
      keywords: ['what to do next', 'next steps', 'contact', 'customer service', 'phone', 'appeals', 'questions', 'help', 'support', 'call'],
      color: '#34495e'
    }
  };

  // Handle file selection
  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setIsLoading(true);
      setError(null);
      setSearchResults([]);

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      setPdfDocument(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
      
      console.log(`📄 PDF loaded: ${pdf.numPages} pages`);
      
      // Load first page
      await loadPage(pdf, 1);
      
    } catch (err) {
      console.error('Error loading PDF:', err);
      setError(`Error loading PDF: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Load a specific page
  const loadPage = async (pdf, pageNum, filterSection = null) => {
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: scale });
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      // Render PDF page
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
      console.log(`📄 Page ${pageNum} loaded: ${viewport.width}x${viewport.height}`);
      
      // Extract text content for search
      const textContent = await page.getTextContent();
      console.log(`📝 Text content extracted: ${textContent.items.length} items`);
      
      // Search based on highlight type
      if (highlightType === 'text' && searchText) {
        await searchTextInPage(page, searchText, viewport);
      } else if (highlightType === 'sections') {
        await searchSectionsInPage(page, viewport, filterSection);
      } else if (highlightType === 'tables') {
        await searchTablesInPage(page, viewport);
      }
      
    } catch (err) {
      console.error('Error loading page:', err);
      setError(`Error loading page: ${err.message}`);
    }
  };

  // Search for text in the current page
  const searchTextInPage = async (page, searchText, viewport) => {
    try {
      const textContent = await page.getTextContent();
      const results = [];
      
      const searchLower = searchText.toLowerCase();
      
      textContent.items.forEach((item, index) => {
        if (item.str && item.str.toLowerCase().includes(searchLower)) {
          // Get text item coordinates
          const transform = item.transform;
          const x = transform[4];
          const y = transform[5];
          const width = item.width;
          const height = item.height || 12; // Default height if not provided
          
          // Convert PDF coordinates to canvas coordinates
          const canvasX = x;
          const canvasY = viewport.height - y - height; // Flip Y coordinate
          
          results.push({
            id: `text-${index}`,
            text: item.str,
            x: canvasX,
            y: canvasY,
            width: width,
            height: height,
            page: currentPage,
            index: index
          });
          
          console.log(`🎯 Found text: "${item.str}" at (${canvasX.toFixed(1)}, ${canvasY.toFixed(1)})`);
        }
      });
      
      setSearchResults(results);
      console.log(`🔍 Search complete: Found ${results.length} matches for "${searchText}"`);
      
    } catch (err) {
      console.error('Error searching text:', err);
      setError(`Error searching text: ${err.message}`);
    }
  };

  // Search for EOB sections in the current page
  const searchSectionsInPage = async (page, viewport, filterSection = null) => {
    try {
      const textContent = await page.getTextContent();
      const results = [];
      
      // Use the filterSection parameter if provided, otherwise use state
      const currentFilter = filterSection !== null ? filterSection : selectedSection;
      console.log(`🔍 Searching sections with filter: "${currentFilter}"`);
      
      // Search each section
      Object.keys(eobSections).forEach(sectionKey => {
        const section = eobSections[sectionKey];
        
        // Apply filtering logic
        if (currentFilter !== 'all' && sectionKey !== currentFilter) {
          console.log(`⏭️ Skipping section: ${section.name} (not selected)`);
          return;
        }
        
        console.log(`🔍 Processing section: ${section.name}`);
        const sectionMatches = [];
        
        textContent.items.forEach((item, index) => {
          if (item.str) {
            const textLower = item.str.toLowerCase();
            
            // Check if this text matches any of the section keywords
            const matchingKeyword = section.keywords.find(keyword => 
              textLower.includes(keyword.toLowerCase())
            );
            
            if (matchingKeyword) {
              const transform = item.transform;
              const x = transform[4];
              const y = transform[5];
              const width = item.width;
              const height = item.height || 12;
              
              const canvasX = x;
              const canvasY = viewport.height - y - height;
              
              sectionMatches.push({
                x: canvasX,
                y: canvasY,
                width: width,
                height: height,
                text: item.str,
                keyword: matchingKeyword
              });
            }
          }
        });
        
        if (sectionMatches.length > 0) {
          // Create a single bounding box for the entire section
          const minX = Math.min(...sectionMatches.map(m => m.x));
          const maxX = Math.max(...sectionMatches.map(m => m.x + m.width));
          const minY = Math.min(...sectionMatches.map(m => m.y));
          const maxY = Math.max(...sectionMatches.map(m => m.y + m.height));
          
          // Add some padding around the section
          const padding = 10;
          const sectionBox = {
            id: `section-${sectionKey}`,
            x: minX - padding,
            y: minY - padding,
            width: (maxX - minX) + (padding * 2),
            height: (maxY - minY) + (padding * 2),
            sectionKey: sectionKey,
            sectionName: section.name,
            color: '#ffd700', // Yellow color
            sectionNumber: sectionKey === 'whatIsThis' ? 1 :
                          sectionKey === 'patientMemberInfo' ? 2 :
                          sectionKey === 'serviceDescription' ? 3 :
                          sectionKey === 'totalCharges' ? 4 :
                          sectionKey === 'discountsAdjustments' ? 5 :
                          sectionKey === 'insurancePayment' ? 6 :
                          sectionKey === 'yourResponsibility' ? 7 :
                          sectionKey === 'remarkCodes' ? 8 :
                          sectionKey === 'whatToDoNext' ? 9 : 0,
            matchCount: sectionMatches.length,
            page: currentPage
          };
          
          results.push(sectionBox);
          console.log(`🎯 Found ${sectionMatches.length} matches for section: ${section.name} - Created single bounding box`);
        } else {
          console.log(`❌ No matches found for section: ${section.name}`);
        }
      });
      
      setSectionResults(results);
      console.log(`🔍 Section search complete: Found ${results.length} total section boxes for selectedSection: "${selectedSection}"`);
      
    } catch (err) {
      console.error('Error searching sections:', err);
      setError(`Error searching sections: ${err.message}`);
    }
  };

  // Search for table elements in the current page
  const searchTablesInPage = async (page, viewport) => {
    try {
      const textContent = await page.getTextContent();
      const results = [];
      
      // Look for table-like patterns (rows of data with consistent spacing)
      const tableKeywords = ['date', 'service', 'description', 'provider', 'charges', 'amount', 'paid', 'owed', 'total', 'subtotal'];
      const potentialTableItems = [];
      
      textContent.items.forEach((item, index) => {
        if (item.str) {
          const textLower = item.str.toLowerCase();
          
          // Check if this looks like a table header or data
          const isTableKeyword = tableKeywords.some(keyword => 
            textLower.includes(keyword.toLowerCase())
          );
          
          // Check if it contains numbers (likely table data)
          const hasNumbers = /\d/.test(item.str);
          
          // Check if it's in a table-like format (short text, likely in columns)
          const isShortText = item.str.length < 50;
          
          if (isTableKeyword || (hasNumbers && isShortText)) {
            const transform = item.transform;
            const x = transform[4];
            const y = transform[5];
            const width = item.width;
            const height = item.height || 12;
            
            const canvasX = x;
            const canvasY = viewport.height - y - height;
            
            potentialTableItems.push({
              id: `table-${index}`,
              text: item.str,
              x: canvasX,
              y: canvasY,
              width: width,
              height: height,
              page: currentPage,
              index: index,
              isHeader: isTableKeyword,
              type: isTableKeyword ? 'header' : 'data'
            });
          }
        }
      });
      
      // Group items by Y position to find table rows
      const rows = {};
      potentialTableItems.forEach(item => {
        const rowKey = Math.round(item.y / 5) * 5; // Group by Y position (5px tolerance)
        if (!rows[rowKey]) {
          rows[rowKey] = [];
        }
        rows[rowKey].push(item);
      });
      
      // Convert rows to table results
      Object.keys(rows).forEach(rowKey => {
        const rowItems = rows[rowKey].sort((a, b) => a.x - b.x); // Sort by X position
        
        if (rowItems.length > 1) { // Only consider rows with multiple items
          rowItems.forEach((item, index) => {
            results.push({
              ...item,
              rowY: parseFloat(rowKey),
              columnIndex: index,
              totalColumns: rowItems.length
            });
          });
        }
      });
      
      setTableResults(results);
      console.log(`🔍 Table search complete: Found ${results.length} table elements in ${Object.keys(rows).length} potential rows`);
      
    } catch (err) {
      console.error('Error searching tables:', err);
      setError(`Error searching tables: ${err.message}`);
    }
  };

  // Handle search text change
  const handleSearchChange = (newSearchText) => {
    setSearchText(newSearchText);
    if (pdfDocument) {
      loadPage(pdfDocument, currentPage);
    }
  };

  // Handle highlight type change
  const handleHighlightTypeChange = (newType) => {
    setHighlightType(newType);
    if (pdfDocument) {
      loadPage(pdfDocument, currentPage);
    }
  };

  // Handle section selection change
  const handleSectionChange = (newSection) => {
    console.log(`🎯 Section changed from "${selectedSection}" to "${newSection}"`);
    setSelectedSection(newSection);
    if (pdfDocument && highlightType === 'sections') {
      console.log(`🔄 Reloading page to apply section filter`);
      // Force immediate re-render with new section
      setSectionResults([]);
      loadPage(pdfDocument, currentPage, newSection);
    }
  };

  // Handle scale change
  const handleScaleChange = (newScale) => {
    setScale(newScale);
    if (pdfDocument) {
      loadPage(pdfDocument, currentPage);
    }
  };

  // Go to specific page
  const goToPage = (pageNum) => {
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      if (pdfDocument) {
        loadPage(pdfDocument, pageNum);
      }
    }
  };

  // Render highlights using the existing highlight box pattern
  const renderHighlights = () => {
    if (!showHighlights) return null;

    const highlights = [];

    // Render text search results
    if (highlightType === 'text' && searchResults.length > 0) {
      searchResults.forEach((result) => {
        highlights.push({
          id: result.id,
          coords: {
            x: result.x,
            y: result.y,
            width: result.width,
            height: result.height
          },
          color: '#ff0000',
          content: `"${result.text}"`,
          type: 'text'
        });
      });
    }

    // Render section results - FIXED: Only show selected section
    if (highlightType === 'sections' && sectionResults.length > 0) {
      sectionResults.forEach((result) => {
        // Only add highlights for the selected section
        if (selectedSection === 'all' || result.sectionKey === selectedSection) {
          highlights.push({
            id: result.id,
            coords: {
              x: result.x,
              y: result.y,
              width: result.width,
              height: result.height
            },
            color: result.color,
            content: `${result.sectionName}: "${result.text}"`,
            type: 'section',
            sectionKey: result.sectionKey
          });
        }
      });
    }

    // Render table results
    if (highlightType === 'tables' && tableResults.length > 0) {
      tableResults.forEach((result) => {
        const isHeader = result.isHeader;
        highlights.push({
          id: result.id,
          coords: {
            x: result.x,
            y: result.y,
            width: result.width,
            height: result.height
          },
          color: isHeader ? '#0066cc' : '#009900',
          content: `${isHeader ? 'Header' : 'Data'}: "${result.text}" (Column ${result.columnIndex + 1})`,
          type: 'table',
          isHeader: isHeader
        });
      });
    }

    return highlights;
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', background: '#f9f9f9' }}>
        <h2>PDF Text Highlighter (PDF.js Direct)</h2>
        
        <div style={{ marginBottom: '15px' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            disabled={isLoading}
          />
        </div>

        {error && (
          <div style={{ color: 'red', margin: '10px 0' }}>
            {error}
          </div>
        )}

        {pdfDocument && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button 
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                style={{ padding: '8px 16px', border: '1px solid #ccc', background: 'white', cursor: 'pointer', borderRadius: '4px', opacity: currentPage <= 1 ? 0.5 : 1, cursor: currentPage <= 1 ? 'not-allowed' : 'pointer' }}
              >
                ← Previous
              </button>
              
              <span>
                Page {currentPage} of {totalPages}
              </span>
              
              <button 
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                style={{ padding: '8px 16px', border: '1px solid #ccc', background: 'white', cursor: 'pointer', borderRadius: '4px', opacity: currentPage >= totalPages ? 0.5 : 1, cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer' }}
              >
                Next →
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label>Scale:</label>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={scale}
                onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
              />
              <span>{scale.toFixed(1)}x</span>
            </div>

            <div>
              <label>
                Highlight Type:
                <select
                  value={highlightType}
                  onChange={(e) => handleHighlightTypeChange(e.target.value)}
                  style={{ marginLeft: '8px', padding: '4px' }}
                >
                  <option value="text">Text Search</option>
                  <option value="sections">EOB Sections (9 sections)</option>
                  <option value="tables">Table Elements</option>
                </select>
              </label>
            </div>

            {highlightType === 'text' && (
              <div>
                <label>
                  Search Text:
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Enter text to highlight..."
                    style={{ marginLeft: '8px', padding: '4px', width: '200px' }}
                  />
                </label>
              </div>
            )}

            {highlightType === 'sections' && (
              <div>
                <label>
                  Select Section:
                  <select
                    value={selectedSection}
                    onChange={(e) => handleSectionChange(e.target.value)}
                    style={{ marginLeft: '8px', padding: '4px', width: '300px' }}
                  >
                    <option value="all">All Sections</option>
                    {Object.keys(eobSections).map(sectionKey => (
                      <option key={sectionKey} value={sectionKey}>
                        {eobSections[sectionKey].name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <div>
              <label>
                <input
                  type="checkbox"
                  checked={showHighlights}
                  onChange={(e) => setShowHighlights(e.target.checked)}
                />
                Show Highlights
              </label>
            </div>

            {highlightType === 'text' && searchResults.length > 0 && (
              <div style={{ marginTop: '15px', padding: '10px', background: '#e8f4f8', borderRadius: '4px' }}>
                <h3>Text Search Results ({searchResults.length} found):</h3>
                {searchResults.map((result, index) => (
                  <div key={result.id} style={{ margin: '5px 0', fontFamily: 'monospace', padding: '5px', background: '#f5f5f5', borderRadius: '3px' }}>
                    <strong>Match {index + 1}:</strong> "{result.text}" 
                    at position ({result.x.toFixed(1)}, {result.y.toFixed(1)})
                  </div>
                ))}
              </div>
            )}

            {highlightType === 'sections' && sectionResults.length > 0 && (
              <div>
                <h3>Section Results ({sectionResults.length} found):</h3>
                {Object.keys(eobSections).map(sectionKey => {
                  const sectionMatches = sectionResults.filter(r => r.sectionKey === sectionKey);
                  if (sectionMatches.length === 0) return null;
                  
                  return (
                    <div key={sectionKey} style={{ margin: '10px 0', padding: '10px', border: '1px solid #ddd', borderRadius: '5px', background: '#fafafa' }}>
                      <h4 style={{ color: eobSections[sectionKey].color, margin: '0 0 10px 0', fontSize: '14px' }}>
                        {eobSections[sectionKey].name} ({sectionMatches.length} matches)
                      </h4>
                      {sectionMatches.map((result, index) => (
                        <div key={result.id} style={{ margin: '5px 0', fontFamily: 'monospace', padding: '5px', background: '#f5f5f5', borderRadius: '3px' }}>
                          <strong>Match {index + 1}:</strong> "{result.text}" 
                          at position ({result.x.toFixed(1)}, {result.y.toFixed(1)})
                          <span style={{ color: result.color, marginLeft: '10px' }}>
                            [Keyword: {result.keyword}]
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {highlightType === 'tables' && tableResults.length > 0 && (
              <div>
                <h3>Table Results ({tableResults.length} elements found):</h3>
                <div style={{ background: '#e8f4f8', padding: '10px', borderRadius: '4px', marginBottom: '10px' }}>
                  <p>Found table elements with headers and data organized in rows and columns.</p>
                  <p>Blue highlights = Headers, Green highlights = Data</p>
                </div>
                {tableResults.slice(0, 10).map((result, index) => (
                  <div key={result.id} style={{ margin: '5px 0', fontFamily: 'monospace', padding: '5px', background: '#f5f5f5', borderRadius: '3px' }}>
                    <strong>{result.isHeader ? 'Header' : 'Data'} {index + 1}:</strong> "{result.text}" 
                    at position ({result.x.toFixed(1)}, {result.y.toFixed(1)})
                    <span style={{ color: '#666', marginLeft: '10px' }}>
                      [Row Y: {result.rowY}, Column: {result.columnIndex + 1}/{result.totalColumns}]
                    </span>
                  </div>
                ))}
                {tableResults.length > 10 && (
                  <div style={{ fontStyle: 'italic', color: '#666', marginTop: '10px' }}>
                    ... and {tableResults.length - 10} more table elements
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* PDF Canvas Container */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <canvas
            ref={canvasRef}
            style={{ border: '1px solid #ccc' }}
          />
          
          {/* Highlight Overlay - Using existing highlight box pattern */}
          {showHighlights && renderHighlights() && (
            <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
              {renderHighlights().map((highlight) => (
                <div
                  key={highlight.id}
                  className="highlight-box"
                  style={{
                    position: 'absolute',
                    left: highlight.coords.x,
                    top: highlight.coords.y,
                    width: highlight.coords.width,
                    height: highlight.coords.height,
                    border: `3px solid ${highlight.color}`,
                    backgroundColor: `${highlight.color}30`,
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                    zIndex: 10,
                    borderRadius: '8px',
                    animation: 'pulse 2s infinite',
                    boxShadow: `0 0 15px ${highlight.color}50`
                  }}
                  title={highlight.content}
                >
                  {/* Circle number for sections */}
                  {highlight.type === 'section' && highlight.sectionNumber && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '-15px',
                        left: '-15px',
                        width: '30px',
                        height: '30px',
                        backgroundColor: highlight.color,
                        color: 'white',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        border: '2px solid white',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                      }}
                    >
                      {highlight.sectionNumber}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CSS for highlight animations */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.3; }
          50% { opacity: 0.7; }
          100% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
};

export default PDFTextHighlighter;
