# Note Timestamper - AI Coding Instructions

This Electron app records audio/video with timestamped notes using a sophisticated modular ES6 architecture. A core innovation is a Web Audio + Canvas mixing system that enables live device switching during recording.

## 🏗️ Core Architecture

The app uses a layered modular architecture with comprehensive type safety:

```
src/main.js                 # Main coordinator (NoteTimestamperApp class)
src/config.js              # Centralized configuration and constants
src/modules/                # Core utilities (timer, devices, export, audioLevel)
│   ├── deviceManager.js    # Device enumeration (@ts-check enabled)
│   └── exportSystem.js     # Session export (@ts-check enabled)
src/editor/                 # Quill.js customizations (blots, images, resizing)
│   ├── customBlots.js      # Custom Quill blots (@ts-check enabled)
│   ├── imageManager.js     # Image handling (@ts-check enabled)
│   └── imageResizer.js     # Interactive resizing (@ts-check enabled)
src/recording/              # Advanced MediaRecorder + Web Audio mixing
│   ├── mixerSystem.js      # Web Audio + Canvas (@ts-check enabled)
│   └── recordingSystem.js  # MediaRecorder lifecycle (@ts-check enabled)
src/ui/                     # Modal dialogs (camera, drawing)
types/global.d.ts           # TypeScript type definitions for all modules
```

**Key Patterns**:
- Each module exports a singleton instance (e.g., `timerSystem`, `deviceManager`)
- All singletons are initialized in `src/main.js` with proper dependency injection
- The main `NoteTimestamperApp` class acts as a coordinator that wires modules together
- Centralized configuration through `CONFIG` object in `src/config.js`
- **Type safety via JSDoc + @ts-check** without TypeScript transpilation
- **IPC contract documentation**: See `docs/ipc-api.md` for preload API contracts, arguments/returns, timeout policy, and non-wrapped calls (file pickers)

## 🎯 Web Audio + Canvas Mixing Architecture

A core innovation is a sophisticated mixing system that combines separate audio and video sources:

### Audio Path: Web Audio API
```javascript
// Audio flow: Microphone → Web Audio Context → MediaStreamDestination
micStream → createMediaStreamSource() → analyser → destination.stream
```

**Key Components:**
- **AudioContext**: Creates isolated audio processing environment
- **MediaStreamSource**: Converts microphone input to Web Audio nodes
- **AnalyserNode**: Provides real-time audio level monitoring
- **MediaStreamDestination**: Outputs processed audio as MediaStream

### Video Path: Canvas Capture
```javascript
// Video flow: Camera → HTMLVideoElement → Canvas → captureStream()
cameraStream → videoElement → canvas.drawImage() → canvas.captureStream(fps)
```

**Key Components:**
- **HTMLVideoElement**: Plays camera stream for canvas drawing
- **Canvas 2D Context**: Draws video frames at controlled framerate
- **RequestAnimationFrame Loop**: Maintains consistent video rendering
- **Canvas.captureStream()**: Outputs canvas as MediaStream at specified FPS

### Stream Combination
```javascript
// Final stream: Web Audio output + Canvas output
const finalStream = new MediaStream();
finalStream.addTrack(audioDestination.stream.getAudioTracks()[0]);
finalStream.addTrack(canvas.captureStream(fps).getVideoTracks()[0]);
```

### Live Device Switching
The mixer enables seamless device switching during recording:
- **Audio switching**: Reconnects Web Audio nodes without interrupting recording
- **Video switching**: Updates canvas source video element dynamically
- **Recording continuity**: MediaRecorder.requestData() ensures no gaps in output

## 🔎 Schema & Validation

The app uses JSON Schemas with AJV validation for session metadata:

### Schema Files
- **`schemas/session.schema.json`**: Defines `session.json` structure
  - Fields: `createdAt` (ISO date-time), `mediaFile` (string or null), `notesFile` (string), `version` (integer)
  - Ensures data integrity when loading saved sessions
- **`schemas/notes-embed.schema.json`**: Defines Quill embed formats
  - `TimestampValue`: { ts: number, label: string }
  - `ImageValueObject`: { src: string, width?: number, height?: number, fabricJSON?: string }
  - `ImageValueString`: "src|widthxheight" format

