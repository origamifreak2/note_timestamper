# Note Timestamper - Architecture

This document describes the architecture of the Note Timestamper application, featuring a modular ES6 system with Web Audio + Canvas mixing capabilities.

## 🏗️ Architecture Overview

The application uses a layered modular architecture with comprehensive type safety:

```
src/
├── main.js                 # Main coordinator (NoteTimestamperApp class)
├── config.js              # Centralized configuration and constants
├── modules/                # Core utilities (timer, devices, export, audioLevel)
│   ├── utils.js           # Common utility functions
│   ├── timer.js           # Recording/playback timing system
│   ├── audioLevel.js      # Real-time audio level monitoring
│   ├── deviceManager.js   # Device enumeration and selection (@ts-check enabled)
│   └── exportSystem.js    # Session export functionality (@ts-check enabled)
├── editor/                # Quill.js customizations (blots, images, resizing)
│   ├── customBlots.js     # Custom Quill.js blots (@ts-check enabled)
│   ├── imageManager.js    # Image handling and drag-drop (@ts-check enabled)
│   └── imageResizer.js    # Interactive image resizing (@ts-check enabled)
├── recording/             # Advanced MediaRecorder + Web Audio mixing
│   ├── mixerSystem.js     # Web Audio API + Canvas mixing (@ts-check enabled)
│   └── recordingSystem.js # MediaRecorder lifecycle (@ts-check enabled)
└── ui/                    # Modal dialogs (camera, drawing)
    ├── cameraSystem.js    # Camera capture functionality
    └── drawingSystem.js   # Drawing canvas with Fabric.js

types/
└── global.d.ts            # TypeScript type definitions for all modules

tests/
├── utils.test.mjs         # Core utility function tests
├── notepack.test.mjs      # Zip archive creation/reading tests
├── errorBoundary.test.mjs # Error handling and retry logic tests
├── customBlots.test.mjs   # Quill.js blot tests (jsdom)
├── zipUtils.test.mjs      # IPC persistence wrapper tests
└── exportSystem.test.mjs  # HTML export and template tests
```

## 📚 Public API Surface Documentation

Every singleton module includes a comprehensive "Public API Surface" documentation block at the top of the file, providing a clear contract for what the module exposes:

```javascript
/**
 * @fileoverview Module description
 *
 * =====================
 * Public API Surface
 * =====================
 * Methods:
 *   - methodName(param: Type): ReturnType
 *       Brief description of what the method does.
 *       Side effects: What state/DOM changes occur.
 *   - async asyncMethod(param: Type): Promise<ReturnType>
 *       Brief description.
 *       Side effects: ...
 *
 * Internal helpers are marked 'Internal'.
 * Invariants and side effects are documented per method.
 */
```

### Documentation Coverage

All 17 core modules include Public API documentation:

**Recording System:**

- `recordingSystem.js`: 8 public methods (init, start/stop/pause, finalize, reset, state management)
- `mixerSystem.js`: 6 public methods (init, createMixerStream, live switching, destroy)

**Core Modules:**

- `deviceManager.js`: 13 public methods (device enumeration, selection, constraints)
- `exportSystem.js`: 14 public methods (export modes, template builders, utilities)
- `timer.js`: 8 public methods (recording/playback timing, state management)
- `audioLevel.js`: 6 public methods (monitoring, UI control)
- `utils.js`: 5 utility functions (time formatting, base64, sleep, timeout, errors)
- `zipUtils.js`: 2 coded persistence wrappers (load/save with error codes)
- `errorBoundary.js`: 9 public methods (error wrapping, logging, dialogs, state)

**Editor System:**

- `customBlots.js`: 2 Quill blot classes (TimestampBlot, CustomImageBlot)
- `imageManager.js`: 7 public methods (insert, drag-drop, paste, update)
- `imageResizer.js`: 13 public methods (overlay, selection, drag handlers)

**UI Components:**

- `cameraSystem.js`: 6 public methods (capture modal, device switching, cleanup)
- `drawingSystem.js`: 2 primary methods (openDrawingModal, setupDrawingUI)

**Configuration:**

- `config.js`: 5 exported objects (CONFIG, STATES, ERROR_CODES, ERRORS, MESSAGES)
- `main.js`: 40+ public methods organized by category (initialization, recording, session, export, editor)

### Benefits

✅ **AI-Friendly**: Clear API contracts improve code generation and understanding
✅ **Developer Onboarding**: New developers can quickly understand module capabilities
✅ **Maintenance**: Easy to identify what's public vs. internal
✅ **Refactoring Safety**: Clear contracts prevent accidental breaking changes
✅ **Documentation at Source**: No need to maintain separate API docs
✅ **Consistency**: Standardized format across all modules

## 📘 Module Contract Blocks

In addition to the Public API Surface, each key module now begins with a concise **Module Contract** block summarizing its runtime role and boundaries.

**Structure (ordered):**

1. Inputs – Data sources, dependencies, DOM references, user interactions
2. Outputs – Objects, return values, emitted callbacks/events, state mutations externally observable
3. Side-effects – DOM writes, media allocation, network/IPC access, timers
4. Invariants – Conditions that must always hold (single active recorder, blob URL revocation, bounded history arrays, etc.)
5. Failure Modes – Enumerated error scenarios mapped to `ERROR_CODES` (or noted as silent no-op) for consistent recovery handling

