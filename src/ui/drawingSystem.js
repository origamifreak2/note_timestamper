
/**
 * @file Drawing system using Fabric.js canvas
 * Provides a drawing interface for creating and inserting drawings
 *
 * =====================
 * Public API Surface
 * =====================
 * Methods:
 *   - async openDrawingModal(fabricJSON?: string|null): Promise<{ dataUrl: string, fabricJSON: string }|null>
 *       Opens drawing modal, returns drawing dataUrl and fabricJSON.
 *   - setupDrawingUI(modal: HTMLElement, canvas: fabric.Canvas): void
 *       Sets up drawing UI and event handlers for Fabric.js canvas.
 *   - [other internal methods for modal creation, tool handling, undo/redo, etc.]
 *
 * Internal helpers are marked 'Internal'.
 * Invariants and side effects are documented per method.
 */

import { imageManager } from '../editor/imageManager.js';

/**
 * Drawing system for creating drawings with Fabric.js canvas
 */
export class DrawingSystem {
  constructor() {
    this.isModalOpen = false;
    this.currentTool = 'rect';
    this.isDrawing = false;
    this.startPoint = null;
    this.canvasHistory = [];
    this.historyStep = -1;
    this.maxHistorySteps = 50;
    this.undoBtn = null;
    this.redoBtn = null;
    this.keyboardHandler = null;
  }

  /**
   * Opens drawing modal with Fabric.js canvas for creating drawings
   * Returns a Promise that resolves with { dataUrl, fabricJSON } or null if cancelled
   * @param {string|null} fabricJSON - Optional Fabric.js JSON to load for editing
   */
  async openDrawingModal(fabricJSON = null) {
    if (this.isModalOpen) return null;

    // Check if Fabric.js is loaded
    if (typeof fabric === 'undefined') {
      throw new Error('Fabric.js library not loaded');
    }

    this.isModalOpen = true;
    let drawingModal = null;
    let canvas = null;
    let initializedSuccessfully = false; // Track whether we reached successful promise return

    try {
      // Create modal overlay
      drawingModal = this.createDrawingModal();
      document.body.appendChild(drawingModal);

      // Wait for DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 50));

      // Set canvas size
      const maxWidth = Math.min(window.innerWidth * 0.7, 800);
      const maxHeight = Math.min(window.innerHeight * 0.5, 600);

      // Create canvas element
      const canvasElement = drawingModal.querySelector('#drawingCanvas');
      canvasElement.width = maxWidth;
      canvasElement.height = maxHeight;
      canvasElement.style.width = `${maxWidth}px`;
      canvasElement.style.height = `${maxHeight}px`;

      // Initialize Fabric.js canvas
      canvas = new fabric.Canvas(canvasElement, {
        backgroundColor: 'white',
        selection: true,
        preserveObjectStacking: true
      });

      canvas.setDimensions({ width: maxWidth, height: maxHeight });
      // Set initial drawing mode based on default tool
      canvas.isDrawingMode = this.currentTool === 'freedraw';
      canvas.selection = this.currentTool !== 'freedraw';
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.width = 3;
      canvas.freeDrawingBrush.color = '#000000';

      // CRITICAL FIX: Make upper canvas transparent but keep mouse events
      // This prevents drawings from disappearing after mouse-up
      if (canvas.upperCanvasEl) {
        canvas.upperCanvasEl.style.backgroundColor = 'transparent';
        canvas.upperCanvasEl.style.background = 'transparent';
      }

  // CRITICAL: Recalculate canvas offset to fix mouse position
  canvas.calcOffset();

      // Set up UI handlers
      this.setupDrawingUI(drawingModal, canvas);

      // Load existing drawing if fabricJSON is provided
      if (fabricJSON) {
        try {
          const jsonData = typeof fabricJSON === 'string' ? JSON.parse(fabricJSON) : fabricJSON;

          await new Promise((resolve, reject) => {
            canvas.loadFromJSON(jsonData, () => {
              // CRITICAL: Set canvas mode INSIDE the callback after JSON is fully loaded
              canvas.backgroundColor = 'white';
              canvas.isDrawingMode = this.currentTool === 'freedraw';
              canvas.selection = this.currentTool !== 'freedraw';
              canvas.calcOffset();

              // Force all objects to be visible and trigger multiple renders
              canvas.getObjects().forEach(obj => {
                obj.setCoords();
                obj.visible = true;
              });

              canvas.renderAll(); // Force complete render after loading

              // Additional render after a short delay to ensure visibility
              setTimeout(() => {
                canvas.renderAll();
              }, 50);

              resolve();
            }, (o, object) => {
              // Error handler for individual objects
              console.warn('Error loading object:', o, object);
            });
          });

          // Save initial state after loading
          setTimeout(() => {
            this.saveCanvasState(canvas);
            this.updateUndoRedoButtons(this.undoBtn, this.redoBtn);
          }, 100);
        } catch (error) {
          console.error('Failed to load fabric JSON:', error);
          // Continue with blank canvas on error
          canvas.clear();
          canvas.backgroundColor = 'white';
          canvas.renderAll();
        }
      } else {
        // Force initial render to ensure everything is visible
        canvas.clear();
        canvas.backgroundColor = 'white';
        canvas.renderAll();
      }

      // Mark success before returning promise so finally won't clean up prematurely
      initializedSuccessfully = true;
      // Return Promise that resolves with { dataUrl, fabricJSON } or null if cancelled
      return new Promise((resolve) => {
        const saveBtn = drawingModal.querySelector('#drawingSaveBtn');
        const cancelBtn = drawingModal.querySelector('#drawingCancelBtn');

        saveBtn.addEventListener('click', () => {
          try {
            const dataUrl = canvas.toDataURL({
              format: 'png',
              quality: 1.0,
              multiplier: 2
            });
            // Export canvas JSON without isDrawingMode property to avoid conflicts on reload
            const canvasData = canvas.toJSON();
            delete canvasData.isDrawingMode;
            const fabricJSON = JSON.stringify(canvasData);
            this.cleanup(drawingModal, canvas);
            resolve({ dataUrl, fabricJSON });
          } catch (error) {
            console.error('Failed to export drawing:', error);
            alert('Failed to export drawing. Please try again.');
          }
        });

        cancelBtn.addEventListener('click', () => {
          this.cleanup(drawingModal, canvas);
          resolve(null);
        });
      });

    } catch (error) {
      console.error('Drawing modal error:', error);
      throw error; // Cleanup handled in finally
    } finally {
      // Ensure cleanup if initialization failed before returning promise
      if (!initializedSuccessfully) {
        if (drawingModal) {
          try {
            this.cleanup(drawingModal, canvas);
          } catch (cleanupErr) {
            console.error('Failed during drawing modal cleanup:', cleanupErr);
          }
        } else {
          // Reset modal open state if nothing was created
          this.isModalOpen = false;
        }
      }
    }
  }

