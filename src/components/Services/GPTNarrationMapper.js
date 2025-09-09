import OpenAI from 'openai';

/**
 * GPT-4o Narration Mapper Service
 * Maps narration text to specific HTML elements for video animations
 * 
 * SECURITY NOTE: This service uses dangerouslyAllowBrowser: true
 * This is required for browser environments but exposes API keys to client-side code.
 * In production, consider using a backend proxy to protect API credentials.
 */
class GPTNarrationMapper {
  constructor() {
    const apiKey = import.meta.env.VITE_AZURE_OPENAI_API_KEY;
    const endpoint = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;
    const deploymentName = import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT_NAME;
    
    console.log('OpenAI Environment variables:', {
      apiKey: apiKey ? 'Set' : 'Not set',
      endpoint: endpoint ? 'Set' : 'Not set',
      deploymentName: deploymentName ? 'Set' : 'Not set'
    });
    
    if (!apiKey || !endpoint || !deploymentName) {
      throw new Error(`OpenAI credentials not configured. API Key: ${apiKey ? 'Set' : 'Missing'}, Endpoint: ${endpoint ? 'Set' : 'Missing'}, Deployment: ${deploymentName ? 'Set' : 'Missing'}`);
    }
    
    this.openai = new OpenAI({
      apiKey: apiKey,
      baseURL: `${endpoint}openai/deployments/${deploymentName}`,
      defaultQuery: { 'api-version': '2024-02-15-preview' },
      defaultHeaders: {
        'api-key': apiKey,
      },
      dangerouslyAllowBrowser: true, // Required for browser environment
    });
  }