**Purpose & Differences vs Public API:**

- Public API lists callable methods/functions; Module Contract gives holistic behavioral context.
- Contracts accelerate AI / human reasoning during refactors (quick scan clarifies impact surface without reading implementation).
- Failure modes section standardizes which coded errors may be thrown (searchable across codebase).

**Authoring Guidelines:**

- Keep each list terse and implementation-agnostic (avoid line-by-line detail).
- Include all externally visible side-effects (media permission prompts, object URL creation, DOM mutations).
- Invariants should be phrased as guarantees ("Only one active mixer", "Blob URL revoked before new one").
- Failure Modes must use exact `ERROR_CODES` symbols when applicable; group misc unexpected cases under `UNKNOWN`.
- Pure/utility modules explicitly state "None" for side-effects/failure modes where appropriate.
- Update both Public API Surface and Module Contract when adding/removing public methods or changing error behavior.

**When to Update:**

- Adding a new public method that introduces new inputs/outputs or side-effects.
- Introducing a new error code or altering failure semantics.
- Changing resource lifecycle (e.g., adding a new interval, stream, or global listener).

These blocks complement JSDoc method-level docs, enabling layered understanding: (1) Contract overview → (2) Public API listing → (3) Individual method details.

## 🔒 Type Safety Architecture

The application implements **type safety without full TypeScript migration** using JSDoc annotations and TypeScript type checking:

### Type Definitions (`types/global.d.ts`)

Centralized TypeScript definitions provide type safety across the codebase:

- **Recording Types**: `RecordingState`, `PlayerState`, `Mixer`, `RecordingInitOptions`
- **Device Types**: `Resolution`, `DeviceSelection`, `AudioBitrateOption`
- **Editor Types**: `TimestampValue`, `ImageValue`, `ImageDimensions`, `ExtractedImage`
- **Session Types**: `SessionMeta`, `SaveSessionPayload`, `SaveProgress`, `TempMediaStream`
- **IPC Interfaces**: `WindowAPI`, `WindowMenu`, `WindowSession` with complete method signatures
- **Error Types**: `ErrorBoundaryWrapOptions`, `DeviceAccessWrapOptions`, `ErrorLogEntry`
- **Utility Types**: `Result<T, E>`, `Callback<T>`, `CleanupFunction`

### JSDoc + @ts-check Pattern

All key modules use `// @ts-check` to enable TypeScript validation without transpilation:

```javascript
// @ts-check
/**
 * @fileoverview Main recording system using MediaRecorder API
 */

/**
 * Starts a new recording session
 * @returns {Promise<void>}
 * @throws {Error} If device access fails or MediaRecorder initialization fails
 *
 * Side effects:
 * - Requests microphone and camera permissions
 * - Creates MediaRecorder instance
 * - Starts audio level monitoring
 * - Updates UI state to 'recording'
 *
 * Invariants:
 * - Must be called when not already recording
 * - Cleans up any existing mixer before starting new session
 */
async startRecording() { ... }
```

### Enhanced JSDoc Documentation

Every public method includes comprehensive documentation:

- **@param**: Parameter types with proper TypeScript references
- **@returns**: Return types including Promise and union types
- **@throws**: Documented error conditions with specific error types
- **Side effects**: What state/DOM changes occur
- **Invariants**: Pre/post-conditions and safety guarantees

### Benefits

✅ **AI-Friendly**: Type definitions make the codebase structure explicit and discoverable
✅ **IntelliSense**: Full IDE autocomplete and type checking
✅ **Error Prevention**: Catch type errors at development time
✅ **Self-Documenting**: JSDoc comments provide inline documentation
✅ **No Build Step**: Runs directly without TypeScript compilation
✅ **Gradual Adoption**: Can migrate to full TypeScript incrementally

## 🧪 Test Architecture

The application uses **Vitest** for fast, ESM-friendly testing with comprehensive coverage:

### Test Suite Overview

```javascript
// Run all tests
npm test

// Test files: 6 files, 39 tests, all passing
// Execution time: ~3 seconds for full suite
```

### Test Categories

**1. Core Utilities** (`tests/utils.test.mjs`)

- Time formatting: `formatTime()` with various timestamp values
- Timeout handling: `withTimeout()` success and rejection paths
- Error creation: `createError()` with coded errors

**2. Zip Archive Operations** (`tests/notepack.test.mjs`)

- yazl/yauzl integration for .notepack file format
- Complete roundtrip: write → read → validate
- Session metadata preservation

**3. Error Boundary System** (`tests/errorBoundary.test.mjs`)

- Error code mapping (device, IPC, recording failures)
- `wrapAsync()` retry logic with exponential backoff
- Success paths and failure exhaustion scenarios
- User-friendly message generation

**4. Custom Quill Blots** (`tests/customBlots.test.mjs`)

- jsdom environment for DOM testing
- TimestampBlot: create/value methods with timestamp data
- CustomImage: string format (`url|widthxheight`) and object format
- FabricJSON preservation for editable drawings
- Global Quill bootstrap pattern for module imports

**5. Persistence Wrappers** (`tests/zipUtils.test.mjs`)

- `loadSessionWithCodes()`: success, cancellation, error flows
- `saveSessionWithCodes()`: write operations with coded errors
- Mocked window.api for isolated IPC testing
- Validates ERROR_CODES.FILE_SYSTEM_ERROR propagation

