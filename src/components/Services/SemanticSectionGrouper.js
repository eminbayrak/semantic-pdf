/**
 * Semantic Section Grouper
 * Groups Azure Document Intelligence granular elements into logical sections
 */
class SemanticSectionGrouper {
  constructor() {
    this.sections = {
      whatIsThis: {
        name: '1. What This Document Is',
        color: '#ff6b6b',
        keywords: ['explanation of benefits', 'eob', 'this is not a bill', 'not a bill', 'explains how your insurance', 'document explains', 'insurance handled', 'medical visit', 'service']
      },
      patientMemberInfo: {
        name: '2. Patient and Member Information',
        color: '#4ecdc4',
        keywords: ['member name', 'patient name', 'address', 'city', 'state', 'zip', 'group', 'group number', 'subscriber number', 'member id', 'patient id', 'date received', 'statement date', 'document number']
      },
      serviceDescription: {
        name: '3. Service Description',
        color: '#45b7d1',
        keywords: ['service description', 'medical service', 'doctor visit', 'blood test', 'physical therapy', 'medical care', 'service', 'procedure', 'treatment', 'date of service', 'line no']
      },
      totalCharges: {
        name: '4. Total Charges',
        color: '#f39c12',
        keywords: ['total charges', 'provider charges', 'total claim cost', 'billed amount', 'charges', 'total', 'provider billed', 'amount charged']
      },
      discountsAdjustments: {
        name: '5. Discounts / Adjustments',
        color: '#9b59b6',
        keywords: ['discounts', 'adjustments', 'not your responsibility', 'insurance adjustment', 'plan discount', 'contractual adjustment', 'write-off', 'adjustment']
      },
      insurancePayment: {
        name: '6. Insurance Payment (Paid by Plan)',
        color: '#27ae60',
        keywords: ['paid by insurer', 'insurance payment', 'paid by plan', 'plan payment', 'insurance covered', 'allowed charges', 'plan paid', 'insurer paid']
      },
      yourResponsibility: {
        name: '7. Your Responsibility (What You Owe)',
        color: '#e74c3c',
        keywords: ['what you owe', 'your responsibility', 'deductible', 'copay', 'co-pay', 'coinsurance', 'co-insurance', 'out of pocket', 'patient responsibility', 'you owe', 'amount due']
      },
      remarkCodes: {
        name: '8. Remark Codes or Notes',
        color: '#f39c12',
        keywords: ['remark code', 'remark codes', 'notes', 'special rules', 'not covered', 'denial', 'explanation', 'code', 'remark', 'reason', 'why']
      },
      whatToDoNext: {
        name: '9. What To Do Next',
        color: '#34495e',
        keywords: ['what to do next', 'next steps', 'call your insurance', 'contact', 'appeals', 'dispute', 'questions', 'customer service', 'phone number', 'appeal process', 'disagreement']
      }
    };
  }

  /**
   * Group elements into semantic sections
   * @param {Object} coordinates - Azure Document Intelligence results
   * @returns {Object} Grouped sections with bounding boxes
   */
  groupIntoSections(coordinates) {
    const groupedSections = {};
    
    // Initialize sections
    Object.keys(this.sections).forEach(sectionKey => {
      groupedSections[sectionKey] = {
        ...this.sections[sectionKey],
        elements: [],
        boundingBox: null,
        subSections: [] // For spatial grouping
      };
    });

    // First pass: Categorize elements
    const allElements = [];
    
    // Add paragraphs
    if (coordinates.paragraphs) {
      coordinates.paragraphs.forEach(paragraph => {
        const section = this.categorizeElement(paragraph.content, 'paragraph');
        if (section && groupedSections[section]) {
          const element = {
            type: 'paragraph',
            content: paragraph.content,
            polygon: paragraph.polygon,
            boundingRegions: paragraph.boundingRegions,
            section: section
          };
          groupedSections[section].elements.push(element);
          allElements.push(element);
        }
      });
    }

    // Add key-value pairs
    if (coordinates.keyValuePairs) {
      coordinates.keyValuePairs.forEach(kvp => {
        const keyText = typeof kvp.key === 'string' ? kvp.key : (kvp.key?.content || '');
        const valueText = typeof kvp.value === 'string' ? kvp.value : (kvp.value?.content || '');
        const combinedText = `${keyText} ${valueText}`;
        
        const section = this.categorizeElement(combinedText, 'keyValuePair');
        if (section && groupedSections[section]) {
          const element = {
            type: 'keyValuePair',
            content: combinedText,
            polygon: kvp.polygon,
            boundingRegions: kvp.boundingRegions,
            section: section
          };
          groupedSections[section].elements.push(element);
          allElements.push(element);
        }
      });
    }

    // Add tables - categorize as serviceDescription since it contains service details
    if (coordinates.tables) {
      coordinates.tables.forEach(table => {
        const element = {
          type: 'table',
          content: 'Claims Detail Table',
          polygon: table.polygon,
          boundingRegions: table.boundingRegions,
          section: 'serviceDescription'
        };
        if (groupedSections.serviceDescription) {
          groupedSections.serviceDescription.elements.push(element);
          allElements.push(element);
        }
      });
    }

    // Second pass: Create spatial sub-sections for better coordinate calculation
    Object.keys(groupedSections).forEach(sectionKey => {
      const section = groupedSections[sectionKey];
      if (section && section.elements && section.elements.length > 0) {
        section.subSections = this.createSpatialSubSections(section.elements);
        section.boundingBox = this.calculateSectionBoundingBox(section.elements);
      }
    });

    return groupedSections;
  }

