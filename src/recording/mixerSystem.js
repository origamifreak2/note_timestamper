// @ts-check

/**
 * @file Audio/Video mixer system for combining multiple media sources
 * Creates a combined MediaStream from separate audio and video sources
 *
 * =====================
 * Public API Surface
 * =====================
 * Methods:
 *   - init(deviceManager: DeviceManager): void
 *       Initializes mixer with device manager reference.
 *       Side effects: stores device manager ref.
 *   - async createMixerStream(): Promise<Mixer>
 *       Creates mixed MediaStream (audio+video) using Web Audio and Canvas.
 *       Side effects: requests device permissions, creates audio/video nodes, starts canvas loop, stores mixer.
 *   - async switchMicLive(deviceId: string): Promise<void>
 *       Switches microphone during live recording.
 *       Side effects: reconnects audio nodes, updates analyser.
 *   - async switchCamLive(deviceId: string): Promise<void>
 *       Switches camera during live recording.
 *       Side effects: updates video element/canvas source.
 *   - destroy(): void
 *       Destroys mixer, stops all tracks, cleans up resources.
 *       Side effects: stops audio/video, releases nodes/canvas.
 *   - getMixer(): Mixer | null
 *       Returns current mixer object.
 *   - isActive(): boolean
 *       Returns true if mixer is active.
 *
 * Internal helpers are marked 'Internal'.
 * Invariants and side effects are documented per method.
 */

import { audioLevelMonitor } from '../modules/audioLevel.js';
import { CONFIG, ERROR_CODES } from '../config.js';
import { withTimeout, createError } from '../modules/utils.js';

/**
 * Mixer system for combining audio and video streams
 * Uses Web Audio API for audio mixing and canvas for video capture
 */
export class MixerSystem {
  constructor() {
    this.mixer = null;
    this.deviceManager = null;
  }

  /**
   * Initialize mixer with device manager reference
   * @param {any} deviceManager - Device manager instance
   * @returns {void}
   *
   * Side effects:
   * - Stores reference to device manager for device selection queries
   */
  init(deviceManager) {
    this.deviceManager = deviceManager;
  }