**6. Export System** (`tests/exportSystem.test.mjs`)

- `stripFabricData()`: removes editing metadata from HTML
- `extractAndReplaceImages()`: base64 extraction with MIME handling
- Template generation: embedded and separate file modes
- Shared components: styles, utilities, event handlers
- Script tag escaping in user content

### Test Configuration

**vitest.config.mjs**:

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{js,mjs}'],
  },
});
```

### Testing Patterns

**Mocking IPC Operations**:

```javascript
const mockApi = {
  loadSession: vi.fn(),
  saveSession: vi.fn(),
};
globalThis.window = { api: mockApi };
```

**jsdom for DOM Tests**:

```javascript
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

// Set global before importing modules that need it
globalThis.Quill = Quill;
const { registerCustomBlots } = await import('../src/editor/customBlots.js');
```

**Async Error Testing**:

```javascript
await expect(someAsyncOperation()).rejects.toMatchObject({
  code: ERROR_CODES.DEVICE_NOT_FOUND,
  message: expect.stringContaining('not found'),
});
```

### Benefits

✅ **Fast Execution**: Full suite runs in ~3 seconds
✅ **ESM Native**: No transpilation needed for ES6 modules
✅ **Type Safe**: Works seamlessly with @ts-check modules
✅ **Isolated Testing**: Mocking prevents external dependencies
✅ **DOM Testing**: jsdom enables testing of editor and UI components
✅ **CI Ready**: Easy integration with GitHub Actions
✅ **Coverage Ready**: Can enable coverage reporting when needed

## 🎯 Innovation: Web Audio + Canvas Mixing

One of the application's features is a sophisticated mixing system that enables live device switching during recording:

### Audio Processing Pipeline

```javascript
// Audio flow: Microphone → Web Audio Context → MediaStreamDestination
micStream → createMediaStreamSource() → analyser → destination.stream
```

- **AudioContext**: Isolated audio processing environment
- **MediaStreamSource**: Converts microphone input to Web Audio nodes
- **AnalyserNode**: Real-time audio level monitoring and visualization
- **MediaStreamDestination**: Outputs processed audio as MediaStream

### Video Processing Pipeline

```javascript
// Video flow: Camera → HTMLVideoElement → Canvas → captureStream()
cameraStream → videoElement → canvas.drawImage() → canvas.captureStream(fps)
```

- **HTMLVideoElement**: Plays camera stream for canvas rendering
- **Canvas 2D Context**: Draws video frames at controlled framerate
- **RequestAnimationFrame Loop**: Maintains consistent video rendering with lifecycle checks
  - Verifies video element existence before each draw
  - Checks playback state (not paused/ended) and ready state
  - Stops gracefully when video becomes invalid or is destroyed
- **Canvas.captureStream()**: Outputs canvas as MediaStream at specified FPS

### Live Device Switching

- **Seamless Audio**: Reconnects Web Audio nodes without recording interruption
- **Dynamic Video**: Updates canvas source video element in real-time
- **Recording Continuity**: MediaRecorder.requestData() prevents gaps in output

## ⚙️ Configuration Architecture

Centralized configuration system in `src/config.js`:

```javascript
import { CONFIG, STATES, ERRORS, MESSAGES } from './config.js';

// Recording settings
const defaultRes = CONFIG.RECORDING.DEFAULT_RESOLUTION;
const supportedMimes = CONFIG.RECORDING.SUPPORTED_MIME_TYPES;

// State management
if (recordingState === STATES.RECORDING.PAUSED) {
  /* ... */
}

