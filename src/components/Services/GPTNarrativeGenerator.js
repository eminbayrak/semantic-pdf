import OpenAI from 'openai';
import AzureTTSService from './AzureTTSService';

class GPTNarrativeGenerator {
  constructor() {
    const apiKey = import.meta.env.VITE_AZURE_OPENAI_API_KEY;
    const endpoint = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;
    const deploymentName = import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o-latest-deployment';

    // Debug environment variables
    console.log('🔍 Environment Variables Debug:');
    console.log('API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT SET');
    console.log('Endpoint:', endpoint || 'NOT SET');
    console.log('Deployment:', deploymentName);
    console.log('All env vars:', import.meta.env);

    if (!apiKey || !endpoint) {
      throw new Error(`Azure OpenAI credentials not configured. API Key: ${apiKey ? 'Set' : 'Missing'}, Endpoint: ${endpoint ? 'Set' : 'Missing'}`);
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

    this.deploymentName = deploymentName;
    this.ttsService = new AzureTTSService();
  }

  /**
   * Generate narrative script with highlighting instructions from PDF text
   * @param {string} pdfText - Extracted text from PDF
   * @param {Array} semanticBlocks - Current semantic blocks for coordinate mapping
   * @returns {Promise<Object>} Narrative script with highlighting instructions
   */
  async generateNarrativeScript(pdfText, semanticBlocks) {
    try {
      console.log('🎬 Generating narrative script with GPT-4o...');
      console.log('PDF Text Length:', pdfText.length);
      console.log('Available Semantic Blocks:', semanticBlocks.length);

      const prompt = this.buildNarrativePrompt(pdfText, semanticBlocks);
      
      const response = await this.openai.chat.completions.create({
        model: this.deploymentName,
        messages: [
          {
            role: "system",
            content: `You are a professional presentation narrator specializing in document walkthroughs. 
            You create engaging, step-by-step narrative scripts that guide users through important document sections.
            
            Your task:
            1. Analyze the PDF text and identify the most important sections to highlight
            2. Create a narrative script that explains each section clearly
            3. Provide specific highlighting instructions with exact text matches
            4. Ensure the narrative flows logically and professionally
            
            Focus on key areas like:
            - Document headers and titles
            - Important notices ("This is not a bill", "Payment due", etc.)
            - Financial information (amounts, dates, totals)
            - Member/patient information
            - Service details and explanations
            - Contact information and next steps`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      const narrativeContent = response.choices[0].message.content;
      console.log('📝 GPT-4o Response:', narrativeContent);

      // Parse the response to extract structured data
      const parsedNarrative = this.parseNarrativeResponse(narrativeContent, semanticBlocks);
      
      return {
        success: true,
        narrative: parsedNarrative,
        rawResponse: narrativeContent
      };

    } catch (error) {
      console.error('❌ Error generating narrative script:', error);
      return {
        success: false,
        error: error.message,
        narrative: null
      };
    }
  }

  /**
   * Build the prompt for GPT-4o
   */
  buildNarrativePrompt(pdfText, semanticBlocks) {
    const blockTexts = semanticBlocks.map(block => 
      `Block ${block.step}: "${block.text}" (ID: ${block.id})`
    ).join('\n');

    return `Please analyze this PDF document and create a professional narrative script for a guided presentation.

PDF TEXT:
${pdfText}

AVAILABLE SEMANTIC BLOCKS FOR HIGHLIGHTING:
${blockTexts}

Please provide a JSON response with the following structure:
{
  "title": "Document Title",
  "introduction": "Brief introduction to the document",
  "steps": [
    {
      "stepNumber": 1,
      "title": "Step Title",
      "narrative": "What to say during this step",
      "highlightText": "Exact text to highlight from the PDF",
      "highlightId": "semantic-block-id-to-highlight",
      "duration": 5,
      "importance": 0.9
    }
  ],
  "conclusion": "Brief conclusion"
}

Requirements:
1. Identify 5-8 most important sections to highlight
2. Use exact text matches from the PDF for highlighting
3. Match highlightText to actual text in the semantic blocks
4. Provide engaging, professional narration
5. Keep each step concise (3-5 seconds of speech)
6. Focus on areas that would be most confusing or important to users
7. Use the semantic block IDs provided above for targeting

Please respond with valid JSON only.`;
  }

  /**
   * Parse GPT-4o response into structured narrative data
   */
  parseNarrativeResponse(response, semanticBlocks) {
    try {
      // Extract JSON from response (handle cases where GPT adds extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in GPT response');
      }

      const narrativeData = JSON.parse(jsonMatch[0]);
      
      // Validate and enhance the narrative data
      const enhancedSteps = narrativeData.steps.map((step, index) => {
        // Find the best matching semantic block for highlighting
        const matchingBlock = this.findBestMatchingBlock(step.highlightText, semanticBlocks);
        
        return {
          ...step,
          stepNumber: index + 1,
          highlightId: matchingBlock ? matchingBlock.id : null,
          highlightCoordinates: matchingBlock ? {
            x: matchingBlock.x,
            y: matchingBlock.y,
            width: matchingBlock.width,
            height: matchingBlock.height
          } : null,
          matched: !!matchingBlock
        };
      });

      return {
        ...narrativeData,
        steps: enhancedSteps,
        totalDuration: enhancedSteps.reduce((total, step) => total + (step.duration || 5), 0)
      };

    } catch (error) {
      console.error('❌ Error parsing narrative response:', error);
      
      // Fallback: create a basic narrative from semantic blocks
      return this.createFallbackNarrative(semanticBlocks);
    }
  }

  /**
   * Find the best matching semantic block for highlighting text
   */
  findBestMatchingBlock(highlightText, semanticBlocks) {
    if (!highlightText || !semanticBlocks) return null;

    const searchText = highlightText.toLowerCase().trim();
    
    // Try exact match first
    let bestMatch = semanticBlocks.find(block => 
      block.text.toLowerCase().includes(searchText)
    );

    // Try partial match if no exact match
    if (!bestMatch) {
      const words = searchText.split(' ').filter(word => word.length > 2);
      bestMatch = semanticBlocks.find(block => 
        words.some(word => block.text.toLowerCase().includes(word))
      );
    }

    // Try keyword matching
    if (!bestMatch) {
      const keywords = this.extractKeywords(searchText);
      bestMatch = semanticBlocks.find(block => 
        keywords.some(keyword => block.text.toLowerCase().includes(keyword))
      );
    }

    return bestMatch;
  }

  /**
   * Extract keywords from text for matching
   */
  extractKeywords(text) {
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    return text.split(' ')
      .map(word => word.toLowerCase().replace(/[^\w]/g, ''))
      .filter(word => word.length > 2 && !commonWords.includes(word));
  }

  /**
   * Create fallback narrative if GPT parsing fails
   */
  createFallbackNarrative(semanticBlocks) {
    const importantBlocks = semanticBlocks.filter(block => block.importance > 0.5);
    
    return {
      title: "Document Walkthrough",
      introduction: "Let me walk you through this important document step by step.",
      steps: importantBlocks.map((block, index) => ({
        stepNumber: index + 1,
        title: `Section ${index + 1}`,
        narrative: `This section contains: ${block.text.substring(0, 100)}...`,
        highlightText: block.text,
        highlightId: block.id,
        duration: 5,
        importance: block.importance,
        matched: true
      })),
      conclusion: "That completes our walkthrough of this document.",
      totalDuration: importantBlocks.length * 5
    };
  }

  /**
   * Generate complete multimedia presentation with audio
   * @param {string} pdfText - Extracted text from PDF
   * @param {Array} semanticBlocks - Current semantic blocks for coordinate mapping
   * @returns {Promise<Object>} Complete multimedia presentation
   */
  async generateMultimediaPresentation(pdfText, semanticBlocks) {
    try {
      console.log('🎬 Generating complete multimedia presentation...');
      
      // First generate the narrative script
      const narrativeResult = await this.generateNarrativeScript(pdfText, semanticBlocks);
      
      if (!narrativeResult.success) {
        return {
          success: false,
          error: narrativeResult.error,
          narrative: null,
          audio: null
        };
      }

      // Then generate audio for the narrative
      const audioResult = await this.ttsService.generateNarrativeAudio(narrativeResult.narrative);
      
      return {
        success: true,
        narrative: narrativeResult.narrative,
        audio: audioResult,
        readyToPlay: audioResult.success && audioResult.readyToPlay
      };

    } catch (error) {
      console.error('❌ Error generating multimedia presentation:', error);
      return {
        success: false,
        error: error.message,
        narrative: null,
        audio: null
      };
    }
  }

  /**
   * Generate audio narration using Azure TTS
   */
  async generateAudioNarration(narrativeStep) {
    try {
      const audioResult = await this.ttsService.generateStepAudio(narrativeStep);
      return audioResult;
    } catch (error) {
      console.error('❌ Error generating audio narration:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default GPTNarrativeGenerator;
