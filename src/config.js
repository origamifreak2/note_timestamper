/**
 * @fileoverview Application configuration and constants
 * Centralized configuration for the Note Timestamper application
 */

/**
 * Application configuration object
 */
export const CONFIG = {
  // Recording settings
  RECORDING: {
    DEFAULT_EXTENSION: 'webm',
    SUPPORTED_MIME_TYPES: [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'audio/webm;codecs=opus',
      'audio/webm'
    ],
    DEFAULT_RESOLUTION: { width: 1280, height: 720 },
    DEFAULT_FRAMERATE: 30,
    AVAILABLE_FRAMERATES: [15, 24, 30, 60],
    CANVAS_FPS: 30, // deprecated - use DEFAULT_FRAMERATE instead
    DEFAULT_AUDIO_BITRATE: 64000,
    AVAILABLE_AUDIO_BITRATES: [
      { value: 32000, label: '32 kbps (Minimal)' },
      { value: 48000, label: '48 kbps (Voice)' },
      { value: 64000, label: '64 kbps (Good)' },
      { value: 96000, label: '96 kbps (Clear)' },
      { value: 128000, label: '128 kbps (High)' }
    ]
  },

  // Audio settings
  AUDIO: {
    ANALYSER_FFT_SIZE: 256,
    ANALYSER_SMOOTHING: 0.8,
    LEVEL_UPDATE_INTERVAL: 100 // ms
  },

  // Timer settings
  TIMER: {
    UPDATE_INTERVAL: 100, // ms
    RECORDING_TIMEOUT: 3000 // ms for robust stop
  },

  // Device settings
  DEVICE: {
    INIT_TIMEOUT: 5000 // ms - timeout for device initialization (e.g., video.play())
  },

  // Image settings
  IMAGE: {
    MAX_FILE_SIZE: 15 * 1024 * 1024, // 15MB
    DEFAULT_MAX_WIDTH: 800,
    DEFAULT_MIN_WIDTH: 300,
    CONTAINER_WIDTH_RATIO: 0.8,
    QUALITY: 0.95
  },

  // UI settings
  UI: {
    MODAL_Z_INDEX: 10000,
    OVERLAY_Z_INDEX: 1000,
    CAMERA_MAX_WIDTH: 640,
    DRAWING_MAX_WIDTH: 800,
    DRAWING_MAX_HEIGHT: 600
  },

  // LocalStorage keys
  STORAGE_KEYS: {
    SELECTED_MIC: 'nt_selected_mic',
    SELECTED_CAM: 'nt_selected_cam',
    SELECTED_RES: 'nt_selected_res',
    SELECTED_FPS: 'nt_selected_fps',
    SELECTED_AUDIO_BITRATE: 'nt_selected_audio_bitrate'
  },

  // Editor settings
  EDITOR: {
    DEFAULT_HEIGHT: 480,
    HISTORY_DELAY: 500,
    MAX_HISTORY_STACK: 200,
    RESIZE_HANDLE_SIZE: 8
  },

  // Error Boundary settings
  ERROR_BOUNDARY: {
    DEFAULT_TIMEOUT: 30000, // 30 seconds for general async operations
    IPC_TIMEOUT: 10000, // 10 seconds for IPC calls
    IPC_MAX_RETRIES: 2, // Number of retry attempts for IPC operations
    RETRY_DELAY: 500, // Base delay in ms before retry (uses exponential backoff)
    STORAGE_KEY: 'nt_error_boundary_prefs' // localStorage key for user preferences
  }
};

/**
 * Application state constants
 */
export const STATES = {
  RECORDING: {
    IDLE: 'idle',
    RECORDING: 'recording',
    PAUSED: 'paused',
    STOPPED: 'stopped'
  },

  PLAYER: {
    IDLE: 'idle',
    PLAYING: 'playing',
    PAUSED: 'paused'
  }
};

/**
 * Error messages
 */
export const ERRORS = {
  CAMERA: {
    NOT_ALLOWED: 'Camera access denied. Please allow camera permissions in your system settings and reload the app.',
    NOT_FOUND: 'No camera device found. Please connect a camera and reload the app.',
    NOT_READABLE: 'Camera is already in use by another application. Please close other apps using the camera and try again.',
    INIT_TIMEOUT: 'Camera initialization timed out. The device may be broken or unavailable.',
    ACCESS_FAILED: 'Failed to access camera. Please check that your camera is connected and not in use by another application.',
    SWITCH_FAILED: 'Unable to switch camera during recording. Please stop recording, change the camera, and start a new recording.',
    GENERIC: 'Camera error. Please check permissions and device connection, then try again.'
  },

  MICROPHONE: {
    NOT_ALLOWED: 'Microphone access denied. Please allow microphone permissions in your system settings and reload the app.',
    NOT_FOUND: 'No microphone device found. Please connect a microphone and reload the app.',
    NOT_READABLE: 'Microphone is already in use by another application. Please close other apps using the microphone and try again.',
    ACCESS_FAILED: 'Failed to access microphone. Please check that your microphone is connected and not in use by another application.',
    SWITCH_FAILED: 'Unable to switch microphone during recording. Please stop recording, change the microphone, and start a new recording.',
    CONNECT_FAILED: 'Failed to connect microphone to audio system. Please reload the app and try again.'
  },

  EXPORT: {
    NO_RECORDING: 'No recording available to export',
    FAILED: 'Export failed'
  },

  IMAGE: {
    TOO_LARGE: 'Image too large (>15MB).',
    INVALID_FORMAT: 'Invalid image format.'
  }
};

/**
 * Success messages
 */
export const MESSAGES = {
  SESSION: {
    SAVED: 'Session saved successfully',
    LOADED: 'Session loaded successfully',
    RESET: 'Session reset',
    EXPORTED: 'Session exported successfully'
  },

  RECORDING: {
    STARTED: 'Recording…',
    PAUSED: 'Paused',
    STOPPED: 'Recording stopped',
    FINALIZED: 'Ready to play.'
  },

  CAMERA: {
    OPENING: 'Opening camera...',
    CAPTURED: 'Photo captured and inserted.',
    CANCELLED: 'Photo capture cancelled.'
  },

  DRAWING: {
    OPENING: 'Opening drawing canvas...',
    INSERTED: 'Drawing inserted.',
    CANCELLED: 'Drawing cancelled.'
  }
};