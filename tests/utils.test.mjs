import { describe, it, expect } from 'vitest';
import { formatTime, withTimeout, createError, sleep } from '../src/modules/utils.js';

describe('utils', () => {
  it('formats time correctly', () => {
    expect(formatTime(0)).toBe('00:00.00');
    expect(formatTime(5.32)).toBe('00:05.32');
    expect(formatTime(65.7)).toBe('01:05.70');
    expect(formatTime(600.99)).toBe('10:00.99');
  });

  it('withTimeout resolves before timeout', async () => {
    const result = await withTimeout(sleep(10).then(()=> 'done'), 100, 'timeout');
    expect(result).toBe('done');
  });

  it('withTimeout rejects on timeout', async () => {
    await expect(withTimeout(sleep(50), 10, 'too slow')).rejects.toThrow('too slow');
  });

  it('createError sets code and message', () => {
    const err = createError('TEST_CODE', 'Test message');
    expect(err.code).toBe('TEST_CODE');
    expect(err.message).toBe('Test message');
  });
});
