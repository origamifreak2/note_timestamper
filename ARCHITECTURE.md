# Note Timestamper - Architecture

This document describes the architecture of the Note Timestamper application, featuring a modular ES6 system with Web Audio + Canvas mixing capabilities.

## 🏗️ Architecture Overview

The application uses a layered modular architecture

```
src/
├── main.js                 # Main coordinator (NoteTimestamperApp class)
├── config.js              # Centralized configuration and constants
├── modules/                # Core utilities (timer, devices, export, audioLevel)
│   ├── utils.js           # Common utility functions
│   ├── timer.js           # Recording/playback timing system
│   ├── audioLevel.js      # Real-time audio level monitoring
│   ├── deviceManager.js   # Device enumeration and selection
│   └── exportSystem.js    # Session export functionality
├── editor/                # Quill.js customizations (blots, images, resizing)
│   ├── customBlots.js     # Custom Quill.js blots (timestamp, image)
│   ├── imageManager.js    # Image handling and drag-drop
│   └── imageResizer.js    # Interactive image resizing
├── recording/             # Advanced MediaRecorder + Web Audio mixing
│   ├── mixerSystem.js     # Web Audio API + Canvas video mixing
│   └── recordingSystem.js # MediaRecorder lifecycle management
└── ui/                    # Modal dialogs (camera, drawing)
    ├── cameraSystem.js    # Camera capture functionality
    └── drawingSystem.js   # Drawing canvas with Fabric.js
```

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
- **RequestAnimationFrame Loop**: Maintains consistent video rendering
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
if (recordingState === STATES.RECORDING.PAUSED) { /* ... */ }

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
- **ERRORS/MESSAGES**: Standardized user-facing text

## 📦 Module Responsibilities

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
- **exportSystem.js**: Advanced HTML export with embedded or separate media files

### Editor System (`src/editor/`)
- **customBlots.js**: Custom Quill.js elements (clickable timestamps, images with dimensions)
- **imageManager.js**: Advanced image insertion, drag-and-drop, clipboard handling
- **imageResizer.js**: Interactive drag handles for resizing images in the editor

### Recording System (`src/recording/`)
- **mixerSystem.js**: Sophisticated Web Audio + Canvas mixing with live device switching
- **recordingSystem.js**: Advanced MediaRecorder lifecycle, codec selection, state management

### UI Components (`src/ui/`)
- **cameraSystem.js**: Camera modal for capturing photos during recording
- **drawingSystem.js**: Drawing canvas modal using Fabric.js for sketching

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
  constructor() { /* private state */ }
  init(domElements, callbacks) { /* setup */ }
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

## ⚠️ Critical Integration Points

### MediaRecorder + Web Audio Coordination
- `mixerSystem.js` combines separate audio/video streams using AudioContext
- Required for live device switching during recording
- Canvas-based video mixing for enhanced control and audio level visualization
- MediaRecorder.requestData() maintains recording continuity during device switches

### Electron IPC Communication
- `preload.cjs` exposes secure APIs: `saveSession`, `loadSession`, `saveHtml`, `pickImage`
- File operations require main process for security compliance
- Session format: `.notepack` folders containing HTML + media files + metadata

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
1. **Mixer Changes**: Update `mixerSystem.js` for audio/video processing modifications
2. **Recording Logic**: Modify `recordingSystem.js` for MediaRecorder lifecycle changes
3. **UI Integration**: Add state handling in main app's `updateRecordingControlsState()`
4. **Configuration**: Update relevant `CONFIG` sections for new settings

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

### 2. **Advanced Media Processing**
- Web Audio API provides professional-grade audio processing
- Canvas capture enables sophisticated video manipulation
- Live device switching without recording interruption
- Real-time audio level monitoring and visualization

### 3. **Robust State Management**
- Multiple specialized UI update methods prevent conflicts
- Pre-emptive state updates eliminate race conditions
- Centralized configuration reduces magic strings and inconsistencies
- Proper event-driven architecture with clear data flows

### 4. **Professional Development Experience**
- Comprehensive JSDoc documentation for all modules
- Consistent code organization and naming conventions
- Enhanced debugging with focused, smaller modules
- Future-proof architecture for continued development

The architecture successfully balances sophistication with maintainability, enabling advanced media processing capabilities while maintaining clean, organized code structure.