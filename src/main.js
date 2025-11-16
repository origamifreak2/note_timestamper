/**
 * @fileoverview Main renderer process entry point for Note Timestamper
 * Coordinates all modules and handles application initialization
 */

// Import all modules
import { formatTime, isMac } from './modules/utils.js';
import { timerSystem } from './modules/timer.js';
import { audioLevelMonitor } from './modules/audioLevel.js';
import { deviceManager } from './modules/deviceManager.js';
import { exportSystem } from './modules/exportSystem.js';
import { registerCustomBlots } from './editor/customBlots.js';
import { imageManager } from './editor/imageManager.js';
import { imageResizer } from './editor/imageResizer.js';
import { mixerSystem } from './recording/mixerSystem.js';
import { recordingSystem } from './recording/recordingSystem.js';
import { cameraSystem } from './ui/cameraSystem.js';
import { drawingSystem } from './ui/drawingSystem.js';

/**
 * Note Timestamper Application
 * Main application class that coordinates all modules
 */
class NoteTimestamperApp {
  constructor() {
    // DOM element references
    this.elements = {};

    // Quill editor instance
    this.quill = null;

    // Application state
    this.isInitialized = false;

    // Current save session ID for progress tracking
    this.currentSaveSessionId = null;

    // Bind methods
    this.onStateChange = this.onStateChange.bind(this);
    this.onTimestampClick = this.onTimestampClick.bind(this);
    this.onQuillTextChange = this.onQuillTextChange.bind(this);
    this.onKeyboardShortcut = this.onKeyboardShortcut.bind(this);
    this.onSaveProgress = this.onSaveProgress.bind(this);
  }

  /**
   * Initialize the application
   */
  async init() {
    if (this.isInitialized) return;

    console.log('Initializing Note Timestamper...');

    try {
      // Get DOM element references
      this.getDOMReferences();

      // Initialize Quill editor
      this.initializeQuillEditor();

    // Initialize all modules
    this.initializeModules();

    // Set up event handlers
    this.setupEventHandlers();

    // Initialize devices
    await this.initializeDevices();

    // Note: Removed periodic monitor - no longer needed with proper state management

    // Set up menu action listener
    this.setupMenuListener();

    // Listen for save progress events from main process
    if (window.menu && window.menu.onAction) {
      // We need a way to listen to IPC messages; add it to the menu channel if available
      // For now, we'll handle this in the IPC listener setup below
    }

    // Update initial UI state
    this.updateUIState();      this.isInitialized = true;
      console.log('Note Timestamper initialized successfully');

    } catch (error) {
      console.error('Failed to initialize Note Timestamper:', error);
      if (this.elements.status) {
        this.elements.status.textContent = 'Initialization failed: ' + error.message;
      }
    }
  }

  /**
   * Get references to all DOM elements
   */
  getDOMReferences() {
    // Media player and recording controls
    this.elements.player = document.getElementById('player');
    this.elements.btnStart = document.getElementById('btnStart');
    this.elements.btnPause = document.getElementById('btnPause');
    this.elements.btnStop = document.getElementById('btnStop');

    // File operations
  // File operations moved to menu

    // UI elements
    this.elements.audioOnly = document.getElementById('audioOnly');
    this.elements.status = document.getElementById('status');
    this.elements.timeDisplay = document.getElementById('tNow');

    // Device selection UI
    this.elements.micSelect = document.getElementById('micSelect');
    this.elements.camSelect = document.getElementById('camSelect');
    this.elements.resSelect = document.getElementById('resSelect');
    this.elements.fpsSelect = document.getElementById('fpsSelect');
    this.elements.audioBitrateSelect = document.getElementById('audioBitrateSelect');
    this.elements.btnRefreshDevs = document.getElementById('btnRefreshDevs');

    // Audio level meter UI
    this.elements.audioLevelMeter = document.getElementById('audioLevelMeter');
    this.elements.audioLevelFill = document.getElementById('audioLevelFill');
    this.elements.audioLevelText = document.getElementById('audioLevelText');

    // Editor elements
    this.elements.editorWrap = document.getElementById('editorWrap');

    // Progress modal elements
    this.elements.saveProgressModal = document.getElementById('saveProgressModal');
    this.elements.saveProgressTitle = document.getElementById('saveProgressTitle');
    this.elements.saveProgressStatus = document.getElementById('saveProgressStatus');
    this.elements.saveProgressFill = document.getElementById('saveProgressFill');
    this.elements.saveProgressPercent = document.getElementById('saveProgressPercent');

    // File loading modal elements
    this.elements.fileLoadingModal = document.getElementById('fileLoadingModal');
    this.elements.fileLoadingTitle = document.getElementById('fileLoadingTitle');
    this.elements.fileLoadingStatus = document.getElementById('fileLoadingStatus');
  }

