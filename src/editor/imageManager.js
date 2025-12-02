// @ts-check

/**
 * @file Image handling functionality for the editor
 * Handles image insertion, drag-and-drop, and dimension management
 *
 * =====================
 * Public API Surface
 * =====================
 * Methods:
 *   - init(quill: Quill): void
 *       Initializes image manager with Quill instance, sets up DnD and paste handlers.
 *   - async insertDrawingImage(dataUrl: string, fabricJSON: string): Promise<void>
 *       Inserts drawing image with fabric JSON into editor.
 *   - async insertDataUrlImage(dataUrl: string): Promise<void>
 *       Inserts image from data URL into editor.
 *   - async handleFiles(files: FileList): Promise<void>
 *       Handles dropped or pasted image files.
 *   - setupDragAndDrop(): void
 *       Sets up drag-and-drop event handlers for images.
 *   - setupPasteHandler(): void
 *       Sets up paste event handlers for images.
 *   - updateImageInQuill(img: HTMLImageElement): void
 *       Updates image embed in Quill after edit.
 *
 * Internal helpers are marked 'Internal'.
 * Invariants and side effects are documented per method.
 */

/**
 * =====================
 * Module Contract
 * =====================
 * Inputs:
 *   - Quill instance (init)
 *   - Data URLs & Fabric JSON (drawings) / FileList for paste & drag
 *   - Dimension calculation utility (calculateDefaultImageDimensions)
 * Outputs:
 *   - Inserted/updated CustomImage blot embeds with metadata
 * Side-effects:
 *   - Mutates editor contents; attaches drag & paste handlers
 * Invariants:
 *   - Drawing images stored with object format preserving fabricJSON
 *   - Fallback insertion used on dimension calc errors
 * Failure Modes:
 *   - Oversized/invalid files produce silent no-op or reduced insertion; no throws
 */

import { calculateDefaultImageDimensions } from '../modules/utils.js';

/**
 * Image manager for handling images in the Quill editor
 */
export class ImageManager {
  constructor() {
    this.quill = null;
  }

  /**
   * Initialize the image manager with Quill instance
   * @param {any} quill - Quill editor instance
   * @returns {void}
   *
   * Side effects:
   * - Stores reference to Quill instance
   * - Sets up drag-and-drop handlers
   * - Sets up paste handlers
   */
  init(quill) {
    this.quill = quill;

    this.setupDragAndDrop();
    this.setupPasteHandler();
  }

  /**
   * Inserts a drawing with embedded Fabric.js JSON into the editor
   * @param {string} dataUrl - Base64 data URL of the drawing image
   * @param {string} fabricJSON - Fabric.js canvas JSON data for re-editing
   * @returns {Promise<void>}
   *
   * Side effects:
   * - Inserts image embed into Quill at cursor position
   * - Moves cursor after inserted image
   *
   * Invariants:
   * - Uses object format to preserve fabricJSON
   * - Calculates default dimensions to prevent oversized exports
   * - Falls back to insertion without dimensions on error
   */
  async insertDrawingImage(dataUrl, fabricJSON) {
    if (!this.quill) return;

    try {
      // Calculate appropriate default dimensions
      const dimensions = await calculateDefaultImageDimensions(dataUrl);

      // Get current selection or default to end of document
      const range = this.quill.getSelection(true) || { index: this.quill.getLength(), length: 0 };

      // Create image value with dimensions and fabric data
      const imageValue = {
        src: dataUrl,
        width: dimensions.width,
        height: dimensions.height,
        fabricJSON: fabricJSON,
      };

      // Insert image at cursor position with fabric data
      this.quill.insertEmbed(range.index, 'image', imageValue, 'user');

      // Move cursor after the inserted image
      this.quill.setSelection(range.index + 1, 0, 'silent');
    } catch (error) {
      console.warn('Failed to insert drawing image:', error);

      // Fallback: insert without dimensions
      const range = this.quill.getSelection(true) || { index: this.quill.getLength(), length: 0 };
      this.quill.insertEmbed(
        range.index,
        'image',
        { src: dataUrl, fabricJSON: fabricJSON },
        'user'
      );
      this.quill.setSelection(range.index + 1, 0, 'silent');
    }
  }

  /**
   * Inserts an image from a data URL into the editor at current cursor position
   * Includes default dimensions to prevent huge images in exports
   * @param {string} dataUrl - Base64 data URL of the image
   * @returns {Promise<void>}
   *
   * Side effects:
   * - Inserts image embed into Quill at cursor position
   * - Moves cursor after inserted image
   *
   * Invariants:
   * - Uses string format ("src|widthxheight") for regular images
   * - Falls back to insertion without dimensions on error
   */
  async insertDataUrlImage(dataUrl) {
    if (!this.quill) return;

    try {
      // Calculate appropriate default dimensions
      const dimensions = await calculateDefaultImageDimensions(dataUrl);

      // Get current selection or default to end of document
      const range = this.quill.getSelection(true) || { index: this.quill.getLength(), length: 0 };

      // Create image value with dimensions using our custom format
      const imageValueWithDimensions = `${dataUrl}|${dimensions.width}x${dimensions.height}`;

      // Insert image at cursor position with default dimensions
      this.quill.insertEmbed(range.index, 'image', imageValueWithDimensions, 'user');

      // Move cursor after the inserted image
      this.quill.setSelection(range.index + 1, 0, 'silent');
    } catch (error) {
      console.warn('Failed to calculate image dimensions, inserting without dimensions:', error);

      // Fallback: insert without dimensions (original behavior)
      const range = this.quill.getSelection(true) || { index: this.quill.getLength(), length: 0 };
      this.quill.insertEmbed(range.index, 'image', dataUrl, 'user');
      this.quill.setSelection(range.index + 1, 0, 'silent');
    }
  }

