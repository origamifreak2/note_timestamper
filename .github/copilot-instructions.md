# Note Timestamper - AI Coding Instructions

This Electron app records audio/video with timestamped notes using a modular ES6 architecture. Understanding the module system and data flows is key to being effective in this codebase.

## 🏗️ Core Architecture

The app has been refactored from a monolithic structure into modules:

```
src/main.js                 # Main coordinator (NoteTimestamperApp class)
src/modules/                # Core utilities (timer, devices, export, etc.)
src/editor/                 # Quill.js customizations (blots, images, resizing)
src/recording/              # MediaRecorder + Web Audio mixing
src/ui/                     # Modal dialogs (camera, drawing)
```

**Key Pattern**: Each module exports a singleton instance (e.g., `timerSystem`, `deviceManager`) that gets initialized in `src/main.js`. The main app acts as a coordinator that wires modules together.

## 🔧 Development Workflows

### Dependencies & Vendor Files
- **npm scripts**: `postinstall` automatically copies vendor assets from node_modules
- **Scripts**: `scripts/fetch-*.mjs` copy Quill.js, Fabric.js, FontAwesome to `/vendor/`
- **Electron**: `npm start` for dev, `npm run build:mac/build:win` for packaging

### Key Files to Modify
- **Recording logic**: `src/recording/recordingSystem.js` (MediaRecorder lifecycle)
- **Device handling**: `src/modules/deviceManager.js` (enumerating mics/cameras)
- **Editor features**: `src/editor/customBlots.js` (Quill.js timestamp/image embeds)
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

### State Management
- **Recording State**: Managed in `recordingSystem`, triggers `onStateChange()` callbacks
- **UI Updates**: Main app has `updateUIState()` methods that sync DOM with app state
- **Device Persistence**: `deviceManager` saves selections to localStorage with `LS_KEYS`

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
- Device selection persistence uses localStorage keys in `LS_KEYS`

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