// Consistent messaging
statusEl.textContent = MESSAGES.RECORDING.STARTED;
```

### Configuration Categories

- **RECORDING**: MediaRecorder settings, codecs, framerates, bitrates
- **AUDIO**: Web Audio API settings, analyser configuration
- **TIMER**: Update intervals, timeout handling
- **IMAGE**: File size limits, quality settings, dimensions
- **UI**: Z-index values, modal dimensions, layout constants
- **STORAGE_KEYS**: LocalStorage persistence keys
- **STATES**: Enumerated state values for consistency
- **ERRORS**: Comprehensive error messages with actionable guidance
  - Camera errors: Permission denied, not found, in use, timeout, switch failures
  - Microphone errors: Permission denied, not found, in use, connection failures
  - Each error provides specific resolution steps for users
- **MESSAGES**: Success messages for user feedback

## 📦 Module Responsibilities

### Type Definitions (`types/global.d.ts`)

- **Domain Types**: RecordingState, DeviceSelection, ImageValue, TimestampValue, etc.
- **IPC Interfaces**: Complete type definitions for window.api, window.menu, window.session
- **Error Types**: Structured error handling types with recovery options
- **Utility Types**: Generic Result<T, E>, Callback<T>, CleanupFunction patterns
- **AI-Readable**: Serves as authoritative source of truth for data structures

### Core Configuration (`src/config.js`)

- **Centralized Settings**: All application constants and configuration
- **State Enums**: Consistent state values across modules
- **Message Templates**: Standardized user-facing text
- **Storage Keys**: LocalStorage key management

### Core Modules (`src/modules/`)

- **utils.js**: Common utilities (time formatting, base64 conversion, sleep, etc.)
- **timer.js**: Sophisticated timing for recording (excludes paused periods) and playback
- **audioLevel.js**: Real-time audio level monitoring integrated with Web Audio analyser
- **deviceManager.js**: Device enumeration, selection persistence, constraint building with CONFIG integration
- **exportSystem.js**: Modular HTML export system with template builder architecture
  - Shared template components for DRY principle
  - Supports embedded (base64) and separate file exports
  - Reusable CSS, JavaScript, and event handler builders
  - Single source of truth for HTML structure
- **errorBoundary.js**: Comprehensive error handling system with timeout protection, retry logic, and structured logging

### Editor System (`src/editor/`)

- **customBlots.js**: Custom Quill.js elements (clickable timestamps, images with dimensions)
- **imageManager.js**: Advanced image insertion, drag-and-drop, clipboard handling
- **imageResizer.js**: Interactive drag handles for resizing images in the editor

### Recording System (`src/recording/`)

- **mixerSystem.js**: Sophisticated Web Audio + Canvas mixing with live device switching
  - Canvas draw loop with lifecycle checks for graceful cleanup
  - Proper animation cleanup prevents runaway timers and resource leaks
  - Comprehensive error handling with user-facing messages
  - Device-specific error detection (NotAllowedError, NotFoundError, NotReadableError)
  - Actionable guidance for permission, connection, and hardware failures
- **recordingSystem.js**: Advanced MediaRecorder lifecycle, codec selection, state management, blob URL memory management

### UI Components (`src/ui/`)

- **cameraSystem.js**: Camera modal for capturing photos during recording
- **drawingSystem.js**: Drawing canvas modal using Fabric.js for sketching and editing
  - Supports creating new drawings with various tools (pencil, shapes, text, image import)
  - Enables re-editing of previously inserted drawings via double-click
  - Returns both PNG data URL and Fabric.js JSON for editability
  - Includes undo/redo history and full tool palette

## 🎨 Drawing Edit System

The application features a sophisticated drawing system that allows users to create and edit drawings:

### Drawing Creation and Editing Flow

```javascript
// Create new drawing
const result = await drawingSystem.openDrawingModal();
// Returns: { dataUrl: "data:image/png;base64,...", fabricJSON: "{...}" }

// Edit existing drawing
const fabricJSON = img.getAttribute('data-fabric-json');
const result = await drawingSystem.openDrawingModal(fabricJSON);
// Reopens with all previous objects loaded
```

### Data Persistence Strategy

- **Fabric.js JSON** stored in `data-fabric-json` attribute on image elements
- Drawing metadata travels with the image in HTML
- Preserved through save/load operations in `.notepack` files
- Stripped from exported HTML to keep external files clean

### Key Components

**Image Manager Integration:**

```javascript
// Insert new drawing with fabric data
await imageManager.insertDrawingImage(dataUrl, fabricJSON);

// Update existing image preserves fabric data during resize
imageManager.updateImageInQuill(img); // Checks for data-fabric-json
```

**Custom Image Blot:**

- `CustomImage.create()` adds `data-fabric-json` attribute when present
- Adds `editable-drawing` class and pointer cursor for visual feedback
- `CustomImage.value()` preserves fabric data during serialization

**Clipboard Handler:**

- Detects `data-fabric-json` attribute when loading sessions
- Uses object format to preserve fabric data through paste operations
- Maintains backward compatibility with regular images

**Double-Click Editing:**

- Event handler in main app detects double-clicks on editable drawings
- Extracts fabric JSON and reopens drawing modal
- Replaces original image in-place with updated version

**Export System:**

- `stripFabricData()` removes editing metadata before export
- Cleans up `data-fabric-json`, `editable-drawing` class, and cursor styles
- Ensures exported HTML contains only final rendered images

### Benefits

- No separate file management needed
- Drawing data survives copy/paste and undo/redo
- Seamless integration with existing image system
- Clean separation between internal editing and external sharing

## 📤 Export System Architecture

The export system uses a modular template builder pattern to eliminate code duplication and ensure consistency across export formats.

### Template Builder Pattern

```javascript
// Modular template construction
const styles = exportSystem.getSharedStyles(); // Common CSS
const utilities = exportSystem.getSharedUtilities(); // JS utilities
const handlers = exportSystem.getSharedEventHandlers(); // Event handlers
const mediaScript = exportSystem.getEmbeddedMediaScript(b64, mime); // Media loading
const html = exportSystem.buildHTMLTemplate(notes, mediaScript); // Assembly
```

### Template Components

**1. Shared Styles (`getSharedStyles()`)**

- Grid layout with responsive breakpoints
- Video/audio player styling
- Timestamp button styles
- Image modal overlay and interactions
- Consistent across both export modes

**2. Shared Utilities (`getSharedUtilities()`)**

- `fmtTime()`: Time formatting (MM:SS.ms)
- DOM element references (player, time display)
- Common initialization code

**3. Shared Event Handlers (`getSharedEventHandlers()`)**

- Timestamp button click handling (seeks video to timestamp)
- Image click-to-expand modal functionality
- Modal close handlers (click outside, ESC key, close button)
- Video timeupdate for current time display

**4. Media Loading Scripts**

- `getEmbeddedMediaScript()`: Base64 decoding and blob URL creation
- `getSeparateMediaScript()`: External file reference with fallback message
- Mode-specific logic isolated in dedicated methods

**5. Core Template Builder (`buildHTMLTemplate()`)**

- Assembles complete HTML document from components
- Handles script tag escaping in notes content
- Injects media script at appropriate location
- Single assembly point for all export modes

### Export Modes

**Embedded Export** (single file):

```javascript
const mediaScript = this.getEmbeddedMediaScript(base64Data, mimeType);
return this.buildHTMLTemplate(notesHtml, mediaScript);
```

- Base64-encodes media into HTML
- Self-contained single file
- Ideal for email sharing or small recordings

**Separate Files Export** (HTML + media folder):

```javascript
const mediaScript = this.getSeparateMediaScript();
return this.buildHTMLTemplate(notesHtml, mediaScript);
```

- References external media file
- Better for large recordings
- Includes images subfolder support

### Benefits of Template Builder Pattern

✅ **DRY Principle**: Shared code in single location (~200 lines saved)
✅ **Maintainability**: CSS/JS updates happen once, apply to both modes
✅ **Consistency**: Both exports guaranteed to have identical structure
✅ **Extensibility**: Easy to add new export formats by composing existing components
✅ **Testability**: Individual template components can be unit tested
✅ **Clarity**: Clear separation between template structure and mode-specific logic

## 🔄 State Management Architecture

### Sophisticated UI Synchronization

The application uses multiple specialized update methods to prevent state conflicts:

```javascript
// Recording state changes trigger full UI updates
recordingSystem.onStateChange = () => {
  this.updateUIState(); // Complete refresh
};

