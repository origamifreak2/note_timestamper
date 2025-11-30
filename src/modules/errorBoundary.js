/**
 * @file Error Boundary System
 * Wraps critical operations with timeout protection, retry logic, and graceful degradation
 * Provides structured error logging and standardized user notifications
 *
 * =====================
 * Public API Surface
 * =====================
 * Methods:
 *   - init(statusElement: HTMLElement): void
 *       Initializes error boundary with status element.
 *   - logError(operation, error, attemptNumber, recoveryAction, context?): void
 *       Logs structured error entry for analytics.
 *   - classifyError(error: Error): string
 *       Classifies error into standard error type.
 *   - mapErrorToMessage(error: Error): string
 *       Maps error to user-friendly message.
 *   - updateStatus(message: string, isError?: boolean): void
 *       Updates status bar with message.
 *   - async showErrorDialog(message, title?, options?): Promise<any>
 *       Shows modal error dialog with retry/cancel options.
 *   - async wrapAsync(fn, options?): Promise<any>
 *       Wraps async operation with timeout and retry logic.
 *   - async wrapIPC(fn, options?): Promise<any>
 *       Wraps IPC operations with timeout (NOT for file pickers).
 *   - async wrapDeviceAccess(fn, options?): Promise<any>
 *       Wraps device access with retry and recovery dialog.
 *
 * Internal helpers: loadErrorPreferences, saveErrorPreferences.
 * Invariants and side effects are documented per method.
 */

import { CONFIG, ERRORS, ERROR_CODES } from '../config.js';
import { sleep, withTimeout } from './utils.js';

/**
 * Error log entry structure for telemetry
 * @typedef {Object} ErrorLogEntry
 * @property {string} timestamp - ISO 8601 timestamp
 * @property {string} operation - Name of the operation that failed
 * @property {string} errorType - Classification of error (e.g., 'IPC_TIMEOUT', 'DEVICE_ACCESS')
 * @property {string} message - Error message
 * @property {number} attemptNumber - Which attempt failed (for retries)
 * @property {string} recoveryAction - Action taken ('retry', 'abort', 'fallback', 'user_cancelled')
 * @property {Object} context - Additional context (device IDs, file paths, etc.)
 */

/**
 * ErrorBoundary class - Singleton wrapper for critical operations
 */
class ErrorBoundary {
  constructor() {
    /** @type {HTMLElement|null} Status bar element for user notifications */
    this.statusElement = null;

    /** @type {ErrorLogEntry[]} Structured error logs for analytics */
    this.errorLog = [];

    /** @type {number} Maximum error log entries to keep in memory */
    this.maxLogSize = 100;

    /** @type {Map<string, number>} Retry attempt tracking per operation */
    this.retryAttempts = new Map();
  }

  /**
   * Initialize the error boundary with status element reference
   * @param {HTMLElement} statusElement - DOM element for displaying status messages
   */
  init(statusElement) {
    this.statusElement = statusElement;
    this.loadErrorPreferences();
  }

  /**
   * Load user preferences for error recovery from localStorage
   * @private
   */
  loadErrorPreferences() {
    try {
      const prefs = localStorage.getItem(CONFIG.ERROR_BOUNDARY.STORAGE_KEY);
      if (prefs) {
        this.preferences = JSON.parse(prefs);
      } else {
        this.preferences = {
          deviceRetryEnabled: true,
          ipcRetryEnabled: true,
          showRecoveryDialogs: true
        };
      }
    } catch (e) {
      console.error('Failed to load error preferences:', e);
      this.preferences = {
        deviceRetryEnabled: true,
        ipcRetryEnabled: true,
        showRecoveryDialogs: true
      };
    }
  }

  /**
   * Save user preferences for error recovery to localStorage
   * @private
   */
  saveErrorPreferences() {
    try {
      localStorage.setItem(
        CONFIG.ERROR_BOUNDARY.STORAGE_KEY,
        JSON.stringify(this.preferences)
      );
    } catch (e) {
      console.error('Failed to save error preferences:', e);
    }
  }

  /**
   * Log structured error for telemetry
   * @param {string} operation - Name of the operation
   * @param {Error} error - The error object
   * @param {number} attemptNumber - Current attempt number
   * @param {string} recoveryAction - Action taken
   * @param {Object} context - Additional context
   * @private
   */
  logError(operation, error, attemptNumber, recoveryAction, context = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      operation,
      errorType: this.classifyError(error),
      message: error.message || String(error),
      attemptNumber,
      recoveryAction,
      context
    };

    this.errorLog.push(entry);

