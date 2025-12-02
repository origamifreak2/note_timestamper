import { describe, it, expect, vi } from 'vitest';
import { errorBoundary } from '../src/modules/errorBoundary.js';
import { ERROR_CODES } from '../src/config.js';
import { createError } from '../src/modules/utils.js';

describe('errorBoundary', () => {
  // Provide a fake status element (simulate DOM element)
  const statusEl = { textContent: '', style: {} };
  errorBoundary.init(statusEl);

  it('maps coded device not found error to camera not found message', () => {
    const err = createError(ERROR_CODES.DEVICE_NOT_FOUND, 'Device not found');
    const msg = errorBoundary.mapErrorToMessage(err);
    // Message should include phrase about camera device found -> verify contains camera and found
    expect(msg.toLowerCase()).toContain('camera');
    expect(msg.toLowerCase()).toContain('found');
  });

  it('maps generic timeout to IPC timeout message', () => {
    const err = new Error('some IPC call timed out');
    const msg = errorBoundary.mapErrorToMessage(err);
    expect(msg.toLowerCase()).toContain('timed out');
  });

  it('wrapAsync retries then succeeds', async () => {
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts++;
      if (attempts < 2) throw new Error('fail first');
      return 'ok';
    });
    const result = await errorBoundary.wrapAsync(fn, {
      operationName: 'retryOp',
      maxRetries: 1,
      timeout: 0,
    });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('wrapAsync throws after exhausting retries', async () => {
    const fn = vi.fn(async () => {
      throw new Error('always fails');
    });
    await expect(
      errorBoundary.wrapAsync(fn, { operationName: 'alwaysFail', maxRetries: 1, timeout: 0 })
    ).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(statusEl.textContent.toLowerCase()).toContain('failed');
  });
});
