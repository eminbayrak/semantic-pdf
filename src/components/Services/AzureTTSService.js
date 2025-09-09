/**
 * Azure Text-to-Speech Service
 * Generates high-quality audio narration for video presentations
 */
class AzureTTSService {
  constructor() {
    this.subscriptionKey = import.meta.env.VITE_AZURE_SPEECH_KEY;
    this.region = import.meta.env.VITE_AZURE_SPEECH_REGION;
    this.endpoint = `https://${this.region}.tts.speech.microsoft.com/`;
    
    if (!this.subscriptionKey || !this.region) {
      throw new Error('Azure Speech Service credentials not configured');
    }
  }

  /**
   * Generates TTS audio from text
   * @param {string} text - Text to convert to speech
   * @param {Object} options - TTS options
   * @returns {Promise<Blob>} Audio blob
   */
  async generateSpeech(text, options = {}) {
    const {
      voice = 'en-US-AriaNeural',
      rate = '0%',
      pitch = '0%',
      volume = '100%'
    } = options;

    const ssml = this.createSSML(text, voice, rate, pitch, volume);
    
    try {
      const response = await fetch(`${this.endpoint}cognitiveservices/v1`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.subscriptionKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
          'User-Agent': 'PDF-to-Video-Presentation'
        },
        body: ssml
      });

      if (!response.ok) {
        throw new Error(`TTS request failed: ${response.status} ${response.statusText}`);
      }

      const audioBlob = await response.blob();
      return audioBlob;
    } catch (error) {
      console.error('TTS generation error:', error);
      throw new Error(`Failed to generate speech: ${error.message}`);
    }
  }

  /**
   * Creates SSML for Azure TTS
   */
  createSSML(text, voice, rate, pitch, volume) {
    return `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
        <voice name="${voice}">
          <prosody rate="${rate}" pitch="${pitch}" volume="${volume}">
            ${this.escapeXml(text)}
          </prosody>
        </voice>
      </speak>
    `;
  }

  /**
   * Escapes XML special characters
   */
  escapeXml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Generates speech with timing information
   * @param {string} text - Text to convert
   * @param {Object} options - TTS options
   * @returns {Promise<Object>} Audio with timing data
   */
  async generateSpeechWithTiming(text, options = {}) {
    const audioBlob = await this.generateSpeech(text, options);
    const audioUrl = URL.createObjectURL(audioBlob);
    
    // Create audio element to get duration
    const audio = new Audio(audioUrl);
    const duration = await new Promise((resolve) => {
      audio.addEventListener('loadedmetadata', () => {
        resolve(audio.duration);
      });
      audio.addEventListener('error', () => {
        resolve(0);
      });
    });

    return {
      audioBlob,
      audioUrl,
      duration,
      text,
      options
    };
  }

  /**
   * Generates speech for multiple text segments with timing
   * @param {Array} segments - Array of text segments
   * @param {Object} options - TTS options
   * @returns {Promise<Array>} Array of audio segments with timing
   */
  async generateSegmentedSpeech(segments, options = {}) {
    const results = [];
    let currentTime = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const audioData = await this.generateSpeechWithTiming(segment.text, options);
      
      results.push({
        ...segment,
        audioData,
        startTime: currentTime,
        endTime: currentTime + audioData.duration,
        duration: audioData.duration
      });

      currentTime += audioData.duration;
    }

    return results;
  }

  /**
   * Available voices for different languages
   */
  getAvailableVoices() {
    return {
      'en-US': [
        { name: 'en-US-AriaNeural', displayName: 'Aria (Female, Natural)' },
        { name: 'en-US-DavisNeural', displayName: 'Davis (Male, Natural)' },
        { name: 'en-US-JennyNeural', displayName: 'Jenny (Female, Friendly)' },
        { name: 'en-US-GuyNeural', displayName: 'Guy (Male, Professional)' }
      ],
      'en-GB': [
        { name: 'en-GB-SoniaNeural', displayName: 'Sonia (Female, British)' },
        { name: 'en-GB-RyanNeural', displayName: 'Ryan (Male, British)' }
      ]
    };
  }

  /**
   * Creates a combined audio file from multiple segments
   * @param {Array} segments - Audio segments with timing
   * @returns {Promise<Blob>} Combined audio blob
   */
  async combineAudioSegments(segments) {
    // This is a simplified version - in production, use Web Audio API or similar
    // For now, we'll return the first segment's audio
    if (segments.length === 0) return null;
    
    return segments[0].audioData.audioBlob;
  }
}

export default AzureTTSService;