### Validation Integration
```javascript
// In main.js - lazy-loaded validation during session load
const validate = await getSessionValidator();
if (validate) {
  const valid = validate(meta);
  if (!valid) {
    console.warn('session.json validation errors:', validate.errors);
  }
}
```

**Key Points**:
- Validation is **non-blocking**: logs warnings only, never interrupts file picker operations
- Ajv instance is lazy-loaded and schema compiled once per app run for performance
- `types/global.d.ts` `SessionMeta` mirrors schema fields for type consistency
- Validation runs after zip extraction in `load-session` handler

## ⚙️ Configuration System

All app settings are centralized in `src/config.js`:

### Usage Patterns
```javascript
import { CONFIG, STATES, ERRORS, MESSAGES } from './config.js';

// Recording settings
const defaultRes = CONFIG.RECORDING.DEFAULT_RESOLUTION; // { width: 1280, height: 720 }
const supportedMimes = CONFIG.RECORDING.SUPPORTED_MIME_TYPES;

// UI constants
const modalZ = CONFIG.UI.MODAL_Z_INDEX; // 10000
const imageMaxSize = CONFIG.IMAGE.MAX_FILE_SIZE; // 15MB

// LocalStorage keys
localStorage.getItem(CONFIG.STORAGE_KEYS.SELECTED_MIC);

// State constants
if (recordingState === STATES.RECORDING.PAUSED) { /* ... */ }

// Consistent messaging
statusEl.textContent = MESSAGES.RECORDING.STARTED; // "Recording…"
```

### Key Configuration Categories
- **RECORDING**: MediaRecorder settings, codecs, framerates, bitrates
- **AUDIO**: Web Audio API settings, analyser configuration
- **TIMER**: Update intervals, timeout handling
- **IMAGE**: File size limits, quality settings, dimension constraints
- **UI**: Z-index values, modal dimensions, layout constants
- **STORAGE_KEYS**: LocalStorage key names for persistence
- **STATES**: Enumerated state values for consistency
- **ERRORS**: Comprehensive error messages with actionable user guidance
  - Camera errors (permission denied, not found, in use, timeout, switch failures)
  - Microphone errors (permission denied, not found, in use, connection failures)
  - Each error type provides specific resolution steps for users
- **MESSAGES**: Standardized success messages for user feedback

## 🧩 Standardized Error Codes

Error handling uses coded errors for consistency across modules.

### Definitions
- `ERROR_CODES` in `src/config.js` is the canonical catalog (e.g., `DEVICE_PERMISSION_DENIED`, `DEVICE_NOT_FOUND`, `DEVICE_IN_USE`, `MIC_SWITCH_FAILED`, `CAMERA_INIT_TIMEOUT`, `RECORDING_START_FAILED`, `CODEC_UNSUPPORTED`, `IPC_TIMEOUT`, `FILE_SYSTEM_ERROR`, `SESSION_VALIDATION_FAILED`, `UNKNOWN`).
- `createError(code, message?, cause?)` in `src/modules/utils.js` constructs an `Error` with `.code` and optional `.cause`.
- `errorBoundary` prefers `error.code` and maps it to actionable text via an internal mapping function.

### Usage Guidelines
- Throw coded errors from modules: `throw createError(ERROR_CODES.DEVICE_NOT_FOUND, ERRORS.MIC.NOT_FOUND)`.
- Don’t throw from event handlers (e.g., `MediaRecorder.onerror`) — set status or signal upstream safely.
- Use wrappers:
  - IPC/background: `await errorBoundary.wrapIPC(() => window.api.createTempMedia(...), { operationName: '...' })`.
  - Device access: `await errorBoundary.wrapDeviceAccess(() => mixerSystem.createMixerStream(), { operationName: 'device access', deviceManager, context })`.
- Session persistence: Prefer `zipUtils.saveSessionWithCodes()` / `zipUtils.loadSessionWithCodes()` which return success objects or coded errors. Preserve cancel semantics. Do not apply timeouts to file picker dialogs.

