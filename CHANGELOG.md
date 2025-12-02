# Changelog

All notable changes to **Note Timestamper** will be documented here.

## [0.12.5] - 2025-12-01

### Added

- **TypeScript type checking** without transpilation
  - Added `typescript ^5.0.0` as dev dependency
  - Created `tsconfig.json` with `checkJs: false` configuration (only checks files with `// @ts-check`)
  - Configured for ES2022 with DOM and Node types, excludes vendor/test files
  - New `npm run typecheck` script runs `tsc --noEmit` to validate JSDoc types
- **Global type declarations** for vendor libraries in `types/global.d.ts`
  - Added global declarations for `Quill` and `fabric` (loaded via script tags)
  - Enables type checking in modules that reference these libraries

### Fixed

- **TypeScript validation errors** in files with `// @ts-check` directive
  - `deviceManager.js`: Replaced spread operator with `Array.from()` for HTMLOptionsCollection iteration
  - `imageManager.js`: Added `Array.from()` for FileList iteration, cast FileReader.result to string
  - `imageResizer.js`: Added type assertions for EventTarget to access `dataset` and `closest()` properties
  - `customBlots.test.mjs`: Removed unnecessary eslint-disable comment
- **Code formatting**: Ran Prettier on all files for consistent formatting across codebase

### Enhanced

- **Developer tooling**: Complete npm script suite now includes:
  - `npm run lint` - ESLint validation
  - `npm run lint:fix` - Auto-fix linting errors
  - `npm run format` - Format code with Prettier
  - `npm run format:check` - Verify code formatting
  - `npm test` - Run Vitest test suite (39 tests)
  - `npm run typecheck` - TypeScript type checking
- **Type safety workflow**: Gradual TypeScript adoption path without build overhead
  - Zero transpilation required - pure JSDoc validation
  - IDE IntelliSense and autocomplete for all custom types
  - Type errors caught at development time via VS Code
- **TODO completion**: Marked "NPM scripts" task as complete in TODO.md

### Quality Assurance

- All verification scripts pass:
  - ✅ ESLint (0 errors, 0 warnings)
  - ✅ Prettier (all files formatted)
  - ✅ Vitest (39/39 tests passing)
  - ✅ TypeScript (0 type errors)

## [0.12.4] - 2025-11-30

### Added

- **Module Contract blocks** across all key modules: explicit Inputs / Outputs / Side-effects / Invariants / Failure Modes documentation added to:
  - Recording: `recordingSystem.js`, `mixerSystem.js`
  - Core Modules: `deviceManager.js`, `exportSystem.js`, `timer.js`, `audioLevel.js`, `utils.js`, `zipUtils.js`, `errorBoundary.js`
  - Editor: `customBlots.js`, `imageManager.js`, `imageResizer.js`
  - UI: `cameraSystem.js`, `drawingSystem.js`
  - Config & Coordinator: `config.js`, `main.js`

### Enhanced

- **AI & Developer Clarity**: Each module now begins with a concise operational contract summarizing runtime expectations and failure surfaces; complements existing Public API Surface.
- **Error Transparency**: Failure Modes sections enumerate relevant `ERROR_CODES`, improving guided recovery and searchability.
- **Non-invasive change**: Comment-only additions; no runtime logic altered.
- **Test Confidence**: Existing 39-test Vitest suite passes unchanged after documentation update.

### Notes

- Serves as foundation for upcoming ADRs and AI guide; TODO item "Module contracts" marked complete.
- No versioned API changes; semantic bump for documentation improvements.

## [0.12.3] - 2025-11-29

### Added

- **Comprehensive test suite with Vitest**
  - Added Vitest framework for fast ESM-friendly testing
  - Created `vitest.config.mjs` with Node environment configuration
  - Added `jsdom` dev dependency for DOM-dependent tests
  - All 39 tests passing across 6 test files
- **Unit tests for core utilities** (`tests/utils.test.mjs`)
  - `formatTime()`: timestamp formatting validation
  - `withTimeout()`: timeout rejection and success paths
  - `createError()`: coded error object creation
- **Zip/session persistence tests** (`tests/notepack.test.mjs`)
  - yazl/yauzl integration for .notepack file creation and reading
  - Validates complete zip roundtrip with session metadata