// Content changes only update relevant controls
this.quill.on('text-change', () => {
  this.updateContentState(); // Excludes recording controls
});

// Pre-emptive control updates prevent race conditions
async handleStartRecording() {
  this.updateRecordingControlsStateForRecording(true); // Disable before start
  await recordingSystem.startRecording();
  // Controls already disabled, no flash/flicker
}
```

### State Update Methods

- **`updateUIState()`**: Full UI refresh for major state changes
- **`updateContentState()`**: Content-only updates (excludes recording controls)
- **`updateRecordingControlsState()`**: Recording button states and device controls
- **`updateRecordingControlsStateForRecording()`**: Pre-emptive control updates

### Device Persistence

- Uses `CONFIG.STORAGE_KEYS` for consistent localStorage management
- Automatic device selection restoration on application start
- Graceful fallbacks when previously selected devices are unavailable

## 🏗️ Module Initialization Pattern

All modules follow a consistent singleton pattern:

```javascript
class MySystem {
  constructor() {
    /* private state */
  }
  init(domElements, callbacks) {
    /* setup */
  }
}
export const mySystem = new MySystem(); // singleton
```

### Initialization Flow in `src/main.js`:

1. **DOM References**: Collect all required DOM elements
2. **Module Initialization**: Initialize all singletons with dependencies
3. **Event Binding**: Set up comprehensive event handling
4. **Device Setup**: Enumerate and configure audio/video devices
5. **UI State**: Synchronize initial UI state

### Dependency Injection

- Modules receive DOM elements and callbacks during initialization
- Clear separation between module logic and UI concerns
- Testable interfaces with mock DOM elements

## 🚨 Error Handling Architecture

### Comprehensive Error Detection and User Feedback

The application implements a sophisticated error handling system that provides actionable guidance to users:

```javascript
// Error detection in mixerSystem.js using standardized codes
import { ERROR_CODES, ERRORS } from '../config.js';
import { createError } from '../modules/utils.js';

