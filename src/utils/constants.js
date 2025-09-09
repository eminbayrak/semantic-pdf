// Application constants and configuration

export const APP_CONFIG = {
  // Video settings
  VIDEO: {
    DEFAULT_WIDTH: 1920,
    DEFAULT_HEIGHT: 1080,
    DEFAULT_FPS: 30,
    PREVIEW_WIDTH: 1280,
    PREVIEW_HEIGHT: 720,
    MAX_DURATION: 300, // 10 minutes in seconds
    MIN_DURATION: 5 // 5 seconds minimum
  },

  // Animation settings
  ANIMATION: {
    DEFAULT_TRANSITION_DURATION: 0.5, // seconds
    DEFAULT_FADE_DURATION: 0.3, // seconds
    DEFAULT_PULSE_DURATION: 2.0, // seconds
    DEFAULT_ZOOM_LEVEL: 1.5,
    MAX_ZOOM_LEVEL: 3.0,
    MIN_ZOOM_LEVEL: 1.0
  },

  // Highlight settings
  HIGHLIGHT: {
    BORDER_COLOR: '#f59e0b',
    BORDER_WIDTH: 3,
    SPOTLIGHT_OPACITY: 0.2,
    PULSE_SCALE_MIN: 1.0,
    PULSE_SCALE_MAX: 1.1,
    FADE_IN_DURATION: 0.5,
    FADE_OUT_DURATION: 0.5
  },

  // Azure settings
  AZURE: {
    SUPPORTED_FORMATS: ['pdf'],
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
    TIMEOUT: 30000, // 30 seconds
    RETRY_ATTEMPTS: 3
  },

  // GPT settings
  GPT: {
    MODEL: 'gpt-4o',
    MAX_TOKENS: 2000,
    TEMPERATURE: 0.3,
    TIMEOUT: 30000 // 30 seconds
  },

  // TTS settings
  TTS: {
    DEFAULT_VOICE: 'en-US-AriaNeural',
    SAMPLE_RATE: 22050,
    DEFAULT_RATE: 1.0,
    DEFAULT_PITCH: 1.0,
    SUPPORTED_FORMATS: ['wav', 'mp3']
  }
};

// Element ID patterns for semantic mapping
export const ELEMENT_PATTERNS = {
  HEADER: [
    'header', 'title', 'document-title', 'main-title'
  ],
  MEMBER_INFO: [
    'member', 'patient', 'subscriber', 'beneficiary', 'member-info'
  ],
  CLAIMS: [
    'claims', 'services', 'procedures', 'billing', 'claims-table'
  ],
  SUMMARY: [
    'summary', 'total', 'amount-due', 'balance', 'summary-section'
  ],
  FIELDS: [
    'name', 'id', 'address', 'phone', 'email', 'dob', 'ssn',
    'policy', 'group', 'plan', 'coverage', 'deductible',
    'copay', 'coinsurance', 'out-of-pocket', 'premium'
  ],
  AMOUNTS: [
    'total', 'subtotal', 'tax', 'discount', 'payment', 'balance',
    'due', 'paid', 'owed', 'refund', 'credit'
  ]
};

// Highlight types
export const HIGHLIGHT_TYPES = {
  BORDER: 'border',
  SPOTLIGHT: 'spotlight',
  PULSE: 'pulse',
  GLOW: 'glow',
  UNDERLINE: 'underline'
};

// Zoom levels
export const ZOOM_LEVELS = {
  MIN: 1.0,
  NORMAL: 1.5,
  MEDIUM: 2.0,
  HIGH: 2.5,
  MAX: 3.0
};

// Transition types
export const TRANSITION_TYPES = {
  SMOOTH: 'smooth',
  INSTANT: 'instant',
  FADE: 'fade',
  SLIDE: 'slide',
  ZOOM: 'zoom'
};

// Audio voices
export const VOICES = {
  'en-US-AriaNeural': {
    name: 'Aria',
    gender: 'Female',
    language: 'en-US',
    style: 'Neural'
  },
  'en-US-DavisNeural': {
    name: 'Davis',
    gender: 'Male',
    language: 'en-US',
    style: 'Neural'
  },
  'en-US-EmmaNeural': {
    name: 'Emma',
    gender: 'Female',
    language: 'en-US',
    style: 'Neural'
  },
  'en-US-GuyNeural': {
    name: 'Guy',
    gender: 'Male',
    language: 'en-US',
    style: 'Neural'
  },
  'en-US-JennyNeural': {
    name: 'Jenny',
    gender: 'Female',
    language: 'en-US',
    style: 'Neural'
  }
};

