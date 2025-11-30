# TODO

## 1) Code Quality & Architecture Improvements

### AI-Readiness Enhancements
- [x] **Type safety without full migration**
  - ✅ Add `// @ts-check` to key modules (`src/recording/recordingSystem.js`, `src/recording/mixerSystem.js`, `src/modules/deviceManager.js`, `src/modules/exportSystem.js`, `src/editor/*`)
  - ✅ Expand JSDoc for all public methods (`@param`, `@returns`, `@throws`), including side-effects and invariants
  - ✅ Created `types/global.d.ts` with shared domain types (RecordingState, SaveProgress, TimestampValue, ImageValue, DeviceSelection, SessionMeta, IPC interfaces)
 - [x] **Central type declarations**
  - ✅ Implemented `types/global.d.ts` with shared domain types: `RecordingState`, `SaveProgress`, `TimestampValue`, `ImageValue`, `DeviceSelection`, `SessionMeta`, plus `Mixer`, `RecordingInitOptions`, `Resolution`, `AudioBitrateOption`, `ImageDimensions`, `ExtractedImage`, `SaveSessionPayload`, and more.
  - ✅ Declared IPC surfaces with method signatures: `window.api`, `window.menu`, `window.session` via `WindowAPI`, `WindowMenu`, `WindowSession` interfaces and `declare global` augmentation.
  - ✅ Added `schemas/session.schema.json` (matches current `session.json` structure: `createdAt`, `mediaFile`, `notesFile`, `version`).
  - ✅ Added `schemas/notes-embed.schema.json` (defines `TimestampValue`, `ImageValueObject`, and string `ImageValue` formats).
  - ✅ Integrated lightweight `ajv` validation of `session.json` in main process load path (non-blocking; logs warnings only).
- [x] **Standard error codes**
  - ✅ Introduced `ERROR_CODES` in `src/config.js` and `createError()` helper
  - ✅ Added mapping in `errorBoundary.mapErrorToMessage()`
  - ✅ Updated throw sites in `mixerSystem`, `recordingSystem`, `deviceManager`
  - ✅ Added coded error handling for session save/load wrappers (zipUtils) and export operations groundwork
  - Remaining future adoption: main-process IPC (when migrating to shared helpers) and additional validation surfaces.
- [x] **Public API surface docs**
  - ✅ Added concise "Public API" section at top of each singleton module listing callable methods and side-effects
  - ✅ Marked internal helpers clearly
  - ✅ Updated modules: recordingSystem, mixerSystem, deviceManager, exportSystem, timer, audioLevel, utils, customBlots, imageManager, imageResizer, cameraSystem, drawingSystem, zipUtils, errorBoundary, config, main
- [x] **IPC contract documentation**
  - ✅ Create `docs/ipc-api.md` detailing exposed preload APIs, arguments/returns, timeout behavior, and which calls must not be wrapped (e.g., file pickers)

### Tooling & CI
- [x] **Lint & format**
  - Added flat ESLint v9 config (`eslint.config.js`) with `eslint-plugin-jsdoc` and Prettier integration
  - Added `npm run lint`, `npm run lint:fix`, `npm run format`, `npm run format:check` scripts
  - Added `.prettierrc.json` and `.prettierignore`
  - Removed legacy `.eslintrc.*` and `.eslintignore` (migrated ignores into flat config)
  - Relaxed internal JSDoc param/returns noise; preserved public API doc warnings only
- [x] **Testing migration to Vitest**
  - ✅ Added Vitest (`vitest` dev dependency, `jsdom` for DOM tests) and `npm test` script
  - ✅ Created `vitest.config.mjs` with Node environment
  - ✅ Added initial tests:
    - `tests/utils.test.mjs`: formatTime, withTimeout, createError
    - `tests/notepack.test.mjs`: zip creation/read roundtrip
    - `tests/errorBoundary.test.mjs`: error code mapping, wrapAsync retry logic
    - `tests/customBlots.test.mjs`: TimestampBlot and CustomImage create/value under jsdom
    - `tests/zipUtils.test.mjs`: coded error flows (success, cancellation, failure) for save/load
    - `tests/exportSystem.test.mjs`: stripFabricData, extractAndReplaceImages, HTML template generation
  - ✅ All 39 tests passing across 6 test files
  - 🚧 Future: add integration tests for recording flows and main process IPC handlers
- [x] **CI workflow**
  - GitHub Actions: run `postinstall`, `lint`, `test` on push/PR

### Documentation Additions
- [x] **Module contracts**: Inputs / Outputs / Side-effects / Invariants / Failure modes blocks at top of key modules
- [ ] **Decision records**: Add `docs/adr/` for major choices (Canvas capture, streaming save pipeline, file picker timeout policy)
- [ ] **AI Guide**: `docs/AI_GUIDE.md` covering safe-to-edit zones, do-not-alter areas, extension patterns, and PR checklists

### Developer Experience
- [ ] **NPM scripts**: add `lint`, `format`, `test`, `typecheck` (`tsc --noEmit` with `checkJs`)
- [ ] **Version pinning**: add `.nvmrc` and `engines` to align Node/Electron versions
- [ ] **.editorconfig** for consistent whitespace/indent

### Example & Validation
- [ ] **Sample artifacts**: add `examples/` with a small `.notepack`, `session.json`, and `notes.html` containing timestamp/image with `fabricJSON`
- [ ] **Runtime validation**: validate `session.json` against `schemas/session.schema.json` on load; report actionable messages via `errorBoundary`

## Decisions & Preferences (from discussion)
- **Type safety approach:** Prefer whichever improves AI understanding most; start with `// @ts-check` + `types/` now, full TS migration later.
- **Tooling:** Yes to ESLint/Prettier and minimal Vitest; wire CI in GitHub Actions.
- **Schemas & validation:** Yes; add JSON Schemas and lightweight `ajv` validation on session load.
- **Version constraints:** Pin Node `>=25` and Electron `>=30` in `engines`/`.nvmrc`.
- **Implementation timing:** First-pass implementation (types, `@ts-check`, lint/test scripts, `docs/ipc-api.md`) deferred for now; keep tasks tracked here.

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