// @ts-check

/**
 * @file Main recording system using MediaRecorder API
 * Handles recording lifecycle, codec selection, and data management
 *
 * =====================
 * Public API Surface
 * =====================
 * Methods:
 *   - init(options: RecordingInitOptions): void
 *       Initializes recording system with DOM references and callbacks.
 *       Side effects: stores DOM refs, initializes timer system.
 *   - async startRecording(): Promise<void>
 *       Starts a new recording session.
 *       Side effects: requests device permissions, creates MediaRecorder, updates UI, starts timer.
 *   - togglePause(): void
 *       Pauses or resumes recording.
 *       Side effects: toggles MediaRecorder/timer, updates UI.
 *   - async stopRecording(): Promise<void>
 *       Stops recording and flushes data.
 *       Side effects: stops MediaRecorder, stops tracks, destroys mixer, stops timer/audio level.
 *   - finalizePreview(): void
 *       Finalizes preview blob and cleans up old blob URLs.
 *       Side effects: creates/revokes blob URLs, updates preview.
 *   - handleStop(): void
 *       Internal: Handles MediaRecorder stop event, triggers finalizePreview and state change.
 *   - updateUIState(state: string): void
 *       Updates UI controls based on recording state.
 *       Side effects: enables/disables buttons, updates status.
 *   - reset(): void
 *       Resets recording system state and cleans up resources.
 *       Side effects: stops MediaRecorder, stops tracks, revokes blob URLs, resets UI.
 *
 * Internal helpers are marked 'Internal'.
 * Invariants and side effects are documented per method.
 */

/**
 * =====================
 * Module Contract
 * =====================
 * Inputs:
 *   - DOM references via init(options): player, status element, control buttons
 *   - Dependencies: timerSystem, audioLevelMonitor, mixerSystem, errorBoundary, CONFIG constants
 *   - User interactions: start/stop/pause buttons, device switching (through mixerSystem)
 *   - Media device streams created by mixerSystem.createMixerStream()
 * Outputs:
 *   - Recorded media blob (recordedBlob) & preview URL (currentBlobUrl)
 *   - Recording state transitions via onStateChange callback
 *   - Media extension (mediaExt) informing export/save logic
 * Side-effects:
 *   - Requests mic/cam permissions
 *   - Allocates & manages MediaRecorder and underlying MediaStream tracks
 *   - Starts/stops timerSystem & audio level monitoring intervals
 *   - Creates/revokes object URLs for preview playback
 *   - Updates DOM control state & status text
 * Invariants:
 *   - Only one active recording; startRecording() is no-op if already recording
 *   - Existing preview URL revoked before creating a new one
 *   - stop/reset always stops tracks & destroys mixer resources
 *   - Paused time excluded from elapsed recording time
 * Failure Modes (coded errors):
 *   - DEVICE_PERMISSION_DENIED / DEVICE_NOT_FOUND / DEVICE_IN_USE
 *   - RECORDING_START_FAILED, CODEC_UNSUPPORTED
 *   - UNKNOWN (unexpected conditions)
 */

import { sleep, createError } from '../modules/utils.js';
import { ERROR_CODES } from '../config.js';
import { timerSystem } from '../modules/timer.js';
import { audioLevelMonitor } from '../modules/audioLevel.js';
import { mixerSystem } from './mixerSystem.js';
import { errorBoundary } from '../modules/errorBoundary.js';

/**
 * Recording system for audio/video capture
 */
export class RecordingSystem {
  constructor() {
    // Recording state
    this.mediaStream = null;
    this.mediaRecorder = null;
    this.chunks = [];
    this.recordedBlob = null;
    this.mediaExt = 'webm';
    this.lastDataChunk = null;
    this.currentBlobUrl = null; // Track blob URL for cleanup

    // UI elements
    this.player = null;
    this.statusEl = null;
    this.buttons = {};

    // Callbacks
    this.onStateChange = null;
  }