- **Error boundary tests** (`tests/errorBoundary.test.mjs`)
  - Error code mapping for device/IPC/recording failures
  - `wrapAsync()` retry logic with success and exhaustion paths
  - User-friendly message generation from error codes
- **Custom Quill blots tests** (`tests/customBlots.test.mjs`)
  - TimestampBlot create/value methods with jsdom environment
  - CustomImage blot with string format (`url|widthxheight`)
  - CustomImage with object format including fabricJSON
  - Global Quill bootstrap for module-level imports
- **Zip utilities tests** (`tests/zipUtils.test.mjs`)
  - `loadSessionWithCodes()`: success, user cancellation, IPC failure paths
  - `saveSessionWithCodes()`: success, user cancellation, write error handling
  - Mocked window.api for IPC operation testing
  - Validates coded error propagation (ERROR_CODES.FILE_SYSTEM_ERROR)
- **Export system tests** (`tests/exportSystem.test.mjs`)
  - `stripFabricData()`: removes editing metadata from exported HTML
  - `extractAndReplaceImages()`: base64 extraction with sequential naming
  - MIME type handling: jpeg→jpg, svg+xml→svg conversions
  - `generateEmbeddedHTML()`: single-file exports with base64 media
  - `generateSeparateHTML()`: external file references with placeholders
  - Template generation: shared styles, utilities, event handlers
  - Script tag escaping in user content

### Enhanced

- **NPM scripts**: Added `npm test` to run Vitest suite
- **Development workflow**: Fast test execution (< 3 seconds for full suite)
- **Code quality**: Test coverage for critical data transformation paths
- **CI readiness**: Foundation for GitHub Actions integration

## [0.12.2] - 2025-11-28

### Added

- **Public API Surface Documentation** across all modules
  - Added comprehensive "Public API Surface" documentation blocks to 17 modules
  - Each module now lists all public methods with parameters, return types, and side effects
  - Internal helpers clearly marked for easy distinction
  - Modules updated:
    - Recording: `recordingSystem.js`, `mixerSystem.js`
    - Modules: `deviceManager.js`, `exportSystem.js`, `timer.js`, `audioLevel.js`, `utils.js`, `zipUtils.js`, `errorBoundary.js`
    - Editor: `customBlots.js`, `imageManager.js`, `imageResizer.js`
    - UI: `cameraSystem.js`, `drawingSystem.js`
    - Config: `config.js`
    - Main: `main.js`

### Enhanced

- **AI-Readability and Developer Experience**
  - Consistent API documentation format across entire codebase
  - Clear method contracts with documented side effects and invariants
  - Easy-to-scan structure for AI tools and human developers
  - Improved code discoverability and maintainability

## [0.12.1] - 2025-11-28

### Added

- Standardized error code system
  - `ERROR_CODES` in `src/config.js`
  - `createError(code, message?, cause?)` in `src/modules/utils.js`
- Zip/Export helpers for coded errors
  - `loadSessionWithCodes()` and `saveSessionWithCodes()` in `src/modules/zipUtils.js`

### Enhanced

- Error boundary mapping and messaging
  - Added `mapErrorToMessage()` and preference for `error.code` in `src/modules/errorBoundary.js`
  - Consistent status/dialog messages across device, IPC, and recording failures
- Propagated coded errors across subsystems
  - `src/recording/mixerSystem.js`: coded errors for mic/cam access and live switching; timeout classified as `CAMERA_INIT_TIMEOUT`
  - `src/recording/recordingSystem.js`: coded error on `MediaRecorder` init; codec failures surfaced via UI
  - `src/modules/deviceManager.js`: coded errors for permission and enumeration failures
  - `src/main.js`: session save/load now use coded wrappers from `zipUtils`

### Fixed

- `@ts-check` warnings in mixer/exports
  - Mixer: removed `webkitAudioContext` reference, added null guards for canvas/video/context
  - Export: typed `HTMLImageElement` in fabric cleanup; annotated extracted images array
- Unified audio level cleanup via `audioLevelMonitor.cleanup()`
- Marked “Standard error codes” as completed in `TODO.md`

