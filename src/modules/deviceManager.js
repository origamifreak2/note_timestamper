// @ts-check
/**
 * @fileoverview Device management for audio and video devices
 * Handles device enumeration, selection persistence, and constraints building
 */

import { CONFIG } from '../config.js';

/**
 * LocalStorage keys for remembering device selections across sessions
 */
const LS_KEYS = {
  mic: 'nt_selected_mic',
  cam: 'nt_selected_cam',
  res: 'nt_selected_res',
  fps: 'nt_selected_fps',
  audioBitrate: 'nt_selected_audio_bitrate'
};

/**
 * Device management system for audio and video devices
 */
export class DeviceManager {
  constructor() {
    // DOM references
    this.micSelect = null;
    this.camSelect = null;
    this.resSelect = null;
    this.fpsSelect = null;
    this.audioBitrateSelect = null;
    this.audioOnlyCheckbox = null;
  }

  /**
   * Initialize device manager with DOM references
   * @param {HTMLSelectElement | null} micSelect - Microphone selector dropdown
   * @param {HTMLSelectElement | null} camSelect - Camera selector dropdown
   * @param {HTMLSelectElement | null} resSelect - Resolution selector dropdown
   * @param {HTMLSelectElement | null} fpsSelect - Framerate selector dropdown
   * @param {HTMLSelectElement | null} audioBitrateSelect - Audio bitrate selector dropdown
   * @param {HTMLInputElement | null} audioOnlyCheckbox - Audio-only mode checkbox
   * @returns {void}
   *
   * Side effects:
   * - Stores references to all DOM elements for later use
   */
  init(micSelect, camSelect, resSelect, fpsSelect, audioBitrateSelect, audioOnlyCheckbox) {
    this.micSelect = micSelect;
    this.camSelect = camSelect;
    this.resSelect = resSelect;
    this.fpsSelect = fpsSelect;
    this.audioBitrateSelect = audioBitrateSelect;
    this.audioOnlyCheckbox = audioOnlyCheckbox;
  }

  /**
   * Gets the selected device ID from a dropdown, filtering out special values
   * @param {HTMLSelectElement | null} selectEl - The device selection dropdown
   * @returns {string | undefined} Device ID or undefined for default/none
   *
   * Invariants:
   * - Returns undefined for null/undefined selectEl
   * - Filters out 'default' and 'none' special values
   */
  getSelectedDeviceId(selectEl) {
    const v = selectEl && selectEl.value;
    return (v && v !== 'default' && v !== 'none') ? v : undefined;
  }

  /**
   * Gets the selected recording resolution from the dropdown
   * @returns {import('../../types/global').Resolution} Object with width and height properties
   *
   * Invariants:
   * - Always returns valid resolution, defaults to 1280x720 if parsing fails
   */
  getSelectedResolution() {
    const resValue = (this.resSelect && this.resSelect.value) || '1280x720';
    const [width, height] = resValue.split('x').map(Number);
    return { width: width || 1280, height: height || 720 };
  }

  /**
   * Gets the selected recording framerate from the dropdown
   * @returns {number} Framerate in FPS
   *
   * Invariants:
   * - Always returns valid number, defaults to CONFIG.RECORDING.DEFAULT_FRAMERATE if parsing fails
   */
  getSelectedFramerate() {
    const fpsValue = (this.fpsSelect && this.fpsSelect.value) || CONFIG.RECORDING.DEFAULT_FRAMERATE.toString();
    const fps = parseInt(fpsValue, 10) || CONFIG.RECORDING.DEFAULT_FRAMERATE;
    return fps;
  }

  /**
   * Gets the selected audio bitrate from the dropdown
   * @returns {number} Audio bitrate in bits per second
   *
   * Invariants:
   * - Always returns valid number, defaults to CONFIG.RECORDING.DEFAULT_AUDIO_BITRATE if parsing fails
   */
  getSelectedAudioBitrate() {
    const bitrateValue = (this.audioBitrateSelect && this.audioBitrateSelect.value) || CONFIG.RECORDING.DEFAULT_AUDIO_BITRATE.toString();
    const bitrate = parseInt(bitrateValue, 10) || CONFIG.RECORDING.DEFAULT_AUDIO_BITRATE;
    return bitrate;
  }

