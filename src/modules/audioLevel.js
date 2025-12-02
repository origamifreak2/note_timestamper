/**
 * @file Audio level monitoring for microphone input
 * Provides visual feedback of audio levels during recording
 *
 * =====================
 * Public API Surface
 * =====================
 * Methods:
 *   - init(levelMeter: HTMLElement, levelFill: HTMLElement, levelText: HTMLElement): void
 *       Initializes audio level monitor with DOM references.
 *   - setAnalyser(analyser: AnalyserNode): void
 *       Sets up Web Audio analyser node for level detection.
 *   - updateAudioLevel(): void
 *       Updates audio level meter display (internal, auto-called).
 *   - start(): void
 *       Starts audio level monitoring loop.
 *   - stop(): void
 *       Stops audio level monitoring loop.
 *   - toggle(show: boolean): void
 *       Shows or hides audio level meter UI.
 *   - cleanup(): void
 *       Cleans up and resets audio level meter UI.
 *
 * Internal helpers are marked 'Internal'.
 * Invariants and side effects are documented per method.
 */

/**
 * =====================
 * Module Contract
 * =====================
 * Inputs:
 *   - DOM elements: levelMeter, levelFill, levelText
 *   - AnalyserNode (set via setAnalyser)
 *   - Update interval CONFIG.AUDIO.LEVEL_UPDATE_INTERVAL
 * Outputs:
 *   - Visual meter fill & percentage text
 * Side-effects:
 *   - Reads analyser frequency data; updates DOM styles/text
 *   - Allocates Uint8Array matching analyser.frequencyBinCount
 * Invariants:
 *   - Monitoring loop runs only when analyser present & start() called
 *   - stop()/cleanup always clears interval
 * Failure Modes:
 *   - None (early returns when analyser absent)
 */

/**
 * Audio level monitoring system
 * Provides real-time visual feedback of microphone input levels
 */
export class AudioLevelMonitor {
  constructor() {
    this.analyser = null;
    this.dataArray = null;
    this.timer = null;

    // DOM references
    this.levelMeter = null;
    this.levelFill = null;
    this.levelText = null;

    // Bind methods to preserve 'this' context
    this.updateAudioLevel = this.updateAudioLevel.bind(this);
  }

  /**
   * Initialize the audio level monitor with DOM references
   * @param {HTMLElement} levelMeter - Container element for the audio level meter
   * @param {HTMLElement} levelFill - Fill element showing the current level
   * @param {HTMLElement} levelText - Text element showing percentage
   */
  init(levelMeter, levelFill, levelText) {
    this.levelMeter = levelMeter;
    this.levelFill = levelFill;
    this.levelText = levelText;
  }

  /**
   * Sets up audio analysis with Web Audio API analyser node
   * @param {AnalyserNode} analyser - Web Audio analyser node for audio level detection
   */
  setAnalyser(analyser) {
    this.analyser = analyser;
    if (this.analyser) {
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    } else {
      this.dataArray = null;
    }
  }

  /**
   * Updates the audio level meter display with current microphone input level
   */
  updateAudioLevel() {
    if (!this.analyser || !this.dataArray) return;

    // Get frequency data from analyser
    this.analyser.getByteFrequencyData(this.dataArray);

    // Calculate average volume level
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    const average = sum / this.dataArray.length;

    // Convert to percentage (0-100)
    const percentage = Math.round((average / 255) * 100);

    // Update UI elements
    if (this.levelFill) {
      this.levelFill.style.width = `${percentage}%`;
    }
    if (this.levelText) {
      this.levelText.textContent = `${percentage}%`;
    }
  }

  /**
   * Starts the audio level monitoring timer
   */
  start() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.timer = setInterval(this.updateAudioLevel, 100); // Update every 100ms
  }

  /**
   * Stops the audio level monitoring timer and resets UI
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    // Reset UI
    if (this.levelFill) {
      this.levelFill.style.width = '0%';
    }
    if (this.levelText) {
      this.levelText.textContent = '0%';
    }
  }

  /**
   * Shows or hides the audio level meter
   * @param {boolean} show - Whether to show the meter
   */
  toggle(show) {
    if (this.levelMeter) {
      this.levelMeter.style.display = show ? 'block' : 'none';
    }
  }

  /**
   * Cleans up resources and stops monitoring
   */
  cleanup() {
    this.stop();
    this.analyser = null;
    this.dataArray = null;
  }
}

// Create a singleton instance
export const audioLevelMonitor = new AudioLevelMonitor();