  /**
   * Handles dropped or pasted files, filtering for images and converting to data URLs
   * @param {FileList | File[]} files - Files from drag/drop or paste event
   * @returns {Promise<void>}
   *
   * Side effects:
   * - Reads file as data URL using FileReader
   * - Inserts image into editor
   * - Shows alert for oversized images
   *
   * Invariants:
   * - Only processes first image file found
   * - Enforces 15MB size limit
   */
  async handleFiles(files) {
    // Find first image file in the list
    const file = Array.from(files).find((f) => /^image\//.test(f.type));
    if (!file) return;

    // Size limit check (15MB)
    if (file.size > 15 * 1024 * 1024) {
      alert('Image too large (>15MB).');
      return;
    }

    // Convert file to data URL and insert
    const r = new FileReader();
    r.onload = async () => await this.insertDataUrlImage(/** @type {string} */ (r.result));
    r.readAsDataURL(file);
  }

  /**
   * Sets up drag-and-drop handlers for images
   * @returns {void}
   *
   * Side effects:
   * - Adds 'drop' event listener to editor root
   * - Adds 'dragover' event listener to editor root
   *
   * Invariants:
   * - Only handles image files from drag events
   * - Ensures cursor position before inserting
   */
  setupDragAndDrop() {
    if (!this.quill) return;

    const editorRoot = this.quill.root;

    editorRoot.addEventListener('drop', async (e) => {
      // Handle dropped image files
      if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
      const hasImg = [...e.dataTransfer.files].some((f) => /^image\//.test(f.type));
      if (!hasImg) return;

      e.preventDefault();

      // Ensure editor has focus and cursor position
      const range = this.quill.getSelection(true);
      if (!range) {
        this.quill.focus();
        this.quill.setSelection(this.quill.getLength(), 0);
      }

      await this.handleFiles(e.dataTransfer.files);
    });

    editorRoot.addEventListener('dragover', (e) => {
      // Allow dropping if dragging images
      const items = e.dataTransfer && e.dataTransfer.items ? [...e.dataTransfer.items] : [];
      if (items.some((i) => i.type && i.type.startsWith('image/'))) {
        e.preventDefault();
      }
    });
  }

  /**
   * Sets up paste handler for images from clipboard
   * @returns {void}
   *
   * Side effects:
   * - Adds 'paste' event listener to editor root
   *
   * Invariants:
   * - Only handles image items from clipboard
   * - Prevents default paste behavior for images
   */
  setupPasteHandler() {
    if (!this.quill) return;

    this.quill.root.addEventListener('paste', async (e) => {
      // Handle pasted images from clipboard
      const items = e.clipboardData && e.clipboardData.items ? [...e.clipboardData.items] : [];
      const file = items
        .map((i) => i.getAsFile && i.getAsFile())
        .find((f) => f && /^image\//.test(f.type));
      if (file) {
        e.preventDefault();
        await this.handleFiles([file]);
      }
    });
  }

  /**
   * Updates an existing image's dimensions in the Quill editor
   * @param {HTMLImageElement | null} img - The image element to update
   * @returns {void}
   *
   * Side effects:
   * - Deletes old image blot from Quill
   * - Inserts updated image blot with new dimensions
   *
   * Invariants:
   * - Preserves fabricJSON if present
   * - Uses silent mode to avoid triggering undo/redo history
   * - Safe to call with null (no-op)
   */
  updateImageInQuill(img) {
    if (!img || !this.quill) return;

    try {
      // Get the current dimensions from the image
      const width = parseInt(img.style.width) || img.width;
      const height = img.style.height === 'auto' ? null : parseInt(img.style.height) || img.height;

      // Find the image's position in the Quill editor
      const blot = Quill.find(img);
      if (!blot) return;

      // Get the image source (data URL or URL)
      const src = img.src;
      if (!src) return;

      // Check if this is an editable drawing with fabric data
      const fabricJSON = img.getAttribute('data-fabric-json');

      // Create new image value with dimensions and fabric data (if present)
      let imageValue;
      if (fabricJSON) {
        // Use object format to preserve fabric data
        imageValue = {
          src: src,
          width: width,
          height: height,
          fabricJSON: fabricJSON,
        };
      } else {
        // Use string format for regular images
        imageValue = height ? `${src}|${width}x${height}` : `${src}|${width}`;
      }

      // Update the image embed in Quill without triggering user history
      const index = this.quill.getIndex(blot);
      this.quill.deleteText(index, 1, 'silent');
      this.quill.insertEmbed(index, 'image', imageValue, 'silent');
    } catch (error) {
      console.warn('Failed to update image in Quill:', error);
    }
  }
}

// Create a singleton instance
export const imageManager = new ImageManager();
