// @ts-check
/**
 * @file Zip/session utility helpers with standardized coded errors
 * Provides lightweight wrappers for save/load IPC operations that surface
 * ERROR_CODES for consistent errorBoundary handling.
 *
 * =====================
 * Public API Surface
 * =====================
 * Functions:
 *   - async loadSessionWithCodes(): Promise<any>
 *       Wraps load-session IPC, throws coded errors on failure.
 *       Returns undefined on user cancellation (not an error).
 *   - async saveSessionWithCodes(payload: object): Promise<any|undefined>
 *       Wraps save-session IPC, throws coded errors on write failure.
 *       Returns undefined on user cancellation (not an error).
 *
 * These wrappers preserve user cancellation semantics while providing
 * standardized error codes for errorBoundary integration.
 */

import { ERROR_CODES } from '../config.js';
import { createError } from './utils.js';

/**
 * =====================
 * Module Contract
 * =====================
 * Inputs:
 *   - IPC handlers: window.api.loadSession(), window.api.saveSession(payload)
 *   - Payload object containing noteHtml, mediaFilePath, sessionId, etc.
 * Outputs:
 *   - Successful result objects from IPC calls
 *   - undefined on user cancellation (non-error path)
 *   - Thrown coded errors for internal failures
 * Side-effects:
 *   - None (pure wrapping layer)
 * Invariants:
 *   - Cancellation (ok:false & no error) never throws; returns undefined
 *   - All failure throws use ERROR_CODES.FILE_SYSTEM_ERROR
 * Failure Modes:
 *   - FILE_SYSTEM_ERROR (no response / IPC error)
 *   - User cancellation (graceful, non-throw)
 */

/**
 * Wrap load-session IPC result and throw coded errors when appropriate.
 * User cancellation (ok:false with no error) is not treated as failure.
 * @returns {Promise<any>} Resolved successful session payload
 * @throws {Error & { code: string }} On load failure
 */
export async function loadSessionWithCodes() {
  const result = await window.api.loadSession();
  if (!result) {
    throw createError(ERROR_CODES.FILE_SYSTEM_ERROR, 'No response from session load');
  }
  if (!result.ok) {
    // Canceled selection → silent return undefined
    if (!result.error) return undefined;
    throw createError(ERROR_CODES.FILE_SYSTEM_ERROR, result.error || 'Failed to load session');
  }
  return result;
}

/**
 * Wrapper for save-session IPC.
 * Preserves the cancellation behavior (returns undefined on user cancel) but
 * throws coded errors for internal write failures.
 * @param {object} payload - Save session payload
 * @returns {Promise<any|undefined>} Successful result or undefined if cancelled
 * @throws {Error & { code: string }} On write failure
 */
export async function saveSessionWithCodes(payload) {
  const result = await window.api.saveSession(payload);
  if (!result) {
    throw createError(ERROR_CODES.FILE_SYSTEM_ERROR, 'No response from session save');
  }
  if (!result.ok) {
    // User cancelled → do not throw
    if (!result.error) return undefined;
    throw createError(ERROR_CODES.FILE_SYSTEM_ERROR, result.error || 'Failed to save session');
  }
  return result;
}