  /**
   * Builds MediaStream constraints based on current UI selections
   * Handles audio-only mode, specific device selection, and video resolution preferences
   * @returns {MediaStreamConstraints} MediaStream constraints object for getUserMedia()
   *
   * Side effects:
   * - Queries DOM elements for current selections
   *
   * Invariants:
   * - Audio constraints always defined (required)
   * - Video constraints set to false in audio-only mode
   * - Resolution preferences always included when video is requested
   */
  buildConstraints() {
    const audioId = this.getSelectedDeviceId(this.micSelect);
    const isAudioOnly = this.audioOnlyCheckbox && this.audioOnlyCheckbox.checked;
    const videoId = isAudioOnly ? undefined : this.getSelectedDeviceId(this.camSelect);
    const resolution = this.getSelectedResolution();

    // Audio constraints: specific device or default
    const audio = audioId ? { deviceId: { exact: audioId } } : true;

    // Video constraints: disabled for audio-only, specific device or default with resolution
    const video = isAudioOnly ? false
      : (videoId ?
          { deviceId: { exact: videoId }, width: { ideal: resolution.width }, height: { ideal: resolution.height } }
          : { width: { ideal: resolution.width }, height: { ideal: resolution.height } });

    return { audio, video };
  }

  /**
   * Saves current device selections to localStorage for persistence across sessions
   * @returns {void}
   *
   * Side effects:
   * - Writes to localStorage using CONFIG.STORAGE_KEYS
   * - Removes keys when selections are cleared
   */
  persistSelection() {
    const micId = this.getSelectedDeviceId(this.micSelect);
    const camId = this.getSelectedDeviceId(this.camSelect);
    const resValue = this.resSelect && this.resSelect.value;
    const fpsValue = this.fpsSelect && this.fpsSelect.value;
    const bitrateValue = this.audioBitrateSelect && this.audioBitrateSelect.value;

    if (micId) localStorage.setItem(LS_KEYS.mic, micId);
    else localStorage.removeItem(LS_KEYS.mic);

    if (camId) localStorage.setItem(LS_KEYS.cam, camId);
    else localStorage.removeItem(LS_KEYS.cam);

    if (resValue) localStorage.setItem(LS_KEYS.res, resValue);
    else localStorage.removeItem(LS_KEYS.res);

    if (fpsValue) localStorage.setItem(LS_KEYS.fps, fpsValue);
    else localStorage.removeItem(LS_KEYS.fps);

    if (bitrateValue) localStorage.setItem(LS_KEYS.audioBitrate, bitrateValue);
    else localStorage.removeItem(LS_KEYS.audioBitrate);
  }