  /**
   * Creates a mixed MediaStream combining audio from Web Audio API and video from canvas
   * Supports live device switching and handles fallbacks when devices are unavailable
   * @returns {Promise<import('../../types/global').Mixer>} Mixer object containing the combined stream and component references
   * @throws {Error} If microphone access fails with detailed user-facing error message
   * @throws {Error} If camera access fails (when video is requested) with detailed user-facing error message
   *
   * Side effects:
   * - Requests microphone and camera permissions
   * - Creates Web Audio context and nodes
   * - Creates canvas and video elements for video processing
   * - Starts canvas drawing loop for video capture
   * - Stores mixer object in instance state
   *
   * Invariants:
   * - Cleans up partial setup if errors occur
   * - Always attempts microphone access (required)
   * - Camera is optional based on deviceManager.isAudioOnly()
   *
   * Error types:
   * - NotAllowedError: Permission denied by user
   * - NotFoundError: Device not found/connected
   * - NotReadableError: Device in use by another app
   * - Timeout: Device initialization timeout (camera only)
   */
  async createMixerStream() {
    const audioId = this.deviceManager.getSelectedMicId();
    const camId = this.deviceManager.getSelectedCamId();
    const wantVideo = !this.deviceManager.isAudioOnly();

    // =============================================================================
    // AUDIO PROCESSING SETUP
    // =============================================================================

    let micStream = null;
    try {
      // Get microphone stream with specific device or default
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: audioId ? { deviceId: { exact: audioId } } : true
      });
    } catch (e) {
      console.error('Microphone access failed:', e);
      // Provide user-facing error message based on error type
      const en = /** @type {any} */(e).name;
      if (en === 'NotAllowedError' || en === 'PermissionDeniedError') {
        throw createError(ERROR_CODES.DEVICE_PERMISSION_DENIED, 'Microphone access denied. Please allow microphone permissions in your system settings and reload the app.', e);
      } else if (en === 'NotFoundError' || en === 'DevicesNotFoundError') {
        throw createError(ERROR_CODES.DEVICE_NOT_FOUND, 'No microphone device found. Please connect a microphone and reload the app.', e);
      } else if (en === 'NotReadableError' || en === 'TrackStartError') {
        throw createError(ERROR_CODES.DEVICE_IN_USE, 'Microphone is already in use by another application. Please close other apps using the microphone and try again.', e);
      } else {
        throw createError(ERROR_CODES.FILE_SYSTEM_ERROR, 'Failed to access microphone. Please check that your microphone is connected and not in use by another application.', e);
      }
    }

    // Create Web Audio context for mixing
    const audioCtx = new (window.AudioContext)();
    const dest = audioCtx.createMediaStreamDestination();  // Output destination

    let micSrc = null, analyser = null;
    if (micStream) {
      try {
        // Connect microphone to audio context destination
        micSrc = audioCtx.createMediaStreamSource(micStream);

        // Create analyser for audio level monitoring
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;

        // Connect: micSrc -> analyser -> dest
        micSrc.connect(analyser);
        analyser.connect(dest);

        // Store analyser for level monitoring
        audioLevelMonitor.setAnalyser(analyser);
      } catch (e) {
        console.error('Failed to connect microphone to audio system:', e);
        // Clean up partial audio context setup
        try { if (micStream) { micStream.getTracks().forEach(t => t.stop()); } } catch {}
        throw createError(ERROR_CODES.MIC_CONNECT_FAILED, 'Failed to connect microphone to audio system. Please reload the app and try again.', e);
      }
    }

    // =============================================================================
    // VIDEO PROCESSING SETUP (Canvas-based for better control)
    // =============================================================================

    let camStream = null;
    /** @type {HTMLVideoElement|null} */
    let camVideo = null;
    /** @type {HTMLCanvasElement|null} */
    let canvas = null;
    let rafId = null;
    const fps = this.deviceManager.getSelectedFramerate();

    if (wantVideo) {
      try {
        // Get camera stream with specific device or default + resolution preferences
        const resolution = this.deviceManager.getSelectedResolution();
        camStream = await navigator.mediaDevices.getUserMedia({
          video: camId ?
            { deviceId: { exact: camId }, width: { ideal: resolution.width }, height: { ideal: resolution.height } }
            : { width: { ideal: resolution.width }, height: { ideal: resolution.height } }
        });

        // Create hidden video element to display camera feed
        camVideo = document.createElement('video');
        camVideo.playsInline = true;
        camVideo.muted = true;           // Prevent audio feedback
        camVideo.srcObject = camStream;

        // Add timeout to prevent hanging on broken webcams
        await withTimeout(
          camVideo.play(),
          CONFIG.DEVICE.INIT_TIMEOUT,
          'Camera initialization timed out. The device may be broken or unavailable.'
        );

        // Create canvas to capture video frames at controlled frame rate
        canvas = document.createElement('canvas');
        const vw = camVideo.videoWidth || 1280;
        const vh = camVideo.videoHeight || 720;
        canvas.width = vw;
        canvas.height = vh;
        const ctx = canvas.getContext('2d');

        // Animation loop to continuously draw video frames to canvas
        const draw = () => {
          // Lifecycle check: stop drawing if video element is destroyed or not playing
          if (!camVideo || camVideo.paused || camVideo.ended || camVideo.readyState < 2) {
            return;
          }

          try {
            if (ctx && canvas) {
              ctx.drawImage(camVideo, 0, 0, canvas.width, canvas.height);
            }
          } catch {
            // Drawing failed, stop the loop
            return;
          }

          rafId = setTimeout(draw, Math.round(1000 / fps));  // Maintain consistent frame rate
        };
        draw();  // Start the drawing loop
      } catch (e) {
        console.error('Camera access failed:', e);
        // Clean up any partial camera setup
        try { if (camStream) { camStream.getTracks().forEach(t => t.stop()); } } catch {}

        // Provide user-facing error message based on error type
        const en = /** @type {any} */(e).name;
        if (en === 'NotAllowedError' || en === 'PermissionDeniedError') {
          throw createError(ERROR_CODES.DEVICE_PERMISSION_DENIED, 'Camera access denied. Please allow camera permissions in your system settings and reload the app.', e);
        } else if (en === 'NotFoundError' || en === 'DevicesNotFoundError') {
          throw createError(ERROR_CODES.DEVICE_NOT_FOUND, 'No camera device found. Please connect a camera and reload the app.', e);
        } else if (en === 'NotReadableError' || en === 'TrackStartError') {
          throw createError(ERROR_CODES.DEVICE_IN_USE, 'Camera is already in use by another application. Please close other apps using the camera and try again.', e);
        } else if ((/** @type {any} */(e)).message && (/** @type {any} */(e)).message.includes('timed out')) {
          // This is from our withTimeout wrapper
          throw e; // Re-throw the timeout error with its original message
        } else {
          throw createError(ERROR_CODES.FILE_SYSTEM_ERROR, 'Failed to access camera. Please check that your camera is connected and not in use by another application.', e);
        }
      }
    }

    // =============================================================================
    // COMBINE AUDIO AND VIDEO INTO SINGLE STREAM
    // =============================================================================

    const stream = new MediaStream();

    // Add audio track from Web Audio API destination
    if (dest.stream.getAudioTracks().length) {
      stream.addTrack(dest.stream.getAudioTracks()[0]);
    }

    // Add video track from canvas capture
    if (wantVideo && canvas) {
      const vTrack = canvas.captureStream(fps).getVideoTracks()[0];
      if (vTrack) stream.addTrack(vTrack);
    }

    // Store all components for later cleanup and live switching
    this.mixer = {
      stream,
      audioCtx,
      dest,
      camVideo,
      canvas,
      rafId,
      micSrc,
      micStream,
      camStream,
      analyser
    };

    return this.mixer;
  }

  /**
   * Switches the microphone input to a new device while recording is active
   * Maintains audio continuity by seamlessly reconnecting Web Audio nodes
   * @param {string} deviceId - ID of the new microphone device
   * @returns {Promise<void>}
   * @throws {Error} If microphone switching fails with user-facing error message
   *
   * Side effects:
   * - Stops old microphone stream
   * - Disconnects old audio source nodes
   * - Creates new microphone stream
   * - Reconnects audio pipeline with new source
   * - Updates analyser node reference for audio level monitoring
   *
   * Invariants:
   * - Only works when mixer is active
   * - Cleans up old microphone on both success and failure
   */
  async switchMicLive(deviceId) {
    if (!this.mixer) return;

    try {
      // Get stream from new microphone device
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } }
      });

      // Disconnect and stop old microphone
      try { if (this.mixer.micSrc) { this.mixer.micSrc.disconnect(); } } catch { }
      try { if (this.mixer.micStream) { this.mixer.micStream.getTracks().forEach(t => t.stop()); } } catch { }

      // Connect new microphone to audio pipeline
      this.mixer.micStream = newStream;
      this.mixer.micSrc = this.mixer.audioCtx.createMediaStreamSource(newStream);

      // Connect through analyzer if it exists (for audio level monitoring)
      if (this.mixer.analyser) {
        this.mixer.micSrc.connect(this.mixer.analyser);
        // analyzer is already connected to dest from initial setup
        // Update global reference for audio level monitoring
        audioLevelMonitor.setAnalyser(this.mixer.analyser);
      } else {
        this.mixer.micSrc.connect(this.mixer.dest);
      }
    } catch (e) {
      console.error('Failed to switch microphone during recording:', e);
      // Provide user-facing error message
      const en = /** @type {any} */(e).name;
      if (en === 'NotAllowedError' || en === 'PermissionDeniedError') {
        throw createError(ERROR_CODES.DEVICE_PERMISSION_DENIED, 'Microphone access denied. Please allow microphone permissions in your system settings.', e);
      } else if (en === 'NotFoundError' || en === 'DevicesNotFoundError') {
        throw createError(ERROR_CODES.DEVICE_NOT_FOUND, 'Selected microphone device not found. It may have been disconnected.', e);
      } else if (en === 'NotReadableError' || en === 'TrackStartError') {
        throw createError(ERROR_CODES.DEVICE_IN_USE, 'Microphone is already in use by another application.', e);
      } else {
        throw createError(ERROR_CODES.MIC_SWITCH_FAILED, 'Unable to switch microphone during recording. Please stop recording, change the microphone, and start a new recording.', e);
      }
    }
  }

  /**
   * Switches the camera input to a new device while recording is active
   * Updates the canvas source video to maintain video continuity
   * @param {string} deviceId - ID of the new camera device
   * @returns {Promise<void>}
   * @throws {Error} If camera switching fails with user-facing error message
   *
   * Side effects:
   * - Stops old camera stream
   * - Creates new camera stream with current resolution settings
   * - Updates video element source (canvas drawing loop continues automatically)
   *
   * Invariants:
   * - Only works when mixer is active and not in audio-only mode
   * - Canvas drawing loop continues without interruption
   */
  async switchCamLive(deviceId) {
    if (!this.mixer || this.deviceManager.isAudioOnly()) return;

    try {
      // Get stream from new camera device
      const resolution = this.deviceManager.getSelectedResolution();
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId }, width: { ideal: resolution.width }, height: { ideal: resolution.height } }
      });

      // Stop old camera stream
      try { if (this.mixer.camStream) { this.mixer.camStream.getTracks().forEach(t => t.stop()); } } catch { }

      // Update video element with new stream (canvas drawing loop continues automatically)
      this.mixer.camStream = newStream;
      if (this.mixer.camVideo) {
        this.mixer.camVideo.srcObject = newStream;
      }

      // Add timeout to prevent hanging on broken webcams
      await withTimeout(
        this.mixer.camVideo ? this.mixer.camVideo.play() : Promise.resolve(),
        CONFIG.DEVICE.INIT_TIMEOUT,
        'Camera initialization timed out. The device may be broken or unavailable.'
      );
    } catch (e) {
      console.error('Failed to switch camera during recording:', e);
      // Provide user-facing error message
      const en = /** @type {any} */(e).name;
      if (en === 'NotAllowedError' || en === 'PermissionDeniedError') {
        throw createError(ERROR_CODES.DEVICE_PERMISSION_DENIED, 'Camera access denied. Please allow camera permissions in your system settings.', e);
      } else if (en === 'NotFoundError' || en === 'DevicesNotFoundError') {
        throw createError(ERROR_CODES.DEVICE_NOT_FOUND, 'Selected camera device not found. It may have been disconnected.', e);
      } else if (en === 'NotReadableError' || en === 'TrackStartError') {
        throw createError(ERROR_CODES.DEVICE_IN_USE, 'Camera is already in use by another application.', e);
      } else if ((/** @type {any} */(e)).message && (/** @type {any} */(e)).message.includes('timed out')) {
        // This is from our withTimeout wrapper
        // Attach code for timeout classification
        const t = createError(ERROR_CODES.CAMERA_INIT_TIMEOUT, (/** @type {any} */(e)).message, e);
        // Preserve stack/message if present
        // @ts-ignore
        t.stack = (/** @type {any} */(e)).stack;
        throw t;
      } else {
        throw createError(ERROR_CODES.CAMERA_SWITCH_FAILED, 'Unable to switch camera during recording. Please stop recording, change the camera, and start a new recording.', e);
      }
    }
  }

  /**
   * Cleanly shuts down the mixer system, stopping all streams and timers
   * Called when stopping recording or resetting the session
   * @returns {void}
   *
   * Side effects:
   * - Stops canvas drawing loop
   * - Pauses and clears video element
   * - Stops all media tracks (camera and microphone)
   * - Closes Web Audio context
   * - Clears audio level monitor
   * - Nullifies mixer state
   *
   * Invariants:
   * - Safe to call multiple times
   * - Safe to call when mixer is null
   */
  destroy() {
    if (!this.mixer) return;

    // Stop canvas drawing loop first to prevent further draws
    try { if (this.mixer.rafId) clearTimeout(this.mixer.rafId); } catch { }
    this.mixer.rafId = null;

    // Pause and clear video element
    try {
      if (this.mixer.camVideo) {
        this.mixer.camVideo.pause();
        this.mixer.camVideo.srcObject = null; // Clear source to trigger lifecycle checks
      }
    } catch { }

    // Stop all media tracks
    try { if (this.mixer.camStream) { this.mixer.camStream.getTracks().forEach(t => t.stop()); } } catch { }
    try { if (this.mixer.micStream) { this.mixer.micStream.getTracks().forEach(t => t.stop()); } } catch { }

    // Close Web Audio context
    try { if (this.mixer.audioCtx) { this.mixer.audioCtx.close(); } } catch { }

    // Clean up audio level monitoring
    audioLevelMonitor.cleanup();

    this.mixer = null;
  }

  /**
   * Get the current mixer instance
   * @returns {import('../../types/global').Mixer | null} Current mixer object or null if not created
   */
  getMixer() {
    return this.mixer;
  }

  /**
   * Check if mixer is currently active
   * @returns {boolean} True if mixer exists and is active
   */
  isActive() {
    return !!this.mixer;
  }
}

// Create a singleton instance
export const mixerSystem = new MixerSystem();