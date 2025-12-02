// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import Quill from 'quill';
import { formatTime } from '../src/modules/utils.js';

// Set global Quill before dynamically importing custom blots module
// so that its top-level references to Quill succeed.
// Vitest supports top-level await.
// Provide minimal global to satisfy module.
globalThis.Quill = Quill;
const { registerCustomBlots } = await import('../src/editor/customBlots.js');

// Register blots before tests
registerCustomBlots();

describe('TimestampBlot', () => {
  it('creates button with timestamp and derives value', () => {
    const TimestampBlot = Quill.import('formats/timestamp');
    const node = TimestampBlot.create({ ts: 12.34, label: formatTime(12.34) });
    expect(node.tagName).toBe('BUTTON');
    expect(node.dataset.ts).toBe('12.34');
    const value = TimestampBlot.value(node);
    expect(value.ts).toBe(12.34);
    expect(value.label).toBe(formatTime(12.34));
  });
});

describe('CustomImage blot', () => {
  it('creates image from string with dimensions', () => {
    const ImageBlot = Quill.import('formats/image');
    const node = ImageBlot.create('http://example.com/a.png|400x300');
    expect(node.tagName).toBe('IMG');
    expect(node.getAttribute('src')).toBe('http://example.com/a.png');
    expect(node.style.width).toBe('400px');
    expect(node.style.height).toBe('300px');
    const val = ImageBlot.value(node);
    expect(val).toBe('http://example.com/a.png|400x300');
  });

  it('creates image from object with fabricJSON', () => {
    const ImageBlot = Quill.import('formats/image');
    const node = ImageBlot.create({
      src: 'data:image/png;base64,AAA',
      width: 250,
      height: 180,
      fabricJSON: '{"objects":[]}',
    });
    expect(node.getAttribute('data-fabric-json')).toBe('{"objects":[]}');
    expect(node.classList.contains('editable-drawing')).toBe(true);
    const val = ImageBlot.value(node);
    expect(val.fabricJSON).toBe('{"objects":[]}');
    expect(val.width).toBe(250);
    expect(val.height).toBe(180);
  });
});