  /**
   * Initialize the Quill editor with custom configuration
   */
  initializeQuillEditor() {
    // Register custom blots first
    registerCustomBlots();

    // Initialize Quill editor
    this.quill = new Quill('#editor', {
      theme: 'snow',
      modules: {
        toolbar: {
          container: '#toolbar',
          handlers: {
            // Custom handlers for toolbar buttons
            undo: () => this.quill.history.undo(),
            redo: () => this.quill.history.redo(),
            image: () => this.handleImageUpload(),
            camera: () => this.handleCameraCapture(),
            drawing: () => this.handleDrawing()
          }
        },
        history: {
          delay: 500,
          maxStack: 200,
          userOnly: true
        }
      },
      formats: [
        'header', 'bold', 'italic', 'underline', 'strike',
        'list', 'indent', 'align', 'color', 'background',
        'link', 'blockquote', 'code-block',
        'image', 'timestamp'
      ]
    });

    // Set up clipboard handling for custom blots
    this.setupClipboardHandlers();

    // Initial height adjustment for the editor
    setTimeout(() => this.adjustEditorHeight(), 50);
  }

  /**
   * Initialize all application modules
   */
  initializeModules() {
    // Initialize timer system
    timerSystem.init(this.elements.timeDisplay, this.elements.player);

    // Initialize audio level monitor
    audioLevelMonitor.init(
      this.elements.audioLevelMeter,
      this.elements.audioLevelFill,
      this.elements.audioLevelText
    );

    // Initialize device manager
    deviceManager.init(
      this.elements.micSelect,
      this.elements.camSelect,
      this.elements.resSelect,
      this.elements.fpsSelect,
      this.elements.audioBitrateSelect,
      this.elements.audioOnly
    );

    // Initialize mixer system
    mixerSystem.init(deviceManager);

    // Initialize recording system
    recordingSystem.init({
      player: this.elements.player,
      statusEl: this.elements.status,
      timeDisplay: this.elements.timeDisplay,
      buttons: {
        btnStart: this.elements.btnStart,
        btnPause: this.elements.btnPause,
        btnStop: this.elements.btnStop
      },
      onStateChange: this.onStateChange
    });

    // Initialize image manager
    imageManager.init(this.quill);

    // Initialize image resizer
    imageResizer.init(this.quill, this.elements.editorWrap, imageManager);

    // Initialize export system
    exportSystem.init(recordingSystem, this.quill);
  }

  /**
   * Set up all event handlers
   */
  setupEventHandlers() {
    // Recording controls
    if (this.elements.btnStart) {
      this.elements.btnStart.addEventListener('click', () => this.handleStartRecording());
    }
    if (this.elements.btnPause) {
      this.elements.btnPause.addEventListener('click', () => recordingSystem.togglePause());
    }
    if (this.elements.btnStop) {
      this.elements.btnStop.addEventListener('click', () => this.handleStopRecording());
    }

    // File operations moved to menu - no longer bound to header buttons
    // Reset is now in the File menu; header button removed

    // Device selection
    if (this.elements.audioOnly) {
      this.elements.audioOnly.addEventListener('change', () => this.handleAudioOnlyChange());
    }
    if (this.elements.micSelect) {
      this.elements.micSelect.addEventListener('change', () => this.handleMicrophoneChange());
    }
    if (this.elements.camSelect) {
      this.elements.camSelect.addEventListener('change', () => this.handleCameraChange());
    }
    if (this.elements.resSelect) {
      this.elements.resSelect.addEventListener('change', () => deviceManager.persistSelection());
    }
    if (this.elements.fpsSelect) {
      this.elements.fpsSelect.addEventListener('change', () => deviceManager.persistSelection());
    }
    if (this.elements.audioBitrateSelect) {
      this.elements.audioBitrateSelect.addEventListener('change', () => deviceManager.persistSelection());
    }
    if (this.elements.btnRefreshDevs) {
      this.elements.btnRefreshDevs.addEventListener('click', () => this.refreshDevices());
    }

    // Editor events
    this.quill.on('text-change', this.onQuillTextChange);

    // Timestamp clicks
    this.quill.root.addEventListener('click', this.onTimestampClick);

    // Keyboard shortcuts
    document.addEventListener('keydown', this.onKeyboardShortcut, true);
    this.quill.keyboard.addBinding({ key: 'T', shortKey: true, altKey: true }, () => this.insertTimestamp());

    // Custom toolbar buttons
    this.setupCustomToolbarButtons();

    // Player events
    if (this.elements.player) {
      this.elements.player.addEventListener('play', () => this.handlePlayerPlay());
      this.elements.player.addEventListener('pause', () => this.handlePlayerPause());
    }

    // Auto-refresh device list when devices change
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', () => this.refreshDevices());
    }

