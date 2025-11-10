# Note Timestamper - Improved Architecture

This document describes the refactored architecture of the Note Timestamper application, which has been reorganized into a modular, maintainable structure.

## 🏗️ Architecture Overview

The application has been restructured from a monolithic `renderer.js` file (3391 lines) into a modular system with clear separation of concerns:

```
src/
├── main.js                 # Main application coordinator
├── modules/                # Core utility modules
│   ├── utils.js           # Common utility functions
│   ├── timer.js           # Recording/playback timing system
│   ├── audioLevel.js      # Audio level monitoring
│   ├── deviceManager.js   # Device enumeration and selection
│   └── exportSystem.js    # Session export functionality
├── editor/                # Editor-related functionality
│   ├── customBlots.js     # Custom Quill.js blots (timestamp, image)
│   ├── imageManager.js    # Image handling and drag-drop
│   └── imageResizer.js    # Interactive image resizing
├── recording/             # Audio/video recording system
│   ├── mixerSystem.js     # Audio/video stream mixing
│   └── recordingSystem.js # MediaRecorder management
└── ui/                   # UI components and modals
    ├── cameraSystem.js    # Camera capture functionality
    └── drawingSystem.js   # Drawing canvas with Fabric.js
```

## 📦 Module Responsibilities

### Core Modules (`src/modules/`)

- **utils.js**: Common utilities (time formatting, base64 conversion, sleep, etc.)
- **timer.js**: Manages timing for both recording (excluding paused periods) and playback
- **audioLevel.js**: Real-time audio level monitoring with visual feedback
- **deviceManager.js**: Device enumeration, selection persistence, constraints building
- **exportSystem.js**: HTML export with embedded or separate media files

### Editor System (`src/editor/`)

- **customBlots.js**: Custom Quill.js elements (clickable timestamps, images with dimensions)
- **imageManager.js**: Image insertion, drag-and-drop, clipboard handling
- **imageResizer.js**: Interactive drag handles for resizing images in the editor

### Recording System (`src/recording/`)

- **mixerSystem.js**: Combines separate audio/video streams using Web Audio API and canvas
- **recordingSystem.js**: MediaRecorder lifecycle, codec selection, data management

### UI Components (`src/ui/`)

- **cameraSystem.js**: Camera modal for capturing photos during recording
- **drawingSystem.js**: Drawing canvas modal using Fabric.js for sketching

## 🔧 Key Improvements

### 1. **Modular Architecture**
- Separated concerns into logical modules
- Clear dependency injection and initialization
- Singleton pattern for shared state management
- Improved testability and maintainability

### 2. **Enhanced Documentation**
- Comprehensive JSDoc comments for all functions
- File headers explaining module purpose
- Inline comments for complex logic
- Architecture documentation

### 3. **Better Error Handling**
- Centralized error handling in main coordinator
- Graceful fallbacks for missing functionality
- User-friendly error messages

### 4. **Improved Code Quality**
- Consistent naming conventions
- Proper ES6 module imports/exports
- Elimination of code duplication
- Better separation of UI logic from business logic

### 5. **Maintainable Structure**
- Each module has a single responsibility
- Clear interfaces between modules
- Easy to add new features or modify existing ones
- Reduced coupling between components

## 🚀 Getting Started

The application initialization follows this flow:

1. **DOM Ready**: `src/main.js` creates the main application instance
2. **Module Initialization**: All modules are initialized with their dependencies
3. **Event Binding**: Event handlers are set up for UI interactions
4. **Device Setup**: Audio/video devices are enumerated and configured

## 🔄 Migration from Old Structure

The original monolithic `renderer.js` has been preserved as `renderer.js.backup`. The new modular structure maintains all existing functionality while providing:

- **Better Organization**: Related code is grouped together
- **Easier Debugging**: Smaller, focused files are easier to navigate
- **Enhanced Reusability**: Modules can be reused or replaced independently
- **Future Extensibility**: New features can be added without touching core systems

## 📝 Code Style Guidelines

- **ES6 Modules**: Use import/export for all module interactions
- **JSDoc Comments**: Document all public functions and classes
- **Consistent Naming**: Use camelCase for functions, PascalCase for classes
- **Error Handling**: Always provide meaningful error messages and fallbacks
- **Single Responsibility**: Each module/function should have one clear purpose

## 🔧 Development

To work with the new structure:

1. **Adding Features**: Create new modules in appropriate directories
2. **Modifying Behavior**: Update specific modules without affecting others
3. **Testing**: Individual modules can be tested in isolation
4. **Debugging**: Use browser dev tools to set breakpoints in specific modules

The modular architecture makes the codebase more maintainable, readable, and extensible for future development.