# Note Timestamper

A desktop application for recording audio/video with synchronized timestamped notes, built with Electron and Quill.js.

## ✨ Features

### 📝 Rich Text Editing
- **Quill.js Editor**: Full-featured rich text editor with formatting options
- **Timestamped Notes**: Insert clickable timestamps that jump to specific moments in recordings
- **Image Support**: Paste, drag-and-drop, or capture images directly in notes
- **Interactive Resizing**: Drag handles to resize images with aspect ratio preservation
- **Camera Integration**: Take photos while recording and insert them inline
- **Drawing Tools**: Built-in drawing canvas with Fabric.js for sketching and annotations

### 🎥 Recording System
- **Audio/Video Recording**: High-quality recording with multiple codec support
- **Live Device Switching**: Change microphone or camera without stopping recording
- **Audio-Only Mode**: Record just audio with visual level monitoring
- **Pause/Resume**: Robust pause/resume with proper time tracking
- **Multiple Resolutions**: Support for 360p to 1080p recording
- **Memory Management**: Efficient blob URL cleanup prevents memory leaks across sessions

### 💾 Session Management
- **Save/Load Sessions**: Save complete sessions as `.notepack` folders
- **Export Options**:
  - Single HTML file with embedded media (self-contained)
  - HTML + separate video files (better for large recordings)
- **Auto-Save Prompts**: Prevents accidental data loss
- **Session Reset**: Clean slate with save confirmation

### 🔧 Advanced Features
- **Device Management**: Automatic device enumeration and selection persistence
- **Live Preview**: Real-time preview during recording
- **Keyboard Shortcuts**: `Cmd+Alt+T` (Mac) / `Ctrl+Alt+T` (Windows/Linux) for timestamps
- **Responsive Design**: Works on various screen sizes
- **Error Recovery**: Comprehensive error boundary system with:
  - Automatic retry for transient failures
  - Device access recovery dialogs with actionable guidance
  - Timeout protection for background operations
  - Structured error logging for diagnostics
  - User-configurable retry preferences

## 🏗️ Architecture

The application has been completely refactored from a monolithic structure into a modular, maintainable architecture:

```
src/
├── main.js                 # Application coordinator
├── config.js              # Configuration and constants
├── modules/                # Core utilities
├── editor/                # Text editor functionality
├── recording/             # Audio/video recording
└── ui/                   # User interface components
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed documentation of the modular structure.

## 🚀 Development

### Prerequisites
- Node.js 16+
- npm or yarn

### Setup
```bash
# Clone and install dependencies
npm install

# Start development server
npm start
```

### Building
```bash
# Build for macOS
npm run build:mac

# Build for Windows
npm run build:win
```

Notes for Windows builds
------------------------
- electron-builder expects a Windows icon file at `build/icon.ico`. Add your .ico file there before running `npm run build:win`. If you don't have an icon yet, you can generate one from a PNG using many online tools or ImageMagick (convert sample.png -define icon:auto-resize=256,128,64,48,32,16 build/icon.ico).
- Building a Windows installer from macOS or Linux requires extra tooling (wine and nsis). It's recommended to run `npm run build:win` on a Windows machine. If you must build cross-platform, install Wine and the NSIS binaries and follow electron-builder docs: https://www.electron.build/multi-platform-build
- Code signing for Windows is optional for creating an installer, but required if you want the installer/app to be signed. See electron-builder docs for signing instructions and CI configuration.

## 🎯 Usage

1. **Start Recording**: Click "Start Rec" to begin audio/video capture
2. **Take Notes**: Use the rich text editor to write notes during recording
3. **Insert Timestamps**: Click the timestamp button or use `Cmd+Alt+T` to mark moments
4. **Add Media**: Insert images via drag-and-drop, camera, or drawing tools
5. **Save Session**: Save your work as a `.notepack` for later editing
6. **Export**: Create shareable HTML files with embedded or linked media

## 🔧 Technical Details

- **Electron**: Desktop application framework
- **Quill.js**: Rich text editor with custom blots
- **Web Audio API**: Advanced audio processing and mixing
- **MediaRecorder API**: High-quality audio/video recording
- **Fabric.js**: Interactive drawing canvas
- **ES6 Modules**: Modern JavaScript module system

## 📄 File Formats

- **`.notepack`**: Custom session format (folder containing HTML, media, and metadata)
- **Exported HTML**: Self-contained or linked HTML files for sharing
- **Media Files**: WebM format with VP9/VP8 video and Opus audio codecs

## 🤝 Contributing

The modular architecture makes contributions easier:

1. Each module has a single responsibility
2. Clear interfaces between components
3. Comprehensive JSDoc documentation
4. Consistent coding standards

## 📝 License

This project is available under the MIT License.
