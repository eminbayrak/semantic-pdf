# PDF to Video Presentation System - Implementation Guide for Cursor AI

## Project Overview
Create a React application that converts PDFs to HTML and generates professional video presentations with accurate zooming and highlighting using Remotion. The system integrates Azure Document Intelligence, GPT-4o, and Azure TTS.

## Architecture Components

### 1. Core Dependencies to Install
```bash
npm install remotion @remotion/cli @remotion/player
npm install @azure/ai-form-recognizer @azure/cognitive-services-text-to-speech
npm install openai axios cheerio jsdom
npm install html2canvas puppeteer
```

### 2. Project Structure
```
src/
├── components/
│   ├── PDFToHTML/
│   │   ├── PDFConverter.jsx
│   │   ├── HTMLGenerator.jsx
│   │   └── SemanticIDInjector.jsx
│   ├── Remotion/
│   │   ├── DocumentPresentation.jsx
│   │   ├── HighlightOverlay.jsx
│   │   ├── ZoomController.jsx
│   │   └── VideoComposition.jsx
│   └── Services/
│       ├── AzureDocumentIntelligence.js
│       ├── GPTNarrationMapper.js
│       ├── TTSGenerator.js
│       └── CoordinateMapper.js
├── utils/
│   ├── htmlTemplates.js
│   ├── animationHelpers.js
│   └── constants.js
└── App.jsx
```

## Implementation Instructions

### Step 1: Create PDF to HTML Converter

**File: `src/components/PDFToHTML/PDFConverter.jsx`**

Create a component that:
1. Accepts PDF file input
2. Uses Azure Document Intelligence to extract structure
3. Converts extracted data to semantic HTML with strategic DOM IDs
4. Maps document sections to meaningful element IDs

Key requirements:
- Use `@azure/ai-form-recognizer` for document analysis
- Generate HTML with these specific ID patterns:
  - `header-section`, `member-info`, `claims-table`, `summary-section`
  - `table-row-{index}`, `field-{fieldName}`, `amount-{type}`
- Maintain exact visual styling from original PDF
- Include CSS for proper scaling and positioning

### Step 2: Create Semantic ID Injector

**File: `src/components/PDFToHTML/SemanticIDInjector.jsx`**

Function that takes Azure Document Intelligence results and injects meaningful IDs:
```javascript
const injectSemanticIDs = (htmlContent, azureResults) => {
  // Map Azure results to HTML elements
  // Add IDs based on document structure
  // Return enhanced HTML with strategic targeting points
}
```

### Step 3: GPT-4o Narration Mapper

**File: `src/components/Services/GPTNarrationMapper.js`**

Create service that:
1. Takes narration text as input
2. Analyzes HTML content with element IDs
3. Uses GPT-4o to map narration phrases to specific HTML sections
4. Returns timeline with element IDs, zoom levels, and timing

Expected output format:
```javascript
{
  sections: [
    {
      narrationPhrase: "Let's examine the member information",
      elementId: "member-info", 
      startFrame: 0,
      duration: 90,
      zoomLevel: 2.0,
      highlightType: "border"
    }
  ]
}
```

### Step 4: Remotion Presentation Component

**File: `src/components/Remotion/DocumentPresentation.jsx`**

Core Remotion component that:
1. Embeds HTML content directly in video
2. Uses `getBoundingClientRect()` for precise element coordinates
3. Implements smooth zoom/pan animations
4. Synchronizes with audio narration

Key features:
- Frame-based animation using `useCurrentFrame()`
- Smooth interpolation for zoom/pan transitions  
- Element-precise highlighting overlays
- Audio synchronization points

### Step 5: Highlight Overlay System

**File: `src/components/Remotion/HighlightOverlay.jsx`**

Component for visual emphasis:
- Animated borders around target elements
- Spotlight effects with radial gradients
- Opacity transitions for smooth appearance
- Transform-aware positioning (accounts for zoom/pan)

### Step 6: Main Application Flow

**File: `src/App.jsx`**

Implement complete workflow:
1. PDF file upload
2. Azure Document Intelligence processing
3. HTML generation with semantic IDs
4. GPT-4o narration analysis and mapping
5. Azure TTS audio generation
6. Remotion video composition and rendering

### Step 7: Coordinate System Handler

**File: `src/utils/CoordinateMapper.js`**

Critical utility functions:
```javascript
const getElementBounds = (elementId, containerRef) => {
  // Get precise pixel coordinates
  // Return x, y, width, height, centerX, centerY
}

const calculateTransform = (targetBounds, videoSize, zoomLevel) => {
  // Calculate scale, translateX, translateY for centering
  // Handle viewport boundaries and smooth transitions
}

const createAnimationSequence = (sections) => {
  // Convert GPT mapping to Remotion-compatible timeline
}
```

