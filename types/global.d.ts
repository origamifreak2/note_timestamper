/**
 * @fileoverview Central type declarations for Note Timestamper
 * Provides TypeScript definitions for shared domain types and IPC interfaces
 */

// ============================================================================
// Recording Domain Types
// ============================================================================

/**
 * Recording state enum
 */
export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

/**
 * Player state enum
 */
export type PlayerState = 'idle' | 'playing' | 'paused';

/**
 * Media stream mixer components
 */
export interface Mixer {
  /** Combined output stream with audio and video tracks */
  stream: MediaStream;
  /** Web Audio context for audio processing */
  audioCtx: AudioContext;
  /** Audio destination node for outputting processed audio */
  dest: MediaStreamAudioDestinationNode;
  /** Video element displaying camera feed */
  camVideo: HTMLVideoElement | null;
  /** Canvas for capturing video frames */
  canvas: HTMLCanvasElement | null;
  /** RequestAnimationFrame ID for canvas drawing loop */
  rafId: number | null;
  /** Audio source node from microphone */
  micSrc: MediaStreamAudioSourceNode | null;
  /** Raw microphone media stream */
  micStream: MediaStream | null;
  /** Raw camera media stream */
  camStream: MediaStream | null;
  /** Audio analyser node for level monitoring */
  analyser: AnalyserNode | null;
}

/**
 * Recording system initialization options
 */
export interface RecordingInitOptions {
  /** Video/audio player element */
  player: HTMLVideoElement;
  /** Status text display element */
  statusEl: HTMLElement;
  /** Time display element for timer */
  timeDisplay: HTMLElement;
  /** Recording control buttons */
  buttons?: {
    btnStart?: HTMLButtonElement;
    btnPause?: HTMLButtonElement;
    btnStop?: HTMLButtonElement;
  };
  /** Callback when recording state changes */
  onStateChange?: () => void;
}

// ============================================================================
// Device Management Types
// ============================================================================

/**
 * Video resolution dimensions
 */
export interface Resolution {
  width: number;
  height: number;
}

/**
 * Device selection persistence
 */
export interface DeviceSelection {
  micId?: string;
  camId?: string;
  resolution?: string;
  framerate?: number;
  audioBitrate?: number;
}

/**
 * Audio bitrate option
 */
export interface AudioBitrateOption {
  value: number;
  label: string;
}

// ============================================================================
// Editor Domain Types
// ============================================================================

/**
 * Timestamp embed value for Quill
 */
export interface TimestampValue {
  /** Timestamp in seconds */
  ts: number;
  /** Display label for the timestamp button */
  label: string;
}

/**
 * Image embed value for Quill (object format with fabric data)
 */
export interface ImageValueObject {
  /** Image data URL or source */
  src: string;
  /** Image width in pixels */
  width?: number;
  /** Image height in pixels */
  height?: number;
  /** Fabric.js canvas JSON for editable drawings */
  fabricJSON?: string;
}

/**
 * Image embed value for Quill (string format: "src|widthxheight")
 */
export type ImageValueString = string;

/**
 * Image embed value (union of object and string formats)
 */
export type ImageValue = ImageValueObject | ImageValueString;

/**
 * Image dimensions for insertion
 */
export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Extracted image data for export
 */
export interface ExtractedImage {
  /** Image filename */
  fileName: string;
  /** Base64-encoded image data */
  base64Data: string;
  /** Image MIME type */
  mimeType: string;
}

/**
 * Export system initialization options
 */
export interface ExportInitOptions {
  recordingSystem: any; // RecordingSystem instance
  quill: any; // Quill instance
}

// ============================================================================
// Session Persistence Types
// ============================================================================

/**
 * Session metadata stored in session.json
 */
export interface SessionMeta {
  /** ISO timestamp when the session was created */
  createdAt: string;
  /** Filename of the media file inside the archive (e.g., "media.webm"). Can be null if missing */
  mediaFile: string | null;
  /** Filename of the notes HTML inside the archive (typically notes.html) */
  notesFile: string;
  /** Internal schema version number for session.json */
  version: number;
}

/**
 * Save session payload
 */
export interface SaveSessionPayload {
  /** HTML content from Quill editor */
  noteHtml: string;
  /** Path to temp media file */
  mediaFilePath: string;
  /** Unique session ID for progress tracking */
  sessionId: string;
}

