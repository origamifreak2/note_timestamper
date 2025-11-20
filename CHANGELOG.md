# Changelog

All notable changes to **Note Timestamper** will be documented here.

## [Unreleased]
### Security
- **Fixed critical security vulnerability** in media permission handler
  - Added origin validation to `setPermissionRequestHandler` in `main.js`
  - Now validates `details.requestingUrl` to ensure requests come from trusted `file://` origins
  - Prevents malicious external content from accessing camera/microphone
  - Logs warning when blocking untrusted permission requests

### Fixed
- **Fixed memory leaks** in `src/recording/recordingSystem.js`
  - Added blob URL tracking with `currentBlobUrl` property
  - Properly revoke blob URLs with `URL.revokeObjectURL()` before creating new ones
  - Clean up URLs in `finalizePreview()`, `loadRecording()`, and `reset()` methods
  - Prevents memory accumulation across multiple recording sessions

## [0.11.0] - 2025-11-16
### Added
- **Drawing edit functionality** with double-click to re-edit inserted drawings
  - Fabric.js canvas JSON stored in `data-fabric-json` attribute on image elements
  - Double-click on any drawing reopens the drawing modal with all objects loaded
  - Full undo/redo history available when editing
  - Drawing metadata travels with images through save/load operations
- **Enhanced imageManager** with `insertDrawingImage()` method
  - Embeds Fabric.js JSON data alongside image data URL
  - Preserves fabric data during image resize operations
  - Maintains backward compatibility with regular images
- **Drawing data persistence** in `.notepack` sessions
  - Fabric JSON preserved in HTML for re-editing within app
  - Custom blot handles object format with fabricJSON property
  - Clipboard matcher preserves fabric data when loading sessions
- **Export system cleanup** for external sharing
  - `stripFabricData()` removes editing metadata from exported HTML
  - Cleans up `data-fabric-json`, `editable-drawing` class, cursor styles
  - Ensures exported files contain only final rendered images

### Enhanced
- Drawing system now returns `{ dataUrl, fabricJSON }` instead of just data URL
- `openDrawingModal()` accepts optional `fabricJSON` parameter for editing mode
- Image resizing preserves fabric data using object format internally
- Visual feedback: editable drawings show pointer cursor and "Double-click to edit" tooltip

## [0.10.0] - 2025-11-16
### Added
- **Zip-based session persistence** using `.notepack` file format (yazl/yauzl libraries)
  - Sessions saved as compressed zip files instead of folders
  - Includes `notes.html`, encoded media file, and `session.json` metadata
  - Seamless load/save operations with file chooser dialogs
- **Streaming architecture for large recordings** with zero in-memory buffering
  - Renderer streams recorded blob in chunks via Web Streaming API
  - Chunks written to temporary file via IPC (create/append/close temp media handlers)
  - Temp file streamed directly into zip using yazl's file streaming
  - Eliminates memory spikes when saving multi-gigabyte recordings
- **Automatic cleanup of orphaned temporary files** on app startup
  - Scans OS temp directory for files matching `/^\d+-[a-z0-9]+-/` pattern
  - Removes incomplete temp files from previous sessions or crashes
  - Runs during `app.whenReady()` initialization
- **Progress reporting system** for save operations (5 phases with real-time feedback)
  - **creating-zip**: Initializing zip file structure
  - **streaming-media**: Writing recorded media to temp file (with percent calculation)
  - **writing-zip**: Building final zip archive with all entries
  - **completed**: Save finished (auto-hides progress modal)
  - Progress events include: sessionId, phase, percent, bytesWritten, statusText
  - Renderer receives events via `menu.onSaveProgress()` listener from preload
- **Progress modal UI** with animated progress bar and live status text
  - Modal displays during save with title, phase status, percent complete
  - Smooth width animation for progress bar with green gradient
  - Auto-hides when phase='completed'
- **File loading indicator** with spinner animation for large file opens
  - Spinner appears during `load-session` operation
  - Shows pulsing indefinite progress bar during load
  - Provides visual feedback that app is responsive while reading zip
  - Auto-hides when file load completes
- **IPC handlers for streaming temp media** (preload API additions)
  - `createTempMedia({ fileName, sessionId })`: Creates temp file, returns id and path
  - `appendTempMedia(id, chunk, sessionId)`: Streams chunk to temp file, returns bytesWritten
  - `closeTempMedia(id)`: Closes temp file stream, returns final path
- **IPC event listeners** for progress and loading UI
  - `menu.onSaveProgress(callback)`: Receives { id, phase, percent, bytesWritten, statusText }
  - `menu.onFileLoadingStart(callback)`: Triggers when opening .notepack file
  - `menu.onFileLoadingComplete(callback)`: Called when file is fully loaded

