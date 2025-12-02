# Project Overview

**Name:** Note Timestamper
**Purpose:** Desktop Electron app to record audio/video while taking synchronized timestamped notes, with rich editor features and session save/load as a single `.notepack` zip.

**Tech Stack:** Electron (main/preload/renderer), ES6 modules, Quill.js (editor), Web Audio API + Canvas capture for mixing, MediaRecorder API, Fabric.js for drawings, AJV JSON Schema validation, yazl/yauzl for zip streaming, FontAwesome assets. Type safety via JSDoc + `@ts-check` with shared defs in `types/global.d.ts`.

**Codebase Structure:**

- `src/` core app modules: `main.js` coordinator; `config.js`; `modules/` (timer, deviceManager, exportSystem, audioLevel, utils, zipUtils, errorBoundary); `recording/` (mixerSystem, recordingSystem); `editor/` (customBlots, imageManager, imageResizer); `ui/` (cameraSystem, drawingSystem)
- Root entry files: `main.js`, `preload.cjs`, `index.html`
- Validation schemas: `schemas/*.json`
- Docs: `README.md`, `ARCHITECTURE.md`, `docs/ipc-api.md`
- Vendor assets: `vendor/`, `static/fa/*`

**Design/Conventions:** Modular single-responsibility singletons, centralized `CONFIG`, standardized `ERROR_CODES` with `createError()` and `errorBoundary` wrappers, comprehensive JSDoc including public API surface, side effects, invariants. IPC file pickers are not timeout-wrapped; background operations are wrapped.

**Entrypoints & Run:**

- Dev: `npm start` (Electron)
- Postinstall vendors: `npm install` triggers `postinstall` scripts to copy Quill/Fabric/FA.
- Build: mac `npm run build:mac` (or `build:mac:universal`), windows `npm run build:win`.

**Testing/Formatting/Linting:** No formal test/lint setup present; repo includes small `scripts/test-*.mjs` utilities for `.notepack` operations. Use TypeScript checking via `@ts-check` and IDE for validation.

**Notable Patterns:** Web Audio + Canvas stream combination enabling live device switching; session persistence via streamed temp file → zip; error boundary with coded errors and recovery dialogs.