  /**
   * Requests media permissions to enable device enumeration with proper labels
   * Tries audio+video first, falls back to audio-only if video fails
   * Immediately stops tracks after permission grant to avoid keeping devices active
   * @returns {Promise<void>}
   *
   * Side effects:
   * - Requests browser media permissions
   * - Briefly activates devices then immediately stops them
   *
   * Invariants:
   * - Never leaves devices active after call completes
   * - Silent failure is acceptable (devices will show generic names)
   */
  async ensurePermissions() {
    try {
      // Try to get both audio and video permissions
      const tmp = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      tmp.getTracks().forEach(t => t.stop());  // Stop immediately, just needed for permissions
    } catch (e) {
      try {
        // Fallback: audio-only permissions
        const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });
        tmp.getTracks().forEach(t => t.stop());
      } catch {
        // If both fail, continue anyway - devices will show as "Camera (abc123...)"
      }
    }
  }

  /**
   * Populates device selection dropdowns with available audio/video devices
   * Restores previously selected devices from localStorage if they're still available
   * @returns {Promise<void>}
   *
   * Side effects:
   * - Populates micSelect and camSelect dropdowns
   * - Reads from localStorage to restore previous selections
   * - Updates device UI state based on available devices
   * - Calls updateDeviceUIState with noCameras flag
   *
   * Invariants:
   * - Always adds 'System default' option as first entry
   * - Only restores saved device if it still exists in enumerated devices
   */
  async loadDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audios = devices.filter(d => d.kind === 'audioinput');
    const videos = devices.filter(d => d.kind === 'videoinput');

    // Build microphone dropdown
    if (this.micSelect) {
      this.micSelect.innerHTML = '';
      const optA = document.createElement('option');
      optA.value = 'default';
      optA.textContent = 'System default';
      this.micSelect.appendChild(optA);

      audios.forEach(d => {
        const o = document.createElement('option');
        o.value = d.deviceId;
        // Use device label if available, otherwise show truncated ID
        o.textContent = d.label || `Microphone (${d.deviceId.slice(0, 6)}…)`;
        this.micSelect.appendChild(o);
      });
    }

    // Build camera dropdown
    if (this.camSelect) {
      this.camSelect.innerHTML = '';
      const optV = document.createElement('option');
      optV.value = 'default';
      optV.textContent = 'System default';
      this.camSelect.appendChild(optV);

      videos.forEach(d => {
        const o = document.createElement('option');
        o.value = d.deviceId;
        o.textContent = d.label || `Camera (${d.deviceId.slice(0, 6)}…)`;
        this.camSelect.appendChild(o);
      });
    }

    // Restore previously selected devices if they still exist
    const savedMic = localStorage.getItem(LS_KEYS.mic);
    const savedCam = localStorage.getItem(LS_KEYS.cam);
    const savedRes = localStorage.getItem(LS_KEYS.res);
    const savedFps = localStorage.getItem(LS_KEYS.fps);
    const savedBitrate = localStorage.getItem(LS_KEYS.audioBitrate);

    if (savedMic && this.micSelect && [...this.micSelect.options].some(o => o.value === savedMic)) {
      this.micSelect.value = savedMic;
    }
    if (savedCam && this.camSelect && [...this.camSelect.options].some(o => o.value === savedCam)) {
      this.camSelect.value = savedCam;
    }
    if (savedRes && this.resSelect && [...this.resSelect.options].some(o => o.value === savedRes)) {
      this.resSelect.value = savedRes;
    }
    if (savedFps && this.fpsSelect && [...this.fpsSelect.options].some(o => o.value === savedFps)) {
      this.fpsSelect.value = savedFps;
    }
    if (savedBitrate && this.audioBitrateSelect && [...this.audioBitrateSelect.options].some(o => o.value === savedBitrate)) {
      this.audioBitrateSelect.value = savedBitrate;
    }

    // Update UI state based on audio-only mode and available devices
    this.updateDeviceUIState(videos.length === 0);
  }

  /**
   * Updates the state of device selection UI elements
   * @param {boolean} [noCameras=false] - Whether cameras are available
   * @param {boolean} [isRecording=false] - Whether recording is currently active
   * @returns {void}
   *
   * Side effects:
   * - Enables/disables camera, resolution, and framerate dropdowns
   * - Enables/disables audio bitrate dropdown based on recording state
   *
   * Invariants:
   * - Camera/resolution/fps disabled when: audio-only OR no cameras OR recording
   * - Audio bitrate disabled only when recording
   */
  updateDeviceUIState(noCameras = false, isRecording = false) {
    if (this.camSelect && this.resSelect && this.fpsSelect && this.audioOnlyCheckbox) {
      // Disable camera, resolution, and framerate selection if in audio-only mode, no cameras available, or recording
      this.camSelect.disabled = this.audioOnlyCheckbox.checked || noCameras;
      // Resolution and framerate dropdowns should be disabled if: audio-only OR no cameras OR recording is active
      this.resSelect.disabled = this.audioOnlyCheckbox.checked || noCameras || isRecording;
      this.fpsSelect.disabled = this.audioOnlyCheckbox.checked || noCameras || isRecording;

  // Device UI state updated (debug log removed)
    }

    // Audio bitrate should be disabled during recording to prevent mid-recording changes
    if (this.audioBitrateSelect) {
      this.audioBitrateSelect.disabled = isRecording;
    }
  }

  /**
   * Get the currently selected microphone device ID
   * @returns {string | undefined} Device ID or undefined for default
   */
  getSelectedMicId() {
    return this.getSelectedDeviceId(this.micSelect);
  }

  /**
   * Get the currently selected camera device ID
   * @returns {string | undefined} Device ID or undefined for default
   */
  getSelectedCamId() {
    return this.getSelectedDeviceId(this.camSelect);
  }

  /**
   * Check if audio-only mode is enabled
   * @returns {boolean} True if audio-only mode is selected
   */
  isAudioOnly() {
    return (this.audioOnlyCheckbox && this.audioOnlyCheckbox.checked) || false;
  }
}

// Create a singleton instance
export const deviceManager = new DeviceManager();