try {
  micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
} catch (e) {
  const name = /** @type {any} */ (e).name;
  if (name === 'NotAllowedError') {
    throw createError(ERROR_CODES.DEVICE_PERMISSION_DENIED, ERRORS.MIC.PERMISSION_DENIED, e);
  } else if (name === 'NotFoundError') {
    throw createError(ERROR_CODES.DEVICE_NOT_FOUND, ERRORS.MIC.NOT_FOUND, e);
  } else if (name === 'NotReadableError') {
    throw createError(ERROR_CODES.DEVICE_IN_USE, ERRORS.MIC.IN_USE, e);
  }
  throw createError(ERROR_CODES.UNKNOWN, 'Unexpected microphone error', e);
}
```

### Error Flow Architecture

1. **Device Access Layer** (`mixerSystem.js`):
   - Detects specific MediaStream API errors (permissions, hardware, availability)
   - Throws descriptive errors with actionable guidance
   - Includes cleanup logic for partial device setup failures

2. **Recording Coordinator** (`recordingSystem.js`):
   - Catches mixer errors during recording start
   - Passes error messages to UI layer
   - Shows alerts for live device switching failures

3. **UI Layer** (`main.js`):
   - Catches errors from recording system
   - Displays error messages in status bar
   - Re-enables controls after failures
   - Maintains consistent UI state

### Standardized Error Codes

- `ERROR_CODES` in `src/config.js` is the canonical catalog (e.g., `DEVICE_PERMISSION_DENIED`, `DEVICE_NOT_FOUND`, `DEVICE_IN_USE`, `MIC_SWITCH_FAILED`, `CAMERA_INIT_TIMEOUT`, `RECORDING_START_FAILED`, `CODEC_UNSUPPORTED`, `IPC_TIMEOUT`, `FILE_SYSTEM_ERROR`, `SESSION_VALIDATION_FAILED`, `UNKNOWN`).
- Use `createError(code, message?, cause?)` to construct thrown errors with `.code`.
- The `errorBoundary` maps `error.code` to user-facing messages and recovery actions.

### Error Message Categories

- **Permission Errors**: Direct users to system settings with clear instructions
- **Hardware Errors**: Guide users to check device connections
- **Resource Errors**: Suggest closing other applications using the device
- **Timeout Errors**: Indicate potential hardware malfunction
- **Live Switching Errors**: Provide fallback guidance (stop recording and try again)

### Benefits

- ✅ No silent failures - all errors surface to users
- ✅ Actionable guidance reduces support burden
- ✅ Specific error detection enables targeted solutions
- ✅ Consistent error formatting across all modules
- ✅ Proper cleanup prevents cascading failures

## 🛡️ Error Boundary System

The application implements a comprehensive error boundary system that wraps critical operations with timeout protection, automatic retry, and graceful degradation.

### Core Components

**ErrorBoundary Class** (`src/modules/errorBoundary.js`):

```javascript
// Three main wrapper methods for different operation types
errorBoundary.wrapAsync(fn, options); // Generic async with timeout/retry
errorBoundary.wrapIPC(fn, options); // IPC calls with 10s timeout + 2 retries
errorBoundary.wrapDeviceAccess(fn, opts); // Device access with recovery dialog
```

### Wrapper Method Details

**1. wrapAsync() - Generic Operation Wrapper**

- Configurable timeout and retry count
- Exponential backoff between retries (base delay \* 2^attempt)
- Custom error handlers for operation-specific recovery
- Status bar updates during retry attempts

**2. wrapIPC() - IPC Communication Protection**

- 10-second timeout for background operations
- 2 automatic retry attempts with 500ms base delay
- Modal dialog for persistent failures
- Detailed context logging (operation name, parameters)
- **Note**: File picker operations (save/load/export) intentionally not wrapped to allow unlimited user time

**3. wrapDeviceAccess() - Device Recovery System**

- Shows user-friendly recovery dialog on device failures
- Offers to refresh device list and retry once
- Respects user preference to disable retry prompts
- Logs device IDs and context for debugging

### Structured Error Logging

All errors are logged with comprehensive telemetry:

```javascript
{
  timestamp: '2025-11-22T00:00:00.000Z',
  operation: 'device access for recording',
  errorType: 'DEVICE_PERMISSION_DENIED',
  message: 'Microphone access denied...',
  attemptNumber: 1,
  recoveryAction: 'retry',
  context: { micId: 'default', camId: '...' }
}
```

**Error Type Classification**:

- `IPC_TIMEOUT`: IPC operation exceeded timeout
- `DEVICE_PERMISSION_DENIED`: User denied device access (NotAllowedError)
- `DEVICE_NOT_FOUND`: Device not available (NotFoundError)
- `DEVICE_IN_USE`: Device busy (NotReadableError)
- `FILE_SYSTEM_ERROR`: File operations failed
- `RECORDING_START_FAILED`: MediaRecorder initialization failed
- `CODEC_UNSUPPORTED`: Codec/constraint unsupported
- `SESSION_VALIDATION_FAILED`: Session JSON failed schema validation (non-blocking)
- `UNKNOWN`: Unclassified errors

The error boundary prefers `error.code` when classifying and mapping messages.

### User Preference Persistence

Error recovery preferences stored in localStorage:

```javascript
{
  deviceRetryEnabled: true,    // Show device retry dialogs
  ipcRetryEnabled: true,       // Enable automatic IPC retries
  showRecoveryDialogs: true    // Show recovery dialogs globally
}
```

Accessed via `CONFIG.ERROR_BOUNDARY.STORAGE_KEY`.

### Integration Points

**IPC Operations** (temp media streaming retains timeout):

```javascript
// Wrapped - background file operations with timeout
await errorBoundary.wrapIPC(
  () => window.api.createTempMedia({...}),
  { operationName: 'create temp media file', context: {...} }
);