  /**
   * Initialize recording system with DOM references and callbacks
   * @param {import('../../types/global').RecordingInitOptions} options - Configuration object
   * @returns {void}
   * @throws {Error} If required DOM elements are not provided
   *
   * Side effects:
   * - Stores references to DOM elements
   * - Initializes timer system with DOM references
   */
  init(options) {
    this.player = options.player;
    this.statusEl = options.statusEl;
    this.buttons = options.buttons || {};
    this.onStateChange = options.onStateChange;

    // Initialize timer system
    timerSystem.init(options.timeDisplay, this.player);
  }

  /**
   * Starts a new recording session
   * @returns {Promise<void>}
   * @throws {Error} If device access fails or MediaRecorder initialization fails
   *
   * Side effects:
   * - Requests microphone and camera permissions
   * - Creates MediaRecorder instance
   * - Starts audio level monitoring
   * - Updates UI state to 'recording'
   * - Starts timer system
   *
   * Invariants:
   * - Must be called when not already recording
   * - Cleans up any existing mixer before starting new session
   */
  async startRecording() {
    try {
      this.statusEl.textContent = 'Requesting devices…';

      // Clean up any existing mixer and start fresh
      mixerSystem.destroy();

      // Wrap device access with error boundary for retry capability
      // Use mixerSystem.deviceManager to avoid circular dependency
      await errorBoundary.wrapDeviceAccess(() => mixerSystem.createMixerStream(), {
        operationName: 'device access for recording',
        deviceManager: mixerSystem.deviceManager,
        context: {
          micId: mixerSystem.deviceManager?.getSelectedMicId(),
          camId: mixerSystem.deviceManager?.getSelectedCamId(),
          isAudioOnly: mixerSystem.deviceManager?.isAudioOnly(),
        },
      });

      // Set up preview in the player element
      const mixer = mixerSystem.getMixer();
      this.mediaStream = mixer.stream;
      this.player.srcObject = this.mediaStream;
      this.player.muted = true; // Prevent feedback during recording
      await this.player.play();

      // =============================================================================
      // CODEC SELECTION - Try best quality formats first
      // =============================================================================
      const mimeCandidates = [
        'video/webm;codecs=vp9,opus', // Best quality video + audio
        'video/webm;codecs=vp8,opus', // Good compatibility video + audio
        'video/webm', // Basic video format
        'audio/webm;codecs=opus', // High quality audio-only
        'audio/webm', // Basic audio-only
      ];

      let mime = '';
      for (const m of mimeCandidates) {
        if (MediaRecorder.isTypeSupported(m)) {
          mime = m;
          break;
        }
      }

      // Set file extension based on selected format
      this.mediaExt = mime.startsWith('audio/') ? 'webm' : 'webm';

      // =============================================================================
      // MEDIARECORDER SETUP
      // =============================================================================
      this.chunks = [];
      this.lastDataChunk = null;

      // Build MediaRecorder options with MIME type and audio bitrate
      const recordingOptions = mime ? { mimeType: mime } : {};
      if (mixerSystem.deviceManager && mixerSystem.deviceManager.getSelectedAudioBitrate) {
        recordingOptions.audioBitsPerSecond = mixerSystem.deviceManager.getSelectedAudioBitrate();
      }

      try {
        this.mediaRecorder = new MediaRecorder(this.mediaStream, recordingOptions);
      } catch (e) {
        throw createError(
          ERROR_CODES.RECORDING_START_FAILED,
          'Failed to start recording. Please check codec support and device access.',
          e
        );
      }

      // Set up timer system with recorder reference
      timerSystem.setMediaRecorder(this.mediaRecorder);

      // Event handlers for recording lifecycle
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size) {
          this.lastDataChunk = e.data;
          this.chunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => this.handleStop();
      this.mediaRecorder.onpause = () => {
        this.onStateChange?.();
      };
      this.mediaRecorder.onresume = () => {
        this.onStateChange?.();
      };
      this.mediaRecorder.onstart = () => {
        this.onStateChange?.();
      };
      this.mediaRecorder.onerror = (e) => {
        const errObj = (e && e.error) || e;
        console.error('MediaRecorder error:', errObj);
        // If codec error occurs, surface a coded error via status
        const msg = (errObj && errObj.message) || String(errObj);
        const code =
          msg && msg.toLowerCase().includes('codec')
            ? ERROR_CODES.CODEC_UNSUPPORTED
            : ERROR_CODES.RECORDING_START_FAILED;
        this.statusEl.textContent = 'Error: ' + (msg || 'Recording error');
        // Avoid throwing from event handler; record code for boundary logs
        // no-op: boundary maps codes on thrown errors elsewhere
      };

      // Update UI state BEFORE starting MediaRecorder to prevent race conditions
      this.updateUIState('recording');

      // Start recording and update UI
      this.mediaRecorder.start(); // No timeslice - get complete blob on stop

      // Initialize recording timer
      timerSystem.startRecording();

      // Set up audio level monitoring for audio-only recording
      // Show audio level meter if: explicitly audio-only OR video failed (no video tracks in stream)
      const deviceManager = mixerSystem.deviceManager;
      const hasVideo = this.mediaStream.getVideoTracks().length > 0;
      if (!hasVideo) {
        audioLevelMonitor.toggle(true);
        audioLevelMonitor.start();
      } else {
        audioLevelMonitor.toggle(false);
      }

      this.statusEl.textContent = 'Recording…';
    } catch (err) {
      console.error(err);
      const msg = /** @type {any} */ (err).message || String(err);
      this.statusEl.textContent = 'Error: ' + msg;
    }
  }