## [0.12.0] - 2025-11-28

### Added

- **Type Safety without TypeScript Migration**
  - Created `types/global.d.ts` with comprehensive TypeScript definitions for all domain types:
    - Recording types: `RecordingState`, `PlayerState`, `Mixer`, `RecordingInitOptions`
    - Device types: `Resolution`, `DeviceSelection`, `AudioBitrateOption`
    - Editor types: `TimestampValue`, `ImageValue`, `ImageDimensions`, `ExtractedImage`
    - Session types: `SessionMeta`, `SaveSessionPayload`, `SaveProgress`, `TempMediaStream`
    - IPC interfaces: `WindowAPI`, `WindowMenu`, `WindowSession` with complete method signatures
    - Error boundary types: `ErrorBoundaryWrapOptions`, `DeviceAccessWrapOptions`, `ErrorLogEntry`
    - Utility types: `Result<T, E>`, `Callback<T>`, `CleanupFunction`
  - Enabled `// @ts-check` in all key modules for TypeScript validation without transpilation:
    - `src/recording/recordingSystem.js`
    - `src/recording/mixerSystem.js`
    - `src/modules/deviceManager.js`
    - `src/modules/exportSystem.js`
    - `src/editor/customBlots.js`
    - `src/editor/imageManager.js`
    - `src/editor/imageResizer.js`
- **Comprehensive JSDoc Documentation** for all public methods:
  - `@param` annotations with proper TypeScript type references
  - `@returns` annotations with typed return values including Promise and union types
  - `@throws` annotations documenting specific error conditions
  - **Side effects** documentation showing what state/DOM changes occur
  - **Invariants** documentation describing pre/post-conditions and safety guarantees
  - Type references link to shared types in `types/global.d.ts` using import syntax

### Enhanced

- **AI-Friendly Codebase**: Type definitions make data structures explicit and discoverable for AI tools
- **Developer Experience**: Full IDE IntelliSense, autocomplete, and type checking without build step
- **Error Prevention**: Catch type errors at development time with VS Code type checking
- **Self-Documenting Code**: JSDoc comments provide inline documentation visible in IDE tooltips
- **Architecture Documentation**: Updated `ARCHITECTURE.md` and `README.md` to document type safety approach

### Schema & Validation

- **JSON Schemas** added under `schemas/`:
  - `schemas/session.schema.json` describing `session.json` (`createdAt`, `mediaFile`, `notesFile`, `version`).
  - `schemas/notes-embed.schema.json` defining editor embed formats (`TimestampValue`, `ImageValueObject`, string `ImageValue`).
- **AJV validation** integrated in `main.js` for `load-session`:
  - Lazy-loaded validator compiles `session.schema.json` and validates `session.json` on load.
  - Non-blocking: logs warnings on validation errors, does not interrupt file picker flows.

### Consistency & Types

- **SessionMeta alignment**: Updated `types/global.d.ts` `SessionMeta` to mirror schema fields (`createdAt`, `mediaFile`, `notesFile`, `version`).
- **IPC response rename**: Changed `load-session` return field from `mediaFileName` → `mediaFile` in `main.js`.
- **WindowAPI types**: Updated `types/global.d.ts` `WindowAPI.loadSession()` to return `{ notesHtml, mediaArrayBuffer, mediaFile }`.
- **Docs updated**: `ARCHITECTURE.md` and `.github/copilot-instructions.md` now reference `createdAt/mediaFile/notesFile/version` and `mediaFile` response.

### Benefits

- ✅ Type safety with zero build overhead (no TypeScript compilation required)
- ✅ Gradual migration path - can move to full TypeScript incrementally
- ✅ Jump-to-definition works for all custom types across the codebase
- ✅ Method contracts explicitly documented with side effects and invariants
- ✅ Consistent type annotations across all 7 core modules

## [0.11.1]

### Refactored