### Example
```javascript
import { ERROR_CODES, ERRORS } from '../config.js';
import { createError } from './utils.js';

async function ensureMic() {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    const name = /** @type {any} */(e).name;
    if (name === 'NotAllowedError') throw createError(ERROR_CODES.DEVICE_PERMISSION_DENIED, ERRORS.MIC.PERMISSION_DENIED, e);
    if (name === 'NotFoundError') throw createError(ERROR_CODES.DEVICE_NOT_FOUND, ERRORS.MIC.NOT_FOUND, e);
    if (name === 'NotReadableError') throw createError(ERROR_CODES.DEVICE_IN_USE, ERRORS.MIC.IN_USE, e);
    throw createError(ERROR_CODES.UNKNOWN, 'Unexpected microphone error', e);
  }
}
```

## � Session Persistence Architecture (Zip-Based)

### .notepack File Format
All user sessions are saved as zip files with `.notepack` extension:

```
mySession.notepack (zip file)
├── notes.html           # Quill.js editor HTML with delta + media embeds
├── media.webm           # Audio/video recording (extension varies)
└── session.json         # Metadata: { createdAt, mediaFile, notesFile, version }
```

**File Characteristics:**
- Single `.notepack` file per session (no folders)
- Uses standard zip compression (compatible with any zip reader)
- Typical size: 50MB-2GB+ depending on recording length
- Compatible with yazl (write) and yauzl (read) Node.js libraries

### Streaming Architecture for Large Files
The save process implements zero-buffering streaming to handle multi-gigabyte recordings:

**Renderer → Main Process (via IPC):**
```javascript
// 1. Create temp file
const { id } = await window.api.createTempMedia({
  fileName: 'recording.webm',
  sessionId: 'save-123-abc'
});

// 2. Stream blob in chunks (no buffering)
const stream = recordedBlob.stream();
const reader = stream.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  await window.api.appendTempMedia(id, value); // Send chunk
}

// 3. Close temp file and get path
const { path } = await window.api.closeTempMedia(id);

// 4. Save session with temp file path
await window.api.saveSession({
  noteHtml,
  mediaFilePath: path,
  sessionId
});
```

**Main Process (file operations):**
```javascript
// Create temp file with unique ID
ipcMain.handle('create-temp-media', async (evt, { fileName, sessionId }) => {
  const id = `${Date.now()}-${randomId()}`;
  const tempPath = path.join(os.tmpdir(), `${id}-${fileName}`);
  const ws = fs.createWriteStream(tempPath);
  tempMediaStreams.set(id, { ws, path: tempPath, bytesWritten: 0, sessionId });
  return { ok: true, id, path: tempPath };
});

// Stream chunks to temp file
ipcMain.handle('append-temp-media', async (evt, id, chunk) => {
  const stream = tempMediaStreams.get(id);
  if (!stream) return { ok: false, error: 'Invalid stream ID' };

  stream.ws.write(Buffer.from(chunk));
  stream.bytesWritten += chunk.byteLength;

  // Send progress event
  reportSaveProgress(mainWindow, id, {
    phase: 'streaming-media',
    percent: Math.min(100, (stream.bytesWritten / expectedSize) * 100),
    bytesWritten: stream.bytesWritten,
    statusText: `Streaming... ${stream.bytesWritten / 1024 / 1024 | 0}MB`
  });

  return { ok: true, bytesWritten: stream.bytesWritten };
});

// Close and return temp file path
ipcMain.handle('close-temp-media', async (evt, id) => {
  const stream = tempMediaStreams.get(id);
  stream.ws.end();
  tempMediaStreams.delete(id);
  return { ok: true, path: stream.path };
});

// Zip the temp file (streamed via yazl.addFile)
const zipPath = path.join(saveDir, 'session.notepack');
const zipfile = new yazl.ZipFile();
zipfile.addFile(tempMediaPath, 'media.webm'); // Streams file without buffering
zipfile.addBuffer(Buffer.from(notesHtml), 'notes.html');
zipfile.addBuffer(JSON.stringify(sessionData), 'session.json');
zipfile.end();
```

**Benefits:**
- Handles 2GB+ recordings without memory spikes
- Temp file cleanup prevents disk space issues
- Progress events enable UI feedback during streaming
- Separation of concerns: blob streaming (renderer), file I/O (main), zip creation (yazl)

### Progress Reporting System
Five-phase progress reporting with real-time percent updates:

