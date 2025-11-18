/**
 * @fileoverview Audio/Video mixer system for combining multiple media sources
 * Creates a combined MediaStream from separate audio and video sources
 */

import { audioLevelMonitor } from '../modules/audioLevel.js';
import { CONFIG } from '../config.js';
import { withTimeout } from '../modules/utils.js';

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
   * @param {Object} deviceManager - Device manager instance
   */
  init(deviceManager) {
    this.deviceManager = deviceManager;
  }

  /**
   * Creates a mixed MediaStream combining audio from Web Audio API and video from canvas
   * Supports live device switching and handles fallbacks when devices are unavailable
   * @returns {Object} Mixer object containing the combined stream and component references
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
      console.warn('Mic getUserMedia failed, proceeding without audio', e);
    }

    // Create Web Audio context for mixing
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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
        console.warn('Mic source connect failed', e);
      }
    }

    // =============================================================================
    // VIDEO PROCESSING SETUP (Canvas-based for better control)
    // =============================================================================

    let camStream = null, camVideo = null, canvas = null, rafId = null;
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
          try {
            ctx.drawImage(camVideo, 0, 0, canvas.width, canvas.height);
          } catch { }
          rafId = setTimeout(draw, Math.round(1000 / fps));  // Maintain consistent frame rate
        };
        draw();  // Start the drawing loop
      } catch (e) {
        console.warn('Camera getUserMedia failed, proceeding audio-only', e);
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
      console.error('switchMicLive failed', e);
      throw new Error('Unable to switch microphone live on this system.');
    }
  }

  /**
   * Switches the camera input to a new device while recording is active
   * Updates the canvas source video to maintain video continuity
   * @param {string} deviceId - ID of the new camera device
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
      this.mixer.camVideo.srcObject = newStream;

      // Add timeout to prevent hanging on broken webcams
      await withTimeout(
        this.mixer.camVideo.play(),
        CONFIG.DEVICE.INIT_TIMEOUT,
        'Camera initialization timed out. The device may be broken or unavailable.'
      );
    } catch (e) {
      console.error('switchCamLive failed', e);
      throw new Error('Unable to switch camera live on this system.');
    }
  }

  /**
   * Cleanly shuts down the mixer system, stopping all streams and timers
   * Called when stopping recording or resetting the session
   */
  destroy() {
    if (!this.mixer) return;

    try { if (this.mixer.rafId) clearTimeout(this.mixer.rafId); } catch { }  // Stop canvas drawing loop
    try { if (this.mixer.audioCtx) { this.mixer.audioCtx.close(); } } catch { }                    // Close Web Audio context
    try { if (this.mixer.camVideo) { this.mixer.camVideo.pause(); } } catch { }                    // Stop video playback
    try { if (this.mixer.camStream) { this.mixer.camStream.getTracks().forEach(t => t.stop()); } } catch { }  // Stop camera tracks
    try { if (this.mixer.micStream) { this.mixer.micStream.getTracks().forEach(t => t.stop()); } } catch { }  // Stop microphone tracks

    // Clean up audio level monitoring
    audioLevelMonitor.setAnalyser(null);
    audioLevelMonitor.stop();

    this.mixer = null;
  }

  /**
   * Get the current mixer instance
   * @returns {Object|null} Current mixer object or null if not created
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