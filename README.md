# Note Timestamper

![CI](https://github.com/origamifreak2/note_timestamper/actions/workflows/ci.yml/badge.svg)

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

- **Save/Load Sessions**: Save complete sessions as `.notepack` zip files
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
  - Standardized error codes with consistent user messaging

## 🏗️ Architecture

Brief overview: modular ES6 architecture with single-responsibility modules (editor, recording, devices, export) coordinated by `src/main.js`, plus centralized config and shared types. See [ARCHITECTURE.md](ARCHITECTURE.md) for the complete breakdown and diagrams.

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

# Run tests
npm test

# Lint code
npm run lint
```

### Building

```bash
# Build for macOS
npm run build:mac

# Build for Windows
npm run build:win
```

## Notes for Windows builds

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
- **Type Safety**: JSDoc + TypeScript type checking without transpilation
- **Public API Documentation**: Every module includes comprehensive API surface documentation
- **Comprehensive Documentation**: All modules include side effects and invariants
- **Module Contract Blocks**: Each module also includes a high-level contract (Inputs, Outputs, Side-effects, Invariants, Failure Modes) complementing the Public API for faster reasoning and error mapping
- **Standardized Errors**: `ERROR_CODES` + `createError()` with mapping in `errorBoundary`; persistence via `zipUtils.saveSessionWithCodes()` / `loadSessionWithCodes()`
- **Test Suite**: Vitest with 39 tests covering utils, zip operations, error boundary, custom blots, persistence, and export system

## 📄 File Formats

- **`.notepack`**: Custom session format (single zip file containing `notes.html`, `media.*`, and `session.json`)
  - `session.json` fields: `createdAt`, `mediaFile` (nullable), `notesFile`, `version`
  - Validated against `schemas/session.schema.json` during load (non-blocking)
- **Exported HTML**: Self-contained or linked HTML files for sharing
- **Media Files**: WebM format with VP9/VP8 video and Opus audio codecs

## 📚 Documentation Map

**Project Overview**: `README.md` (this file)
**Architecture Deep Dive**: `ARCHITECTURE.md`
**Change History**: `CHANGELOG.md`
**IPC Contract Documentation**: `docs/ipc-api.md` (preload API contracts, arguments/returns, timeout/error handling)
**AI Coding Guidelines**: `.github/copilot-instructions.md` (development standards, types, module patterns, JSON schemas, and validation approach)

## 🤝 Contributing

The modular architecture makes contributions easier:

1. Each module has a single responsibility
2. Clear interfaces between components
3. Public API Surface documentation at the top of each module
4. Comprehensive JSDoc documentation with type annotations
5. Type safety via `@ts-check` and `types/global.d.ts`
6. Document side effects and invariants for all public methods
7. Consistent coding standards

Start here for contribution guardrails and IPC contracts:

- AI Guide: see `docs/AI_GUIDE.md` for safe-to-edit zones, do-not-alter areas, extension patterns, and the PR checklist.
- IPC Contracts: see `docs/ipc-api.md` for preload APIs, arguments/returns, event shapes, and timeout policy (no timeouts for file pickers).

## 📝 License

This project is available under the MIT License.