/**
 * Save progress phases
 */
export type SaveProgressPhase =
  | 'creating-zip'
  | 'streaming-media'
  | 'writing-zip'
  | 'completed'
  | 'error';

/**
 * Save progress event data
 */
export interface SaveProgress {
  /** Current phase of save operation */
  phase: SaveProgressPhase;
  /** Progress percentage (0-100) */
  percent: number;
  /** Status message for UI display */
  statusText: string;
  /** Bytes written (for streaming phase) */
  bytesWritten?: number;
  /** Error message (for error phase) */
  error?: string;
}

/**
 * Temp media stream metadata
 */
export interface TempMediaStream {
  /** Write stream for temp file */
  ws: any; // fs.WriteStream
  /** Temp file path */
  path: string;
  /** Bytes written so far */
  bytesWritten: number;
  /** Associated session ID */
  sessionId: string;
}

// ============================================================================
// IPC Interface Definitions
// ============================================================================

/**
 * Main process API exposed via preload
 */
export interface WindowAPI {
  // Session operations
  saveSession(payload: SaveSessionPayload): Promise<{ ok: boolean; path?: string; error?: string }>;
  loadSession(): Promise<{ ok: boolean; notesHtml?: string; mediaArrayBuffer?: ArrayBuffer; mediaFile?: string | null; error?: string }>;

  // Temp media streaming
  createTempMedia(opts: { fileName: string; sessionId: string }): Promise<{ ok: boolean; id?: string; path?: string; error?: string }>;
  appendTempMedia(id: string, chunk: Uint8Array): Promise<{ ok: boolean; bytesWritten?: number; error?: string }>;
  closeTempMedia(id: string): Promise<{ ok: boolean; path?: string; error?: string }>;

  // Export operations
  saveHtml(payload: { html: string }): Promise<{ ok: boolean; path?: string; error?: string }>;
  saveHtmlVideo(payload: {
    html: string;
    mediaBuffer: ArrayBuffer | null;
    mediaExt: string;
    images: ExtractedImage[];
  }): Promise<{ ok: boolean; path?: string; error?: string }>;

  // Image picker
  pickImage(): Promise<{ ok: boolean; dataUrl?: string; error?: string }>;
}

/**
 * Menu IPC interface exposed via preload
 */
export interface WindowMenu {
  /** Listen for menu actions from main process */
  onAction(callback: (action: string) => void): void;

  /** Listen for save progress updates */
  onSaveProgress(callback: (progress: SaveProgress) => void): void;

  /** Listen for file loading start event */
  onFileLoadingStart(callback: () => void): void;

  /** Listen for file loading complete event */
  onFileLoadingComplete(callback: () => void): void;

  /** Send current state to main process for menu updates */
  sendState(state: any): void;
}

/**
 * Session management interface exposed via preload
 */
export interface WindowSession {
  /** Clear the last opened session directory */
  clearLastOpenedSession(): Promise<void>;
}

/**
 * Window object extensions
 */
declare global {
  interface Window {
    api: WindowAPI;
    menu: WindowMenu;
    session: WindowSession;
  }
}

// ============================================================================
// Error Boundary Types
// ============================================================================

/**
 * Error boundary wrap options
 */
export interface ErrorBoundaryWrapOptions {
  /** Operation name for logging */
  operationName: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Additional context for error logging */
  context?: Record<string, any>;
}

/**
 * Device access wrap options (extends ErrorBoundaryWrapOptions)
 */
export interface DeviceAccessWrapOptions extends ErrorBoundaryWrapOptions {
  /** Device manager instance for retry functionality */
  deviceManager: any; // DeviceManager instance
}

/**
 * Structured error log entry
 */
export interface ErrorLogEntry {
  /** Timestamp of error */
  timestamp: string;
  /** Error name/type */
  errorType: string;
  /** Operation that failed */
  operation: string;
  /** Error message */
  message: string;
  /** Additional context data */
  context?: Record<string, any>;
  /** Recovery action taken */
  recoveryAction?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Async operation result wrapper
 */
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Callback function type
 */
export type Callback<T = void> = (data: T) => void;

/**
 * Cleanup function type
 */
export type CleanupFunction = () => void;