// Not wrapped - file picker needs unlimited time
const result = await window.api.saveSession({...});
```

**Device Access** (recording start):

```javascript
await errorBoundary.wrapDeviceAccess(() => mixerSystem.createMixerStream(), {
  operationName: 'device access for recording',
  deviceManager: mixerSystem.deviceManager,
  context: { micId, camId, isAudioOnly },
});
```

**Global Unhandled Rejection Handler**:

```javascript
window.addEventListener('unhandledrejection', (event) => {
  errorBoundary.logError('unhandled promise rejection', ...);
  statusElement.textContent = `Error: ${event.reason.message}`;
});
```

### Configuration

`CONFIG.ERROR_BOUNDARY` settings:

```javascript
{
  DEFAULT_TIMEOUT: 30000,      // 30s for general operations
  IPC_TIMEOUT: 10000,          // 10s for IPC calls
  IPC_MAX_RETRIES: 2,          // Number of retry attempts
  RETRY_DELAY: 500,            // Base delay (exponential backoff)
  STORAGE_KEY: 'nt_error_boundary_prefs'
}
```

### Benefits

✅ **Timeout Protection**: All IPC background operations have 10-second timeouts
✅ **Automatic Retry**: Transient failures retry with exponential backoff
✅ **User Recovery**: Device failures show recovery dialogs with actionable options
✅ **Structured Logging**: All errors logged with context for analytics
✅ **Cleanup Guarantees**: Modal cleanup runs even on error paths
✅ **User Preferences**: Retry behavior persists across sessions
✅ **No Silent Failures**: Global handler catches all unhandled rejections
✅ **Selective Timeouts**: User-facing operations (file pickers) exempt from timeout

## 🔧 Advanced Features

### 1. **Web Audio + Canvas Innovation**

- Real-time audio/video mixing without MediaStream limitations
- Live device switching during active recording
- Audio level monitoring integrated with Web Audio analyser
- Canvas-based video capture for enhanced control

### 2. **Centralized Configuration**

- Single source of truth for all application settings
- Consistent state enums prevent magic strings
- Standardized error messages and user feedback
- Organized storage key management

### 3. **Sophisticated State Management**

- Multiple specialized UI update methods
- Pre-emptive control state management
- Race condition prevention in recording workflows
- Proper separation of content and recording state

### 4. **Advanced Editor Integration**

- Custom Quill.js blots for timestamps and images
- Interactive image resizing with drag handles
- Comprehensive clipboard and drag-drop support
- Seamless timestamp-to-video synchronization

### 5. **Robust Recording System**

- Intelligent codec selection with fallbacks
- Proper MediaRecorder lifecycle management
- Live device switching without recording interruption
- Enhanced stop/finalization with timeout protection
- Blob URL memory management to prevent memory leaks
- Canvas animation lifecycle management prevents runaway timers and resource leaks

## ⚠️ Critical Integration Points

### MediaRecorder + Web Audio Coordination

- `mixerSystem.js` combines separate audio/video streams using AudioContext
- Required for live device switching during recording
- Canvas-based video mixing for enhanced control and audio level visualization
- MediaRecorder.requestData() maintains recording continuity during device switches

## ⚡ Session Persistence Architecture

### Zip-Based .notepack Format

Sessions are now saved as zip files (with `.notepack` extension) instead of folders:

```
session.notepack (zip file)
├── notes.html          # Rich text notes with timestamps
├── media.webm          # Recorded audio/video (if present)
└── session.json        # Metadata (version, createdAt, mediaFile reference)
```

**Benefits:**

- Single file instead of directory structure
- Portable and easy to share
- Smaller footprint with zip compression
- Consistent file extension across platforms

### Coded Persistence Wrappers

Use `src/modules/zipUtils.js` helpers for persistence with standardized codes:

- `saveSessionWithCodes()` and `loadSessionWithCodes()` return `{ ok, ... }` on success or a coded error object.
- Preserve cancel semantics (user cancellations are not treated as errors).
- Wrap background work with `errorBoundary.wrapIPC(...)`, but never wrap the file picker UI itself (no timeout for user actions).

### Streaming Architecture for Large Files

To avoid memory spikes with large recordings:

1. **Renderer streaming** → Main process:
   - Blob stream is read in chunks via `recordedBlob.stream()`
   - Each chunk sent via IPC to main process (`append-temp-media`)
   - No in-memory buffering of entire recording

2. **Main process temp file**:
   - Temp file created in OS temp directory with pattern: `TIMESTAMP-RANDOM-filename`
   - IPC handlers: `create-temp-media`, `append-temp-media`, `close-temp-media`
   - Tracks bytes written for progress reporting

3. **Yazl streaming into zip**:
   - Uses `yazl.addFile(tempFilePath, zipEntryName)` to stream temp file into zip
   - No re-buffering of media data
   - Automatic cleanup of temp file after zip write completes

4. **Automatic cleanup**:
   - Orphaned temp files cleaned up on app startup via `cleanupOrphanedTempFiles()`
   - Pattern matching: `/^\d+-[a-z0-9]+-/` identifies notepack temp files
   - Non-fatal cleanup failures don't block app startup

## 🔎 Schema & Validation

The session metadata (`session.json`) is validated using Ajv to improve robustness without blocking user flows:

- **Schemas Location**: JSON Schemas live under `schemas/`
  - `schemas/session.schema.json`: Describes `session.json` fields — `createdAt` (ISO date-time), `mediaFile` (string or null), `notesFile` (string), `version` (integer).
  - `schemas/notes-embed.schema.json`: Defines Quill embed formats (`TimestampValue`, `ImageValueObject`, and string `ImageValue`).
- **Integration Point**: Validation occurs in `main.js` during `load-session` after the zip is read.
  - Ajv is lazily loaded and the schema compiled once per app run for performance.
  - Validation is non-blocking: errors are logged as warnings and do not interrupt file picker operations.
- **Types Alignment**: `types/global.d.ts` `SessionMeta` mirrors the schema fields for consistent IntelliSense across modules.

### Progress Reporting Architecture

Real-time progress feedback during save and file open operations:

**Save Progress (defined phases):**

- `creating-zip` (5%): Initial setup
- `streaming-media` (5-95%): Uploading media chunks to temp file
- `writing-zip` (10-95%): Yazl writing output stream to disk
- `completed` (100%): Save finished

**IPC Progress Channel:**

- Main → Renderer: `save-progress` events with `{ id, phase, percent, bytesWritten, statusText }`
- Session ID tracking: unique ID per save operation to distinguish overlapping saves
- Progress modal shows percent, status text, and animated progress bar

**File Loading Indicator:**

- Main → Renderer: `file-loading-start` and `file-loading-complete` events
- Spinner animation (rotating circle) with pulsing indefinite progress bar
- Non-blocking: user can dismiss with file picker cancellation

### IPC Handler Details

**Session Save/Load:**

```javascript
// Streaming-based save
ipcMain.handle('save-session', async (evt, payload) => {
  // payload: { noteHtml, mediaFilePath, mediaSuggestedExt, forceSaveAs, sessionId }
  // Returns: { ok: true, path: filePath } or { ok: false, error: ... }
  // Sends progress events via webContents.send('save-progress', ...)
});