  /**
   * Set up drawing UI controls
   */
  setupDrawingUI(modal, canvas) {
    const toolButtons = modal.querySelectorAll('.drawing-tool-btn');
    const colorPicker = modal.querySelector('#drawingColorPicker');
    const fillColorPicker = modal.querySelector('#drawingFillColorPicker');
    const noFillCheckbox = modal.querySelector('#drawingNoFill');
    const brushSizeSlider = modal.querySelector('#drawingBrushSize');
    const brushSizeValue = modal.querySelector('#drawingBrushSizeValue');
    const clearBtn = modal.querySelector('#drawingClearBtn');
    const deleteBtn = modal.querySelector('#drawingDeleteBtn');
    const undoBtn = modal.querySelector('#drawingUndoBtn');
    const redoBtn = modal.querySelector('#drawingRedoBtn');
    const importImageBtn = modal.querySelector('#drawingImportImageBtn');

    // Store button references for use in saveCanvasState
    this.undoBtn = undoBtn;
    this.redoBtn = redoBtn;

    // Initialize history system
    this.canvasHistory = [];
    this.historyStep = -1;

    // Save initial state after a short delay to ensure canvas is ready
    setTimeout(() => {
      this.saveCanvasState(canvas);
      this.updateUndoRedoButtons(undoBtn, redoBtn);
    }, 100);

    // Tool button handlers
    toolButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        // Update button styles
        toolButtons.forEach(b => {
          b.style.border = '2px solid #d1d5db';
          b.style.background = 'white';
          b.style.color = '#374151';
          b.classList.remove('active');
        });

        btn.style.border = '2px solid #2563eb';
        btn.style.background = '#2563eb';
        btn.style.color = 'white';
        btn.classList.add('active');

        this.currentTool = btn.dataset.tool;

        // Configure canvas for selected tool
        switch(this.currentTool) {
          case 'freedraw':
            canvas.isDrawingMode = true;
            canvas.selection = false;
            break;
          case 'rect':
          case 'circle':
          case 'line':
          case 'text':
            canvas.isDrawingMode = false;
            canvas.selection = true;
            break;
        }
      });
    });

    // Color picker handler
    colorPicker.addEventListener('change', (e) => {
      const color = e.target.value;
      canvas.freeDrawingBrush.color = color;

      // Update color for selected objects
      const activeObjects = canvas.getActiveObjects();
      if (activeObjects.length > 0) {
        activeObjects.forEach(obj => {
          if (obj.type === 'path') {
            obj.set('stroke', color);
          } else if (obj.type === 'i-text') {
            obj.set('fill', color);
          } else {
            obj.set('stroke', color);
          }
        });
        canvas.renderAll();
      }
    });

    // Fill color picker handler
    fillColorPicker.addEventListener('change', (e) => {
      const fillColor = e.target.value;

      // Automatically uncheck "No Fill" when user selects a fill color
      if (noFillCheckbox.checked) {
        noFillCheckbox.checked = false;
        fillColorPicker.disabled = false;
        fillColorPicker.style.opacity = '1';
      }

      // Update fill for selected objects
      const activeObjects = canvas.getActiveObjects();
      if (activeObjects.length > 0) {
        activeObjects.forEach(obj => {
          if (obj.type !== 'path' && obj.type !== 'i-text') {
            obj.set('fill', fillColor);
          }
        });
        canvas.renderAll();
      }
    });

    // No fill checkbox handler
    noFillCheckbox.addEventListener('change', (e) => {
      const isNoFill = e.target.checked;
      fillColorPicker.disabled = isNoFill;
      fillColorPicker.style.opacity = isNoFill ? '0.5' : '1';

      // Update fill for selected objects
      const activeObjects = canvas.getActiveObjects();
      if (activeObjects.length > 0) {
        activeObjects.forEach(obj => {
          if (obj.type !== 'path' && obj.type !== 'i-text') {
            obj.set('fill', isNoFill ? 'transparent' : fillColorPicker.value);
          }
        });
        canvas.renderAll();
      }
    });

    // Brush size handler
    brushSizeSlider.addEventListener('input', (e) => {
      const size = parseInt(e.target.value);
      brushSizeValue.textContent = size + 'px';
      canvas.freeDrawingBrush.width = size;

      // Update stroke width for selected objects
      const activeObjects = canvas.getActiveObjects();
      if (activeObjects.length > 0) {
        activeObjects.forEach(obj => {
          if (obj.type !== 'i-text') {
            obj.set('strokeWidth', size);
          }
        });
        canvas.renderAll();
      }
    });

    // Clear button handler
    clearBtn.addEventListener('click', () => {
      canvas.clear();
      canvas.backgroundColor = 'white';
      canvas.renderAll();
      this.saveCanvasState(canvas);
    });

    // Delete selected objects handler
    deleteBtn.addEventListener('click', () => {
      this.deleteSelectedObjects(canvas);
      this.saveCanvasState(canvas);
    });

    // Undo button handler
    undoBtn.addEventListener('click', () => {
      this.undo(canvas, undoBtn, redoBtn);
    });

    // Redo button handler
    redoBtn.addEventListener('click', () => {
      this.redo(canvas, undoBtn, redoBtn);
    });

    // Import image button handler
    importImageBtn.addEventListener('click', async () => {
      await this.importImage(canvas);
    });

    // Set up keyboard shortcuts for undo/redo
    this.setupKeyboardShortcuts(canvas, undoBtn, redoBtn);

    // Set up canvas event handlers
    this.setupCanvasEvents(canvas);

    // Initial button states will be updated after the initial state is saved
  }

  /**
   * Set up keyboard shortcuts for undo/redo
   */
  setupKeyboardShortcuts(canvas, undoBtn, redoBtn) {
    // Create keyboard handler function
    this.keyboardHandler = (e) => {
      // Check if we're in the drawing modal (prevent interference with main app shortcuts)
      if (!this.isModalOpen) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      if (ctrlKey && !e.altKey) {
        if (e.key.toLowerCase() === 'z') {
          if (e.shiftKey) {
            // Ctrl+Shift+Z or Cmd+Shift+Z = Redo
            e.preventDefault();
            this.redo(canvas, undoBtn, redoBtn);
          } else {
            // Ctrl+Z or Cmd+Z = Undo
            e.preventDefault();
            this.undo(canvas, undoBtn, redoBtn);
          }
        } else if (e.key.toLowerCase() === 'y' && !isMac) {
          // Ctrl+Y = Redo (Windows/Linux style)
          e.preventDefault();
          this.redo(canvas, undoBtn, redoBtn);
        }
      }
    };

    // Add event listener to document to capture all keyboard events
    document.addEventListener('keydown', this.keyboardHandler);

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  }

  /**
   * Creates the modal overlay interface for drawing
   */
  createDrawingModal() {
    const modal = document.createElement('div');
    modal.className = 'drawing-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      font-family: system-ui, sans-serif;
    `;

    modal.innerHTML = `
      <div style="
        background: white;
        border-radius: 8px;
        padding: 20px;
        max-width: 95vw;
        max-height: 95vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      ">
        <h3 style="margin: 0; color: #333; font-size: 18px;">Draw</h3>

        <!-- Drawing Tools -->
        <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap; justify-content: center;">
          <!-- Drawing Mode -->
          <div style="display: flex; gap: 8px;">
            <button id="drawingFreeDrawBtn" class="drawing-tool-btn" data-tool="freedraw" style="
              padding: 8px 12px;
              border: 2px solid #d1d5db;
              background: white;
              color: #374151;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
              display: flex;
              align-items: center;
              gap: 4px;
            ">
              <i class="fa-solid fa-pencil"></i> Draw
            </button>
            <button id="drawingRectBtn" class="drawing-tool-btn active" data-tool="rect" style="
              padding: 8px 12px;
              border: 2px solid #2563eb;
              background: #2563eb;
              color: white;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
              display: flex;
              align-items: center;
              gap: 4px;
            ">
              <i class="fa-regular fa-square"></i> Rectangle
            </button>
            <button id="drawingCircleBtn" class="drawing-tool-btn" data-tool="circle" style="
              padding: 8px 12px;
              border: 2px solid #d1d5db;
              background: white;
              color: #374151;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
              display: flex;
              align-items: center;
              gap: 4px;
            ">
              <i class="fa-regular fa-circle"></i> Circle
            </button>
            <button id="drawingLineBtn" class="drawing-tool-btn" data-tool="line" style="
              padding: 8px 12px;
              border: 2px solid #d1d5db;
              background: white;
              color: #374151;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
              display: flex;
              align-items: center;
              gap: 4px;
            ">
              <i class="fa-solid fa-minus"></i> Line
            </button>
            <button id="drawingTextBtn" class="drawing-tool-btn" data-tool="text" style="
              padding: 8px 12px;
              border: 2px solid #d1d5db;
              background: white;
              color: #374151;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
              display: flex;
              align-items: center;
              gap: 4px;
            ">
              <i class="fa-solid fa-font"></i> Text
            </button>
          </div>

          <!-- Import Image Button -->
          <div style="display: flex; gap: 8px;">
            <button id="drawingImportImageBtn" style="
              padding: 8px 12px;
              border: 2px solid #059669;
              background: white;
              color: #059669;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
              display: flex;
              align-items: center;
              gap: 4px;
            ">
              <i class="fa-solid fa-image"></i> Import Image
            </button>
          </div>

          <!-- Stroke Color Picker -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="font-size: 12px; color: #666;">Stroke:</label>
            <input type="color" id="drawingColorPicker" value="#000000" style="
              width: 32px;
              height: 32px;
              border: none;
              border-radius: 4px;
              cursor: pointer;
            ">
          </div>

          <!-- Fill Color Picker -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="font-size: 12px; color: #666;">Fill:</label>
            <input type="color" id="drawingFillColorPicker" value="#ffffff" style="
              width: 32px;
              height: 32px;
              border: none;
              border-radius: 4px;
              cursor: pointer;
            ">
            <label style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: #666; cursor: pointer;">
              <input type="checkbox" id="drawingNoFill" checked style="margin: 0;">
              No Fill
            </label>
          </div>

          <!-- Brush Size -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="font-size: 12px; color: #666;">Size:</label>
            <input type="range" id="drawingBrushSize" min="1" max="20" value="3" style="width: 80px;">
            <span id="drawingBrushSizeValue" style="font-size: 12px; color: #666; min-width: 20px;">3px</span>
          </div>

          <!-- Clear Button -->
          <button id="drawingClearBtn" style="
            padding: 8px 12px;
            border: 2px solid #ef4444;
            background: white;
            color: #ef4444;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            <i class="fa-solid fa-trash"></i> Clear All
          </button>

          <!-- Delete Selected Button -->
          <button id="drawingDeleteBtn" style="
            padding: 8px 12px;
            border: 2px solid #f97316;
            background: white;
            color: #f97316;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            <i class="fa-solid fa-minus"></i> Delete Selected
          </button>

          <!-- Undo Button -->
          <button id="drawingUndoBtn" style="
            padding: 8px 12px;
            border: 2px solid #6366f1;
            background: white;
            color: #6366f1;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            <i class="fa-solid fa-undo"></i> Undo
          </button>

          <!-- Redo Button -->
          <button id="drawingRedoBtn" style="
            padding: 8px 12px;
            border: 2px solid #8b5cf6;
            background: white;
            color: #8b5cf6;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            <i class="fa-solid fa-redo"></i> Redo
          </button>
        </div>

        <!-- Canvas Container -->
        <div style="position: relative; display: flex; justify-content: center;">
          <canvas id="drawingCanvas" style="
            border: 2px solid #d1d5db;
            border-radius: 4px;
            background: white;
          "></canvas>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 12px;">
          <button id="drawingSaveBtn" style="
            padding: 10px 20px;
            background: #16a34a;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
          ">
            <i class="fa-solid fa-check"></i> Insert Drawing
          </button>
          <button id="drawingCancelBtn" style="
            padding: 10px 20px;
            background: #6b7280;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
          ">
            <i class="fa-solid fa-times"></i> Cancel
          </button>
        </div>
      </div>
    `;

    // Close modal on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        const cancelBtn = modal.querySelector('#drawingCancelBtn');
        cancelBtn.click();
      }
    });

    // Handle escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        const cancelBtn = modal.querySelector('#drawingCancelBtn');
        cancelBtn.click();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Store escape handler reference for robust cleanup if initialization fails early
    modal._escapeHandler = handleEscape;

    return modal;
  }

  /**
   * Set up canvas event handlers for drawing shapes and interactions
   */
  setupCanvasEvents(canvas) {
    // Save state when path is created (free drawing)
    canvas.on('path:created', (e) => {
      this.saveCanvasState(canvas);
    });

    // Save state when objects are modified
    canvas.on('object:modified', (e) => {
      this.saveCanvasState(canvas);
    });

    // Mouse events for shape drawing
    canvas.on('mouse:down', (options) => {
      if (this.currentTool === 'rect' || this.currentTool === 'circle' || this.currentTool === 'line') {
        // Don't start drawing if clicking on an existing object
        if (options.target) {
          this.isDrawing = false;
          return;
        }

        this.isDrawing = true;
        const pointer = canvas.getPointer(options.e);
        this.startPoint = pointer;
      }
    });

    canvas.on('mouse:up', (options) => {
      if (this.isDrawing && (this.currentTool === 'rect' || this.currentTool === 'circle' || this.currentTool === 'line')) {
        const pointer = canvas.getPointer(options.e);

        // Only create shape if we have a valid start point and moved the mouse
        const distance = Math.sqrt(Math.pow(pointer.x - this.startPoint.x, 2) + Math.pow(pointer.y - this.startPoint.y, 2));
        if (distance < 5) {
          // Too small movement, don't create shape
          this.isDrawing = false;
          return;
        }

        const modal = canvas.wrapperEl.closest('.drawing-modal');
        const fillColorPicker = modal.querySelector('#drawingFillColorPicker');
        const noFillCheckbox = modal.querySelector('#drawingNoFill');
        const colorPicker = modal.querySelector('#drawingColorPicker');
        const brushSizeSlider = modal.querySelector('#drawingBrushSize');

        if (this.currentTool === 'rect') {
          const rect = new fabric.Rect({
            left: Math.min(this.startPoint.x, pointer.x),
            top: Math.min(this.startPoint.y, pointer.y),
            width: Math.abs(pointer.x - this.startPoint.x),
            height: Math.abs(pointer.y - this.startPoint.y),
            fill: noFillCheckbox.checked ? 'transparent' : fillColorPicker.value,
            stroke: colorPicker.value,
            strokeWidth: parseInt(brushSizeSlider.value)
          });
          canvas.add(rect);
          // Force render to make shape visible immediately
          canvas.renderAll();
          this.saveCanvasState(canvas);
        } else if (this.currentTool === 'circle') {
          const width = Math.abs(pointer.x - this.startPoint.x);
          const height = Math.abs(pointer.y - this.startPoint.y);
          const radius = Math.min(width, height) / 2;

          const centerX = (this.startPoint.x + pointer.x) / 2;
          const centerY = (this.startPoint.y + pointer.y) / 2;

          const circle = new fabric.Circle({
            left: centerX - radius,
            top: centerY - radius,
            radius: radius,
            fill: noFillCheckbox.checked ? 'transparent' : fillColorPicker.value,
            stroke: colorPicker.value,
            strokeWidth: parseInt(brushSizeSlider.value)
          });
          canvas.add(circle);
          // Force render to make shape visible immediately
          canvas.renderAll();
          this.saveCanvasState(canvas);
        } else if (this.currentTool === 'line') {
          const line = new fabric.Line([
            this.startPoint.x,
            this.startPoint.y,
            pointer.x,
            pointer.y
          ], {
            stroke: colorPicker.value,
            strokeWidth: parseInt(brushSizeSlider.value),
            originX: 'center',
            originY: 'center'
          });
          canvas.add(line);
          // Force render to make line visible immediately
          canvas.renderAll();
          this.saveCanvasState(canvas);
        }

        this.isDrawing = false;
        this.startPoint = null;
      }
    });

    // Text tool double-click handler
    canvas.on('mouse:dblclick', (options) => {
      if (this.currentTool === 'text') {
        const pointer = canvas.getPointer(options.e);
        const modal = canvas.wrapperEl.closest('.drawing-modal');
        const colorPicker = modal.querySelector('#drawingColorPicker');
        const brushSizeSlider = modal.querySelector('#drawingBrushSize');

        const text = new fabric.IText('Click to edit', {
          left: pointer.x,
          top: pointer.y,
          fill: colorPicker.value,
          fontSize: parseInt(brushSizeSlider.value) * 4 + 12,
          fontFamily: 'Arial'
        });
        canvas.add(text);
        // Force render to make text visible immediately
        canvas.renderAll();
        this.saveCanvasState(canvas);
        canvas.setActiveObject(text);
        text.enterEditing();
      }
    });
  }

  /**
   * Save canvas state for undo/redo functionality
   */
  saveCanvasState(canvas) {
    // Remove any states after current step (when user made new action after undo)
    this.canvasHistory = this.canvasHistory.slice(0, this.historyStep + 1);

    // Add new state
    const canvasData = JSON.stringify(canvas.toObject());
    this.canvasHistory.push(canvasData);
    this.historyStep++;

    // Limit history size
    if (this.canvasHistory.length > this.maxHistorySteps) {
      this.canvasHistory = this.canvasHistory.slice(1);
      this.historyStep = this.maxHistorySteps - 1;
    }

  // Canvas state saved (debug log removed)

    // Update button states after saving state
    if (this.undoBtn && this.redoBtn) {
      this.updateUndoRedoButtons(this.undoBtn, this.redoBtn);
    }
  }

  /**
   * Update undo/redo button states
   */
  updateUndoRedoButtons(undoBtn, redoBtn) {
    // Undo button
    const canUndo = this.historyStep > 0;
    undoBtn.disabled = !canUndo;
    undoBtn.style.opacity = canUndo ? '1' : '0.5';
    undoBtn.style.cursor = canUndo ? 'pointer' : 'not-allowed';

    // Redo button
    const canRedo = this.historyStep < this.canvasHistory.length - 1;
    redoBtn.disabled = !canRedo;
    redoBtn.style.opacity = canRedo ? '1' : '0.5';
    redoBtn.style.cursor = canRedo ? 'pointer' : 'not-allowed';

  // Button state update (debug log removed)
  }

  /**
   * Undo last action
   */
  undo(canvas, undoBtn, redoBtn) {
  // Undo called
    if (this.historyStep > 0) {
      this.historyStep--;
      const previousState = this.canvasHistory[this.historyStep];
  // Undoing to step
      canvas.loadFromJSON(previousState, () => {
        canvas.requestRenderAll();
        canvas.calcOffset();
        setTimeout(() => {
          canvas.renderAll();
          // Undo completed
        }, 10);
      });
      // Update button states after the undo operation
      this.updateUndoRedoButtons(undoBtn, redoBtn);
    } else {
  // Cannot undo - at beginning of history
      // Still update button states to disable undo button
      this.updateUndoRedoButtons(undoBtn, redoBtn);
    }
  }

  /**
   * Redo last undone action
   */
  redo(canvas, undoBtn, redoBtn) {
  // Redo called
    if (this.historyStep < this.canvasHistory.length - 1) {
      this.historyStep++;
      const nextState = this.canvasHistory[this.historyStep];
  // Redoing to step
      canvas.loadFromJSON(nextState, () => {
        canvas.requestRenderAll();
        canvas.calcOffset();
        setTimeout(() => {
          canvas.renderAll();
          // Redo completed
        }, 10);
      });
      // Update button states after the redo operation
      this.updateUndoRedoButtons(undoBtn, redoBtn);
    } else {
  // Cannot redo - at end of history
      // Still update button states to disable redo button
      this.updateUndoRedoButtons(undoBtn, redoBtn);
    }
  }

  /**
   * Delete selected objects
   */
  deleteSelectedObjects(canvas) {
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length > 0) {
      activeObjects.forEach(obj => {
        canvas.remove(obj);
      });
      canvas.discardActiveObject();
      canvas.renderAll();
    }
  }

  /**
   * Import an image file and add it to the canvas
   */
  async importImage(canvas) {
    try {
  // starting image import

      // Use the existing image picker from the main process
      const result = await window.api.pickImage();
  // image picker returned

      if (!result || !result.ok || !result.dataUrl) {
  // image import cancelled or failed
        return;
      }

  // creating fabric image from data URL

      // Check if this is an SVG file
      if (result.dataUrl.startsWith('data:image/svg+xml')) {
  // detected SVG, using SVG-specific handling
        this.importSVG(canvas, result.dataUrl);
        return;
      }

      // For regular images: Create HTML image first, then fabric.Image
      const htmlImg = new Image();

      htmlImg.onload = () => {
  // HTML image loaded

        const fabricImg = new fabric.Image(htmlImg);
  // fabric image created

        if (!fabricImg || fabricImg.width === 0 || fabricImg.height === 0) {
          console.error('Invalid image dimensions:', { width: fabricImg.width, height: fabricImg.height });
          alert('Failed to load image. Invalid image dimensions.');
          return;
        }

        // Calculate appropriate scaling to fit canvas while maintaining aspect ratio
        const canvasWidth = canvas.getWidth();
        const canvasHeight = canvas.getHeight();
  // canvas dimensions computed

        const maxWidth = canvasWidth * 0.6; // Use 60% of canvas width for better visibility
        const maxHeight = canvasHeight * 0.6; // Use 60% of canvas height

        // Calculate scale factor to fit within bounds
        const scaleX = maxWidth / fabricImg.width;
        const scaleY = maxHeight / fabricImg.height;
        const scale = Math.min(scaleX, scaleY, 1); // Don't upscale
  // scale calculated

        // Set image properties
        const leftPos = (canvasWidth - (fabricImg.width * scale)) / 2;
        const topPos = (canvasHeight - (fabricImg.height * scale)) / 2;

        fabricImg.set({
          scaleX: scale,
          scaleY: scale,
          left: leftPos,
          top: topPos,
          selectable: true,
          evented: true
        });

  // image positioned

        // Add to canvas
  canvas.add(fabricImg);

        // Set as active object
        canvas.setActiveObject(fabricImg);

        // Force render
        canvas.requestRenderAll();
  // canvas render requested

        // Save state for undo/redo
        this.saveCanvasState(canvas);

        // image import completed
      };

      htmlImg.onerror = (error) => {
        console.error('Failed to load HTML image:', error);
        alert('Failed to load image. Please check the file format.');
      };

      // Set the data URL to start loading
      htmlImg.src = result.dataUrl;

    } catch (error) {
      console.error('Failed to import image:', error);
      alert('Failed to import image: ' + error.message);
    }
  }

  /**
   * Import an SVG file and add it to the canvas
   */
  importSVG(canvas, dataUrl) {
    try {
  // processing SVG import

      // Extract SVG content from data URL
      const base64Content = dataUrl.split(',')[1];
      const svgContent = decodeURIComponent(escape(atob(base64Content)));
  // SVG content extracted

      // Use Fabric.js loadSVGFromString method
      fabric.loadSVGFromString(svgContent, (objects, options) => {
  // SVG loaded

        if (!objects || objects.length === 0) {
          console.error('No objects found in SVG');
          alert('Failed to load SVG. No valid objects found.');
          return;
        }

        // Create a group from all SVG objects
        const svgGroup = fabric.util.groupSVGElements(objects, options);
  // SVG group created

        // Calculate appropriate scaling to fit canvas
        const canvasWidth = canvas.getWidth();
        const canvasHeight = canvas.getHeight();
  // canvas dimensions for SVG

        const maxWidth = canvasWidth * 0.6;
        const maxHeight = canvasHeight * 0.6;

        // Calculate scale factor
        const scaleX = maxWidth / svgGroup.width;
        const scaleY = maxHeight / svgGroup.height;
        const scale = Math.min(scaleX, scaleY, 1); // Don't upscale
  // calculated SVG scale

        // Position and scale the SVG group
        const leftPos = (canvasWidth - (svgGroup.width * scale)) / 2;
        const topPos = (canvasHeight - (svgGroup.height * scale)) / 2;

        svgGroup.set({
          scaleX: scale,
          scaleY: scale,
          left: leftPos,
          top: topPos,
          selectable: true,
          evented: true
        });

  // SVG positioned

        // Add to canvas
  canvas.add(svgGroup);

        // Set as active object
        canvas.setActiveObject(svgGroup);

        // Force render
        canvas.requestRenderAll();
  // canvas render requested for SVG

        // Save state for undo/redo
        this.saveCanvasState(canvas);

        // SVG import completed
      });

    } catch (error) {
      console.error('Failed to import SVG:', error);
      alert('Failed to import SVG: ' + error.message);
    }
  }

    /**
   * Clean up drawing resources
   */
  cleanup(modal, canvas) {
    if (canvas) {
      canvas.dispose();
    }
    if (modal && modal.parentNode) {
      modal.parentNode.removeChild(modal);
    }
    // Remove escape handler if it was attached
    if (modal && modal._escapeHandler) {
      document.removeEventListener('keydown', modal._escapeHandler);
      modal._escapeHandler = null;
    }
    this.isModalOpen = false;

    // Remove keyboard event listener
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler);
      this.keyboardHandler = null;
    }

    // Reset state to default tool (rect)
    this.currentTool = 'rect';
    this.isDrawing = false;
    this.startPoint = null;
    this.canvasHistory = [];
    this.historyStep = -1;
    this.undoBtn = null;
    this.redoBtn = null;
  }
}

// Create a singleton instance
export const drawingSystem = new DrawingSystem();