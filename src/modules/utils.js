/**
 * @fileoverview Utility functions for the Note Timestamper application
 * Common helper functions used throughout the application
 */

/**
 * Formats seconds as MM:SS.CC (minutes:seconds.centiseconds)
 * Used for timestamp display and timestamp button labels
 * @param {number} s - Time in seconds (can include fractional part)
 * @returns {string} Formatted time string like "02:34.56"
 */
export function formatTime(s) {
  const ms = Math.floor((s % 1) * 100);  // Extract centiseconds (0-99)
  s = Math.floor(s);                     // Get whole seconds
  const m = Math.floor(s / 60);          // Extract minutes
  const sec = s % 60;                    // Get remaining seconds
  const pad = (n) => String(n).padStart(2, '0');  // Zero-pad helper
  return `${pad(m)}:${pad(sec)}.${pad(ms)}`;
}

/**
 * Converts ArrayBuffer to base64 string for embedding in HTML
 * Used when exporting sessions as self-contained HTML files
 * @param {ArrayBuffer} ab - Binary data to convert
 * @returns {string} Base64-encoded string
 */
export function arrayBufferToBase64(ab) {
  const bytes = new Uint8Array(ab);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/**
 * Promise-based sleep function for adding delays
 * Used in recording stop process to ensure proper data flushing
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Resolves after the delay
 */
export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Wraps a promise with a timeout, rejecting if the promise doesn't resolve in time
 * Used for handling potentially hanging operations like broken webcam initialization
 * @param {Promise} promise - The promise to wrap with a timeout
 * @param {number} ms - Timeout in milliseconds
 * @param {string} errorMsg - Error message to use if timeout occurs
 * @returns {Promise} Promise that resolves with the original result or rejects on timeout
 */
export function withTimeout(promise, ms, errorMsg = 'Operation timed out') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(errorMsg)), ms)
    )
  ]);
}

/**
 * Detects if running on macOS (affects which modifier key to use)
 * @returns {boolean} True if on macOS
 */
export function isMac() {
  return navigator.platform.includes('Mac') || navigator.userAgent.includes('Mac');
}

/**
 * Calculates appropriate default dimensions for an image
 * Ensures images don't appear too large while maintaining aspect ratio
 * @param {string} dataUrl - Base64 data URL of the image
 * @returns {Promise<Object>} Object with width and height properties
 */
export async function calculateDefaultImageDimensions(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const naturalWidth = img.width;
      const naturalHeight = img.height;

      // Get editor container width for responsive sizing
      const editorContainer = document.querySelector('.ql-editor');
      const containerWidth = editorContainer ? editorContainer.offsetWidth : 600;

      // Set maximum width to 80% of container width, but at least 300px and at most 800px
      const maxWidth = Math.max(300, Math.min(800, containerWidth * 0.8));

      let targetWidth = naturalWidth;
      let targetHeight = naturalHeight;

      // If image is wider than max width, scale it down
      if (naturalWidth > maxWidth) {
        const aspectRatio = naturalHeight / naturalWidth;
        targetWidth = maxWidth;
        targetHeight = Math.round(maxWidth * aspectRatio);
      }

      // If image is very small, don't upscale it
      if (naturalWidth < 150) {
        targetWidth = naturalWidth;
        targetHeight = naturalHeight;
      }

      resolve({ width: targetWidth, height: targetHeight });
    };

    img.onerror = () => {
      // Fallback dimensions if image can't be loaded
      resolve({ width: 400, height: 300 });
    };

    img.src = dataUrl;
  });
}