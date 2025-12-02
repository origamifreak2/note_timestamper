import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ERROR_CODES } from '../src/config.js';

// Mock window.api before importing zipUtils
const mockApi = {
  loadSession: vi.fn(),
  saveSession: vi.fn(),
};

// Set global window.api
globalThis.window = { api: mockApi };

// Now import zipUtils which depends on window.api
const { loadSessionWithCodes, saveSessionWithCodes } = await import('../src/modules/zipUtils.js');

describe('zipUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadSessionWithCodes', () => {
    it('returns session payload on success', async () => {
      const payload = { ok: true, notesHtml: '<p>test</p>', mediaArrayBuffer: new ArrayBuffer(8) };
      mockApi.loadSession.mockResolvedValue(payload);

      const result = await loadSessionWithCodes();
      expect(result).toEqual(payload);
      expect(mockApi.loadSession).toHaveBeenCalledTimes(1);
    });

    it('returns undefined on user cancellation (ok:false, no error)', async () => {
      mockApi.loadSession.mockResolvedValue({ ok: false });

      const result = await loadSessionWithCodes();
      expect(result).toBeUndefined();
    });

    it('throws coded error on load failure with error message', async () => {
      mockApi.loadSession.mockResolvedValue({ ok: false, error: 'File not readable' });

      await expect(loadSessionWithCodes()).rejects.toMatchObject({
        code: ERROR_CODES.FILE_SYSTEM_ERROR,
        message: 'File not readable',
      });
    });

    it('throws coded error when no response from IPC', async () => {
      mockApi.loadSession.mockResolvedValue(null);

      await expect(loadSessionWithCodes()).rejects.toMatchObject({
        code: ERROR_CODES.FILE_SYSTEM_ERROR,
        message: 'No response from session load',
      });
    });
  });

  describe('saveSessionWithCodes', () => {
    it('returns result on successful save', async () => {
      const payload = {
        noteHtml: '<p>test</p>',
        mediaFilePath: '/tmp/recording.webm',
        sessionId: 'abc',
      };
      const saveResult = { ok: true, path: '/saved/session.notepack' };
      mockApi.saveSession.mockResolvedValue(saveResult);

      const result = await saveSessionWithCodes(payload);
      expect(result).toEqual(saveResult);
      expect(mockApi.saveSession).toHaveBeenCalledWith(payload);
    });

    it('returns undefined on user cancellation (ok:false, no error)', async () => {
      mockApi.saveSession.mockResolvedValue({ ok: false });

      const result = await saveSessionWithCodes({ noteHtml: '<p>x</p>' });
      expect(result).toBeUndefined();
    });

    it('throws coded error on save failure with error message', async () => {
      mockApi.saveSession.mockResolvedValue({ ok: false, error: 'Disk full' });

      await expect(saveSessionWithCodes({ noteHtml: '<p>x</p>' })).rejects.toMatchObject({
        code: ERROR_CODES.FILE_SYSTEM_ERROR,
        message: 'Disk full',
      });
    });

    it('throws coded error when no response from IPC', async () => {
      mockApi.saveSession.mockResolvedValue(null);

      await expect(saveSessionWithCodes({ noteHtml: '<p>x</p>' })).rejects.toMatchObject({
        code: ERROR_CODES.FILE_SYSTEM_ERROR,
        message: 'No response from session save',
      });
    });
  });
});
