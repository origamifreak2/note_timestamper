// @ts-check
/**
 * @fileoverview Interactive image resizing functionality
 * Provides drag handles for resizing images directly in the Quill editor
 */

/**
 * Interactive image resizer for Quill editor
 * Provides drag handles for resizing images with aspect ratio preservation
 */
export class ImageResizer {
  constructor() {
    this.quill = null;
    this.wrapper = null;
    this.scrollHost = null;
    this.targetImg = null;
    this.overlay = null;
    this.start = null;
    this.imageManager = null;

    // Bind methods to preserve 'this' context
    this.onHandleDown = this.onHandleDown.bind(this);
    this.onDrag = this.onDrag.bind(this);
    this.onUp = this.onUp.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onScroll = this.onScroll.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onTextChange = this.onTextChange.bind(this);
  }

  /**
   * Initialize the image resizer
   * @param {any} quill - Quill editor instance
   * @param {HTMLElement | null} wrapper - Editor wrapper element
   * @param {any} imageManager - Image manager instance for updates
   * @returns {void}
   *
   * Side effects:
   * - Stores references to quill, wrapper, and imageManager
   * - Sets up all event listeners
   * - Creates ResizeObserver for editor changes
   */
  init(quill, wrapper, imageManager) {
    this.quill = quill;
    this.wrapper = wrapper;
    this.imageManager = imageManager;

    if (!this.wrapper) return;

    this.scrollHost = this.wrapper.closest('section') || this.wrapper;

    this.setupEventListeners();
  }

  /**
   * Sets up all event listeners for the resizer
   * @returns {void}
   *
   * Side effects:
   * - Adds click listener to editor root
   * - Adds keydown listener to document
   * - Adds scroll listeners to window and scroll host
   * - Creates ResizeObserver for editor root
   * - Adds text-change listener to Quill
   */
  setupEventListeners() {
    if (!this.quill || !this.wrapper) return;

    // Click handler for image selection
    this.quill.root.addEventListener('click', this.onClick);

    // Keyboard handler for escape key
    document.addEventListener('keydown', this.onKeyDown);

    // Scroll handlers
    window.addEventListener('scroll', this.onScroll, true);
    this.scrollHost.addEventListener('scroll', this.onScroll);

    // Resize observer for editor changes
    this.resizeObserver = new ResizeObserver(this.onResize);
    this.resizeObserver.observe(this.quill.root);

    // Text change handler to clean up overlay when images are deleted
    this.quill.on('text-change', this.onTextChange);
  }

  /**
   * Creates resize overlay with drag handles
   * @returns {void}
   *
   * Side effects:
   * - Creates and appends overlay div to wrapper
   * - Creates four corner drag handles
   * - Adds mousedown listeners to handles
   *
   * Invariants:
   * - Overlay positioned absolutely
   * - Handle positions: nw, ne, sw, se corners
   */
  createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'img-resize-overlay';
    this.overlay.style.cssText = `
      position: absolute;
      border: 2px solid #2563eb;
      pointer-events: none;
      z-index: 1000;
    `;

    // Create drag handles for each corner
    ['nw', 'ne', 'sw', 'se'].forEach(pos => {
      const handle = document.createElement('div');
      handle.className = `img-resize-handle img-h-${pos}`;
      handle.dataset.pos = pos;
      handle.style.cssText = `
        position: absolute;
        width: 8px;
        height: 8px;
        background: #2563eb;
        border: 1px solid white;
        pointer-events: auto;
        cursor: ${pos.includes('n') && pos.includes('w') ? 'nw' :
                   pos.includes('n') && pos.includes('e') ? 'ne' :
                   pos.includes('s') && pos.includes('w') ? 'sw' : 'se'}-resize;
      `;

      // Position handles at corners
      if (pos.includes('n')) handle.style.top = '-5px';
      if (pos.includes('s')) handle.style.bottom = '-5px';
      if (pos.includes('w')) handle.style.left = '-5px';
      if (pos.includes('e')) handle.style.right = '-5px';

      handle.addEventListener('mousedown', this.onHandleDown);
      this.overlay.appendChild(handle);
    });

