
/**
 * @file Utility functions for the Note Timestamper application
 * Common helper functions used throughout the application
 *
 * =====================
 * Public API Surface
 * =====================
 * Methods:
 *   - formatTime(s: number): string
 *       Formats seconds as MM:SS.CC for timestamp display.
 *   - arrayBufferToBase64(ab: ArrayBuffer): string
 *       Converts ArrayBuffer to base64 string for HTML embedding.
 *   - sleep(ms: number): Promise<void>
 *       Promise-based sleep/delay utility.
 *   - withTimeout(promise: Promise, ms: number, errorMsg?: string): Promise<any>
 *       Wraps a promise with a timeout, rejects on timeout.
 *   - createError(code: string, message?: string, cause?: any): Error
 *       Creates an Error object with code/message/cause properties.
 *
 * Internal helpers are marked 'Internal'.
 * Invariants and side effects are documented per method.
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
 * Properly clears timeout handle when promise resolves to prevent memory leaks
 * @param {Promise} promise - The promise to wrap with a timeout
 * @param {number} ms - Timeout in milliseconds
 * @param {string} errorMsg - Error message to use if timeout occurs
 * @returns {Promise} Promise that resolves with the original result or rejects on timeout
 */
export function withTimeout(promise, ms, errorMsg = 'Operation timed out') {
  let timeoutHandle;

  // Create timeout promise that can be cancelled
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(errorMsg));
    }, ms);
  });

  // Race the promises and clear timeout when done
  return Promise.race([
    promise.then((result) => {
      clearTimeout(timeoutHandle);
      return result;
    }).catch((error) => {
      clearTimeout(timeoutHandle);
      throw error;
    }),
    timeoutPromise
  ]);
}

/**
 * Creates an Error object with a standardized code and optional cause
 * Use for throwing errors from lower layers that the error boundary can map.
 * @param {string} code - One of `ERROR_CODES` values
 * @param {string} [message] - Optional override message
 * @param {any} [cause] - Optional underlying error or context
 * @returns {Error & { code: string, cause?: any }} Error with code property
 */
export function createError(code, message = '', cause = undefined) {
  const err = new Error(message || code);
  // @ts-ignore - augment with code for standardized handling
  err.code = code;
  // Attach cause if provided (kept lightweight)
  if (cause !== undefined) {
    // @ts-ignore
    err.cause = cause;
  }
  return err;
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