/**
 * @fileoverview Main recording system using MediaRecorder API
 * Handles recording lifecycle, codec selection, and data management
 */

import { sleep } from '../modules/utils.js';
import { timerSystem } from '../modules/timer.js';
import { audioLevelMonitor } from '../modules/audioLevel.js';
import { mixerSystem } from './mixerSystem.js';

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

    // UI elements
    this.player = null;
    this.statusEl = null;
    this.buttons = {};

    // Callbacks
    this.onStateChange = null;
  }

  /**
   * Initialize recording system with DOM references and callbacks
   * @param {Object} options - Configuration object
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
   */
  async startRecording() {
    try {
      this.statusEl.textContent = 'Requesting devices…';

      // Clean up any existing mixer and start fresh
      mixerSystem.destroy();
      await mixerSystem.createMixerStream();

      // Set up preview in the player element
      const mixer = mixerSystem.getMixer();
      this.mediaStream = mixer.stream;
      this.player.srcObject = this.mediaStream;
      this.player.muted = true;  // Prevent feedback during recording
      await this.player.play();

      // =============================================================================
      // CODEC SELECTION - Try best quality formats first
      // =============================================================================
      const mimeCandidates = [
        'video/webm;codecs=vp9,opus',   // Best quality video + audio
        'video/webm;codecs=vp8,opus',   // Good compatibility video + audio
        'video/webm',                   // Basic video format
        'audio/webm;codecs=opus',       // High quality audio-only
        'audio/webm'                    // Basic audio-only
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

      this.mediaRecorder = new MediaRecorder(this.mediaStream, recordingOptions);

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
        this.statusEl.textContent = 'Paused';
        console.log('MediaRecorder paused, calling onStateChange');
        if (this.onStateChange) this.onStateChange();
      };
      this.mediaRecorder.onresume = () => {
        this.statusEl.textContent = 'Recording…';
        console.log('MediaRecorder resumed, calling onStateChange');
        if (this.onStateChange) this.onStateChange();
      };
      this.mediaRecorder.onstart = () => {
        console.log('MediaRecorder started, calling onStateChange');
        if (this.onStateChange) this.onStateChange();
      };
      this.mediaRecorder.onerror = (e) => {
        console.error('MediaRecorder error:', (e && e.error) || e);
        this.statusEl.textContent = 'Recorder error — see console';
      };

      // Update UI state BEFORE starting MediaRecorder to prevent race conditions
      console.log('Setting UI state to recording BEFORE MediaRecorder.start()');
      this.updateUIState('recording');

      // Start recording and update UI
      this.mediaRecorder.start(); // No timeslice - get complete blob on stop
      console.log('MediaRecorder started, state:', this.mediaRecorder.state);

      // Initialize recording timer
      timerSystem.startRecording();

      // Set up audio level monitoring for audio-only recording
      const deviceManager = mixerSystem.deviceManager;
      if (deviceManager && deviceManager.isAudioOnly()) {
        audioLevelMonitor.toggle(true);
        audioLevelMonitor.start();
      } else {
        audioLevelMonitor.toggle(false);
      }

      this.statusEl.textContent = 'Recording…';

    } catch (err) {
      console.error(err);
      this.statusEl.textContent = 'Error: ' + err.message;
    }
  }

  /**
   * Pauses or resumes recording
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
      try { this.mediaRecorder.requestData(); } catch { }  // Request any buffered data
      try { this.mediaRecorder.resume(); } catch { }       // Resume for clean stop
    }

    // Request final data chunk before stopping
    try { this.mediaRecorder.requestData(); } catch { }
    await sleep(100);  // Give MediaRecorder time to process the request

    // =============================================================================
    // ROBUST STOP WITH TIMEOUT PROTECTION
    // =============================================================================

    let stopped = false;
    let dataListener = null;

    await new Promise((resolve) => {
      // Failsafe: resolve after 3 seconds regardless of state
      const hardTimeout = setTimeout(() => { cleanup(); resolve(); }, 3000);

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
      try { this.mediaRecorder.stop(); } catch { cleanup(); resolve(); }
    });

    // =============================================================================
    // CLEANUP AND UI RESET
    // =============================================================================

    // Stop all media tracks and clean up mixer
    if (this.mediaStream) this.mediaStream.getTracks().forEach(t => t.stop());
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
   */
  finalizePreview() {
    // Ensure the last data chunk is included
    if (this.lastDataChunk && (!this.chunks.length || this.chunks[this.chunks.length - 1] !== this.lastDataChunk)) {
      this.chunks.push(this.lastDataChunk);
    }

    if (this.chunks.length) {
      // Combine all chunks into a single blob
      this.recordedBlob = new Blob(this.chunks, { type: (this.chunks[0] && this.chunks[0].type) || 'video/webm' });
      const url = URL.createObjectURL(this.recordedBlob);

      // Switch player from live preview to recorded playback
      this.player.srcObject = null;  // Clear live stream
      this.player.muted = false;     // Enable audio for playback
      this.player.src = url;         // Set recorded media as source

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
   * @param {string} state - Current state: 'idle', 'recording', 'paused', 'stopped'
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
   */
  reset() {
    // Stop recording if active
    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
    } catch { }

    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }

    // Clean up mixer
    mixerSystem.destroy();

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
    const result = this.mediaRecorder && this.mediaRecorder.state !== 'inactive';
    console.log('isRecording called, mediaRecorder:', !!this.mediaRecorder, 'state:', this.mediaRecorder?.state, 'result:', result);
    return result;
  }

  /**
   * Load a recorded blob for playback
   * @param {ArrayBuffer} mediaArrayBuffer - Media data as ArrayBuffer
   */
  loadRecording(mediaArrayBuffer) {
    if (mediaArrayBuffer) {
      const blob = new Blob([mediaArrayBuffer], { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
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