```javascript
reportSaveProgress(mainWindow, sessionId, {
  phase: 'creating-zip',        // Start: Initialize zip structure
  percent: 0,
  statusText: 'Creating zip...'
});

reportSaveProgress(mainWindow, sessionId, {
  phase: 'streaming-media',     // During: Streaming blob to temp file
  percent: 45,
  bytesWritten: 2147483648,     // 2GB streamed
  statusText: 'Streaming... 2048MB'
});

reportSaveProgress(mainWindow, sessionId, {
  phase: 'writing-zip',         // After: yazl writing final zip
  percent: 95,
  statusText: 'Finalizing...'
});

reportSaveProgress(mainWindow, sessionId, {
  phase: 'completed',           // Done: Auto-hide progress modal
  percent: 100,
  statusText: 'Saved!'
});
```

**Event Flow:**
1. Renderer calls `saveSession()` with sessionId
2. Main process sends `save-progress` events to renderer window
3. Renderer listener (via `menu.onSaveProgress()` from preload) updates progress modal UI
4. When phase='completed', modal auto-hides after brief display
5. Main returns `{ ok, path }` to renderer after cleanup

### Cleanup of Orphaned Temp Files
Temp files match pattern `/^\d+-[a-z0-9]+-/` (timestamp-randomId-):

```javascript
// Runs on app startup
function cleanupOrphanedTempFiles() {
  const tmpdir = os.tmpdir();
  const files = fs.readdirSync(tmpdir);
  const pattern = /^\d+-[a-z0-9]+-/;

  files.forEach(file => {
    if (pattern.test(file)) {
      const fullPath = path.join(tmpdir, file);
      fs.rmSync(fullPath, { force: true });
    }
  });
}
```

**When cleanup runs:**
- On `app.whenReady()` initialization
- Removes files from interrupted saves or app crashes
- Safe to run frequently; ignores non-matching files
- Prevents temp directory from filling up over time

## �🔧 Development Workflows

### Dependencies & Vendor Files
- **npm scripts**: `postinstall` automatically copies vendor assets from node_modules
- **Scripts**: `scripts/fetch-*.mjs` copy Quill.js, Fabric.js, FontAwesome to `/vendor/`
- **Electron**: `npm start` for dev, `npm run build:mac/build:win` for packaging

### Key Files to Modify
- **Type definitions**: `types/global.d.ts` (add new types for data structures)
- **JSON Schemas**: `schemas/session.schema.json`, `schemas/notes-embed.schema.json` (validation rules)
- **Mixing logic**: `src/recording/mixerSystem.js` (Web Audio + Canvas coordination, @ts-check enabled)
- **Recording lifecycle**: `src/recording/recordingSystem.js` (MediaRecorder management, @ts-check enabled)
- **Device handling**: `src/modules/deviceManager.js` (enumerating mics/cameras, @ts-check enabled)
- **Editor features**: `src/editor/customBlots.js` (Quill.js timestamp/image embeds, @ts-check enabled)
- **Configuration**: `src/config.js` (centralized constants and settings)
- **Error handling**: `src/modules/errorBoundary.js` (timeout protection, retry logic, structured logging)
- **UI coordination**: `src/main.js` (event handling, state management, session validation)

## 📦 Critical Patterns

### Type Safety & Documentation
All key modules use `// @ts-check` for TypeScript validation without transpilation:

```javascript
// @ts-check
/**
 * @fileoverview Module description
 *
 * =====================
 * Public API Surface
 * =====================
 * Methods:
 *   - init(param: Type): void
 *       Brief description.
 *       Side effects: ...
 *   - async methodName(param: Type): Promise<ReturnType>
 *       Brief description.
 *       Side effects: ...
 *
 * Internal helpers are marked 'Internal'.
 * Invariants and side effects are documented per method.
 */

/**
 * Method description
 * @param {import('../../types/global').TypeName} param - Parameter description
 * @returns {Promise<void>}
 * @throws {Error} Error conditions
 *
 * Side effects:
 * - What state/DOM changes occur
 *
 * Invariants:
 * - Pre/post-conditions and safety guarantees
 */
async myMethod(param) { ... }
```

