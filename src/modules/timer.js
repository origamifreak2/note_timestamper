/**
 * @fileoverview Timer system for tracking recording and playback time
 * Handles timing during recording (excluding paused periods) and during playback
 */

import { formatTime } from './utils.js';

/**
 * Timer system for the Note Timestamper application
 * Manages timing for both recording and playback modes
 */
export class TimerSystem {
  constructor() {
    // Recording state
    this.recordingStartTime = 0;      // When recording actually started
    this.recordingElapsed = 0;        // Total recorded time (excluding paused periods)
    this.recordingPauseStart = 0;     // When current pause began
    this.recordingTimer = null;       // Timer interval for updating display during recording
    this.playbackTimer = null;        // Timer interval for tracking video playback position
    this.isRecordingPaused = false;   // Flag to track if recording is paused

    // DOM references
    this.timeDisplay = null;
    this.player = null;
    this.mediaRecorder = null;

    // Bind methods to preserve 'this' context
    this.updateRecordingTimer = this.updateRecordingTimer.bind(this);
  }

  /**
   * Initialize the timer system with DOM references
   * @param {HTMLElement} timeDisplay - Element to show current time
   * @param {HTMLVideoElement} player - Video/audio player element
   */
  init(timeDisplay, player) {
    this.timeDisplay = timeDisplay;
    this.player = player;
  }

  /**
   * Sets the media recorder reference for recording state checks
   * @param {MediaRecorder} mediaRecorder - Current media recorder instance
   */
  setMediaRecorder(mediaRecorder) {
    this.mediaRecorder = mediaRecorder;
  }

  /**
   * Gets the current recording time (excludes paused periods) or playback time
   * When recording: uses internal timer that excludes paused periods
   * When playing back loaded media: uses video player's currentTime
   * @returns {number} Current time in seconds for timestamps
   */
  getCurrentRecordingTime() {
    // If we have a loaded media file and we're not actively recording, use playback time
    if (this.player && this.player.src && !this.player.srcObject &&
        (!this.mediaRecorder || this.mediaRecorder.state === 'inactive')) {
      return this.player.currentTime || 0;
    }

    // Otherwise use recording timer (original behavior)
    if (!this.mediaRecorder) return 0;

    const now = Date.now();

    if (this.isRecordingPaused) {
      // During pause: return time up to when pause started
      return this.recordingElapsed;
    } else {
      // During recording: add time since last resume/start
      const sessionStart = this.recordingPauseStart || this.recordingStartTime;
      return this.recordingElapsed + (now - sessionStart) / 1000;
    }
  }

  /**
   * Updates the timer display with current recording or playback time
   */
  updateRecordingTimer() {
    if (this.timeDisplay) {
      this.timeDisplay.textContent = formatTime(this.getCurrentRecordingTime());
    }
  }

  /**
   * Starts recording timer tracking
   */
  startRecording() {
    this.recordingStartTime = Date.now();
    this.recordingElapsed = 0;
    this.recordingPauseStart = 0;
    this.isRecordingPaused = false;

    // Start timer update interval (every 100ms for smooth display)
    this.recordingTimer = setInterval(this.updateRecordingTimer, 100);

    // Stop playback timer when recording starts
    this.stopPlaybackTimer();
  }

  /**
   * Pauses the recording timer
   */
  pauseRecording() {
    const now = Date.now();
    this.recordingElapsed += (now - (this.recordingPauseStart || this.recordingStartTime)) / 1000;
    this.recordingPauseStart = now;
    this.isRecordingPaused = true;
  }

  /**
   * Resumes the recording timer
   */
  resumeRecording() {
    this.recordingPauseStart = Date.now();
    this.isRecordingPaused = false;
  }

  /**
   * Stops recording timer tracking
   */
  stopRecording() {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }

    // Reset recording time tracking
    this.recordingStartTime = 0;
    this.recordingElapsed = 0;
    this.recordingPauseStart = 0;
    this.isRecordingPaused = false;
  }

  /**
   * Starts the playback timer to track video position when playing loaded media
   * This allows timestamp insertion during playback of previously recorded sessions
   */
  startPlaybackTimer() {
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
    }
    this.playbackTimer = setInterval(this.updateRecordingTimer, 100);
  }

  /**
   * Stops the playback timer when no longer needed
   */
  stopPlaybackTimer() {
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = null;
    }
  }

  /**
   * Resets all timer state
   */
  reset() {
    this.stopRecording();
    this.stopPlaybackTimer();

    if (this.timeDisplay) {
      this.timeDisplay.textContent = '00:00.00';
    }
  }
}

// Create a singleton instance
export const timerSystem = new TimerSystem();