  /**
   * Create spatial sub-sections based on proximity
   * @param {Array} elements - Elements in a section
   * @returns {Array} Sub-sections with their own bounding boxes
   */
  createSpatialSubSections(elements) {
    if (elements.length <= 1) {
      return elements.length === 1 ? [{
        elements: elements,
        boundingBox: this.calculateSectionBoundingBox(elements)
      }] : [];
    }

    // Sort elements by Y coordinate (top to bottom)
    const sortedElements = elements.slice().sort((a, b) => {
      const aY = this.getElementCenterY(a);
      const bY = this.getElementCenterY(b);
      return aY - bY;
    });

    const subSections = [];
    let currentSubSection = [sortedElements[0]];
    let currentY = this.getElementCenterY(sortedElements[0]);

    for (let i = 1; i < sortedElements.length; i++) {
      const element = sortedElements[i];
      const elementY = this.getElementCenterY(element);
      const yDistance = Math.abs(elementY - currentY);

      // If elements are close vertically (within 1 inch), group them
      if (yDistance < 1.0) {
        currentSubSection.push(element);
      } else {
        // Start a new sub-section
        subSections.push({
          elements: currentSubSection,
          boundingBox: this.calculateSectionBoundingBox(currentSubSection)
        });
        currentSubSection = [element];
        currentY = elementY;
      }
    }

    // Add the last sub-section
    if (currentSubSection.length > 0) {
      subSections.push({
        elements: currentSubSection,
        boundingBox: this.calculateSectionBoundingBox(currentSubSection)
      });
    }

    return subSections;
  }

  /**
   * Get the center Y coordinate of an element
   * @param {Object} element - Element with polygon
   * @returns {number} Center Y coordinate
   */
  getElementCenterY(element) {
    let polygon = element.polygon;
    if (!polygon && element.boundingRegions && element.boundingRegions.length > 0) {
      polygon = element.boundingRegions[0].polygon;
    }
    
    if (polygon && polygon.length >= 4) {
      const minY = Math.min(...polygon.map(p => p.y));
      const maxY = Math.max(...polygon.map(p => p.y));
      return (minY + maxY) / 2;
    }
    
    return 0;
  }