// Error messages
export const ERROR_MESSAGES = {
  FILE_UPLOAD: {
    INVALID_FORMAT: 'Please select a valid PDF file',
    FILE_TOO_LARGE: 'File size exceeds the maximum limit of 50MB',
    UPLOAD_FAILED: 'Failed to upload file. Please try again.',
    NO_FILE_SELECTED: 'Please select a file to upload'
  },
  AZURE: {
    INVALID_ENDPOINT: 'Invalid Azure endpoint configuration',
    INVALID_API_KEY: 'Invalid Azure API key',
    ANALYSIS_FAILED: 'Document analysis failed. Please try again.',
    TIMEOUT: 'Document analysis timed out. Please try again.',
    QUOTA_EXCEEDED: 'Azure quota exceeded. Please check your subscription.'
  },
  GPT: {
    INVALID_API_KEY: 'Invalid OpenAI API key',
    MAPPING_FAILED: 'Failed to map narration to elements. Please try again.',
    TIMEOUT: 'GPT processing timed out. Please try again.',
    QUOTA_EXCEEDED: 'OpenAI quota exceeded. Please check your subscription.'
  },
  TTS: {
    GENERATION_FAILED: 'Failed to generate audio. Please try again.',
    INVALID_VOICE: 'Invalid voice selection',
    AUDIO_PROCESSING_FAILED: 'Audio processing failed. Please try again.'
  },
  RENDERING: {
    COMPOSITION_FAILED: 'Failed to create video composition',
    RENDERING_FAILED: 'Video rendering failed. Please try again.',
    INVALID_MAPPING: 'Invalid narration mapping configuration'
  }
};

// Success messages
export const SUCCESS_MESSAGES = {
  FILE_UPLOADED: 'File uploaded successfully',
  ANALYSIS_COMPLETE: 'Document analysis completed',
  MAPPING_COMPLETE: 'Narration mapping completed',
  AUDIO_GENERATED: 'Audio generated successfully',
  RENDERING_COMPLETE: 'Video rendering completed'
};

// CSS classes for styling
export const CSS_CLASSES = {
  HIGHLIGHT: {
    BORDER: 'highlight-border',
    SPOTLIGHT: 'highlight-spotlight',
    PULSE: 'highlight-pulse',
    GLOW: 'highlight-glow',
    UNDERLINE: 'highlight-underline'
  },
  ANIMATION: {
    FADE_IN: 'fade-in',
    FADE_OUT: 'fade-out',
    SLIDE_IN: 'slide-in',
    SLIDE_OUT: 'slide-out',
    ZOOM_IN: 'zoom-in',
    ZOOM_OUT: 'zoom-out'
  },
  LAYOUT: {
    CONTAINER: 'document-container',
    PAGE: 'page',
    SECTION: 'section',
    FIELD: 'field',
    AMOUNT: 'amount'
  }
};

// API endpoints (for future use)
export const API_ENDPOINTS = {
  AZURE: {
    DOCUMENT_INTELLIGENCE: 'https://{region}.cognitiveservices.azure.com/formrecognizer/documentModels/prebuilt-layout:analyze',
    CUSTOM_MODEL: 'https://{region}.cognitiveservices.azure.com/formrecognizer/documentModels/{modelId}:analyze'
  },
  OPENAI: {
    CHAT_COMPLETIONS: 'https://api.openai.com/v1/chat/completions'
  }
};

// File validation
export const FILE_VALIDATION = {
  PDF: {
    MIME_TYPES: ['application/pdf'],
    EXTENSIONS: ['.pdf'],
    MAX_SIZE: 50 * 1024 * 1024 // 50MB
  }
};

// Default values
export const DEFAULTS = {
  NARRATION: 'Welcome to this document presentation. Let me walk you through the key information.',
  VOICE: 'en-US-AriaNeural',
  ZOOM_LEVEL: 1.5,
  HIGHLIGHT_TYPE: 'border',
  TRANSITION_DURATION: 0.5,
  FPS: 30
};

// Environment variables
export const ENV_VARS = {
  AZURE_ENDPOINT: 'REACT_APP_AZURE_ENDPOINT',
  AZURE_KEY: 'REACT_APP_AZURE_KEY',
  OPENAI_API_KEY: 'REACT_APP_OPENAI_API_KEY',
  TTS_API_KEY: 'REACT_APP_TTS_API_KEY',
  TTS_REGION: 'REACT_APP_TTS_REGION'
};
