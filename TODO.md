# TODO

## 1) Code Quality & Architecture Improvements

### Immediate Priority (This Week)
- [x] **Fix critical security vulnerability** in `main.js` (lines 238-248)
  - Add origin validation to media permission handler
  - Prevent untrusted origins from accessing camera/microphone
- [x] **Fix memory leaks** in `src/recording/recordingSystem.js`
  - Add blob URL cleanup with `URL.revokeObjectURL()`
  - Track and revoke URLs in `finalizePreview()` and `cleanup()` methods
- [x] **Fix canvas animation cleanup** in `src/recording/mixerSystem.js`
  - Add proper lifecycle checks to canvas draw loop
  - Clear timeout when video element is destroyed
- [ ] **Improve error handling** in `src/recording/mixerSystem.js`
  - Add user-facing notifications for microphone/camera failures
  - Replace silent console warnings with actionable error messages
- [ ] **Remove obsolete code**
  - Delete `renderer.js` (3423-line legacy file)
  - Delete `renderer.js.backup`
  - Verify `index.html` loads `src/main.js` instead

### Short Term (This Month)
- [ ] **Add error boundary system**
  - Create `ErrorBoundary` class wrapper for all public module methods
  - Prevent module failures from crashing entire app
  - Add fallback handlers for graceful degradation
- [ ] **Refactor export system** in `src/modules/exportSystem.js`
  - Extract shared HTML templates between `exportAsEmbeddedHtml` and `exportAsSeparateFiles`
  - Create reusable template builder to reduce 200+ lines of duplication
- [ ] **Fix timeout error handling** in `src/modules/utils.js`
  - Update `withTimeout()` to properly cancel timed-out operations
  - Clear timeout handles when promise resolves
- [ ] **Improve modal error recovery** in `src/ui/drawingSystem.js`
  - Ensure modal cleanup runs even when Fabric.js initialization fails
  - Add finally block for DOM cleanup

### Testing Infrastructure
- [ ] **Set up Jest testing framework**
  - Install `jest`, `@testing-library/dom`, `electron-mock-ipc`
  - Configure Jest for ES6 modules and Electron environment
- [ ] **Add unit tests for core modules**
  - `src/modules/timer.js` - Timer calculations and pause exclusion
  - `src/recording/recordingSystem.js` - State transitions and lifecycle
  - `src/modules/utils.js` - Utility functions and edge cases
  - `src/modules/exportSystem.js` - HTML generation and template logic
- [ ] **Target 60%+ code coverage** for critical paths

### TypeScript Migration
- [ ] **Phase 1: Configuration and types**
  - Rename `src/config.js` → `src/config.ts`
  - Add interfaces for `RecordingConfig`, `DeviceConstraints`, `MixerConfig`
  - Create type definitions for all CONFIG constants
- [ ] **Phase 2: Core modules**
  - Migrate `src/modules/timer.js` → `.ts`
  - Migrate `src/modules/deviceManager.js` → `.ts`
  - Migrate `src/modules/utils.js` → `.ts`
- [ ] **Phase 3: Recording system**
  - Migrate `src/recording/mixerSystem.js` → `.ts`
  - Migrate `src/recording/recordingSystem.js` → `.ts`
- [ ] **Phase 4: Editor and UI**
  - Migrate `src/editor/*` files
  - Migrate `src/ui/*` files
  - Migrate `src/main.js` → `.ts`

### Code Quality Improvements
- [ ] **Standardize error message formatting**
  - Replace string concatenation with template literals across all files
  - Use consistent error message structure
- [ ] **Add comprehensive JSDoc comments**
  - Document all public methods with `@param`, `@returns`, `@throws`
  - Add usage examples for complex APIs
- [ ] **Optimize image dimension calculations** in `src/modules/utils.js`
  - Add timeout handling to prevent hanging
  - Consider extracting metadata before full image load
- [ ] **Add debouncing to image resize** in `src/editor/imageManager.js`
  - Batch Quill updates during drag operations
  - Reduce unnecessary re-renders

### Accessibility (Post-TypeScript)
- [ ] **Add ARIA labels to modals**
  - `src/ui/cameraSystem.js` - Camera preview modal
  - `src/ui/drawingSystem.js` - Drawing canvas modal
  - Add `role="dialog"`, `aria-labelledby`, `aria-modal` attributes
- [ ] **Improve keyboard navigation**
  - Ensure all modals are keyboard-accessible
  - Add focus trapping for modal dialogs
  - Test with screen readers

### Long Term Goals
- [ ] **Event-driven architecture refactor**
  - Implement EventBus class for module communication
  - Replace direct function calls with event emissions
  - Reduce tight coupling between modules
  - Timeline: 1-2 week effort for full implementation
- [ ] **Performance optimizations**
  - Profile and optimize canvas rendering pipeline
  - Add Web Worker support for heavy computations
  - Implement progressive loading for large sessions

---

## 2) Movable divider between video and notes (split view)
- [ ] **Feature:** Draggable resizer between the preview pane and the notes pane.
- [ ] **Tech plan:**
  - Convert main layout to CSS grid or flex with a central **drag handle**.
  - Implement mouse/touch drag to adjust `grid-template-columns`/flex-basis.
  - Persist user split preference in `localStorage`.
- [ ] **Accessibility:** Resizer is keyboard-focusable; support arrow keys to nudge widths.
- [ ] **Acceptance:** Smooth resizing; state restored across app restarts.

---

## Nice-to-haves (future)
- [ ] Device Diagnostics panel (recorder state, current device IDs, last chunk size, canvas fps).
- [ ] Waveform preview for audio tracks (from analyzer node).
- [ ] Clip trimming and export selections.
- [ ] Optional Markdown export alongside HTML.
- [ ] Configurable stop delay (50–200 ms) in a settings panel.