**Type Definitions** (`types/global.d.ts`):
- Recording types: `RecordingState`, `Mixer`, `RecordingInitOptions`
- Device types: `Resolution`, `DeviceSelection`, `AudioBitrateOption`
- Editor types: `TimestampValue`, `ImageValue`, `ImageDimensions`
- Session types: `SessionMeta` (createdAt, mediaFile, notesFile, version), `SaveProgress`, `SaveSessionPayload`
- IPC interfaces: `WindowAPI`, `WindowMenu`, `WindowSession`
- Error types: `ErrorBoundaryWrapOptions`, `ErrorLogEntry`

**Documentation Standards**:
- **Public API Surface**: Add a concise "Public API Surface" section at the top of each module listing all callable methods with brief descriptions
- `@param`: Include proper TypeScript type references from `types/global.d.ts`
- `@returns`: Document return types including Promise and union types
- `@throws`: Specify error conditions with error types
- **Side effects**: Document what state/DOM changes occur
- **Invariants**: Describe pre/post-conditions and safety guarantees
- **Internal helpers**: Clearly mark internal methods as 'Internal' in API surface docs

### Module Initialization
All modules follow this pattern:
```javascript
class MySystem {
  constructor() { /* private state */ }
  init(domElements, callbacks) { /* setup */ }
}
export const mySystem = new MySystem(); // singleton
```

### Error Boundary Usage
Wrap critical operations with appropriate error boundary methods:
```javascript
// IPC operations (background file operations only - NOT file pickers)
await errorBoundary.wrapIPC(
  () => window.api.createTempMedia({...}),
  { operationName: 'create temp media file', context: {...} }
);

// File picker operations - NO timeout (user needs unlimited time)
const result = await window.api.saveSession({...});

// Device access with retry capability
await errorBoundary.wrapDeviceAccess(
  () => mixerSystem.createMixerStream(),
  {
    operationName: 'device access',
    deviceManager: mixerSystem.deviceManager,
    context: { micId, camId }
  }
);

// Generic async with custom timeout/retry
await errorBoundary.wrapAsync(
  () => someAsyncOperation(),
  {
    operationName: 'operation name',
    timeout: 5000,
    maxRetries: 1,
    context: {...}
  }
);
```

### State Management Architecture
- **Recording State**: Managed in `recordingSystem` with `isRecording()` method and `onStateChange()` callbacks
- **UI Synchronization**: Multiple specialized update methods prevent state conflicts:
  - `updateUIState()`: Full UI refresh for major state changes
  - `updateContentState()`: Content-only updates (excludes recording controls)
  - `updateRecordingControlsState()`: Recording button states and device controls
  - `updateRecordingControlsStateForRecording()`: Pre-emptive control updates
- **Device Persistence**: `deviceManager` saves selections to localStorage with `CONFIG.STORAGE_KEYS`
- **Centralized Constants**: State values defined in `STATES` object prevent magic strings

### State Synchronization Patterns
```javascript
// Recording state changes trigger UI updates
recordingSystem.onStateChange = () => {
  this.updateUIState(); // Full refresh
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

### Custom Quill.js Blots
- **TimestampBlot**: Creates `<button class="ts" data-ts="123.45">` for clickable timestamps
- **CustomImage**: Extends default image to support dimensions (`src|widthxheight`) and fabric data
  - Handles object format: `{ src, width, height, fabricJSON }` for editable drawings
  - String format: `"src|widthxheight"` for regular images
  - Adds `data-fabric-json` attribute and `editable-drawing` class for drawings
- **Registration**: Must call `registerCustomBlots()` before creating Quill instance

## 🎨 Drawing Edit System

The app features sophisticated drawing creation and editing capabilities:

### Core Workflow
1. **Create Drawing**: User clicks Draw tool → Drawing modal opens → Creates drawing → Returns `{ dataUrl, fabricJSON }`
2. **Insert Drawing**: `imageManager.insertDrawingImage(dataUrl, fabricJSON)` embeds both image and metadata
3. **Edit Drawing**: User double-clicks image → Modal reopens with `fabricJSON` loaded → Updates image in place
4. **Export**: `stripFabricData()` removes editing metadata before external sharing

### Data Flow
```javascript
// Creating a new drawing
const result = await drawingSystem.openDrawingModal();
// result = { dataUrl: "data:image/png;base64,...", fabricJSON: "{...}" }
await imageManager.insertDrawingImage(result.dataUrl, result.fabricJSON);