### Fixed
- Save operation no longer buffers entire recorded blob in memory before writing
- Temp files from interrupted saves are automatically cleaned up on app restart
- File loading operations provide visual feedback to user (prevents appearance of frozen UI)

### Enhanced
- Session persistence now uses industry-standard zip format for better compatibility
- Progress events enable real-time feedback during large file operations
- Main process session management is now more transparent with detailed phase reporting

## [0.9.2] - 2025-11-15
### Added
- Native File menu (Save, Save As, Load, Export, Reset) with platform-appropriate accelerators
- "Save" now overwrites the loaded session directory when a session was opened with Load; "Save" prompts for a location when creating a new session
- "Save As" always prompts for a save location (force-save-as)
- Menu-state synchronization: renderer sends enabled/disabled state to main so native menu items mirror the app UI

### Fixed
- Ensure macOS application menu is refreshed after state changes so menu enabled flags update correctly
- Prevent accidental ReferenceError in main save handler (use explicit payload param instead of `arguments`)

## [0.9.1] - 2025-11-14
### Added
- **Centralized CONFIG system** (`src/config.js`) with organized constants:
  - Recording settings (MIME types, resolutions, framerates, audio bitrates)
  - Audio analyzer configuration and level monitoring settings
  - UI constants (z-index values, modal dimensions)
  - Standardized STATES, ERRORS, and MESSAGES objects
  - LocalStorage key management through STORAGE_KEYS
- **Enhanced mixer system architecture** (`src/recording/mixerSystem.js`):
  - Sophisticated Web Audio API + Canvas video mixing
  - Live device switching without stopping recording
  - AudioContext with MediaStreamSource and AnalyserNode integration
  - Canvas-based video capture with controlled framerate
- **Advanced state management** in main app coordinator:
  - Specialized UI update methods (`updateUIState`, `updateContentState`, `updateRecordingControlsState`)
  - Pre-emptive control state updates to prevent race conditions
  - Proper separation of concerns between recording and content state

### Enhanced
- **Audio level monitoring** (`src/modules/audioLevel.js`) integrated with Web Audio analyzer
- **Recording system** with improved MediaRecorder lifecycle management
- **Device manager** with enhanced permission handling and device persistence
- **Module initialization** with proper dependency injection patterns

### Fixed
- Race conditions in UI state updates during recording state changes
- Proper cleanup and destruction of Web Audio contexts and canvas streams
- Enhanced recording control synchronization to prevent UI flicker

## [0.9.0] - 2025-11-01
### Added
- **Mic & Camera selectors** with live device switching **without stopping** the recording via a stable **mixer stream** (WebAudio + canvas capture).
- **Overwrite warning** when starting a new recording while one already exists.
- **“Save before Reset?”** prompt, with cancel-safe flow.
- **Force Finalize** safety path for edge cases where `stop` events misbehave.

### Fixed
- Stop button reliability: 100ms flush delay + 3s fallback; safer `requestData()` use.
- Duplicate function definitions (`switchMicLive` / `switchCamLive`) removed.
- Quill styling issues: ensured `quill.core.css` and `quill.snow.css` are both loaded.
- Quill CDN fallback added if `/vendor` assets are missing.

## [0.8.1] - 2025-10-31
### Added
- Image handling: insert via picker, paste, or drag-drop.
- **Image resize handles** with overlay (shift-drag to keep aspect ratio).
- Keyboard shortcut **⌘/Ctrl + Alt + T** to insert timestamp buttons at caret.
- “Export HTML” (single-file export with embedded media + clickable timestamp buttons).

### Fixed
- Timestamp caret placement (cursor now lands **after** the timestamp button).

## [0.8.0] - 2025-10-31
### Added
- Switched from TinyMCE to **Quill** (local vendored assets).
- Quill toolbar (headers, bold/italic/underline/strike, lists, align, color, background, link, quote, code block, clean, undo/redo, image, timestamp).
- **Save / Load `.notepack`** (notes.html + media + session.json).
- Reset button to clear notes and recording.

### Fixed
- “Export HTML” video playback issues in the exported file.

## [0.7.x] - 2025-10-30
### Added
- Basic recorder UI: Start, Pause/Resume, Stop, status text, current time display.
- Timestamp buttons in HTML notes that jump playback to that time.
- Audio-only toggle.

### Fixed
- Initial stop reliability improvements; preview finalization after stop.

## [0.6.x] - 2025-10-29
### Added
- Initial Electron scaffolding (main/preload/renderer), IPC for save/load/export.
- Minimal in-app HTML editor and timestamp insertion prototype.