  /**
   * Pauses or resumes recording
   * @returns {void}
   *
   * Side effects:
   * - Pauses or resumes MediaRecorder
   * - Pauses or resumes timer system
   * - Updates UI state
   *
   * Invariants:
   * - MediaRecorder must be active (not 'inactive' state)
   */
  togglePause() {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return;

    if (this.mediaRecorder.state === 'recording') {
      // Pausing
      timerSystem.pauseRecording();
      this.mediaRecorder.pause();
      this.updateUIState('paused');
      this.statusEl.textContent = 'Paused';
    } else if (this.mediaRecorder.state === 'paused') {
      // Resuming
      timerSystem.resumeRecording();
      this.mediaRecorder.resume();
      this.updateUIState('recording');
      this.statusEl.textContent = 'Recording…';
    }
  }

  /**
   * Stops the recording with robust data flushing
   * @returns {Promise<void>}
   *
   * Side effects:
   * - Stops MediaRecorder and flushes remaining data
   * - Stops all media tracks
   * - Destroys mixer system
   * - Stops timer and audio level monitoring
   * - Creates final blob and sets up playback
   * - Updates UI state to 'stopped'
   *
   * Invariants:
   * - Safe to call even if recorder is already stopped
   * - Implements 3-second timeout protection for robust stopping
   */
  async stopRecording() {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      console.warn('stopRec: recorder not active');
      return;
    }

    // =============================================================================
    // DATA FLUSHING PREPARATION
    // =============================================================================

    // If recording is paused, resume it briefly to ensure proper data flushing
    if (this.mediaRecorder.state === 'paused') {
      try {
        this.mediaRecorder.requestData();
      } catch {} // Request any buffered data
      try {
        this.mediaRecorder.resume();
      } catch {} // Resume for clean stop
    }

    // Request final data chunk before stopping
    try {
      this.mediaRecorder.requestData();
    } catch {}
    await sleep(100); // Give MediaRecorder time to process the request

    // =============================================================================
    // ROBUST STOP WITH TIMEOUT PROTECTION
    // =============================================================================

    let stopped = false;
    let dataListener = null;

    await new Promise((resolve) => {
      // Failsafe: resolve after 3 seconds regardless of state
      const hardTimeout = setTimeout(() => {
        cleanup();
        resolve();
      }, 3000);

      // Listen for final data chunks
      dataListener = (e) => {
        if (e.data && e.data.size) {
          this.lastDataChunk = e.data;
          this.chunks.push(e.data);
        }
      };
      this.mediaRecorder.addEventListener('dataavailable', dataListener);

      // Listen for stop completion
      const onStopped = () => {
        stopped = true;
        cleanup();
        resolve();
      };
      this.mediaRecorder.addEventListener('stop', onStopped, { once: true });

      // Cleanup function to remove listeners and timeout
      const cleanup = () => {
        clearTimeout(hardTimeout);
        if (dataListener) this.mediaRecorder.removeEventListener('dataavailable', dataListener);
        this.mediaRecorder.removeEventListener('stop', onStopped);
      };

      // Actually stop the recorder (may throw if already stopped)
      try {
        this.mediaRecorder.stop();
      } catch {
        cleanup();
        resolve();
      }
    });