// Editing an existing drawing
const fabricJSON = img.getAttribute('data-fabric-json');
const result = await drawingSystem.openDrawingModal(fabricJSON);
// Modal loads previous canvas state from JSON
```

### Key Implementation Details

**Drawing System (`src/ui/drawingSystem.js`):**
- `openDrawingModal(fabricJSON = null)` accepts optional fabric data for editing
- Returns `{ dataUrl, fabricJSON }` with both rendered PNG and canvas JSON
## 🎯 Common Tasks

### Adding New Recording Features
1. **Add types** to `types/global.d.ts` if introducing new data structures
2. Modify `recordingSystem.js` for MediaRecorder changes
3. Update `mixerSystem.js` if audio/video mixing is involved
4. Add UI state handling in main app's `updateRecordingControlsState()`
5. **Update Public API docs**: Add new methods to the "Public API Surface" section at top of file
6. **Document with JSDoc**: Include @param, @returns, @throws, side effects, and invariants
7. **Update IPC contract documentation**: If preload APIs change, update `docs/ipc-api.md` to reflect new arguments, return types, timeout/error handling, and non-wrapped calls.

### Editor Customizations
1. **Add types** to `types/global.d.ts` for new Quill embed formats
2. Create custom blots in `src/editor/customBlots.js` (use @ts-check)
3. Add toolbar handlers in main app's `setupCustomToolbarButtons()`
4. Update clipboard handling in `setupClipboardHandlers()` for paste support
5. Consider whether new blots need special export handling (like fabric data stripping)
6. **Update Public API docs**: Add new blots/methods to the "Public API Surface" section
7. **Document with JSDoc**: Include side effects and invariants

**Clipboard Handler (`src/main.js`):**
- `setupClipboardHandlers()` includes matcher for `img` elements
- Detects `data-fabric-json` attribute when loading sessions or pasting
- Preserves fabric data using object format: `{ src, width, height, fabricJSON }`

**Double-Click Handler (`src/main.js`):**
- `onImageDoubleClick()` listens for clicks on `img.editable-drawing` elements
- Extracts fabric JSON and reopens drawing modal in edit mode
- Replaces image in place by deleting old blot and inserting updated one

**Export System (`src/modules/exportSystem.js`):**
- `stripFabricData(html)` removes all editing metadata before export
- Cleans up `data-fabric-json`, `editable-drawing` class, title attributes
- Resets cursor styles to ensure clean exported HTML

### Persistence Strategy
- Drawing metadata stored directly in `data-fabric-json` attribute (not separate files)
- Data travels with image through all operations (save, load, copy, paste, undo, redo)
- Preserved in `.notepack` sessions for re-editing within app
- Automatically stripped from exports to keep external files clean

### Benefits
- No separate JSON file management needed
- Seamless integration with existing image system
- Drawing data survives all editor operations
- Clean separation between internal editing and external sharing

## 🎯 Common Tasks

### Adding New Recording Features
1. Modify `recordingSystem.js` for MediaRecorder changes
2. Update `mixerSystem.js` if audio/video mixing is involved
3. Add UI state handling in main app's `updateRecordingControlsState()`

### Editor Customizations
1. Create custom blots in `src/editor/customBlots.js`
2. Add toolbar handlers in main app's `setupCustomToolbarButtons()`
3. Update clipboard handling in `setupClipboardHandlers()` for paste support
4. Consider whether new blots need special export handling (like fabric data stripping)

### Drawing System Extensions
1. Add new Fabric.js tools in `drawingSystem.setupDrawingUI()`
2. Extend toolbar HTML in `createDrawingModal()`
3. Add event handlers for new tools in `setupDrawingUI()`
4. New tools automatically work with edit system (no additional changes needed)

### Device/Hardware Integration
1. Extend `deviceManager.js` for new device types or constraints
2. Update `CONFIG.CONSTRAINTS` in `src/config.js` for recording parameters
3. Handle permissions in `deviceManager.ensurePermissions()`

## ⚠️ Critical Integration Points

### MediaRecorder + Web Audio
- `mixerSystem.js` combines separate audio/video streams using AudioContext
- Required for live device switching during recording
- Canvas-based video mixing for visual audio levels

### Error Handling Architecture
- **Device Access Errors**: `mixerSystem.js` detects specific MediaStream API errors and throws coded errors via `createError()`
  - `NotAllowedError` → `ERROR_CODES.DEVICE_PERMISSION_DENIED`
  - `NotFoundError` → `ERROR_CODES.DEVICE_NOT_FOUND`
  - `NotReadableError` → `ERROR_CODES.DEVICE_IN_USE`
  - Timeout/switch/connect failures map to appropriate `ERROR_CODES.*`
- **Error Flow**: Device layer throws descriptive errors → errorBoundary catches and logs → UI displays in status bar
- **User Guidance**: All errors include actionable resolution steps
- **Error Boundary Integration**:
  ```javascript
  // Wrap device access with error boundary
  await errorBoundary.wrapDeviceAccess(
    () => mixerSystem.createMixerStream(),
    { deviceManager, operationName: 'device access', context: {...} }
  );
  // Shows recovery dialog on failure with device refresh option
  ```
- **Structured Logging**: All errors logged with timestamp, error type, context, and recovery action
- **Live Switching Errors**: Device switching failures during recording show alerts with guidance
- **Cleanup on Failure**: Partial device setup is cleaned up when errors occur
- **Pattern to Follow**: Always throw descriptive errors with resolution guidance, never silent failures
- **IPC Timeout Pattern**: Wrap background IPC operations with `errorBoundary.wrapIPC()`, but NOT file picker dialogs

### Electron IPC (Main ↔ Renderer)
- `preload.cjs` exposes session and file operation APIs with four categories:
  - **Session Handlers**: `saveSession(payload)`, `loadSession()`
  - **File Operations**: `saveHtml(html)`, `pickImage()`
  - **Temp Media Streaming**: `createTempMedia(opts)`, `appendTempMedia(id, chunk)`, `closeTempMedia(id)`
  - **Event Listeners**: `onSaveProgress(callback)`, `onFileLoadingStart(callback)`, `onFileLoadingComplete(callback)`
- File operations require main process for security (Electron sandbox isolation)
- Session format: `.notepack` zip files with yazl/yauzl libraries
  - Archive structure: `notes.html`, `media.{ext}`, `session.json`
  - `notes.json` contains embedded Quill.js delta for rich text editing
  - `session.json` stores metadata (createdAt, mediaFile, notesFile, version)
  - Validated against `schemas/session.schema.json` during load (non-blocking)
  - Enables seamless load/save of audio/video + timestamped notes
- **IPC Response Shape**: `loadSession()` returns `{ ok, notesHtml, mediaArrayBuffer, mediaFile }` (mediaFile was renamed from mediaFileName for consistency)
  - For coded persistence flows, use `zipUtils.loadSessionWithCodes()` / `zipUtils.saveSessionWithCodes()`; wrap background work with `errorBoundary.wrapIPC`, never the file picker itself.

### Electron Security (Permission Handling)
- **Media Permissions**: `main.js` uses `setPermissionRequestHandler` with origin validation
- **Security Pattern**: Only allows media access from trusted `file://` origins
  ```javascript
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    if (permission === 'media') {
      const requestingUrl = details.requestingUrl || '';
      const isLocalFile = requestingUrl.startsWith('file://');
      callback(isLocalFile); // Only allow local file origins
    } else {
      callback(false); // Deny all other permissions
    }
  });
  ```