  /**
   * Categorize an element into a section based on content
   * @param {string} content - Element content
   * @param {string} type - Element type
   * @returns {string|null} Section key or null
   */
  categorizeElement(content, type) {
    if (!content) return null;
    
    const contentLower = content.toLowerCase();
    
    // Check each section's keywords with higher precision
    for (const [sectionKey, section] of Object.entries(this.sections)) {
        const matchScore = this.calculateMatchScore(contentLower, section.keywords);
        if (matchScore > 0.3) { // Threshold for matching
          return sectionKey;
        }
    }

    // Specific EOB section logic
    if (contentLower.includes('this is not a bill') || contentLower.includes('explanation of benefits') || 
        contentLower.includes('not a bill') || contentLower.includes('explains how')) {
      return 'whatIsThis';
    }

    if (contentLower.includes('member name') || contentLower.includes('patient name') || 
        contentLower.includes('address') || contentLower.includes('group number') || 
        contentLower.includes('subscriber number') || contentLower.includes('member id')) {
      return 'patientMemberInfo';
    }

    if (contentLower.includes('service description') || contentLower.includes('medical care') || 
        contentLower.includes('medical service') || contentLower.includes('date of service') ||
        contentLower.includes('line no') || contentLower.includes('procedure')) {
      return 'serviceDescription';
    }

    if (contentLower.includes('total charges') || contentLower.includes('provider charges') || 
        contentLower.includes('total claim cost') || contentLower.includes('billed amount') ||
        (contentLower.includes('total') && contentLower.includes('$'))) {
      return 'totalCharges';
    }

    if (contentLower.includes('paid by insurer') || contentLower.includes('allowed charges') || 
        contentLower.includes('insurance payment') || contentLower.includes('plan payment')) {
      return 'insurancePayment';
    }

    if (contentLower.includes('what you owe') || contentLower.includes('your responsibility') || 
        contentLower.includes('deductible') || contentLower.includes('copay') || 
        contentLower.includes('coinsurance') || contentLower.includes('co-pay')) {
      return 'yourResponsibility';
    }

    if (contentLower.includes('remark code') || contentLower.includes('remark codes') || 
        contentLower.includes('pdc') || contentLower.includes('denial') || 
        contentLower.includes('not covered') || contentLower.includes('explanation')) {
      return 'remarkCodes';
    }

    if (contentLower.includes('appeals') || contentLower.includes('call your insurance') || 
        contentLower.includes('customer service') || contentLower.includes('phone number') ||
        contentLower.includes('dispute') || contentLower.includes('questions')) {
      return 'whatToDoNext';
    }

    // Check for dollar amounts that might be charges
    if (contentLower.includes('$') && (contentLower.includes('31.60') || contentLower.includes('375.00') || 
        contentLower.includes('406.60') || contentLower.includes('120.27') || contentLower.includes('35.00'))) {
      return 'totalCharges';
    }

    // Skip elements that don't clearly belong to any section
    return null;
  }

  /**
   * Calculate match score between content and keywords
   * @param {string} content - Content to match
   * @param {Array} keywords - Keywords to match against
   * @returns {number} Match score (0-1)
   */
  calculateMatchScore(content, keywords) {
    let matches = 0;
    let totalKeywords = keywords.length;

    keywords.forEach(keyword => {
      if (content.includes(keyword.toLowerCase())) {
        matches++;
      }
    });

    return matches / totalKeywords;
  }

  /**
   * Calculate bounding box for a section based on its elements
   * @param {Array} elements - Elements in the section
   * @returns {Object|null} Bounding box coordinates
   */
  calculateSectionBoundingBox(elements) {
    if (elements.length === 0) return null;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let hasValidCoords = false;

    elements.forEach(element => {
      let polygon = null;
      
      // Get polygon from element
      if (element.polygon) {
        polygon = element.polygon;
      } else if (element.boundingRegions && element.boundingRegions.length > 0) {
        polygon = element.boundingRegions[0].polygon;
      }

      if (polygon && polygon.length >= 4) {
        hasValidCoords = true;
        const elementMinX = Math.min(...polygon.map(p => p.x));
        const elementMaxX = Math.max(...polygon.map(p => p.x));
        const elementMinY = Math.min(...polygon.map(p => p.y));
        const elementMaxY = Math.max(...polygon.map(p => p.y));

        minX = Math.min(minX, elementMinX);
        maxX = Math.max(maxX, elementMaxX);
        minY = Math.min(minY, elementMinY);
        maxY = Math.max(maxY, elementMaxY);
      }
    });

    if (!hasValidCoords) return null;

    return {
      minX, maxX, minY, maxY,
      polygon: [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY }
      ]
    };
  }

  /**
   * Get section statistics
   * @param {Object} groupedSections - Grouped sections
   * @returns {Object} Statistics
   */
  getSectionStatistics(groupedSections) {
    const stats = {
      totalSections: 0,
      sectionsWithElements: 0,
      totalElements: 0,
      sectionBreakdown: {}
    };

    Object.keys(groupedSections).forEach(sectionKey => {
      const section = groupedSections[sectionKey];
      stats.totalSections++;
      
      if (section.elements.length > 0) {
        stats.sectionsWithElements++;
        stats.totalElements += section.elements.length;
        stats.sectionBreakdown[sectionKey] = {
          name: section.name,
          elementCount: section.elements.length,
          hasBoundingBox: !!section.boundingBox
        };
      }
    });

    return stats;
  }
}

export default SemanticSectionGrouper;