    // =============================================================================
    // CLEANUP AND UI RESET
    // =============================================================================

    // Stop all media tracks and clean up mixer
    if (this.mediaStream) this.mediaStream.getTracks().forEach((t) => t.stop());
    mixerSystem.destroy();

    // Finalize the recording if stop event didn't fire
    if (!stopped) this.finalizePreview();

    // Stop timer systems
    timerSystem.stopRecording();

    // Stop audio level monitoring
    audioLevelMonitor.stop();
    audioLevelMonitor.toggle(false);

    this.updateUIState('stopped');
    this.statusEl.textContent = 'Finalized.';
  }

  /**
   * Assembles recorded chunks into final blob and sets up playback
   * @returns {void}
   *
   * Side effects:
   * - Revokes previous blob URL to prevent memory leaks
   * - Creates new blob from recorded chunks
   * - Sets player source to recorded blob
   * - Starts playback timer
   * - Triggers onStateChange callback
   *
   * Invariants:
   * - Can be called multiple times safely (cleans up previous blob URLs)
   */
  finalizePreview() {
    // Ensure the last data chunk is included
    if (
      this.lastDataChunk &&
      (!this.chunks.length || this.chunks[this.chunks.length - 1] !== this.lastDataChunk)
    ) {
      this.chunks.push(this.lastDataChunk);
    }

    // Revoke previous blob URL to prevent memory leaks
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }

    if (this.chunks.length) {
      // Combine all chunks into a single blob
      this.recordedBlob = new Blob(this.chunks, {
        type: (this.chunks[0] && this.chunks[0].type) || 'video/webm',
      });
      const url = URL.createObjectURL(this.recordedBlob);
      this.currentBlobUrl = url; // Track URL for later cleanup

      // Switch player from live preview to recorded playback
      this.player.srcObject = null; // Clear live stream
      this.player.muted = false; // Enable audio for playback
      this.player.src = url; // Set recorded media as source

      // Start playback timer to track video position for timestamps
      timerSystem.startPlaybackTimer();
    } else {
      // No recording data available
      this.recordedBlob = null;
      this.player.srcObject = null;
      this.player.removeAttribute('src');
      this.player.load();

      // Stop playback timer when no media is available
      timerSystem.stopPlaybackTimer();
    }

    this.statusEl.textContent = 'Ready to play.';

    // Notify of state change
    if (this.onStateChange) {
      this.onStateChange();
    }
  }

  /**
   * Handles MediaRecorder stop event
   */
  handleStop() {
    this.finalizePreview();
  }

  /**
   * Updates button states based on recording state
   * @param {import('../../types/global').RecordingState} state - Current state: 'idle', 'recording', 'paused', 'stopped'
   * @returns {void}
   *
   * Side effects:
   * - Enables/disables control buttons
   * - Updates button text and icons
   * - Triggers onStateChange callback
   */
  updateUIState(state) {
    const { btnStart, btnPause, btnStop } = this.buttons;

    switch (state) {
      case 'recording':
        if (btnStart) btnStart.disabled = true;
        if (btnPause) {
          btnPause.disabled = false;
          btnPause.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
        }
        if (btnStop) btnStop.disabled = false;
        break;

      case 'paused':
        if (btnPause) {
          btnPause.innerHTML = '<i class="fa-solid fa-play"></i> Resume';
        }
        break;

      case 'stopped':
      case 'idle':
        if (btnStart) btnStart.disabled = false;
        if (btnPause) {
          btnPause.disabled = true;
          btnPause.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
        }
        if (btnStop) btnStop.disabled = true;
        break;
    }

    // Notify of state change for other UI updates
    if (this.onStateChange) {
      this.onStateChange();
    }
  }

  /**
   * Resets recording state and clears data
   * @returns {void}
   *
   * Side effects:
   * - Stops MediaRecorder if active
   * - Stops all media tracks
   * - Destroys mixer system
   * - Revokes blob URLs to prevent memory leaks
   * - Resets all internal state
   * - Resets player and timer systems
   * - Updates UI to 'idle' state
   *
   * Invariants:
   * - Safe to call at any time, even if not recording
   */
  reset() {
    // Stop recording if active
    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
    } catch {}

    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    // Clean up mixer
    mixerSystem.destroy();

    // Revoke blob URL to prevent memory leaks
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }

    // Reset data
    this.recordedBlob = null;
    this.chunks = [];
    this.lastDataChunk = null;

    // Reset player
    this.player.pause();
    this.player.srcObject = null;
    this.player.removeAttribute('src');
    this.player.load();

    // Reset timers
    timerSystem.reset();

    // Stop audio level monitoring
    audioLevelMonitor.stop();
    audioLevelMonitor.toggle(false);

    // Reset UI
    this.updateUIState('idle');
    this.statusEl.textContent = 'Session reset.';
  }

  /**
   * Switch microphone device during active recording
   * @param {string} deviceId - New microphone device ID
   * @returns {Promise<void>}
   * @throws {Error} If device switching fails
   *
   * Side effects:
   * - Switches microphone input in mixer system
   * - Requests new data chunk from MediaRecorder for continuity
   *
   * Invariants:
   * - Only works when mixer is active
   * - Shows alert to user if switching fails
   */
  async switchMicrophoneLive(deviceId) {
    if (!mixerSystem.isActive()) return;

    try {
      await mixerSystem.switchMicLive(deviceId);

      // Request new data chunk to maintain recording continuity
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.requestData();
      }
    } catch (error) {
      alert(error.message);
    }
  }

  /**
   * Switch camera device during active recording
   * @param {string} deviceId - New camera device ID
   * @returns {Promise<void>}
   * @throws {Error} If device switching fails
   *
   * Side effects:
   * - Switches camera input in mixer system
   * - Requests new data chunk from MediaRecorder for continuity
   *
   * Invariants:
   * - Only works when mixer is active
   * - Shows alert to user if switching fails
   */
  async switchCameraLive(deviceId) {
    if (!mixerSystem.isActive()) return;

    try {
      await mixerSystem.switchCamLive(deviceId);

      // Request new data chunk to maintain recording continuity
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.requestData();
      }
    } catch (error) {
      alert(error.message);
    }
  }

  /**
   * Get the recorded blob
   * @returns {Blob|null} Recorded media blob or null if no recording
   */
  getRecordedBlob() {
    return this.recordedBlob;
  }

  /**
   * Get the media file extension
   * @returns {string} File extension for the recorded media
   */
  getMediaExtension() {
    return this.mediaExt;
  }

  /**
   * Check if currently recording
   * @returns {boolean} True if recording is active
   */
  isRecording() {
    const result = this.mediaRecorder && this.mediaRecorder.state === 'recording';
    return result;
  }

  /**
   * Load a recorded blob for playback
   * @param {ArrayBuffer | null} mediaArrayBuffer - Media data as ArrayBuffer
   * @returns {void}
   *
   * Side effects:
   * - Revokes previous blob URL to prevent memory leaks
   * - Creates new blob from array buffer
   * - Sets player source to loaded media
   * - Starts playback timer
   * - Triggers onStateChange callback
   *
   * Invariants:
   * - Safe to call with null to clear playback
   */
  loadRecording(mediaArrayBuffer) {
    // Revoke previous blob URL to prevent memory leaks
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }

    if (mediaArrayBuffer) {
      const blob = new Blob([mediaArrayBuffer], { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      this.currentBlobUrl = url; // Track URL for later cleanup
      this.recordedBlob = blob;
      this.player.srcObject = null;
      this.player.muted = false;
      this.player.src = url;

      // Start playback timer to track video position for timestamps
      timerSystem.startPlaybackTimer();
    } else {
      this.recordedBlob = null;
      this.player.srcObject = null;
      this.player.removeAttribute('src');
      this.player.load();

      // Stop playback timer when no media is loaded
      timerSystem.stopPlaybackTimer();
    }

    // Notify of state change
    if (this.onStateChange) {
      this.onStateChange();
    }
  }
}

// Create a singleton instance
export const recordingSystem = new RecordingSystem();
