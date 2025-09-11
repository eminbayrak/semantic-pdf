# Fix PDF Highlighting Issue - Instructions for Cursor AI

## Problem
The current highlighting system in GuidedPresentation.jsx has alignment issues because it tries to match GPT-4o narrative sections with PDF coordinates using complex fuzzy matching and proximity heuristics. This causes highlights to appear in wrong locations or not at all.

## Solution Architecture
Implement a clean ID-based highlighting system with 3 layers:

1. **PDF Background Image** (bottom layer) - for visual accuracy
2. **Invisible HTML Elements with IDs** (middle layer) - for measurement
3. **Highlight Overlays** (top layer) - positioned using DOM measurements

## Key Changes Required

### 1. Modify GPT-4o Prompt
Change the narrative generation to ask GPT-4o for **exact text phrases** that appear in the document:

```javascript
const prompt = `
Analyze this PDF document and identify 5-8 key sections for a guided presentation.

For each section, provide:
1. A section title
2. Engaging narration text  
3. An EXACT text phrase from the document that should be highlighted
4. A unique section ID (lowercase with underscores)

Document text:
"""
${fullText}
"""

Return JSON:
{
  "title": "Document Title",
  "steps": [
    {
      "title": "Section Title",
      "narrative": "Engaging narration text",
      "highlightText": "EXACT phrase from document",
      "sectionId": "unique_section_id"
    }
  ]
}

CRITICAL: highlightText must be exact phrases that appear in the document.
`;
```

### 2. Replace Complex Alignment Logic
Remove these functions entirely:
- `alignHTMLElementsWithNarration()`
- `calculateTextSimilarity()`
- `mergeHTMLElements()`
- `generateSemanticBlocks()`
- `calculateImportance()`

### 3. Add Simple ID Assignment Function
Replace the complex alignment with this simple approach:

```javascript
const assignIDsBasedOnNarrative = (elements, narrativeSteps) => {
  const updatedElements = [...elements];
  
  narrativeSteps.forEach((step, stepIndex) => {
    const targetText = step.highlightText;
    const sectionId = step.sectionId;
    
    // Find elements containing this exact text
    const matchingElements = elements.filter(el => 
      el.text.toLowerCase().includes(targetText.toLowerCase())
    );
    
    // Assign same ID to all matching elements
    matchingElements.forEach(element => {
      element.id = sectionId;
      element.narrativeSection = stepIndex;
    });
  });
  
  return updatedElements;
};
```

### 4. Update HTML Generation
Replace the complex highlight positioning with this layered approach:

```javascript
// Group elements by section ID
const elementsBySection = {};
elements.filter(el => el.id).forEach(el => {
  if (!elementsBySection[el.id]) elementsBySection[el.id] = [];
  elementsBySection[el.id].push(el);
});

// Calculate bounding boxes for each section
const sectionBoundingBoxes = {};
Object.entries(elementsBySection).forEach(([sectionId, sectionElements]) => {
  const minX = Math.min(...sectionElements.map(el => el.x));
  const minY = Math.min(...sectionElements.map(el => el.y));
  const maxX = Math.max(...sectionElements.map(el => el.x + el.width));
  const maxY = Math.max(...sectionElements.map(el => el.y + el.height));
  
  sectionBoundingBoxes[sectionId] = {
    x: minX - 10,
    y: minY - 10, 
    width: (maxX - minX) + 20,
    height: (maxY - minY) + 20
  };
});
```

### 5. Update HTML Template Structure
Use this 3-layer HTML structure:

```html
<div class="pdf-viewer">
  <!-- Layer 1: PDF Background -->
  <img src="${imageDataUrl}" class="pdf-background">
  
  <!-- Layer 2: Invisible HTML Elements -->
  <div class="html-elements-layer" style="opacity: 0;">
    ${elements.filter(el => el.id).map(el => `
      <div id="${el.id}-${el.index}" 
           style="position: absolute; left: ${el.x}px; top: ${el.y}px;">
        ${el.text}
      </div>
    `).join('')}
  </div>
  
  <!-- Layer 3: Highlights -->
  <div class="highlight-layer">
    ${Object.entries(sectionBoundingBoxes).map(([sectionId, bbox], index) => `
      <div class="highlight" data-section="${sectionId}" data-step="${index}"
           style="left: ${bbox.x}px; top: ${bbox.y}px; width: ${bbox.width}px; height: ${bbox.height}px;">
        <div class="step-number">${index + 1}</div>
      </div>
    `).join('')}
  </div>
</div>
```

## Implementation Steps

1. **Keep existing code working** - don't break the file upload, PDF rendering, or audio generation
2. **Update the narrative generation prompt** to request exact text phrases
3. **Remove all the complex alignment functions** listed above
4. **Add the simple ID assignment function**
5. **Update the HTML generation** to use the 3-layer approach
6. **Test with a simple PDF** to verify highlights appear in correct locations

## CSS Requirements
Ensure these CSS classes exist:
```css
.pdf-background { position: relative; z-index: 1; }
.html-elements-layer { position: absolute; z-index: 2; pointer-events: none; }
.highlight-layer { position: absolute; z-index: 3; pointer-events: none; }
.highlight { position: absolute; border: 3px solid #ffd700; border-radius: 8px; }
```

## Expected Result
After implementation:
- Highlights will appear exactly where GPT-4o identified text
- No more coordinate mismatches
- Clean, maintainable code
- Easy to debug highlight positioning issues

## What NOT to Change
- File upload functionality
- PDF rendering to canvas  
- Audio generation
- Page navigation
- Download functionality

Focus ONLY on replacing the highlighting alignment logic with the ID-based system described above.