    this.wrapper.appendChild(this.overlay);
  }

  /**
   * Removes resize overlay and cleans up
   * @returns {void}
   *
   * Side effects:
   * - Removes event listeners from handles
   * - Removes overlay from DOM
   * - Nullifies overlay and targetImg references
   */
  removeOverlay() {
    if (this.overlay) {
      this.overlay.querySelectorAll('.img-resize-handle')
        .forEach(h => h.removeEventListener('mousedown', this.onHandleDown));
      this.overlay.remove();
    }
    this.overlay = null;
    this.targetImg = null;
    this.start = null;
  }

  /**
   * Positions overlay to match the target image
   * @param {HTMLImageElement | null} img - Image to position overlay for
   * @returns {void}
   *
   * Side effects:
   * - Updates overlay position and dimensions
   *
   * Invariants:
   * - Accounts for scroll offsets
   * - Uses getBoundingClientRect for accurate positioning
   */
  positionOverlayFor(img) {
    if (!this.overlay || !img || !this.wrapper) return;

    const imgRect = img.getBoundingClientRect();
    const wrapperRect = this.wrapper.getBoundingClientRect();

    const top = imgRect.top - wrapperRect.top + (this.scrollHost.scrollTop || 0);
    const left = imgRect.left - wrapperRect.left + (this.scrollHost.scrollLeft || 0);

    this.overlay.style.top = `${top}px`;
    this.overlay.style.left = `${left}px`;
    this.overlay.style.width = `${imgRect.width}px`;
    this.overlay.style.height = `${imgRect.height}px`;
  }

  /**
   * Selects an image for resizing
   * @param {HTMLImageElement} img - Image to select
   * @returns {void}
   *
   * Side effects:
   * - Sets targetImg reference
   * - Creates overlay if needed
   * - Positions overlay over image
   */
  selectImage(img) {
    this.targetImg = img;
    if (!this.overlay) {
      this.createOverlay();
    }
    this.positionOverlayFor(this.targetImg);
  }

  /**
   * Handle mouse down on resize handles
   * @param {MouseEvent} e - Mouse event
   * @returns {void}
   *
   * Side effects:
   * - Stores initial resize state
   * - Adds mousemove and mouseup listeners
   *
   * Invariants:
   * - Calculates initial dimensions and aspect ratio
   * - Records which handle was grabbed (nw, ne, sw, se)
   */
  onHandleDown(e) {
    if (!this.targetImg) return;

    e.preventDefault();
    e.stopPropagation();

    const imgRect = this.targetImg.getBoundingClientRect();
    this.start = {
      x: e.clientX,
      y: e.clientY,
      w: imgRect.width,
      h: imgRect.height,
      ar: imgRect.width / imgRect.height,
      handle: e.currentTarget.dataset.pos,
      keepAR: e.shiftKey
    };

    document.addEventListener('mousemove', this.onDrag);
    document.addEventListener('mouseup', this.onUp, { once: true });
  }

  /**
   * Handle mouse drag for resizing
   * @param {MouseEvent} e - Mouse event
   * @returns {void}
   *
   * Side effects:
   * - Updates target image dimensions
   * - Repositions overlay to match
   *
   * Invariants:
   * - Maintains aspect ratio when shift is held
   * - Enforces minimum size of 20px
   * - Direction-aware resizing based on handle
   */
  onDrag(e) {
    if (!this.start || !this.targetImg) return;

    const dx = e.clientX - this.start.x;
    const dy = e.clientY - this.start.y;

    let dw = 0, dh = 0;
    switch (this.start.handle) {
      case 'se': dw = dx; dh = dy; break;
      case 'ne': dw = dx; dh = -dy; break;
      case 'sw': dw = -dx; dh = dy; break;
      case 'nw': dw = -dx; dh = -dy; break;
    }

    let newW = Math.max(20, this.start.w + dw);
    let newH = Math.max(20, this.start.h + dh);

    // Maintain aspect ratio if shift is held or by default
    if (this.start.keepAR || e.shiftKey) {
      if (Math.abs(dw) > Math.abs(dh)) {
        newH = Math.round(newW / this.start.ar);
      } else {
        newW = Math.round(newH * this.start.ar);
      }
    }

    this.targetImg.style.width = `${newW}px`;
    this.targetImg.style.height = 'auto';

    this.positionOverlayFor(this.targetImg);
  }

  /**
   * Handle mouse up after resizing
   * @returns {void}
   *
   * Side effects:
   * - Removes mousemove listener
   * - Updates image dimensions in Quill editor
   * - Nullifies resize state
   */
  onUp() {
    document.removeEventListener('mousemove', this.onDrag);

    // Update Quill's Delta to persist the image dimensions
    if (this.targetImg && this.start && this.imageManager) {
      this.imageManager.updateImageInQuill(this.targetImg);
    }

    this.start = null;
  }

  /**
   * Handle clicks on images or outside
   * @param {MouseEvent} e - Mouse event
   * @returns {void}
   *
   * Side effects:
   * - Selects clicked image
   * - Removes overlay if clicking outside
   */
  onClick(e) {
    const img = e.target.closest('img');
    if (img) {
      this.selectImage(img);
    } else if (!e.target.closest('.img-resize-overlay')) {
      this.removeOverlay();
    }
  }

  /**
   * Handle keyboard events
   * @param {KeyboardEvent} e - Keyboard event
   * @returns {void}
   *
   * Side effects:
   * - Removes overlay on Escape key
   */
  onKeyDown(e) {
    if (e.key === 'Escape') {
      this.removeOverlay();
    }
  }

  /**
   * Handle scroll events to reposition overlay
   * @returns {void}
   *
   * Side effects:
   * - Repositions overlay to match scrolled image
   */
  onScroll() {
    if (this.targetImg && this.overlay) {
      this.positionOverlayFor(this.targetImg);
    }
  }

  /**
   * Handle resize events to reposition overlay
   * @returns {void}
   *
   * Side effects:
   * - Repositions overlay to match resized editor
   */
  onResize() {
    if (this.targetImg && this.overlay) {
      this.positionOverlayFor(this.targetImg);
    }
  }

  /**
   * Handle text changes to clean up overlay when images are deleted
   * @returns {void}
   *
   * Side effects:
   * - Removes overlay if target image no longer in DOM
   */
  onTextChange() {
    if (this.targetImg && !document.body.contains(this.targetImg)) {
      this.removeOverlay();
    }
  }

  /**
   * Clean up event listeners and overlay
   * @returns {void}
   *
   * Side effects:
   * - Removes all event listeners
   * - Removes overlay
   * - Disconnects ResizeObserver
   */
  cleanup() {
    this.removeOverlay();

    if (this.quill) {
      this.quill.root.removeEventListener('click', this.onClick);
      this.quill.off('text-change', this.onTextChange);
    }

    document.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('scroll', this.onScroll, true);

    if (this.scrollHost) {
      this.scrollHost.removeEventListener('scroll', this.onScroll);
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }
}

// Create a singleton instance
export const imageResizer = new ImageResizer();