  /**
   * Maps narration phrases to HTML elements using GPT-4o
   * @param {string} narration - The narration text to analyze
   * @param {string} htmlWithIds - HTML content with semantic IDs
   * @param {Array} elementIds - Array of available element IDs
   * @returns {Promise<Object>} Mapping results with timing and animation data
   */
  async mapNarrationToElements(narration, htmlWithIds, elementIds = []) {
    try {
      // Extract element IDs if not provided
      if (elementIds.length === 0) {
        elementIds = this.extractElementIds(htmlWithIds);
      }

      const prompt = this.buildMappingPrompt(narration, elementIds);
      
      const response = await this.openai.chat.completions.create({
        model: import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT_NAME,
        messages: [
          {
            role: "system",
            content: "You are an expert video production assistant that maps narration text to specific HTML elements for creating professional video presentations. You understand document structure and can identify the most relevant elements for each narration phrase."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content);
      return this.validateAndEnhanceMapping(result, elementIds);
      
    } catch (error) {
      console.error('Error mapping narration to elements:', error);
      throw new Error(`Failed to map narration: ${error.message}`);
    }
  }

  /**
   * Builds the prompt for GPT-4o mapping
   */
  buildMappingPrompt(narration, elementIds) {
    return `
Analyze this narration text and map each meaningful phrase to the most relevant HTML element ID.

NARRATION TEXT:
"${narration}"

AVAILABLE HTML ELEMENT IDs:
${elementIds.map(id => `- ${id}`).join('\n')}

For each narration phrase, determine:
1. The most relevant HTML element ID (must be from the list above)
2. Appropriate zoom level (1.0-3.0, where 1.0 = full page, 3.0 = close-up)
3. Duration in frames (30fps, so 30 frames = 1 second)
4. Highlight style (border, spotlight, glow, or none)
5. Transition type (smooth, instant, or fade)

Return JSON in this exact format:
{
  "mappings": [
    {
      "phrase": "exact phrase from narration",
      "elementId": "matching-element-id",
      "startFrame": 0,
      "duration": 90,
      "zoomLevel": 2.0,
      "highlightType": "border",
      "transitionType": "smooth",
      "confidence": 0.9
    }
  ],
  "totalDuration": 300,
  "narrativeFlow": "description of the overall flow"
}

Guidelines:
- Each phrase should map to the most semantically relevant element
- Use zoom levels appropriately (1.0 for overview, 2.0-2.5 for focus, 3.0 for details)
- Duration should match the speaking pace (typically 1-3 seconds per phrase)
- Choose highlight styles that enhance understanding
- Ensure smooth transitions between elements
- Set confidence score based on how well the phrase matches the element
    `;
  }

  /**
   * Validates and enhances the GPT mapping results
   */
  validateAndEnhanceMapping(result, elementIds) {
    if (!result.mappings || !Array.isArray(result.mappings)) {
      throw new Error('Invalid mapping result from GPT');
    }

    // Validate and enhance each mapping
    const enhancedMappings = result.mappings.map((mapping, index) => {
      // Validate element ID exists
      if (!elementIds.includes(mapping.elementId)) {
        console.warn(`Element ID ${mapping.elementId} not found in available IDs`);
        // Try to find a similar ID
        const similarId = this.findSimilarElementId(mapping.elementId, elementIds);
        if (similarId) {
          mapping.elementId = similarId;
        }
      }

      // Set defaults for missing properties
      return {
        phrase: mapping.phrase || `Phrase ${index + 1}`,
        elementId: mapping.elementId || elementIds[0],
        startFrame: mapping.startFrame || 0,
        duration: mapping.duration || 90,
        zoomLevel: Math.max(1.0, Math.min(3.0, mapping.zoomLevel || 2.0)),
        highlightType: mapping.highlightType || 'border',
        transitionType: mapping.transitionType || 'smooth',
        confidence: Math.max(0, Math.min(1, mapping.confidence || 0.8))
      };
    });

    // Calculate cumulative start frames
    let currentFrame = 0;
    enhancedMappings.forEach(mapping => {
      mapping.startFrame = currentFrame;
      currentFrame += mapping.duration;
    });

    return {
      mappings: enhancedMappings,
      totalDuration: currentFrame,
      narrativeFlow: result.narrativeFlow || 'Sequential presentation flow',
      elementIds: elementIds
    };
  }

  /**
   * Extracts element IDs from HTML content
   */
  extractElementIds(htmlContent) {
    const idRegex = /id="([^"]*)"/g;
    const ids = [];
    let match;
    
    while ((match = idRegex.exec(htmlContent)) !== null) {
      ids.push(match[1]);
    }
    
    return [...new Set(ids)]; // Remove duplicates
  }

  /**
   * Finds similar element ID when exact match not found
   */
  findSimilarElementId(targetId, availableIds) {
    const target = targetId.toLowerCase();
    
    // Look for partial matches
    for (const id of availableIds) {
      if (id.toLowerCase().includes(target) || target.includes(id.toLowerCase())) {
        return id;
      }
    }
    
    // Look for semantic matches
    const semanticMatches = {
      'header': ['header-section', 'header', 'title'],
      'member': ['member-info', 'member', 'patient'],
      'table': ['claims-table', 'table', 'items-table'],
      'summary': ['summary-section', 'summary', 'total'],
      'amount': ['amount-total', 'total', 'cost']
    };
    
    for (const [key, values] of Object.entries(semanticMatches)) {
      if (target.includes(key)) {
        for (const value of values) {
          if (availableIds.includes(value)) {
            return value;
          }
        }
      }
    }
    
    return availableIds[0]; // Fallback to first available ID
  }

  /**
   * Creates a timeline for Remotion animation
   */
  createAnimationTimeline(mappings) {
    const timeline = [];
    
    mappings.forEach((mapping, index) => {
      const endFrame = mapping.startFrame + mapping.duration;
      
      timeline.push({
        id: `animation-${index}`,
        elementId: mapping.elementId,
        startFrame: mapping.startFrame,
        endFrame: endFrame,
        duration: mapping.duration,
        zoomLevel: mapping.zoomLevel,
        highlightType: mapping.highlightType,
        transitionType: mapping.transitionType,
        phrase: mapping.phrase,
        confidence: mapping.confidence
      });
    });
    
    return timeline;
  }

  /**
   * Generates smooth transitions between elements
   */
  generateTransitions(mappings) {
    const transitions = [];
    
    for (let i = 0; i < mappings.length - 1; i++) {
      const current = mappings[i];
      const next = mappings[i + 1];
      
      // Add transition period between elements
      const transitionDuration = 15; // 0.5 seconds at 30fps
      const transitionStart = current.startFrame + current.duration - transitionDuration;
      
      transitions.push({
        fromElementId: current.elementId,
        toElementId: next.elementId,
        startFrame: transitionStart,
        duration: transitionDuration,
        type: current.transitionType || 'smooth'
      });
    }
    
    return transitions;
  }
}

export default GPTNarrationMapper;