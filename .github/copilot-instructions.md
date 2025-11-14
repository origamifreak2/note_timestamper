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

## 🔧 Development Workflows

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
- **CustomImage**: Extends default image to support dimensions (`src|widthxheight`)
- **Registration**: Must call `registerCustomBlots()` before creating Quill instance

## 🎯 Common Tasks

### Adding New Recording Features
1. Modify `recordingSystem.js` for MediaRecorder changes
2. Update `mixerSystem.js` if audio/video mixing is involved
3. Add UI state handling in main app's `updateRecordingControlsState()`

### Editor Customizations
1. Create custom blots in `src/editor/customBlots.js`
2. Add toolbar handlers in main app's `setupCustomToolbarButtons()`
3. Update clipboard handling in `setupClipboardHandlers()` for paste support

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
- `preload.cjs` exposes: `saveSession`, `loadSession`, `saveHtml`, `pickImage`
- File operations require main process for security
- Session format: `.notepack` folders with HTML + media files

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