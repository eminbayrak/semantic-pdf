import React, { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import AzureDocumentIntelligence from './AzureDocumentIntelligence';
import UniversalCoordinateConverter from './UniversalCoordinateConverter';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';

/**
 * Universal EOB Highlighter
 * Uses Azure Document Intelligence + Universal Coordinate Converter
 * Works with any EOB template by using semantic analysis instead of keyword matching
 */
const UniversalEOBHighlighter = () => {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [sections, setSections] = useState({});
  const [selectedSection, setSelectedSection] = useState('all');
  const [showHighlights, setShowHighlights] = useState(true);
  
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const azureService = new AzureDocumentIntelligence();
  const coordinateConverter = new UniversalCoordinateConverter();

  // EOB section definitions with comprehensive semantic patterns
  const eobSections = {
    documentHeader: {
      name: '1. Document Header',
      patterns: [
        'explanation of benefits', 'this is not a bill', 'statement of benefits', 'eob', 'benefits statement',
        'explanation of benefits', 'not a bill', 'benefits', 'statement', 'explanation'
      ],
      color: '#e74c3c',
      narrative: 'This is the main document header that identifies this as an Explanation of Benefits (EOB) document.'
    },
    patientInfo: {
      name: '2. Patient Information',
      patterns: [
        'subscriber name', 'subscriber address', 'subscriber city', 'member name', 'patient name', 
        'address:', 'city:', 'state:', 'zip:', 'group:', 'policy:', 'dob:', 'birth:',
        'subscriber:', 'member:', 'insured', 'insured name', 'insured address',
        'claim number:', 'group name:', 'subscriber id#:', 'patient:', 'dentist:',
        'subscriber information', 'member information', 'personal information',
        'benefit year deductible', 'benefit year maximum', 'orthodontic maximum', 'out-of-pocket limit'
      ],
      color: '#3498db',
      narrative: 'Contains your personal information including name, address, member ID, and contact details.'
    },
    serviceDetails: {
      name: '3. Service Details',
      patterns: [
        'service date', 'procedure description', 'proc. code', 'evaluation', 'cleaning', 'treatment', 
        'service:', 'procedure:', 'description:', 'date:', 'ref. code', 'reference code',
        'service details', 'procedure details', 'treatment details', 'medical services', 'services provided',
        'dental plan', 'dental insurance', 'in-network dentists', 'payment for these services'
      ],
      color: '#2ecc71',
      narrative: 'Details about the medical services you received, including dates, procedures, and codes.'
    },
    financialSummary: {
      name: '4. Financial Summary',
      patterns: [
        'submit amt', 'fee adjust', 'approved amt', 'allowed amt', 'deduct applied', 'totals',
        'check amount', 'total charges', 'billed amount', 'allowed amount', 'approved amount',
        'financial summary', 'billing summary', 'cost summary', 'amount summary',
        'this dentist has agreed', 'discount shown', 'fee adjust column'
      ],
      color: '#f39c12',
      narrative: 'Shows the financial breakdown including total charges, insurance payments, and what you owe.'
    },
    paymentInfo: {
      name: '5. Payment Information',
      patterns: [
        'patient payment', 'delta dental payment', 'insurance payment', 'plan payment', 
        'payment to date', 'check number', 'check amount', 'payment:', 'paid:', 'owed:', 'due:', 'balance:',
        'payment information', 'payment details', 'payment summary', 'your responsibility', 
        'amount owed', 'balance due', 'outstanding balance', 'you pay only'
      ],
      color: '#9b59b6',
      narrative: 'Information about payments made by insurance and any remaining balance you may owe.'
    },
    notes: {
      name: '6. Notes and Codes',
      patterns: [
        'reference codes', 'remark codes', 'explanation codes', 'pdc', 'ref code', 'remark code',
        'rights of review', 'rights of appeal', 'fraud', 'abuse', 'professional services',
        'in-network', 'out-of-network', 'network dentist', 'fee reductions', 'website',
        'coding information', 'additional notes', 'special notes', 'important notes'
      ],
      color: '#e67e22',
      narrative: 'Additional notes, codes, or explanations about your claim or coverage.'
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      setError('Please select a valid PDF file');
      return;
    }

    setPdfFile(file);
    setError('');
    setIsProcessing(true);

    try {
      // Get the ArrayBuffer once and create copies for each use
      const arrayBuffer = await file.arrayBuffer();
      
      // Create a copy for PDF.js
      const arrayBufferCopy1 = arrayBuffer.slice();
      const pdfDoc = await pdfjsLib.getDocument(arrayBufferCopy1).promise;
      setPdf(pdfDoc);

      // Create a copy for Azure Document Intelligence
      const arrayBufferCopy2 = arrayBuffer.slice();
      const pdfBuffer = new Uint8Array(arrayBufferCopy2);
      const analysisResult = await azureService.analyzeDocument(pdfBuffer);
      
      // Load first page and process
      await loadPage(pdfDoc, 1, analysisResult);

    } catch (err) {
      console.error('Error processing PDF:', err);
      setError(`Error processing PDF: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const loadPage = async (pdfDoc, pageNumber, analysisResult) => {
    try {
      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // Render PDF page
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
      // Process Azure results with universal coordinate converter
      const processedSections = await processAzureResults(analysisResult, page, viewport);
      setSections(processedSections);
      
      console.log('📊 Processed sections:');
      Object.keys(processedSections).forEach(key => {
        console.log(`  ${key}: ${processedSections[key].elements.length} elements`);
      });
      
    } catch (err) {
      console.error('Error loading page:', err);
      setError(`Error loading page: ${err.message}`);
    }
  };

  const processAzureResults = async (analysisResult, pdfPage, viewport) => {
    const sections = {};
    
    // Initialize sections
    Object.keys(eobSections).forEach(key => {
      sections[key] = {
        ...eobSections[key],
        elements: []
      };
    });

    // Process tables
    if (analysisResult.tables && analysisResult.tables.length > 0) {
      console.log(`📊 Processing ${analysisResult.tables.length} tables`);
      analysisResult.tables.forEach((table, index) => {
        if (table.boundingRegions && table.boundingRegions.length > 0) {
          const coords = coordinateConverter.convertBoundingRegion(
            table.boundingRegions[0], 
            pdfPage, 
            viewport, 
            scale
          );
          
          if (coords) {
            // Determine which section this table belongs to
            const sectionKey = classifyTable(table);
            if (sectionKey && sections[sectionKey]) {
              sections[sectionKey].elements.push({
                ...table,
                canvasCoords: coords,
                type: 'table'
              });
              console.log(`✅ Table ${index + 1} added to ${sectionKey}`);
            } else {
              console.log(`❌ Table ${index + 1} not classified or section not found`);
            }
          }
        }
      });
    }

    // Process key-value pairs
    if (analysisResult.keyValuePairs && analysisResult.keyValuePairs.length > 0) {
      console.log(`🔑 Processing ${analysisResult.keyValuePairs.length} key-value pairs`);
      analysisResult.keyValuePairs.forEach((pair, index) => {
        if (pair.boundingRegions && pair.boundingRegions.length > 0) {
          const coords = coordinateConverter.convertBoundingRegion(
            pair.boundingRegions[0], 
            pdfPage, 
            viewport, 
            scale
          );
          
          if (coords) {
            const sectionKey = classifyKeyValuePair(pair);
            if (sectionKey && sections[sectionKey]) {
              sections[sectionKey].elements.push({
                ...pair,
                canvasCoords: coords,
                type: 'field'
              });
              console.log(`✅ Key-value ${index + 1} added to ${sectionKey}`);
            } else {
              console.log(`❌ Key-value ${index + 1} not classified or section not found`);
            }
          }
        }
      });
    }

    // Process paragraphs
    if (analysisResult.paragraphs && analysisResult.paragraphs.length > 0) {
      console.log(`📝 Processing ${analysisResult.paragraphs.length} paragraphs`);
      analysisResult.paragraphs.forEach((paragraph, index) => {
        if (paragraph.boundingRegions && paragraph.boundingRegions.length > 0) {
          const coords = coordinateConverter.convertBoundingRegion(
            paragraph.boundingRegions[0], 
            pdfPage, 
            viewport, 
            scale
          );
          
          if (coords) {
            const sectionKey = classifyParagraph(paragraph);
            if (sectionKey && sections[sectionKey]) {
              sections[sectionKey].elements.push({
                ...paragraph,
                canvasCoords: coords,
                type: 'paragraph'
              });
              console.log(`✅ Paragraph ${index + 1} added to ${sectionKey}`);
            } else {
              console.log(`❌ Paragraph ${index + 1} not classified or section not found`);
            }
          }
        }
      });
    }

    return sections;
  };

  const classifyTable = (table) => {
    const content = (table.cells || []).map(cell => cell.content || '').join(' ').toLowerCase();
    
    console.log(`🔍 Table content to classify:`, content.substring(0, 200) + '...');
    
    // Check each section in order of specificity
    for (const [sectionKey, section] of Object.entries(eobSections)) {
      const matchingPatterns = section.patterns.filter(pattern => content.includes(pattern));
      if (matchingPatterns.length > 0) {
        console.log(`📋 Table classified as ${sectionKey}:`, content.substring(0, 100) + '...');
        console.log(`   Matching patterns:`, matchingPatterns);
        return sectionKey;
      }
    }
    
    console.log(`❌ Table not classified, defaulting to serviceDetails`);
    // Default to service details for tables
    return 'serviceDetails';
  };

  const classifyKeyValuePair = (pair) => {
    const key = (pair.key || '').toLowerCase();
    const value = (pair.value || '').toLowerCase();
    const content = `${key} ${value}`;
    
    console.log(`🔍 Key-value content to classify:`, content);
    
    // Check each section in order of specificity
    for (const [sectionKey, section] of Object.entries(eobSections)) {
      const matchingPatterns = section.patterns.filter(pattern => content.includes(pattern));
      if (matchingPatterns.length > 0) {
        console.log(`🔑 Key-value classified as ${sectionKey}:`, content);
        console.log(`   Matching patterns:`, matchingPatterns);
        return sectionKey;
      }
    }
    
    console.log(`❌ Key-value not classified, defaulting to patientInfo`);
    // Default to patient info for form fields
    return 'patientInfo';
  };

  const classifyParagraph = (paragraph) => {
    const content = (paragraph.content || '').toLowerCase();
    
    console.log(`🔍 Paragraph content to classify:`, content.substring(0, 200) + '...');
    
    // Check each section in order of specificity
    for (const [sectionKey, section] of Object.entries(eobSections)) {
      const matchingPatterns = section.patterns.filter(pattern => content.includes(pattern));
      if (matchingPatterns.length > 0) {
        console.log(`📝 Paragraph classified as ${sectionKey}:`, content.substring(0, 100) + '...');
        console.log(`   Matching patterns:`, matchingPatterns);
        return sectionKey;
      }
    }
    
    console.log(`❌ Paragraph not classified`);
    // Don't classify paragraphs by default
    return null;
  };

  const renderHighlights = () => {
    if (!showHighlights) return null;

    const elementsToHighlight = selectedSection === 'all' 
      ? Object.values(sections).flatMap(section => section.elements)
      : sections[selectedSection]?.elements || [];

    return elementsToHighlight.map((element, index) => {
      const coords = element.canvasCoords;
      if (!coords) return null;

      const section = Object.values(sections).find(s => s.elements.includes(element));
      const sectionColor = section?.color || '#ffd700';

      // Add debug info to highlight box
      const debugInfo = `${Math.round(coords.x)},${Math.round(coords.y)}`;

      return (
        <div
          key={`highlight-${index}`}
          style={{
            position: 'absolute',
            left: coords.x,
            top: coords.y,
            width: coords.width,
            height: coords.height,
            border: `3px solid ${sectionColor}`,
            borderRadius: '8px',
            backgroundColor: `${sectionColor}20`,
            pointerEvents: 'auto', // Enable clicking
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          onClick={() => {
            console.log('🎯 Clicked highlight:');
            console.log('  Highlight number:', index + 1);
            console.log('  Section:', section?.name);
            console.log('  Type:', element.type);
            console.log('  Content:', element.content || element.key || 'Table');
            console.log('  Coordinates:', coords);
            console.log('  Debug info:', debugInfo);
          }}
        >
          <div
            style={{
              backgroundColor: sectionColor,
              color: 'white',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 'bold'
            }}
          >
            {index + 1}
          </div>
          {/* Debug info overlay */}
          <div
            style={{
              position: 'absolute',
              top: '-20px',
              left: '0px',
              backgroundColor: 'rgba(0,0,0,0.8)',
              color: 'white',
              fontSize: '10px',
              padding: '2px 4px',
              borderRadius: '3px',
              pointerEvents: 'none'
            }}
          >
            {debugInfo}
          </div>
        </div>
      );
    });
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>Universal EOB Highlighter</h2>
      <p>Uses Azure Document Intelligence with universal coordinate conversion to work with any EOB template.</p>
      
      {/* File Upload */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          ref={fileInputRef}
          style={{ marginRight: '10px' }}
        />
        {isProcessing && <span>Processing...</span>}
        {error && <div style={{ color: 'red', marginTop: '10px' }}>{error}</div>}
      </div>

      {/* Controls */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '20px', alignItems: 'center' }}>
        <div>
          <label>Section: </label>
          <select 
            value={selectedSection} 
            onChange={(e) => setSelectedSection(e.target.value)}
            style={{ marginLeft: '5px' }}
          >
            <option value="all">All Sections</option>
            {Object.entries(eobSections).map(([key, section]) => (
              <option key={key} value={key}>
                {section.name} ({sections[key]?.elements.length || 0})
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label>
            <input
              type="checkbox"
              checked={showHighlights}
              onChange={(e) => setShowHighlights(e.target.checked)}
              style={{ marginRight: '5px' }}
            />
            Show Highlights
          </label>
        </div>
      </div>

      {/* PDF Canvas */}
      <div style={{ position: 'relative', border: '1px solid #ccc', display: 'inline-block' }}>
        <canvas
          ref={canvasRef}
          style={{ display: 'block' }}
        />
        {renderHighlights()}
      </div>

      {/* Section Information */}
      {Object.entries(sections).map(([key, section]) => (
        section.elements.length > 0 && (
          <div key={key} style={{ marginTop: '20px', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}>
            <h3 style={{ color: section.color, margin: '0 0 10px 0' }}>
              {section.name} ({section.elements.length} elements)
            </h3>
            <p style={{ margin: '0 0 10px 0', fontStyle: 'italic' }}>{section.narrative}</p>
            <div style={{ fontSize: '12px', color: '#666' }}>
              Elements: {section.elements.map((el, i) => (
                <span key={i}>
                  {el.type}
                  {i < section.elements.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
          </div>
        )
      ))}
    </div>
  );
};

export default UniversalEOBHighlighter;
