/**
 * Azure Text-to-Speech Service
 * Generates high-quality audio narration for presentation steps
 */

class AzureTTSService {
  constructor() {
    this.subscriptionKey = import.meta.env.VITE_AZURE_SPEECH_KEY;
    this.region = import.meta.env.VITE_AZURE_SPEECH_REGION || 'eastus';
    this.endpoint = `https://${this.region}.tts.speech.microsoft.com/`;
    
    if (!this.subscriptionKey) {
      throw new Error('Azure Speech Service key not configured');
    }

    this.audioContext = null;
    this.currentAudio = null;
    this.isPlaying = false;
    this.availableVoices = this.getAvailableVoices();
    this.currentNarrativeVoice = null; // Store voice for entire narrative
  }

  /**
   * Initialize audio context for playback
   */
  async initializeAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Resume audio context if suspended (required for user interaction)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
    }
    return this.audioContext;
  }

  /**
   * Generate audio for a single narrative step
   * @param {Object} step - Narrative step object
   * @param {string} step.narrative - Text to convert to speech
   * @param {number} step.duration - Expected duration in seconds
   * @param {Object} options - TTS options including voice randomization
   * @returns {Promise<Object>} Audio generation result
   */
  async generateStepAudio(step, options = {}) {
    try {
      console.log(`🎵 Generating audio for step ${step.stepNumber}: "${step.narrative}"`);
      
      // Determine voice for this step
      let voiceToUse = this.currentNarrativeVoice;
      if (options.randomizePerStep) {
        voiceToUse = this.getRandomVoice();
        console.log(`🎭 Step ${step.stepNumber} using voice: ${voiceToUse.displayName}`);
      }
      
      const audioData = await this.synthesizeSpeech(step.narrative, {
        ...options,
        voice: voiceToUse.name
      });
      
      return {
        success: true,
        stepNumber: step.stepNumber,
        audioData: audioData,
        duration: step.duration,
        text: step.narrative,
        voice: voiceToUse
      };

    } catch (error) {
      console.error(`❌ Error generating audio for step ${step.stepNumber}:`, error);
      return {
        success: false,
        stepNumber: step.stepNumber,
        error: error.message,
        text: step.narrative
      };
    }
  }

  /**
   * Generate audio for entire narrative script
   * @param {Object} narrativeScript - Complete narrative script
   * @param {Object} options - TTS options including voice randomization
   * @returns {Promise<Object>} Complete audio generation result
   */
  async generateNarrativeAudio(narrativeScript, options = {}) {
    try {
      console.log('🎵 Generating complete narrative audio...');
      
      if (!narrativeScript || !narrativeScript.steps) {
        throw new Error('Invalid narrative script provided');
      }

      // Set voice for entire narrative if not already set
      if (!this.currentNarrativeVoice || options.randomizeVoice) {
        this.currentNarrativeVoice = this.getRandomVoice();
        console.log(`🎭 Selected voice: ${this.currentNarrativeVoice.displayName}`);
      }

      const audioSteps = [];
      let totalDuration = 0;

      // Generate audio for each step
      for (const step of narrativeScript.steps) {
        const audioResult = await this.generateStepAudio(step, options);
        audioSteps.push(audioResult);
        
        if (audioResult.success) {
          totalDuration += step.duration || 5;
        }
        
        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const successCount = audioSteps.filter(step => step.success).length;
      
      return {
        success: successCount > 0,
        title: narrativeScript.title,
        totalSteps: narrativeScript.steps.length,
        successSteps: successCount,
        totalDuration: totalDuration,
        audioSteps: audioSteps,
        readyToPlay: successCount === narrativeScript.steps.length
      };

    } catch (error) {
      console.error('❌ Error generating narrative audio:', error);
      return {
        success: false,
        error: error.message,
        audioSteps: []
      };
    }
  }

  /**
   * Synthesize speech using Azure TTS
   * @param {string} text - Text to convert to speech
   * @param {Object} options - TTS options
   * @returns {Promise<ArrayBuffer>} Audio data
   */
  async synthesizeSpeech(text, options = {}) {
    const {
      voice = 'en-US-AriaNeural',
      rate = '0%',
      pitch = '0%',
      volume = '100%'
    } = options;

    // SSML for better control over speech synthesis
    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
        <voice name="${voice}">
          <prosody rate="${rate}" pitch="${pitch}" volume="${volume}">
            ${text}
          </prosody>
        </voice>
      </speak>
    `;

    const response = await fetch(`${this.endpoint}cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
      },
      body: ssml
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TTS API error: ${response.status} - ${errorText}`);
    }

    return await response.arrayBuffer();
  }

  /**
   * Play audio for a specific step
   * @param {Object} audioStep - Audio step data
   * @param {Function} onStart - Callback when audio starts
   * @param {Function} onEnd - Callback when audio ends
   * @returns {Promise<Object>} Playback result
   */
  async playStepAudio(audioStep, onStart, onEnd) {
    try {
      if (!audioStep.success || !audioStep.audioData) {
        throw new Error('No audio data available for this step');
      }

      // Stop any currently playing audio
      await this.stopCurrentAudio();

      // Initialize audio context
      await this.initializeAudioContext();

      // Decode audio data
      const audioBuffer = await this.audioContext.decodeAudioData(audioStep.audioData.slice(0));
      
      // Create audio source
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      // Connect to speakers
      source.connect(this.audioContext.destination);
      
      // Store current audio for control
      this.currentAudio = source;
      this.isPlaying = true;

      // Set up event handlers
      source.onended = () => {
        this.isPlaying = false;
        this.currentAudio = null;
        if (onEnd) onEnd(audioStep);
      };

      // Start playback
      source.start(0);
      
      if (onStart) onStart(audioStep);

      console.log(`🎵 Playing audio for step ${audioStep.stepNumber}`);

      return {
        success: true,
        stepNumber: audioStep.stepNumber,
        duration: audioBuffer.duration
      };

    } catch (error) {
      console.error(`❌ Error playing audio for step ${audioStep.stepNumber}:`, error);
      this.isPlaying = false;
      this.currentAudio = null;
      
      return {
        success: false,
        stepNumber: audioStep.stepNumber,
        error: error.message
      };
    }
  }

  /**
   * Stop currently playing audio
   */
  async stopCurrentAudio() {
    if (this.currentAudio && this.isPlaying) {
      try {
        this.currentAudio.stop();
        this.currentAudio = null;
        this.isPlaying = false;
        console.log('🛑 Stopped current audio');
      } catch (error) {
        console.warn('Warning: Error stopping audio:', error);
      }
    }
  }

  /**
   * Pause audio playback
   */
  pauseAudio() {
    if (this.currentAudio && this.isPlaying) {
      // Note: Web Audio API doesn't have built-in pause/resume
      // We'll need to track timing and restart from the pause point
      this.stopCurrentAudio();
      console.log('⏸️ Audio paused');
    }
  }

  /**
   * Check if audio is currently playing
   */
  isAudioPlaying() {
    return this.isPlaying && this.currentAudio !== null;
  }

  /**
   * Get available voices
   * @returns {Array} List of available voices
   */
  getAvailableVoices() {
    return [
      // US English Voices
      { name: 'en-US-AriaNeural', displayName: 'Aria (Female, US)', region: 'US' },
      { name: 'en-US-DavisNeural', displayName: 'Davis (Male, US)', region: 'US' },
      { name: 'en-US-JennyNeural', displayName: 'Jenny (Female, US)', region: 'US' },
      { name: 'en-US-GuyNeural', displayName: 'Guy (Male, US)', region: 'US' },
      { name: 'en-US-AmberNeural', displayName: 'Amber (Female, US)', region: 'US' },
      { name: 'en-US-AshleyNeural', displayName: 'Ashley (Female, US)', region: 'US' },
      { name: 'en-US-BrandonNeural', displayName: 'Brandon (Male, US)', region: 'US' },
      { name: 'en-US-ChristopherNeural', displayName: 'Christopher (Male, US)', region: 'US' },
      
      // British English Voices
      { name: 'en-GB-SoniaNeural', displayName: 'Sonia (Female, British)', region: 'UK' },
      { name: 'en-GB-RyanNeural', displayName: 'Ryan (Male, British)', region: 'UK' },
      { name: 'en-GB-LibbyNeural', displayName: 'Libby (Female, British)', region: 'UK' },
      { name: 'en-GB-ThomasNeural', displayName: 'Thomas (Male, British)', region: 'UK' },
      { name: 'en-GB-MaisieNeural', displayName: 'Maisie (Female, British)', region: 'UK' },
      { name: 'en-GB-NoahNeural', displayName: 'Noah (Male, British)', region: 'UK' },
      
      // Australian English Voices
      { name: 'en-AU-NatashaNeural', displayName: 'Natasha (Female, Australian)', region: 'AU' },
      { name: 'en-AU-WilliamNeural', displayName: 'William (Male, Australian)', region: 'AU' },
      { name: 'en-AU-FreyaNeural', displayName: 'Freya (Female, Australian)', region: 'AU' },
      { name: 'en-AU-KenNeural', displayName: 'Ken (Male, Australian)', region: 'AU' },
      { name: 'en-AU-TimNeural', displayName: 'Tim (Male, Australian)', region: 'AU' }
    ];
  }

  /**
   * Get a random voice from available voices
   * @returns {Object} Random voice object
   */
  getRandomVoice() {
    const randomIndex = Math.floor(Math.random() * this.availableVoices.length);
    return this.availableVoices[randomIndex];
  }

  /**
   * Reset the current narrative voice (useful for new presentations)
   */
  resetNarrativeVoice() {
    this.currentNarrativeVoice = null;
    console.log('🎭 Narrative voice reset - next generation will use random voice');
  }

  /**
   * Set a specific voice for the current narrative
   * @param {string} voiceName - Voice name to use
   */
  setNarrativeVoice(voiceName) {
    const voice = this.availableVoices.find(v => v.name === voiceName);
    if (voice) {
      this.currentNarrativeVoice = voice;
      console.log(`🎭 Set narrative voice to: ${voice.displayName}`);
    } else {
      console.warn(`Voice '${voiceName}' not found. Using random voice instead.`);
      this.currentNarrativeVoice = this.getRandomVoice();
    }
  }

  /**
   * Get voices by region/accent
   * @param {string} region - Region code ('US', 'UK', 'AU')
   * @returns {Array} Voices for the specified region
   */
  getVoicesByRegion(region) {
    return this.availableVoices.filter(voice => voice.region === region);
  }

  /**
   * Get a random voice from a specific region
   * @param {string} region - Region code ('US', 'UK', 'AU')
   * @returns {Object} Random voice from the specified region
   */
  getRandomVoiceByRegion(region) {
    const regionalVoices = this.getVoicesByRegion(region);
    if (regionalVoices.length === 0) {
      console.warn(`No voices found for region '${region}'. Using random voice instead.`);
      return this.getRandomVoice();
    }
    const randomIndex = Math.floor(Math.random() * regionalVoices.length);
    return regionalVoices[randomIndex];
  }

  /**
   * Set narrative voice by region/accent
   * @param {string} region - Region code ('US', 'UK', 'AU')
   */
  setNarrativeVoiceByRegion(region) {
    this.currentNarrativeVoice = this.getRandomVoiceByRegion(region);
    console.log(`🎭 Set narrative voice to random ${region} accent: ${this.currentNarrativeVoice.displayName}`);
  }

  /**
   * Create audio URL for download
   * @param {ArrayBuffer} audioData - Audio data
   * @returns {string} Blob URL
   */
  createAudioURL(audioData) {
    const blob = new Blob([audioData], { type: 'audio/mpeg' });
    return URL.createObjectURL(blob);
  }

  /**
   * Download audio file
   * @param {ArrayBuffer} audioData - Audio data
   * @param {string} filename - Filename for download
   */
  downloadAudio(audioData, filename = 'narration.mp3') {
    const url = this.createAudioURL(audioData);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export default AzureTTSService;