// Zip-based load
ipcMain.handle('load-session', async () => {
  // Shows file picker for .notepack files
  // Sends file-loading-start / file-loading-complete events
  // Returns: { ok: true, notesHtml, mediaArrayBuffer, mediaFile }
});
```

**Temp Media Streaming:**

```javascript
// Create temp file with unique ID
ipcMain.handle('create-temp-media', async (evt, { fileName, sessionId }) => {
  // Returns: { ok: true, id, path }
});

// Stream chunks to temp file with progress tracking
ipcMain.handle('append-temp-media', async (evt, id, chunk, sessionId) => {
  // Tracks bytesWritten, sends progress events
  // Returns: { ok: true, bytesWritten }
});

// Close temp file and return final path
ipcMain.handle('close-temp-media', async (evt, id) => {
  // Returns: { ok: true, path }
});
```

### Electron Security (Permission Handling)

- **Media Permissions**: Uses `setPermissionRequestHandler` with strict origin validation
- **Security Pattern**: Only allows media access from trusted `file://` origins
  ```javascript
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      if (permission === 'media') {
        const requestingUrl = details.requestingUrl || '';
        const isLocalFile = requestingUrl.startsWith('file://');
        callback(isLocalFile); // Only allow local file origins
      } else {
        callback(false); // Deny all other permissions
      }
    }
  );
  ```
- **Why This Matters**: Prevents malicious external content from accessing camera/microphone
- **Pattern to Follow**: Always validate `details.requestingUrl` before granting permissions
- **Logging**: Warns when blocking untrusted permission requests for debugging

### Quill.js Deep Integration

- Custom blots for timestamps (`<button class="ts" data-ts="123.45">`) and images
- Text changes trigger `onQuillTextChange()` → selective UI state updates
- Custom keyboard shortcuts via `quill.keyboard.addBinding()`
- Timestamp clicks handled in `onTimestampClick()` → precise video player synchronization

### State Synchronization Challenges

- DOM changes must trigger appropriate `updateXXXState()` methods
- Recording state changes propagate via `onStateChange` callbacks
- Device selection persistence uses `CONFIG.STORAGE_KEYS` consistently
- Race condition prevention through pre-emptive control state updates

## 🎯 Development Workflows

### Adding New Recording Features

1. **Type Definitions**: Add new types to `types/global.d.ts` if introducing new data structures
2. **Mixer Changes**: Update `mixerSystem.js` for audio/video processing modifications
3. **Recording Logic**: Modify `recordingSystem.js` for MediaRecorder lifecycle changes
4. **UI Integration**: Add state handling in main app's `updateRecordingControlsState()`
5. **Configuration**: Update relevant `CONFIG` sections for new settings
6. **JSDoc**: Document new methods with @param, @returns, @throws, side effects, and invariants

### Editor Customizations

1. **Custom Blots**: Create new Quill.js elements in `src/editor/customBlots.js`
2. **Toolbar Integration**: Add handlers in main app's `setupCustomToolbarButtons()`
3. **Clipboard Support**: Update `setupClipboardHandlers()` for paste functionality
4. **Image Handling**: Extend `imageManager.js` for new image-related features

### Device/Hardware Integration

1. **Device Detection**: Extend `deviceManager.js` for new device types or constraints
2. **Configuration**: Update `CONFIG.RECORDING` and related sections
3. **Permissions**: Handle new permissions in `deviceManager.ensurePermissions()`
4. **Live Switching**: Update `mixerSystem.js` for new device switching capabilities

### UI/State Management

1. **New States**: Add to `CONFIG.STATES` for consistency
2. **Update Methods**: Create specialized update methods for new UI concerns
3. **Event Handling**: Add handlers in main app's `setupEventHandlers()`
4. **Persistence**: Use `CONFIG.STORAGE_KEYS` for new localStorage needs

## 🚀 Architecture Benefits

### 1. **Scalable Modularity**

- Clear separation of concerns across functional domains
- Singleton pattern ensures consistent state management
- Dependency injection enables testing and mocking
- Easy feature addition without core system modification

### 2. **Type Safety & Documentation**

- TypeScript type definitions without migration overhead
- JSDoc provides inline documentation visible in IDE
- @ts-check catches type errors at development time
- Side effects and invariants explicitly documented
- AI-friendly codebase structure with discoverable types

### 3. **Advanced Media Processing**

- Web Audio API provides professional-grade audio processing
- Canvas capture enables sophisticated video manipulation
- Live device switching without recording interruption
- Real-time audio level monitoring and visualization

### 4. **Robust State Management**

- Multiple specialized UI update methods prevent conflicts
- Pre-emptive state updates eliminate race conditions
- Centralized configuration reduces magic strings and inconsistencies
- Proper event-driven architecture with clear data flows

### 5. **Professional Development Experience**

- Comprehensive JSDoc documentation for all modules
- TypeScript-powered IntelliSense and type checking
- Consistent code organization and naming conventions
- Enhanced debugging with focused, smaller modules
- Future-proof architecture for continued development

The architecture successfully balances sophistication with maintainability, enabling advanced media processing capabilities while maintaining clean, organized code structure.