- **Why This Matters**: Prevents malicious external content from accessing camera/microphone
- **Pattern to Follow**: Always validate `details.requestingUrl` before granting permissions

### Quill.js Event Handling
- Text changes trigger `onQuillTextChange()` → updates save/export button states
- Custom keyboard shortcuts via `quill.keyboard.addBinding()`
- Timestamp clicks handled in `onTimestampClick()` → jumps video player time

### State Synchronization
- DOM changes must trigger `updateUIState()` to sync button states
- Recording state changes propagate via `onStateChange` callbacks
- Device selection persistence uses localStorage keys in `CONFIG.STORAGE_KEYS`

### Memory Management
- **Blob URL Cleanup**: Always revoke blob URLs created with `URL.createObjectURL()` to prevent memory leaks
- **Pattern in recordingSystem.js**:
  ```javascript
  // Track blob URLs for cleanup
  this.currentBlobUrl = null;

  // Before creating new blob URL, revoke old one
  if (this.currentBlobUrl) {
    URL.revokeObjectURL(this.currentBlobUrl);
    this.currentBlobUrl = null;
  }

  // Create and track new URL
  const url = URL.createObjectURL(blob);
  this.currentBlobUrl = url;
  ```
- **Critical Cleanup Points**:
  - `finalizePreview()`: Revoke before creating preview URL
  - `loadRecording()`: Revoke before loading new session
  - `reset()`: Revoke when clearing recording state