## Specific Implementation Requirements

### Azure Document Intelligence Integration
```javascript
// Use prebuilt-document model for general documents
// Extract tables, key-value pairs, and text regions
// Map results to HTML semantic structure
const analyzeDocument = async (pdfBuffer) => {
  const client = new DocumentAnalysisClient(endpoint, credential);
  const poller = await client.beginAnalyzeDocument("prebuilt-document", pdfBuffer);
  return await poller.pollUntilDone();
}
```

### GPT-4o Integration Pattern
```javascript
const mapNarrationToElements = async (narration, htmlWithIds) => {
  const prompt = `
    Analyze this narration: "${narration}"
    
    Available HTML elements with IDs: ${extractElementIds(htmlWithIds)}
    
    Return JSON mapping each narration sentence to:
    1. Most relevant HTML element ID
    2. Appropriate zoom level (1.0-3.0)
    3. Duration in frames (30fps)
    4. Highlight style (border/spotlight/glow)
    
    Format: { "mappings": [{"phrase": "...", "elementId": "...", "zoom": 2.0, "frames": 90, "highlight": "border"}] }
  `;
  
  return await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }]
  });
};
```

### HTML Template System
**File: `src/utils/htmlTemplates.js`**

Create reusable templates for different document types:
- EOB (Explanation of Benefits) template
- Invoice template  
- Report template
- Custom document template

Each template should include:
- Strategic DOM ID placement
- Print-ready CSS styling
- Responsive scaling for video dimensions
- Semantic HTML structure

### Remotion Video Configuration
```javascript
// Video composition settings
export const VIDEO_CONFIG = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 600, // 20 seconds
  backgroundColor: '#ffffff'
};

// Animation constants
export const ANIMATION_TIMINGS = {
  zoomDuration: 30,        // 1 second at 30fps
  highlightDelay: 15,      // 0.5 second delay
  transitionEasing: 'ease-out',
  maxZoomLevel: 3.0
};
```

### Error Handling Requirements
Implement robust error handling for:
- PDF parsing failures
- Azure service timeouts
- GPT-4o API rate limits
- Remotion rendering errors
- Audio/video synchronization issues

### Performance Optimizations
1. **Lazy loading** for large documents
2. **Memoization** for expensive calculations
3. **Chunked processing** for long narrations
4. **Caching** for repeated elements
5. **Memory management** during video rendering

### Testing Strategy
Create tests for:
- PDF to HTML conversion accuracy
- Coordinate mapping precision
- Animation smoothness
- Audio synchronization
- Cross-browser compatibility

## Usage Example

```javascript
const generatePresentation = async (pdfFile, narrationText) => {
  // 1. Analyze PDF with Azure Document Intelligence
  const documentAnalysis = await analyzeDocument(pdfFile);
  
  // 2. Convert to HTML with semantic IDs
  const htmlContent = await convertToHTML(documentAnalysis);
  const enhancedHTML = injectSemanticIDs(htmlContent, documentAnalysis);
  
  // 3. Map narration to HTML elements using GPT-4o
  const sectionMappings = await mapNarrationToElements(narrationText, enhancedHTML);
  
  // 4. Generate TTS audio
  const audioFile = await generateTTS(narrationText);
  
  // 5. Create Remotion composition
  const videoComposition = createVideoComposition({
    htmlContent: enhancedHTML,
    mappings: sectionMappings,
    audioFile: audioFile
  });
  
  // 6. Render final video
  return await renderRemotionVideo(videoComposition);
};
```

## Key Success Criteria
1. **Pixel-perfect accuracy** - Zoom and highlights must precisely target intended sections
2. **Smooth animations** - No jarring transitions or coordinate mismatches  
3. **Audio sync** - Visual highlights perfectly timed with narration
4. **Scalable architecture** - Support multiple document types and layouts
5. **Production ready** - Handle edge cases and provide clear error messages

## Environment Variables Required
```env
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=your_endpoint
AZURE_DOCUMENT_INTELLIGENCE_KEY=your_key
AZURE_TTS_SUBSCRIPTION_KEY=your_tts_key
AZURE_TTS_REGION=your_region
OPENAI_API_KEY=your_openai_key
```

## Final Output
The system should produce high-quality MP4 videos with:
- Professional zooming and panning effects
- Accurate section highlighting  
- Synchronized audio narration
- Smooth transitions between focal points
- Guidde.com-style presentation quality

Start with the PDFConverter component and work through each step systematically. Ensure each component is fully functional before moving to the next. Test coordinate accuracy at every step - this is critical for the final video quality.