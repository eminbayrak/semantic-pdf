import React, { useState, useRef, useEffect } from 'react';
import { generateHTML } from '../PDFToHTML/HTMLGenerator';

/**
 * EOB Narrative Generator with synchronized highlights
 * Creates HTML with narrative text and PDF highlights that sync together
 */
const EOBNarrativeGenerator = () => {
  const [pdfDocument, setPdfDocument] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSection, setSelectedSection] = useState('all');
  const [sectionResults, setSectionResults] = useState([]);
  const [narrativeHTML, setNarrativeHTML] = useState('');
  const [showHighlights, setShowHighlights] = useState(true);
  
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // EOB Section definitions with narrative text
  const eobSections = {
    whatIsThis: {
      name: '1. What This Document Is',
      keywords: ['explanation of benefits', 'this is not a bill', 'eob', 'statement'],
      color: '#ff6b6b',
      narrative: 'This document is an Explanation of Benefits (EOB) that shows how your insurance claim was processed. It is NOT a bill, but rather a detailed breakdown of what services were covered, what your insurance paid, and what you may owe.'
    },
    patientMemberInfo: {
      name: '2. Patient and Member Information',
      keywords: ['member name:', 'patient name:', 'address:', 'city, state, zip:', 'id:', 'group:', 'group number:', 'subscriber number:', 'document number:', 'statement date:'],
      color: '#4ecdc4',
      narrative: 'This section contains your personal information including your name, address, member ID, group number, and other identifying details. It also includes the statement date and document number for reference.'
    },
    serviceDescription: {
      name: '3. Service Description',
      keywords: ['service description', 'date of service', 'procedure', 'diagnosis', 'treatment'],
      color: '#45b7d1',
      narrative: 'Here you\'ll find details about the medical services you received, including the date of service, provider information, procedures performed, and any diagnosis codes. This section explains what medical care was provided.'
    },
    totalCharges: {
      name: '4. Total Charges',
      keywords: ['submit amt', 'totals', '162.00', 'submit amount', 'amount submitted'],
      color: '#f9ca24',
      narrative: 'This shows the total amount that your healthcare provider billed for the services you received. This is the full cost before any insurance adjustments or payments.'
    },
    discountsAdjustments: {
      name: '5. Discounts / Adjustments',
      keywords: ['fee adjust', '43.00', 'discount', 'adjustment', 'reduction', 'contractual'],
      color: '#6c5ce7',
      narrative: 'Any discounts or adjustments applied to your charges are shown here. This typically includes contractual discounts between your insurance and the provider, or other adjustments that reduce the amount you owe.'
    },
    insurancePayment: {
      name: '6. Insurance Payment (Paid by Plan)',
      keywords: ['approved amt', 'allowed amt', 'delta dental payment', '119.00', 'check amount', 'other carrier paid'],
      color: '#a8e6cf',
      narrative: 'This section shows how much your insurance plan paid toward your medical expenses. This is the portion covered by your health insurance benefits.'
    },
    yourResponsibility: {
      name: '7. Your Responsibility (What You Owe)',
      keywords: ['patient payment', 'deduct applied', 'co-pay', '0.00', 'benefit year deductible', 'annual benefit year maximum', 'out-of-pocket limit'],
      color: '#ff7675',
      narrative: 'This is the amount you are responsible for paying. It may include copays, deductibles, coinsurance, or any remaining balance after insurance payments and adjustments.'
    },
    remarkCodes: {
      name: '8. Remark Codes or Notes',
      keywords: ['ref. code', 'reference codes', 'remark code', 'remark', 'code', 'note', 'explanation'],
      color: '#fd79a8',
      narrative: 'Any special notes, codes, or explanations about your claim are listed here. This might include information about coverage decisions, denials, or special circumstances.'
    },
    whatToDoNext: {
      name: '9. What To Do Next',
      keywords: ['you pay only', 'this dentist has agreed', 'payment for these services', 'to submit a claim', 'fraud or abuse', 'professional services department'],
      color: '#fdcb6e',
      narrative: 'This section provides guidance on what actions you should take next, such as contacting customer service with questions, filing an appeal if you disagree with a decision, or understanding your next steps.'
    }
  };

  // Filter matches to keep only those that are close together (likely part of the same section)
  const filterNearbyMatches = (matches) => {
    if (matches.length <= 3) return matches; // Keep all if few matches
    
    // Sort matches by Y position (top to bottom)
    const sortedMatches = matches.sort((a, b) => a.y - b.y);
    
    // Group matches that are close together vertically
    const groups = [];
    let currentGroup = [sortedMatches[0]];
    
    for (let i = 1; i < sortedMatches.length; i++) {
      const currentMatch = sortedMatches[i];
      const lastMatch = currentGroup[currentGroup.length - 1];
      
      // If this match is close to the last one (within 100px vertically), add to current group
      if (Math.abs(currentMatch.y - lastMatch.y) < 100) {
        currentGroup.push(currentMatch);
      } else {
        // Start a new group
        groups.push(currentGroup);
        currentGroup = [currentMatch];
      }
    }
    groups.push(currentGroup);
    
    // Return the largest group (most likely to be the actual section)
    const largestGroup = groups.reduce((max, group) => 
      group.length > max.length ? group : max, groups[0]);
    
    console.log(`🔍 Filtered ${matches.length} matches down to ${largestGroup.length} nearby matches`);
    return largestGroup;
  };

  // Load PDF file
  const handleFileLoad = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;
      setPdfDocument(pdf);
      setCurrentPage(1);
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
      
      // Search for sections
      await searchSectionsInPage(page, viewport, filterSection);
      
    } catch (err) {
      console.error('Error loading page:', err);
      setError(`Error loading page: ${err.message}`);
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
            
            // Debug logging for specific sections that aren't matching
            if (sectionKey === 'totalCharges' || sectionKey === 'insurancePayment') {
              console.log(`🔍 Debug ${section.name}: Checking text "${item.str}" against keywords:`, section.keywords);
            }
            
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
              
              if (sectionKey === 'totalCharges' || sectionKey === 'insurancePayment') {
                console.log(`✅ Match found for ${section.name}: "${item.str}" matched keyword "${matchingKeyword}"`);
              }
            }
          }
        });
        
        if (sectionMatches.length > 0) {
          // Filter out matches that are too far apart (likely false positives)
          const filteredMatches = filterNearbyMatches(sectionMatches);
          
          if (filteredMatches.length > 0) {
            // Create a single bounding box for the entire section
            const minX = Math.min(...filteredMatches.map(m => m.x));
            const maxX = Math.max(...filteredMatches.map(m => m.x + m.width));
            const minY = Math.min(...filteredMatches.map(m => m.y));
            const maxY = Math.max(...filteredMatches.map(m => m.y + m.height));
            
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
              color: section.color,
              sectionNumber: sectionKey === 'whatIsThis' ? 1 :
                            sectionKey === 'patientMemberInfo' ? 2 :
                            sectionKey === 'serviceDescription' ? 3 :
                            sectionKey === 'totalCharges' ? 4 :
                            sectionKey === 'discountsAdjustments' ? 5 :
                            sectionKey === 'insurancePayment' ? 6 :
                            sectionKey === 'yourResponsibility' ? 7 :
                            sectionKey === 'remarkCodes' ? 8 :
                            sectionKey === 'whatToDoNext' ? 9 : 0,
              matchCount: filteredMatches.length,
              page: currentPage,
              narrative: section.narrative
            };
            
            results.push(sectionBox);
            console.log(`🎯 Found ${filteredMatches.length} filtered matches for section: ${section.name} - Created single bounding box`);
          } else {
            console.log(`❌ No valid matches found for section: ${section.name} (all matches filtered out)`);
          }
        } else {
          console.log(`❌ No matches found for section: ${section.name}`);
        }
      });
      
      setSectionResults(results);
      console.log(`🔍 Section search complete: Found ${results.length} total section boxes for selectedSection: "${currentFilter}"`);
      
    } catch (err) {
      console.error('Error searching sections:', err);
      setError(`Error searching sections: ${err.message}`);
    }
  };

  // Generate narrative HTML
  const generateNarrativeHTML = () => {
    if (sectionResults.length === 0) return '';

    const sectionsHTML = sectionResults.map(section => `
      <div class="narrative-section" data-section="${section.sectionKey}">
        <h3 class="section-title">
          <span class="section-number">${section.sectionNumber}</span>
          ${section.sectionName}
        </h3>
        <p class="section-narrative">${section.narrative}</p>
        <div class="section-stats">
          <span class="match-count">${section.matchCount} text matches found</span>
        </div>
      </div>
    `).join('');

    return `
      <div class="narrative-container">
        <h2>EOB Section Analysis</h2>
        <div class="sections-list">
          ${sectionsHTML}
        </div>
      </div>
    `;
  };

  // Handle section selection change
  const handleSectionChange = (newSection) => {
    console.log(`🎯 Section changed from "${selectedSection}" to "${newSection}"`);
    setSelectedSection(newSection);
    if (pdfDocument) {
      console.log(`🔄 Reloading page to apply section filter`);
      setSectionResults([]);
      loadPage(pdfDocument, currentPage, newSection);
    }
  };

  // Update narrative HTML when section results change
  useEffect(() => {
    const html = generateNarrativeHTML();
    setNarrativeHTML(html);
  }, [sectionResults]);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>EOB Narrative Generator</h1>
      
      {/* File Upload */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileLoad}
          accept=".pdf"
          style={{ marginBottom: '10px' }}
        />
        {isLoading && <p>Loading PDF...</p>}
        {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      </div>

      {/* Controls */}
      {pdfDocument && (
        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={selectedSection}
            onChange={(e) => handleSectionChange(e.target.value)}
            style={{ padding: '5px' }}
          >
            <option value="all">All Sections</option>
            {Object.keys(eobSections).map(key => (
              <option key={key} value={key}>{eobSections[key].name}</option>
            ))}
          </select>
          
          <label>
            <input
              type="checkbox"
              checked={showHighlights}
              onChange={(e) => setShowHighlights(e.target.checked)}
            />
            Show Highlights
          </label>
        </div>
      )}

      {/* PDF Viewer with Highlights */}
      {pdfDocument && (
        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ position: 'relative' }}>
            <canvas
              ref={canvasRef}
              style={{ border: '1px solid #ccc' }}
            />
            
            {/* Highlight Overlay */}
            {showHighlights && sectionResults.map((highlight) => (
              <div
                key={highlight.id}
                style={{
                  position: 'absolute',
                  left: highlight.x,
                  top: highlight.y,
                  width: highlight.width,
                  height: highlight.height,
                  border: `3px solid ${highlight.color}`,
                  backgroundColor: `${highlight.color}30`,
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                  zIndex: 10,
                  borderRadius: '8px',
                  animation: 'pulse 2s infinite',
                  boxShadow: `0 0 15px ${highlight.color}50`
                }}
                title={highlight.sectionName}
              >
                {/* Circle number */}
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
              </div>
            ))}
          </div>

          {/* Narrative Panel */}
          <div 
            style={{ 
              flex: 1, 
              maxWidth: '400px',
              padding: '20px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              maxHeight: '600px',
              overflowY: 'auto'
            }}
            dangerouslySetInnerHTML={{ __html: narrativeHTML }}
          />
        </div>
      )}

      {/* CSS Styles */}
      <style>{`
        .narrative-container {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .narrative-section {
          margin-bottom: 20px;
          padding: 15px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          border-left: 4px solid #007bff;
        }
        
        .section-title {
          margin: 0 0 10px 0;
          font-size: 16px;
          color: #333;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .section-number {
          background: #007bff;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
        }
        
        .section-narrative {
          margin: 0 0 10px 0;
          line-height: 1.6;
          color: #555;
        }
        
        .section-stats {
          font-size: 12px;
          color: #666;
          font-style: italic;
        }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default EOBNarrativeGenerator;