- **Why This Matters**: Blob URLs persist in memory until explicitly revoked, causing memory leaks across multiple recording sessions

## �️ Planned Feature Areas

### Drawing System Enhancements (`src/ui/drawingSystem.js`)
- **Fabric.js Tools**: Bucket fill, text with font selection, straight lines, arrows, highlight
- **Pattern**: Add new tools to Fabric.js canvas, extend toolbar in drawing modal
- **Integration**: New tools should export to same base64 format for `imageManager`

### Export System Improvements (`src/modules/exportSystem.js`)
- **Folder Structure**: Separate media files into subfolders in export output
- **HTML Enhancement**: Add click-to-expand functionality for images in exported HTML
- **File Organization**: Update both embedded and separate file export modes

### UI/UX Enhancements
- **Layout**: Maximize note editor viewport for better writing experience
- **Video Processing**: Add filter system (likely in `mixerSystem.js` or new module)
- **Image Interaction**: Enhanced image viewing in both editor and exported HTML

## 🚫 Common Pitfalls

### Code Patterns
- **Don't** modify recording controls directly - use `updateRecordingControlsState()`
- **Don't** forget to call module `.init()` methods with proper DOM references
- **Don't** assume synchronous MediaRecorder operations - use await/promises
- **Don't** grant Electron permissions without origin validation - always check `details.requestingUrl`
- **Don't** create blob URLs without tracking them for cleanup - always revoke with `URL.revokeObjectURL()`
- **Don't** use silent error handling (console.warn) - throw descriptive errors with user guidance
- **Don't** leave errors unhandled - catch and display in UI with actionable messages
- **Don't** wrap file picker IPC calls with timeout - user needs unlimited time to choose location
- **Don't** bypass error boundary for new IPC background operations - wrap with `errorBoundary.wrapIPC()`

### Type Safety & Documentation
- **Don't** add new modules without `// @ts-check` directive
- **Don't** create new modules without adding a "Public API Surface" documentation block
- **Don't** create new data structures without adding types to `types/global.d.ts`
- **Don't** write public methods without comprehensive JSDoc (including side effects and invariants)
- **Don't** use generic `Object` or `any` types - reference specific types from `types/global.d.ts`
- **Don't** forget to update the Public API section when adding/removing public methods
- **Do** add "Public API Surface" documentation at the top of each new module
- **Do** list all public methods with brief descriptions in the API surface section
- **Do** mark internal helpers clearly as 'Internal' in API documentation
- **Do** use `@param {import('../../types/global').TypeName}` for type references
- **Do** document side effects (what state/DOM changes occur)
- **Do** document invariants (pre/post-conditions and safety guarantees)
- **Do** include `@throws` for all error conditions

### Best Practices
- **Do** check `recordingSystem.isRecording()` before UI state changes
- **Do** handle device enumeration failures gracefully (permissions, hardware)
- **Do** validate all IPC handler inputs to prevent security vulnerabilities
- **Do** track and revoke blob URLs in constructor, cleanup methods, and before creating new URLs
- **Do** detect specific error types (NotAllowedError, NotFoundError, NotReadableError) and provide targeted guidance
- **Do** clean up partial device setup when errors occur (stop tracks, disconnect nodes)
- **Do** use `errorBoundary.wrapDeviceAccess()` for device operations that might need retry
- **Do** distinguish between user-facing operations (no timeout) and background operations (with timeout)
- **Do** track and revoke blob URLs in constructor, cleanup methods, and before creating new URLs
- **Do** detect specific error types (NotAllowedError, NotFoundError, NotReadableError) and provide targeted guidance
- **Do** clean up partial device setup when errors occur (stop tracks, disconnect nodes)
- **Do** use `errorBoundary.wrapDeviceAccess()` for device operations that might need retry
- **Do** distinguish between user-facing operations (no timeout) and background operations (with timeout)