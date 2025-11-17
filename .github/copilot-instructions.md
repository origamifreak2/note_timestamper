# Note Timestamper - AI Coding Instructions

This Electron app records audio/video with timestamped notes using a sophisticated modular ES6 architecture. A core innovation is a Web Audio + Canvas mixing system that enables live device switching during recording.

## 🏗️ Core Architecture

The app uses a layered modular architecture:

```
src/main.js                 # Main coordinator (NoteTimestamperApp class)
src/config.js              # Centralized configuration and constants
src/modules/                # Core utilities (timer, devices, export, audioLevel)
src/editor/                 # Quill.js customizations (blots, images, resizing)
src/recording/              # Advanced MediaRecorder + Web Audio mixing
│   ├── mixerSystem.js      # Web Audio API + Canvas video mixing
│   └── recordingSystem.js  # MediaRecorder lifecycle management
src/ui/                     # Modal dialogs (camera, drawing)
```

**Key Patterns**:
- Each module exports a singleton instance (e.g., `timerSystem`, `deviceManager`)
- All singletons are initialized in `src/main.js` with proper dependency injection
- The main `NoteTimestamperApp` class acts as a coordinator that wires modules together
- Centralized configuration through `CONFIG` object in `src/config.js`

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
- **ERRORS/MESSAGES**: Standardized user-facing text

## � Session Persistence Architecture (Zip-Based)

### .notepack File Format
All user sessions are saved as zip files with `.notepack` extension:

```
mySession.notepack (zip file)
├── notes.html           # Quill.js editor HTML with delta + media embeds
├── media.webm           # Audio/video recording (extension varies)
└── session.json         # Metadata: { created, mediaFileName, appVersion }
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
- **Mixing logic**: `src/recording/mixerSystem.js` (Web Audio + Canvas coordination)
- **Recording lifecycle**: `src/recording/recordingSystem.js` (MediaRecorder management)
- **Device handling**: `src/modules/deviceManager.js` (enumerating mics/cameras)
- **Editor features**: `src/editor/customBlots.js` (Quill.js timestamp/image embeds)
- **Configuration**: `src/config.js` (centralized constants and settings)
- **UI coordination**: `src/main.js` (event handling, state management)

## 📦 Critical Patterns

### Module Initialization
All modules follow this pattern:
```javascript
class MySystem {
  constructor() { /* private state */ }
  init(domElements, callbacks) { /* setup */ }
}
export const mySystem = new MySystem(); // singleton
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
- Uses `canvas.loadFromJSON()` to restore previous drawing state
- All Fabric.js objects (shapes, text, imported images) are editable

**Image Manager (`src/editor/imageManager.js`):**
- `insertDrawingImage(dataUrl, fabricJSON)` handles drawing-specific insertion
- `updateImageInQuill(img)` preserves fabric data during resize operations
- Checks for `data-fabric-json` attribute and uses object format when present

**Custom Image Blot (`src/editor/customBlots.js`):**
- `create()` method adds `data-fabric-json` attribute when `value.fabricJSON` exists
- Adds `editable-drawing` class and pointer cursor for visual feedback
- `value()` method returns object format for drawings, string format for regular images

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
  - `session.json` stores metadata (created date, media filename, app version)
  - Enables seamless load/save of audio/video + timestamped notes

### Quill.js Event Handling
- Text changes trigger `onQuillTextChange()` → updates save/export button states
- Custom keyboard shortcuts via `quill.keyboard.addBinding()`
- Timestamp clicks handled in `onTimestampClick()` → jumps video player time

### State Synchronization
- DOM changes must trigger `updateUIState()` to sync button states
- Recording state changes propagate via `onStateChange` callbacks
- Device selection persistence uses localStorage keys in `CONFIG.STORAGE_KEYS`

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

### Extension Points
- **New Fabric.js tools**: Extend `drawingSystem.openDrawingModal()` with additional canvas tools
- **Export customization**: Modify `exportAsEmbeddedHtml()` and `exportAsSeparateFiles()` methods
- **Video effects**: Add filter pipeline in recording or post-processing chain

## �🚫 Common Pitfalls

- **Don't** modify recording controls directly - use `updateRecordingControlsState()`
- **Don't** forget to call module `.init()` methods with proper DOM references
- **Don't** assume synchronous MediaRecorder operations - use await/promises
- **Do** check `recordingSystem.isRecording()` before UI state changes
- **Do** handle device enumeration failures gracefully (permissions, hardware)