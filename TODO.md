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
- [ ] **Standard error codes**
  - Introduce `ERROR_CODES` in `src/config.js` and an `ErrorWithCode` helper
  - Throw errors with codes from device/mixer/recording layers; map to user-facing messages via `errorBoundary`
- [ ] **Public API surface docs**
  - Add concise “Public API” section at top of each singleton module listing callable methods and side-effects; mark internal helpers clearly
- [ ] **IPC contract documentation**
  - Create `docs/ipc-api.md` detailing exposed preload APIs, arguments/returns, timeout behavior, and which calls must not be wrapped (e.g., file pickers)

### Tooling & CI
- [ ] **Lint & format**
  - Add ESLint with ESM config + `eslint-plugin-jsdoc`
  - Add Prettier; wire `npm run lint` and `npm run format`
- [ ] **Testing migration to Vitest**
  - Add Vitest for fast ESM-friendly tests
  - Add initial tests: `utils`, `zipUtils/exportSystem`, `errorBoundary`, `editor/customBlots`
- [ ] **CI workflow**
  - GitHub Actions: run `postinstall`, `lint`, `test` on push/PR

### Documentation Additions
- [ ] **Module contracts**: Inputs / Outputs / Side-effects / Invariants / Failure modes blocks at top of key modules
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