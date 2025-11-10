# Changelog

All notable changes to **Note Timestamper** will be documented here.

## [0.9.0] - 2025-11-01
### Added
- **Mic & Camera selectors** with live device switching **without stopping** the recording via a stable **mixer stream** (WebAudio + canvas capture).
- **Overwrite warning** when starting a new recording while one already exists.
- **“Save before Reset?”** prompt, with cancel-safe flow.
- **Force Finalize** safety path for edge cases where `stop` events misbehave.

### Fixed
- Stop button reliability: 100ms flush delay + 3s fallback; safer `requestData()` use.
- Duplicate function definitions (`switchMicLive` / `switchCamLive`) removed.
- Quill styling issues: ensured `quill.core.css` and `quill.snow.css` are both loaded.
- Quill CDN fallback added if `/vendor` assets are missing.

## [0.8.1] - 2025-10-31
### Added
- Image handling: insert via picker, paste, or drag-drop.
- **Image resize handles** with overlay (shift-drag to keep aspect ratio).
- Keyboard shortcut **⌘/Ctrl + Alt + T** to insert timestamp buttons at caret.
- “Export HTML” (single-file export with embedded media + clickable timestamp buttons).

### Fixed
- Timestamp caret placement (cursor now lands **after** the timestamp button).

## [0.8.0] - 2025-10-31
### Added
- Switched from TinyMCE to **Quill** (local vendored assets).
- Quill toolbar (headers, bold/italic/underline/strike, lists, align, color, background, link, quote, code block, clean, undo/redo, image, timestamp).
- **Save / Load `.notepack`** (notes.html + media + session.json).
- Reset button to clear notes and recording.

### Fixed
- “Export HTML” video playback issues in the exported file.

## [0.7.x] - 2025-10-30
### Added
- Basic recorder UI: Start, Pause/Resume, Stop, status text, current time display.
- Timestamp buttons in HTML notes that jump playback to that time.
- Audio-only toggle.

### Fixed
- Initial stop reliability improvements; preview finalization after stop.

## [0.6.x] - 2025-10-29
### Added
- Initial Electron scaffolding (main/preload/renderer), IPC for save/load/export.
- Minimal in-app HTML editor and timestamp insertion prototype.