    // Trim log if it exceeds max size
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }

    // Console log for development
    console.error(`[ErrorBoundary] ${operation}:`, {
      ...entry,
      stack: error.stack
    });
  }

  /**
   * Classify error type for structured logging
   * @param {Error} error - The error to classify
   * @returns {string} Error type classification
   * @private
   */
  classifyError(error) {
    const msg = error.message || '';

    // Prefer explicit error codes when available
    if (error && /** @type {any} */(error).code) {
      return /** @type {any} */(error).code;
    }

    // IPC errors
    if (msg.includes('IPC') || msg.includes('timed out')) {
      return 'IPC_TIMEOUT';
    }

    // Device access errors
    if (error.name === 'NotAllowedError') return 'DEVICE_PERMISSION_DENIED';
    if (error.name === 'NotFoundError') return 'DEVICE_NOT_FOUND';
    if (error.name === 'NotReadableError') return 'DEVICE_IN_USE';
    if (msg.includes('Camera') || msg.includes('Microphone')) {
      return 'DEVICE_ACCESS_FAILED';
    }

    // File system errors
    if (msg.includes('disk') || msg.includes('file') || msg.includes('write')) {
      return 'FILE_SYSTEM_ERROR';
    }

    // Codec/MediaRecorder errors
    if (msg.includes('codec') || msg.includes('MIME')) {
      return 'CODEC_ERROR';
    }

    return 'UNKNOWN';
  }

  /**
   * Map internal error codes to user-facing messages
   * @param {Error} error - Error possibly containing a `code`
   * @returns {string} Message to show to the user
   * @private
   */
  mapErrorToMessage(error) {
    const code = /** @type {any} */(error).code || this.classifyError(error);

    switch (code) {
      case ERROR_CODES.DEVICE_PERMISSION_DENIED:
        return ERRORS.CAMERA.NOT_ALLOWED; // camera/mic share wording
      case ERROR_CODES.DEVICE_NOT_FOUND:
        return ERRORS.CAMERA.NOT_FOUND;
      case ERROR_CODES.DEVICE_IN_USE:
        return ERRORS.CAMERA.NOT_READABLE;
      case ERROR_CODES.CAMERA_INIT_TIMEOUT:
        return ERRORS.CAMERA.INIT_TIMEOUT;
      case ERROR_CODES.CAMERA_SWITCH_FAILED:
        return ERRORS.CAMERA.SWITCH_FAILED;

      case ERROR_CODES.MIC_SWITCH_FAILED:
        return ERRORS.MICROPHONE.SWITCH_FAILED;
      case ERROR_CODES.MIC_CONNECT_FAILED:
        return ERRORS.MICROPHONE.CONNECT_FAILED;

      case ERROR_CODES.RECORDING_START_FAILED:
        return ERRORS.RECORDING.START_FAILED;
      case ERROR_CODES.CODEC_UNSUPPORTED:
        return ERRORS.RECORDING.START_FAILED;

      case ERROR_CODES.IPC_TIMEOUT:
        return ERRORS.IPC.TIMEOUT;
      case ERROR_CODES.FILE_SYSTEM_ERROR:
        return ERRORS.IPC.FILE_SYSTEM;
      case ERROR_CODES.SESSION_VALIDATION_FAILED:
        return 'Loaded session has validation issues. Some data may be incomplete.';

      default:
        // Fallback based on rough classification
        const type = this.classifyError(error);
        if (type === 'DEVICE_PERMISSION_DENIED') return ERRORS.CAMERA.NOT_ALLOWED;
        if (type === 'DEVICE_NOT_FOUND') return ERRORS.CAMERA.NOT_FOUND;
        if (type === 'DEVICE_IN_USE') return ERRORS.CAMERA.NOT_READABLE;
        if (type === 'IPC_TIMEOUT') return ERRORS.IPC.TIMEOUT;
        if (type === 'FILE_SYSTEM_ERROR') return ERRORS.IPC.FILE_SYSTEM;
        return 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Update status bar with user-friendly message
   * @param {string} message - Message to display
   * @param {boolean} isError - Whether this is an error message (affects styling)
   * @private
   */
  updateStatus(message, isError = false) {
    if (this.statusElement) {
      this.statusElement.textContent = message;
      if (isError) {
        this.statusElement.style.color = '#d32f2f';
      } else {
        this.statusElement.style.color = '';
      }
    }
  }

  /**
   * Show modal dialog for critical errors that require user decision
   * @param {string} message - Error message
   * @param {string} title - Dialog title
   * @param {Object} options - Dialog options
   * @returns {Promise<boolean>} User's decision (true for retry/confirm, false for cancel)
   * @private
   */
  async showErrorDialog(message, title = 'Error', options = {}) {
    const {
      showRetry = true,
      showDontAskAgain = false,
      preferenceKey = null
    } = options;

    // Check if user has disabled this dialog
    if (preferenceKey && !this.preferences.showRecoveryDialogs) {
      return this.preferences[preferenceKey] || false;
    }

    // Build dialog message
    let fullMessage = message;
    if (showRetry) {
      fullMessage += '\n\nWould you like to retry?';
    }

    const userConfirmed = window.confirm(fullMessage);

    // Save preference if "don't ask again" was requested
    if (showDontAskAgain && preferenceKey) {
      // For this simple implementation, we just save the user's choice
      // A more advanced version could show a checkbox in a custom dialog
      this.preferences[preferenceKey] = userConfirmed;
      this.saveErrorPreferences();
    }

    return userConfirmed;
  }

  /**
   * Wrap any async function with timeout and retry logic
   * @param {Function} fn - Async function to wrap
   * @param {Object} options - Configuration options
   * @returns {Promise<any>} Result of the function
   */
  async wrapAsync(fn, options = {}) {
    const {
      operationName = 'async operation',
      timeout = CONFIG.ERROR_BOUNDARY.DEFAULT_TIMEOUT,
      maxRetries = 0,
      retryDelay = CONFIG.ERROR_BOUNDARY.RETRY_DELAY,
      onError = null,
      context = {}
    } = options;

    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Add timeout wrapper if specified
        if (timeout > 0) {
          return await withTimeout(
            fn(),
            timeout,
            `${operationName} timed out after ${timeout}ms`
          );
        } else {
          return await fn();
        }
      } catch (error) {
        lastError = error;

        // Log the error
        const recoveryAction = attempt < maxRetries ? 'retry' : 'abort';
        this.logError(operationName, error, attempt + 1, recoveryAction, context);

        // If this was the last retry, break
        if (attempt === maxRetries) {
          break;
        }

        // Wait before retrying (exponential backoff)
        const delay = retryDelay * Math.pow(2, attempt);
        await sleep(delay);

        // Update status
        this.updateStatus(`Retrying ${operationName}... (${attempt + 1}/${maxRetries})`, false);
      }
    }

    // All retries failed
    const msg = this.mapErrorToMessage(lastError);
    this.updateStatus(`${operationName} failed: ${msg}`, true);

    // Call custom error handler if provided
    if (onError) {
      await onError(lastError);
    }

    // Re-throw the error
    throw lastError;
  }

  /**
   * Wrap IPC operations with timeout and retry logic
   * @param {Function} ipcFn - IPC function to call (e.g., () => window.api.saveSession(...))
   * @param {Object} options - Configuration options
   * @returns {Promise<any>} Result from IPC call
   */
  async wrapIPC(ipcFn, options = {}) {
    const {
      operationName = 'IPC operation',
      context = {}
    } = options;

    return this.wrapAsync(ipcFn, {
      operationName,
      timeout: CONFIG.ERROR_BOUNDARY.IPC_TIMEOUT,
      maxRetries: this.preferences.ipcRetryEnabled ? CONFIG.ERROR_BOUNDARY.IPC_MAX_RETRIES : 0,
      retryDelay: CONFIG.ERROR_BOUNDARY.RETRY_DELAY,
      context,
      onError: async (error) => {
        // Show modal for IPC failures (blocking errors)
        const msg = this.mapErrorToMessage(error);
        await this.showErrorDialog(
          `${operationName} failed: ${msg}\n\nThis may indicate a problem with file system access or the main process.`,
          'Operation Failed',
          { showRetry: false }
        );
      }
    });
  }

  /**
   * Wrap device access operations with retry and recovery dialog
   * @param {Function} deviceFn - Device access function (e.g., () => mixerSystem.createMixerStream())
   * @param {Object} options - Configuration options
   * @returns {Promise<any>} Result from device access
   */
  async wrapDeviceAccess(deviceFn, options = {}) {
    const {
      operationName = 'device access',
      deviceManager = null,
      context = {}
    } = options;

    let lastError = null;

    try {
      // First attempt
      return await deviceFn();
    } catch (error) {
      lastError = error;
      this.logError(operationName, error, 1, 'showing_dialog', context);

      // Check if retries are enabled
      if (!this.preferences.deviceRetryEnabled) {
        this.updateStatus(`${operationName} failed: ${this.mapErrorToMessage(error)}`, true);
        throw error;
      }

      // Show recovery dialog
      const shouldRetry = await this.showErrorDialog(
        `${error.message}\n\nThe device list will be refreshed before retrying.`,
        'Device Access Failed',
        {
          showRetry: true,
          preferenceKey: 'deviceRetryEnabled'
        }
      );

      if (!shouldRetry) {
        this.logError(operationName, error, 1, 'user_cancelled', context);
        this.updateStatus(`${operationName} cancelled by user`, true);
        throw error;
      }

      // Refresh device list if deviceManager provided
      if (deviceManager) {
        try {
          this.updateStatus('Refreshing device list...', false);
          await deviceManager.loadDevices();
        } catch (refreshError) {
          console.error('Failed to refresh devices:', refreshError);
          // Continue with retry anyway
        }
      }

      // Retry once
      try {
        this.updateStatus(`Retrying ${operationName}...`, false);
        const result = await deviceFn();
        this.logError(operationName, error, 2, 'retry_success', context);
        return result;
      } catch (retryError) {
        this.logError(operationName, retryError, 2, 'retry_failed', context);
        this.updateStatus(`${operationName} failed after retry: ${this.mapErrorToMessage(retryError)}`, true);
        throw retryError;
      }
    }
  }

  /**
   * Get error log for analytics/debugging
   * @returns {ErrorLogEntry[]} Array of error log entries
   */
  getErrorLog() {
    return [...this.errorLog];
  }

  /**
   * Clear error log
   */
  clearErrorLog() {
    this.errorLog = [];
  }

  /**
   * Export error log as JSON string
   * @returns {string} JSON string of error log
   */
  exportErrorLog() {
    return JSON.stringify(this.errorLog, null, 2);
  }
}

// Export singleton instance
export const errorBoundary = new ErrorBoundary();