    // Dynamic editor height handling
    this.setupDynamicEditorHeight();
  }

  /**
   * Set up custom toolbar button handlers
   */
  setupCustomToolbarButtons() {
    const undoButton = document.querySelector('#toolbar .ql-undo');
    if (undoButton) {
      undoButton.addEventListener('click', () => this.quill.getModule('toolbar').handlers.undo());
    }

    const redoButton = document.querySelector('#toolbar .ql-redo');
    if (redoButton) {
      redoButton.addEventListener('click', () => this.quill.getModule('toolbar').handlers.redo());
    }

    const timestampButton = document.querySelector('#toolbar .ql-timestamp');
    if (timestampButton) {
      timestampButton.addEventListener('click', () => this.insertTimestamp());
    }
  }

  /**
   * Set up dynamic editor height functionality
   */
  setupDynamicEditorHeight() {
    // Add resize event listeners
    window.addEventListener('resize', () => this.adjustEditorHeight());

    // Use ResizeObserver for more responsive updates (if supported)
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(() => this.adjustEditorHeight());

      // Observe changes to the main container and header
      const main = document.querySelector('main');
      const header = document.querySelector('header');

      if (main) {
        resizeObserver.observe(main);
      }
      if (header) {
        resizeObserver.observe(header);
      }
    }

    // Initial height adjustment
    // Use setTimeout to ensure DOM is fully rendered
    setTimeout(() => this.adjustEditorHeight(), 100);
  }

  /**
   * Adjust the editor height to fill available space
   */
  adjustEditorHeight() {
    const editorWrap = document.getElementById('editorWrap');
    if (!editorWrap) return;

    try {
      // Let CSS flexbox handle the sizing automatically
      // This method is called primarily to trigger any necessary Quill updates
      if (this.quill && this.quill.root) {
        // Force Quill to recalculate its internal dimensions
        setTimeout(() => {
          // Ensure the container takes full available space
          const container = this.quill.container;
          const editor = this.quill.root;

          if (container && editor) {
            // Trigger a layout recalculation by briefly changing display
            const originalDisplay = container.style.display;
            container.style.display = 'none';
            container.offsetHeight; // Force reflow
            container.style.display = originalDisplay || '';

            // Ensure proper scrolling behavior
            editor.style.overflowY = 'auto';
          }
        }, 10);
      }
    } catch (error) {
      console.warn('Error adjusting editor height:', error);
    }
  }

  /**
   * Set up clipboard handlers for custom blots
   */
  setupClipboardHandlers() {
    const Delta = Quill.import('delta');

    // Convert pasted/loaded timestamp buttons back to custom blot format
    this.quill.clipboard.addMatcher('button.ts', (node, delta) => {
      const ts = Number(node.getAttribute('data-ts') || '0');
      const label = node.textContent || formatTime(ts);
      return new Delta().insert({ timestamp: { ts, label } }).insert(' ');
    });

    // Convert pasted/loaded images with dimensions back to custom format
    this.quill.clipboard.addMatcher('img', (node, delta) => {
      const src = node.getAttribute('src');
      if (!src) return delta;

      const width = node.style.width ? parseInt(node.style.width) : null;
      const height = (node.style.height && node.style.height !== 'auto') ? parseInt(node.style.height) : null;

      let imageValue = src;
      if (width || height) {
        if (height) {
          imageValue = `${src}|${width}x${height}`;
        } else {
          imageValue = `${src}|${width}`;
        }
      }

      return new Delta().insert({ image: imageValue });
    });
  }

  /**
   * Initialize device enumeration and permissions
   */
  async initializeDevices() {
    await deviceManager.ensurePermissions();
    await deviceManager.loadDevices();
  }

  /**
   * Set up menu action listener for File menu interactions
   */
  setupMenuListener() {
    if (window.menu && window.menu.onAction) {
      window.menu.onAction((action) => {
        switch (action) {
          case 'save':
            this.handleSaveSession();
            break;
          case 'save-as':
            this.handleSaveSessionAs();
            break;
          case 'load':
            this.handleLoadSession();
            break;
          case 'export-embedded':
            this.exportAsEmbeddedHtml();
            break;
          case 'export-separate':
            this.exportAsSeparateFiles();
            break;
          case 'reset':
            this.handleResetSession();
            break;
          default:
            console.warn('Unknown menu action:', action);
        }
      });
    }

    // Listen for save progress events from main process
    if (window.menu && typeof window.menu.onSaveProgress === 'function') {
      window.menu.onSaveProgress((progress) => this.onSaveProgress(progress));
    }

    // Listen for file loading events from main process
    if (window.menu && typeof window.menu.onFileLoadingStart === 'function') {
      window.menu.onFileLoadingStart(() => this.onFileLoadingStart());
    }
    if (window.menu && typeof window.menu.onFileLoadingComplete === 'function') {
      window.menu.onFileLoadingComplete(() => this.onFileLoadingComplete());
    }
  }

  /**
   * Send menu state to main process for updating menu item enabled states
   */
  sendMenuState() {
    if (!window.menu || !window.menu.sendState) return;

    const hasNotes = this.quill && this.quill.getText().trim().length > 0;
    const hasCompletedRecording = !!recordingSystem.getRecordedBlob();
    const isCurrentlyRecording = recordingSystem.isRecording();
    const hasRecording = !!recordingSystem.getRecordedBlob();

    const menuState = {
      canSave: (hasNotes && !isCurrentlyRecording) || hasCompletedRecording,
      canSaveAs: (hasNotes && !isCurrentlyRecording) || hasCompletedRecording,
      canLoad: !isCurrentlyRecording,
      canExport: hasRecording,
      canReset: this.hasContent()
    };

    window.menu.sendState(menuState);
  }

  // =====================================================================
  // EVENT HANDLERS
  // =====================================================================

  /**
   * Handle recording state changes
   */
  onStateChange() {
    console.log('Recording state changed, updating UI...');
    this.updateUIState();
  }

  /**
   * Handle Quill text changes
   */
  onQuillTextChange() {
    // Only update content-related UI state, not recording controls
    this.updateContentState();
  }

  /**
   * Handle save progress updates from main process
   */
  onSaveProgress({ id, phase, percent, bytesWritten, statusText }) {
    // Only show progress if this is our current save session
    if (id !== this.currentSaveSessionId) return;

    // Update progress UI
    if (this.elements.saveProgressFill) {
      this.elements.saveProgressFill.style.width = `${percent}%`;
    }
    if (this.elements.saveProgressPercent) {
      this.elements.saveProgressPercent.textContent = percent;
    }
    if (this.elements.saveProgressStatus) {
      this.elements.saveProgressStatus.textContent = statusText || phase;
    }

    // Hide modal when complete
    if (phase === 'completed' && this.elements.saveProgressModal) {
      setTimeout(() => {
        this.elements.saveProgressModal.classList.remove('visible');
        this.currentSaveSessionId = null;
      }, 500);
    }
  }

  /**
   * Handle file loading start event from main process
   */
  onFileLoadingStart() {
    if (this.elements.fileLoadingModal) {
      this.elements.fileLoadingModal.classList.add('visible');
    }
  }

  /**
   * Handle file loading complete event from main process
   */
  onFileLoadingComplete() {
    if (this.elements.fileLoadingModal) {
      this.elements.fileLoadingModal.classList.remove('visible');
    }
  }

  /**
   * Handle timestamp button clicks
   */
  onTimestampClick(e) {
    const btn = e.target.closest('button.ts');
    if (!btn) return;

    const ts = Number(btn.dataset.ts || '0');
    if (!Number.isFinite(ts)) return;

    // Jump to the timestamp in the video/audio player
    this.elements.player.currentTime = ts;
    this.elements.player.play();
  }

  /**
   * Handle keyboard shortcuts
   */
  onKeyboardShortcut(e) {
    const want = (isMac() ? e.metaKey : e.ctrlKey) && e.altKey &&
                 (e.code === 'KeyT' || e.key === 't' || e.key === 'T');
    if (!want) return;

    e.preventDefault();
    e.stopPropagation();
    this.focusEditorEndIfNeeded();
    this.insertTimestamp();
  }

  /**
   * Handle player play events
   */
  handlePlayerPlay() {
    // Only start playback timer if we have loaded media (not live recording)
    if (this.elements.player.src && !this.elements.player.srcObject && !recordingSystem.isRecording()) {
      timerSystem.startPlaybackTimer();
    }
  }

  /**
   * Handle player pause events
   */
  handlePlayerPause() {
    // Pause the playback timer when video is paused
    if (this.elements.player.src && !this.elements.player.srcObject && !recordingSystem.isRecording()) {
      timerSystem.stopPlaybackTimer();
      // Update display one final time with current position
      timerSystem.updateRecordingTimer();
    }
  }

  // =====================================================================
  // RECORDING OPERATIONS
  // =====================================================================

  /**
   * Handle start recording button click
   */
  async handleStartRecording() {
    if (recordingSystem.getRecordedBlob()) {
      const sure = window.confirm("Starting a new recording will overwrite the existing one.\n\nContinue?");
      if (!sure) return;

      // Clear existing recording
      recordingSystem.recordedBlob = null;
      this.elements.player.pause();
      this.elements.player.srcObject = null;
      this.elements.player.removeAttribute('src');
      this.elements.player.load();
      timerSystem.stopPlaybackTimer();
    }

    // Immediately disable resolution dropdown and update recording controls
    console.log('Pre-emptively disabling recording controls before starting recording');
    this.updateRecordingControlsStateForRecording(true);

    try {
      await recordingSystem.startRecording();
    } catch (error) {
      // If recording failed, re-enable the controls
      console.error('Recording failed to start, re-enabling controls:', error);
      this.updateRecordingControlsStateForRecording(false);
      throw error;
    }
  }

  /**
   * Handle stop recording button click
   */
  async handleStopRecording() {
    console.log('handleStopRecording called');
    await recordingSystem.stopRecording();

    // Ensure resolution and framerate dropdowns are re-enabled after stopping
    if (this.elements.resSelect) {
      console.log('Re-enabling resolution dropdown after recording stopped');
      const shouldDisable = recordingSystem.isRecording() || deviceManager.isAudioOnly();
      this.elements.resSelect.disabled = shouldDisable;
      this.elements.resSelect.title = shouldDisable ?
        (deviceManager.isAudioOnly() ? 'Resolution not applicable for audio-only recording' : 'Stop recording first to change resolution') :
        'Select recording resolution';
    }
    if (this.elements.fpsSelect) {
      console.log('Re-enabling framerate dropdown after recording stopped');
      const shouldDisable = recordingSystem.isRecording() || deviceManager.isAudioOnly();
      this.elements.fpsSelect.disabled = shouldDisable;
      this.elements.fpsSelect.title = shouldDisable ?
        (deviceManager.isAudioOnly() ? 'Framerate not applicable for audio-only recording' : 'Stop recording first to change framerate') :
        'Select recording framerate';
    }
  }

  // =====================================================================
  // DEVICE MANAGEMENT
  // =====================================================================

  /**
   * Handle audio-only mode change
   */
  async handleAudioOnlyChange() {
    deviceManager.updateDeviceUIState(false, recordingSystem.isRecording());
    deviceManager.persistSelection();

    // Update audio level meter visibility
    if (deviceManager.isAudioOnly() && recordingSystem.isRecording()) {
      audioLevelMonitor.toggle(true);
      audioLevelMonitor.start();
    } else {
      audioLevelMonitor.toggle(false);
      audioLevelMonitor.stop();
    }
  }

  /**
   * Handle microphone selection change
   */
  async handleMicrophoneChange() {
    deviceManager.persistSelection();
    const id = deviceManager.getSelectedMicId();
    if (id && recordingSystem.isRecording()) {
      await recordingSystem.switchMicrophoneLive(id);
    }
  }

  /**
   * Handle camera selection change
   */
  async handleCameraChange() {
    deviceManager.persistSelection();
    const id = deviceManager.getSelectedCamId();
    if (id && recordingSystem.isRecording()) {
      await recordingSystem.switchCameraLive(id);
    }
  }

  /**
   * Refresh device list
   */
  async refreshDevices() {
    await deviceManager.ensurePermissions();
    await deviceManager.loadDevices();
  }

  // =====================================================================
  // FILE OPERATIONS
  // =====================================================================

  /**
   * Save current session
   */
  async handleSaveSession() {
    const noteHtml = this.quill.root.innerHTML;
    // Generate a unique session ID for progress tracking
    const sessionId = `save-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.currentSaveSessionId = sessionId;

    // Show progress modal
    if (this.elements.saveProgressModal) {
      this.elements.saveProgressModal.classList.add('visible');
      this.elements.saveProgressTitle.textContent = 'Saving Session...';
      this.elements.saveProgressPercent.textContent = '0';
      this.elements.saveProgressFill.style.width = '0%';
    }

    // Stream media to main process temp file to avoid buffering into memory
    const recordedBlob = recordingSystem.getRecordedBlob();
    let mediaFilePath = null;

    if (recordedBlob) {
      // Ask main process to create a temp file for the media
      const tmp = await window.api.createTempMedia({ fileName: `media.${recordingSystem.getMediaExtension()}`, sessionId });
      if (!tmp || !tmp.ok) {
        this.elements.status.textContent = 'Failed to create temp media file.';
        if (this.elements.saveProgressModal) {
          this.elements.saveProgressModal.classList.remove('visible');
        }
        return;
      }
      const id = tmp.id;

      // Stream blob to main process in chunks
      try {
        const stream = recordedBlob.stream();
        const reader = stream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          // value is a Uint8Array — send to main
          await window.api.appendTempMedia(id, value, sessionId);
        }
        const closed = await window.api.closeTempMedia(id);
        if (!closed || !closed.ok) {
          this.elements.status.textContent = 'Failed to finalize temp media file.';
          if (this.elements.saveProgressModal) {
            this.elements.saveProgressModal.classList.remove('visible');
          }
          return;
        }
        mediaFilePath = closed.path;
      } catch (err) {
        console.error('Error streaming media to temp file', err);
        this.elements.status.textContent = 'Failed to stream media to temp file.';
        if (this.elements.saveProgressModal) {
          this.elements.saveProgressModal.classList.remove('visible');
        }
        return;
      }
    }

    const result = await window.api.saveSession({
      noteHtml,
      // pass mediaFilePath when available so main can stream into zip
      mediaFilePath,
      mediaSuggestedExt: recordingSystem.getMediaExtension(),
      sessionId
    });

    // Hide progress modal (it should already be hidden on completion, but ensure it)
    if (this.elements.saveProgressModal) {
      this.elements.saveProgressModal.classList.remove('visible');
    }
    this.elements.status.textContent = result.ok ? `Saved → ${result.path || result.dir}` : 'Save canceled';
  }

  /**
   * Save current session (Save As - always prompt for location)
   */
  async handleSaveSessionAs() {
    const noteHtml = this.quill.root.innerHTML;
    // Generate a unique session ID for progress tracking
    const sessionId = `save-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.currentSaveSessionId = sessionId;

    // Show progress modal
    if (this.elements.saveProgressModal) {
      this.elements.saveProgressModal.classList.add('visible');
      this.elements.saveProgressTitle.textContent = 'Saving Session...';
      this.elements.saveProgressPercent.textContent = '0';
      this.elements.saveProgressFill.style.width = '0%';
    }

    // Stream media to main process temp file to avoid buffering into memory
    const recordedBlob = recordingSystem.getRecordedBlob();
    let mediaFilePath = null;

    if (recordedBlob) {
      const tmp = await window.api.createTempMedia({ fileName: `media.${recordingSystem.getMediaExtension()}`, sessionId });
      if (!tmp || !tmp.ok) {
        this.elements.status.textContent = 'Failed to create temp media file.';
        if (this.elements.saveProgressModal) {
          this.elements.saveProgressModal.classList.remove('visible');
        }
        return;
      }
      const id = tmp.id;

      try {
        const stream = recordedBlob.stream();
        const reader = stream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await window.api.appendTempMedia(id, value, sessionId);
        }
        const closed = await window.api.closeTempMedia(id);
        if (!closed || !closed.ok) {
          this.elements.status.textContent = 'Failed to finalize temp media file.';
          if (this.elements.saveProgressModal) {
            this.elements.saveProgressModal.classList.remove('visible');
          }
          return;
        }
        mediaFilePath = closed.path;
      } catch (err) {
        console.error('Error streaming media to temp file', err);
        this.elements.status.textContent = 'Failed to stream media to temp file.';
        if (this.elements.saveProgressModal) {
          this.elements.saveProgressModal.classList.remove('visible');
        }
        return;
      }
    }

    const result = await window.api.saveSession({
      noteHtml,
      mediaFilePath,
      mediaSuggestedExt: recordingSystem.getMediaExtension(),
      forceSaveAs: true,
      sessionId
    });

    // Hide progress modal
    if (this.elements.saveProgressModal) {
      this.elements.saveProgressModal.classList.remove('visible');
    }
    this.elements.status.textContent = result.ok ? `Saved → ${result.path || result.dir}` : 'Save canceled';
  }

  /**
   * Load existing session
   */
  async handleLoadSession() {
    const result = await window.api.loadSession();
    if (!result || !result.ok) return;

    // Load notes
    const html = result.notesHtml || '';
    if (html.trim()) {
      const delta = this.quill.clipboard.convert({ html });
      this.quill.setContents(delta, 'api');
    } else {
      this.quill.setText('');
    }

    // Load media
    recordingSystem.loadRecording(result.mediaArrayBuffer);

    this.elements.status.textContent = 'Session loaded.';
  }

  /**
   * Reset session with confirmation
   */
  async handleResetSession() {
    if (this.hasContent()) {
      const wantSave = window.confirm('Save before resetting?\n\nOK = Save, Cancel = Don\'t Save');
      if (wantSave) {
        await this.handleSaveSession();
        // TODO: Check if save was successful before proceeding
      } else {
        const sure = window.confirm('Reset without saving?');
        if (!sure) return;
      }
    }

    // Clear last opened session so subsequent Save behaves like a new Save
    try {
      if (window.session && window.session.clearLastOpenedSession) {
        await window.session.clearLastOpenedSession();
      }
    } catch (err) {
      console.warn('Failed to clear last opened session:', err);
    }

    // Reset recording system
    recordingSystem.reset();

    // Reset editor
    this.elements.timeDisplay.textContent = '00:00.00';
    this.quill.setText('');

    this.updateUIState();
    this.elements.status.textContent = 'Session reset.';
  }

  // =====================================================================
  // EXPORT OPERATIONS
  // =====================================================================

  /**
   * Export as embedded HTML
   */
  async exportAsEmbeddedHtml() {
    try {
      const result = await exportSystem.exportAsEmbeddedHtml();
      this.elements.status.textContent = result.ok ? `Exported → ${result.path}` : 'Export canceled';
    } catch (error) {
      console.error('Export failed:', error);
      this.elements.status.textContent = 'Export failed: ' + error.message;
    }
  }

  /**
   * Export as separate files
   */
  async exportAsSeparateFiles() {
    try {
      const result = await exportSystem.exportAsSeparateFiles();
      if (result.ok) {
        if (result.videoPath) {
          this.elements.status.textContent = `Exported → HTML + ${result.videoFileName}`;
        } else {
          this.elements.status.textContent = `Exported → HTML (no video)`;
        }
      } else {
        this.elements.status.textContent = 'Export canceled';
      }
    } catch (error) {
      console.error('Export failed:', error);
      this.elements.status.textContent = 'Export failed: ' + error.message;
    }
  }

  // =====================================================================
  // EDITOR OPERATIONS
  // =====================================================================

  /**
   * Insert timestamp at cursor position
   */
  insertTimestamp() {
    if (!this.quill) return;

    const currentTime = timerSystem.getCurrentRecordingTime();
    const timeStr = formatTime(currentTime);

    const range = this.quill.getSelection(true);

    // Insert the timestamp embed
    this.quill.insertEmbed(range.index, 'timestamp', { ts: currentTime, label: timeStr }, 'user');

    // Insert a space after the timestamp
    this.quill.insertText(range.index + 1, ' ', 'user');

    // Position cursor after the timestamp and space
    this.quill.setSelection(range.index + 2);
  }

  /**
   * Handle image upload from file picker
   */
  async handleImageUpload() {
    const result = await window.api.pickImage();
    if (result && result.ok) {
      await imageManager.insertDataUrlImage(result.dataUrl);
    }
  }

  /**
   * Handle camera photo capture
   */
  async handleCameraCapture() {
    this.elements.status.textContent = 'Opening camera...';
    try {
      const dataUrl = await cameraSystem.capturePhotoFromCamera();
      if (dataUrl) {
        await imageManager.insertDataUrlImage(dataUrl);
        this.elements.status.textContent = 'Photo captured and inserted.';
      } else {
        this.elements.status.textContent = 'Photo capture cancelled.';
      }
    } catch (error) {
      console.error('Camera capture error:', error);
      this.elements.status.textContent = 'Camera capture failed.';
    }
  }

  /**
   * Handle drawing canvas
   */
  async handleDrawing() {
    this.elements.status.textContent = 'Opening drawing canvas...';
    try {
      const dataUrl = await drawingSystem.openDrawingModal();
      if (dataUrl) {
        await imageManager.insertDataUrlImage(dataUrl);
        this.elements.status.textContent = 'Drawing inserted.';
      } else {
        this.elements.status.textContent = 'Drawing cancelled.';
      }
    } catch (error) {
      console.error('Drawing error:', error);
      this.elements.status.textContent = 'Drawing failed.';
    }
  }

  /**
   * Focus editor if not already focused
   */
  focusEditorEndIfNeeded() {
    const inEditor = document.activeElement && document.activeElement.closest && document.activeElement.closest('.ql-editor');
    if (!inEditor) {
      this.quill.focus();
      this.quill.setSelection(this.quill.getLength(), 0);
    }
  }

  // =====================================================================
  // UI STATE MANAGEMENT
  // =====================================================================

  /**
   * Update UI state based on application state
   */
  updateUIState() {
    this.updateSaveState();
    this.updateLoadState();
    this.updateExportState();
    this.updateRecordingControlsState();
    this.sendMenuState();
  }

  /**
   * Update UI state for content changes (excludes recording controls)
   */
  updateContentState() {
    this.updateSaveState();
    this.updateLoadState();
    this.updateExportState();
    this.sendMenuState();
    // Intentionally NOT calling updateRecordingControlsState() here
    // Recording controls should only be updated on recording state changes
  }

  /**
   * Update save button state
   */
  updateSaveState() {
    // Save/Save As logic is now handled via menu; no button UI updates needed
    // But we still track the state for sendMenuState()
  }

  /**
   * Update load button state
   */
  updateLoadState() {
    // Load logic is now handled via menu; no button UI updates needed
    // But we still track the state for sendMenuState()
  }

  /**
   * Update export button state
   */
  updateExportState() {
    // Export logic is now handled via menu; no button UI updates needed
    // But we still track the state for sendMenuState()
  }

  /**
   * Update recording controls state
   */
  updateRecordingControlsState() {
    const isRecording = recordingSystem.isRecording();
    const isAudioOnly = deviceManager.isAudioOnly();

    // Update resolution and framerate controls
    // Try to get the elements fresh in case they weren't available during initialization
    const resSelect = this.elements.resSelect || document.getElementById('resSelect');
    const fpsSelect = this.elements.fpsSelect || document.getElementById('fpsSelect');

    if (resSelect) {
      const shouldDisable = isRecording || isAudioOnly;
      console.log('Updating resolution dropdown - disabled:', shouldDisable, '(recording:', isRecording, 'audioOnly:', isAudioOnly, ')');
      resSelect.disabled = shouldDisable;
      resSelect.title = isRecording ?
        'Stop recording first to change resolution' :
        (isAudioOnly ? 'Resolution not applicable for audio-only recording' : 'Select recording resolution');

      // Update our reference in case it was null before
      this.elements.resSelect = resSelect;
    } else {
      console.error('resSelect element not found! DOM might not be ready yet.');
    }

    if (fpsSelect) {
      const shouldDisable = isRecording || isAudioOnly;
      console.log('Updating framerate dropdown - disabled:', shouldDisable, '(recording:', isRecording, 'audioOnly:', isAudioOnly, ')');
      fpsSelect.disabled = shouldDisable;
      fpsSelect.title = isRecording ?
        'Stop recording first to change framerate' :
        (isAudioOnly ? 'Framerate not applicable for audio-only recording' : 'Select recording framerate');

      // Update our reference in case it was null before
      this.elements.fpsSelect = fpsSelect;
    } else {
      console.error('fpsSelect element not found! DOM might not be ready yet.');
    }

    if (!resSelect || !fpsSelect) {
      // Try again after a short delay if any elements are missing
      setTimeout(() => this.updateRecordingControlsState(), 100);
      return;
    }

    if (this.elements.audioOnly) {
      this.elements.audioOnly.disabled = isRecording;
      this.elements.audioOnly.title = isRecording ?
        'Stop recording first to change audio-only mode' :
        'Record audio only (no video)';
    }

    // Update device selection state
    deviceManager.updateDeviceUIState(false, isRecording);
  }

  /**
   * Force update recording controls to a specific recording state
   * Used to pre-emptively set controls before recording actually starts
   * @param {boolean} isRecording - Whether recording is active
   */
  updateRecordingControlsStateForRecording(isRecording) {
    const isAudioOnly = deviceManager.isAudioOnly();

    // Force resolution and framerate dropdown states
    const resSelect = this.elements.resSelect || document.getElementById('resSelect');
    const fpsSelect = this.elements.fpsSelect || document.getElementById('fpsSelect');

    if (resSelect) {
      const shouldDisable = isRecording || isAudioOnly;
      console.log('Force setting resolution dropdown disabled:', shouldDisable, '(recording:', isRecording, 'audioOnly:', isAudioOnly, ')');
      resSelect.disabled = shouldDisable;
      resSelect.title = isRecording ?
        'Stop recording first to change resolution' :
        (isAudioOnly ? 'Resolution not applicable for audio-only recording' : 'Select recording resolution');
    }

    if (fpsSelect) {
      const shouldDisable = isRecording || isAudioOnly;
      console.log('Force setting framerate dropdown disabled:', shouldDisable, '(recording:', isRecording, 'audioOnly:', isAudioOnly, ')');
      fpsSelect.disabled = shouldDisable;
      fpsSelect.title = isRecording ?
        'Stop recording first to change framerate' :
        (isAudioOnly ? 'Framerate not applicable for audio-only recording' : 'Select recording framerate');
    }

    // Force audio-only checkbox state
    if (this.elements.audioOnly) {
      this.elements.audioOnly.disabled = isRecording;
      this.elements.audioOnly.title = isRecording ?
        'Stop recording first to change audio-only mode' :
        'Record audio only (no video)';
    }

    // Also update device selection state
    deviceManager.updateDeviceUIState(false, isRecording);
  }

  /**
   * Check if session has content worth saving
   */
  hasContent() {
    const text = this.quill && this.quill.getText().trim();
    return !!recordingSystem.getRecordedBlob() || (text && text.length > 0);
  }
}

// Create app instance
const app = new NoteTimestamperApp();

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  app.init().catch(error => {
    console.error('Failed to initialize application:', error);
  });
});

// Make app instance available globally for debugging
window.noteTimestamperApp = app;