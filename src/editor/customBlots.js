/**
 * @fileoverview Custom Quill.js blots for timestamps and images
 * Defines custom embed types for enhanced editor functionality
 */

import { formatTime } from '../modules/utils.js';

const Delta = Quill.import('delta');
const Embed = Quill.import('blots/embed');
const BlockEmbed = Quill.import('blots/block/embed');

/**
 * Custom Quill.js blot for embedding clickable timestamps in the editor
 * Creates <button> elements that store timestamp data and jump to that time when clicked
 */
export class TimestampBlot extends Embed {
  static blotName = 'timestamp';    // Internal Quill name for this blot type
  static tagName = 'BUTTON';        // HTML tag to create
  static className = 'ts';          // CSS class name

  /**
   * Creates a new timestamp button element
   * @param {Object} value - Object with ts (timestamp in seconds) and label properties
   * @returns {HTMLButtonElement} The created button element
   */
  static create(value) {
    const node = super.create();
    const ts = Number((value && value.ts) || 0);
    const label = (value && value.label) || formatTime(ts);

    // Configure button attributes
    node.setAttribute('type', 'button');
    node.setAttribute('contenteditable', 'false');  // Prevent editing the button text
    node.dataset.ts = String(ts);                   // Store timestamp data
    node.textContent = label;                       // Display formatted time
    return node;
  }

  /**
   * Extracts timestamp data from an existing button element
   * @param {HTMLButtonElement} node - The button element to read from
   * @returns {Object} Object with ts and label properties
   */
  static value(node) {
    return {
      ts: Number(node.dataset.ts || 0),
      label: node.textContent || formatTime(Number(node.dataset.ts || 0))
    };
  }
}

/**
 * Custom Image blot that supports width and height attributes
 * Extends Quill's default image handling to persist dimensions
 */
export class CustomImage extends BlockEmbed {
  static blotName = 'image';
  static tagName = 'img';

  /**
   * Creates a new image element with optional dimensions and fabric data
   * @param {string|Object} value - Image source or object with src, dimensions, and fabricJSON
   * @returns {HTMLImageElement} The created image element
   */
  static create(value) {
    const node = super.create();

    if (typeof value === 'string') {
      // Handle both simple URL and URL with dimensions (format: "url|widthxheight" or "url|width")
      const [src, dimensions] = value.split('|');
      node.setAttribute('src', src);

      if (dimensions) {
        const [width, height] = dimensions.split('x');
        if (width) {
          node.style.width = `${width}px`;
        }
        if (height) {
          node.style.height = `${height}px`;
        } else {
          node.style.height = 'auto';
        }
      }
    } else if (typeof value === 'object' && value.src) {
      // Handle object format: { src: "url", width: 100, height: 200, fabricJSON: "..." }
      node.setAttribute('src', value.src);
      if (value.width) {
        node.style.width = `${value.width}px`;
      }
      if (value.height) {
        node.style.height = `${value.height}px`;
      } else {
        node.style.height = 'auto';
      }
      // Store fabric JSON for editable drawings
      if (value.fabricJSON) {
        node.setAttribute('data-fabric-json', value.fabricJSON);
        node.classList.add('editable-drawing');
        node.style.cursor = 'pointer';
        node.title = 'Double-click to edit drawing';
      }
    }

    return node;
  }

  /**
   * Extracts image data from an existing image element
   * @param {HTMLImageElement} node - The image element to read from
   * @returns {string|Object} Image source with optional dimensions, or object with fabricJSON
   */
  static value(node) {
    const src = node.getAttribute('src');
    const width = node.style.width ? parseInt(node.style.width) : null;
    const height = (node.style.height && node.style.height !== 'auto') ? parseInt(node.style.height) : null;
    const fabricJSON = node.getAttribute('data-fabric-json');

    // If has fabric data, return object format to preserve it
    if (fabricJSON) {
      return {
        src: src,
        width: width,
        height: height,
        fabricJSON: fabricJSON
      };
    }

    // Legacy format for regular images
    if (width || height) {
      // Return format with dimensions
      if (height) {
        return `${src}|${width}x${height}`;
      } else {
        return `${src}|${width}`;
      }
    }

    return src;
  }
}

/**
 * Registers custom blots with Quill
 * Call this function to enable custom timestamp and image functionality
 */
export function registerCustomBlots() {
  Quill.register(TimestampBlot);
  Quill.register(CustomImage, true);
}