- **Export System** (`src/modules/exportSystem.js`)
  - Extracted shared HTML templates into reusable helper methods
  - Created modular template builder with 6 specialized methods:
    - `getSharedStyles()`: CSS styles for both export modes
    - `getSharedUtilities()`: JavaScript utilities (time formatting, DOM refs)
    - `getSharedEventHandlers()`: Event handlers for timestamps, images, modal
    - `getEmbeddedMediaScript()`: Base64 media loading for embedded exports
    - `getSeparateMediaScript()`: External file media loading for separate exports
    - `buildHTMLTemplate()`: Core template assembler
  - Reduced code duplication by ~200 lines
  - Improved maintainability with DRY principle
  - Both export modes now share single source of truth for HTML/CSS/JS

### Added

- **Error Boundary System** (`src/modules/errorBoundary.js`)
  - Comprehensive error handling wrapper for critical operations
  - `wrapAsync()`: Generic async operation wrapper with timeout and retry logic
  - `wrapIPC()`: Specialized wrapper for IPC calls with 10-second timeout and automatic retry
  - `wrapDeviceAccess()`: Device access wrapper with user recovery dialog
  - Structured error logging with telemetry data (timestamp, error type, context, recovery action)
  - User preference persistence in localStorage for retry behavior
  - Standardized notifications: status bar for non-critical errors, modal dialogs for blocking errors
- **Global unhandled promise rejection handler**
  - Catches all unhandled promise rejections to prevent silent failures
  - Logs errors to error boundary for analytics
  - Displays user-friendly messages in status bar
- **IPC operation protection** with timeout and retry
  - All IPC calls now have 10-second timeout protection for background operations
  - Automatic retry with exponential backoff for transient failures
  - File picker operations (save/load/export) exempt from timeout to allow user time
- **Device access retry system**
  - Recovery dialog on device access failures with actionable options
  - Offers to refresh device list and retry once
  - Respects user preference to disable retry prompts
- **Modal cleanup guarantees**
  - Camera and drawing modals ensure cleanup on error paths
  - Prevents DOM pollution and resource leaks on failures

### Security

- **Fixed critical security vulnerability** in media permission handler
  - Added origin validation to `setPermissionRequestHandler` in `main.js`
  - Now validates `details.requestingUrl` to ensure requests come from trusted `file://` origins
  - Prevents malicious external content from accessing camera/microphone
  - Logs warning when blocking untrusted permission requests

### Enhanced

- **Improved error handling** in `src/recording/mixerSystem.js`
  - Replaced silent console warnings with actionable error messages
  - Added user-facing notifications for microphone/camera failures
  - Error messages now include specific guidance based on failure type:
    - Permission denied: Directs user to system settings
    - Device not found: Prompts to connect device and reload
    - Device in use: Suggests closing other applications
    - Timeout errors: Indicates potential hardware issues
  - Enhanced error messages in `src/config.js` with comprehensive ERRORS object
  - Errors properly caught and displayed in status bar via `src/main.js`
  - Live device switching failures now provide actionable feedback
- **Drawing modal error recovery** in `src/ui/drawingSystem.js`
  - Added initialization success flag plus `finally` block guaranteeing cleanup when Fabric.js setup fails early
  - Stored Escape key handler reference on modal and removed it in `cleanup()` to prevent orphaned listeners
  - Consolidated cleanup path (removed duplicate catch cleanup) for consistent resource release

### Fixed

- **Fixed memory leaks** in `src/recording/recordingSystem.js`
  - Added blob URL tracking with `currentBlobUrl` property
  - Properly revoke blob URLs with `URL.revokeObjectURL()` before creating new ones
  - Clean up URLs in `finalizePreview()`, `loadRecording()`, and `reset()` methods
  - Prevents memory accumulation across multiple recording sessions
- **Fixed canvas animation cleanup** in `src/recording/mixerSystem.js`
  - Added lifecycle checks to canvas draw loop (video element existence, playback state, ready state)
  - Draw loop now stops gracefully when video element is destroyed or becomes invalid
  - Enhanced `destroy()` method with proper cleanup order and null assignments
  - Prevents runaway animations and "Failed to execute 'drawImage'" console errors
  - Eliminates unnecessary CPU consumption after mixer cleanup
- **Fixed timeout error handling** in `src/modules/utils.js`
  - Updated `withTimeout()` to clear timeout handle on resolve/reject
  - Prevents dangling timers and potential memory leaks
  - Ensures timed operations cancel cleanly when underlying promise settles first

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
