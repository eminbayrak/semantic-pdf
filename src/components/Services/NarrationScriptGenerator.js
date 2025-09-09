/**
 * Narration Script Generator
 * Creates timed narration segments for PowerPoint-style presentations
 */
class NarrationScriptGenerator {
  constructor() {
    this.ttsService = null;
    this.gptMapper = null;
  }

  /**
   * Initialize services
   */
  async initialize() {
    try {
      const { default: AzureTTSService } = await import('./AzureTTSService.js');
      const { default: GPTNarrationMapper } = await import('./GPTNarrationMapper.js');
      
      this.ttsService = new AzureTTSService();
      this.gptMapper = new GPTNarrationMapper();
    } catch (error) {
      console.error('Failed to initialize services:', error);
      throw error;
    }
  }

  /**
   * Generates complete narration script with audio and timing
   * @param {string} htmlContent - HTML content with semantic IDs
   * @param {string} narrationText - Raw narration text
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Complete narration script with audio
   */
  async generateNarrationScript(htmlContent, narrationText, options = {}) {
    if (!this.ttsService || !this.gptMapper) {
      await this.initialize();
    }

    const {
      voice = 'en-US-AriaNeural',
      rate = '0%',
      pitch = '0%',
      volume = '100%',
      pauseBetweenSegments = 0.5 // seconds
    } = options;

    try {
      // Step 1: Map narration to HTML elements using GPT
      console.log('Mapping narration to HTML elements...');
      const mappings = await this.gptMapper.mapNarrationToElements(
        narrationText, 
        htmlContent
      );

      // Step 2: Create narration segments
      console.log('Creating narration segments...');
      const segments = this.createNarrationSegments(mappings.mappings, pauseBetweenSegments);

      // Step 3: Generate audio for each segment
      console.log('Generating audio for segments...');
      const audioSegments = await this.generateAudioForSegments(segments, {
        voice,
        rate,
        pitch,
        volume
      });

      // Step 4: Calculate timing and create final script
      console.log('Calculating timing and creating final script...');
      const finalScript = this.createFinalScript(audioSegments, htmlContent);

      return finalScript;
    } catch (error) {
      console.error('Error generating narration script:', error);
      throw error;
    }
  }

  /**
   * Creates narration segments from GPT mappings
   */
  createNarrationSegments(mappings, pauseBetweenSegments = 0.5) {
    const segments = [];
    let currentTime = 0;

    mappings.forEach((mapping, index) => {
      const segment = {
        id: `segment-${index}`,
        text: mapping.phrase,
        elementId: mapping.elementId,
        zoomLevel: mapping.zoomLevel,
        highlightType: mapping.highlightType,
        transitionType: mapping.transitionType,
        confidence: mapping.confidence,
        startTime: currentTime,
        endTime: currentTime + (mapping.duration / 30), // Convert frames to seconds
        duration: mapping.duration / 30,
        frameStart: mapping.startFrame,
        frameEnd: mapping.startFrame + mapping.duration
      };

      segments.push(segment);
      currentTime += segment.duration + pauseBetweenSegments;
    });

    return segments;
  }

  /**
   * Generates audio for all segments
   */
  async generateAudioForSegments(segments, ttsOptions) {
    const audioSegments = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      console.log(`Generating audio for segment ${i + 1}/${segments.length}: "${segment.text}"`);

      try {
        const audioData = await this.ttsService.generateSpeechWithTiming(
          segment.text,
          ttsOptions
        );

        audioSegments.push({
          ...segment,
          audioData,
          audioUrl: audioData.audioUrl,
          audioBlob: audioData.audioBlob
        });
      } catch (error) {
        console.warn(`Failed to generate audio for segment ${i + 1}:`, error);
        // Add segment without audio
        audioSegments.push({
          ...segment,
          audioData: null,
          audioUrl: null,
          audioBlob: null
        });
      }
    }

    return audioSegments;
  }

  /**
   * Creates final script with combined audio and timing
   */
  createFinalScript(audioSegments, htmlContent) {
    const totalDuration = audioSegments.reduce((total, segment) => {
      return total + (segment.audioData?.duration || 0) + 0.5; // 0.5s pause between segments
    }, 0);

    // Combine all audio segments into one file
    const combinedAudio = this.combineAudioSegments(audioSegments);

    return {
      segments: audioSegments,
      totalDuration,
      combinedAudio,
      htmlContent,
      metadata: {
        totalSegments: audioSegments.length,
        totalFrames: Math.ceil(totalDuration * 30), // 30fps
        generatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Combines multiple audio segments into one
   */
  combineAudioSegments(audioSegments) {
    // This is a simplified version - in production, use Web Audio API
    // For now, return the first segment's audio
    const validSegments = audioSegments.filter(segment => segment.audioData);
    if (validSegments.length === 0) return null;

    return {
      audioUrl: validSegments[0].audioUrl,
      audioBlob: validSegments[0].audioBlob,
      duration: validSegments.reduce((total, segment) => total + (segment.audioData?.duration || 0), 0)
    };
  }

  /**
   * Creates a preview of the narration script
   */
  createPreview(script) {
    return {
      totalDuration: script.totalDuration,
      segmentCount: script.segments.length,
      segments: script.segments.map(segment => ({
        text: segment.text,
        elementId: segment.elementId,
        duration: segment.duration,
        zoomLevel: segment.zoomLevel,
        highlightType: segment.highlightType
      }))
    };
  }

  /**
   * Exports narration script as JSON
   */
  exportScript(script) {
    const exportData = {
      ...script,
      segments: script.segments.map(segment => ({
        ...segment,
        audioData: null, // Remove audio data for export
        audioUrl: null,
        audioBlob: null
      }))
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Imports narration script from JSON
   */
  importScript(jsonString) {
    try {
      const script = JSON.parse(jsonString);
      return script;
    } catch (error) {
      throw new Error(`Failed to import script: ${error.message}`);
    }
  }
}

export default NarrationScriptGenerator;
