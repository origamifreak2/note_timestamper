# AI Guide

This guide helps AI and human contributors make safe, high‑quality changes to the Note Timestamper codebase. It highlights safe‑to‑edit zones, do‑not‑alter areas, extension patterns, and a practical PR checklist.

## Scope and Principles

- Favor minimal, surgical edits; keep public APIs and behavior stable unless a change is explicitly requested.
- Use `// @ts-check` and precise JSDoc types referencing `types/global.d.ts`.
- Prefer module‑local changes and clear dependency injection; keep singletons consistent with existing patterns.
- When adding or changing IPC/public APIs, update docs and types in the same PR.
- Handle errors with coded errors and the error boundary patterns; avoid silent failures.

## Safe‑to‑Edit Zones

These areas are intended for feature work, bug fixes, and enhancements. Keep changes scoped and documented.

- `src/modules/`
  - `deviceManager.js`: Device enumeration, selection persistence, permissions handling (@ts-check).
  - `exportSystem.js`: Export behavior, HTML cleanup, future export features (@ts-check).
  - `audioLevel.js`, `timer.js`, `utils.js`, `zipUtils.js`, `errorBoundary.js`: Utilities and infrastructure. Add small, well‑typed helpers as needed.
- `src/recording/`
  - `mixerSystem.js`: Web Audio + Canvas mixing; audio/video composition; live device switching (@ts-check). Extend carefully (filters, visualizations).
  - `recordingSystem.js`: MediaRecorder lifecycle, state transitions, blob URL lifecycle (@ts-check). Use coded errors; maintain cleanup invariants.
- `src/editor/`
  - `customBlots.js`, `imageManager.js`, `imageResizer.js`: Quill customizations, image/drawing integration (@ts-check). Add new blots/features with tests.
- `src/ui/`
  - `cameraSystem.js`, `drawingSystem.js`: UI modals and drawing features. Extend tools, handlers, and modals following current patterns.
- `src/main.js` (renderer): Coordinator wiring, UI state sync, toolbar handlers, event listeners. Keep responsibilities narrow; avoid doing heavy I/O here.
- `types/global.d.ts`: Add or refine types to mirror new data structures or schema changes.
- `schemas/*.json`: Update only with corresponding code + type updates and validation rules.
- `tests/*.test.mjs`: Add tests for new behavior (Vitest; use jsdom where DOM is involved).

## Do‑Not‑Alter (without explicit need)

- `vendor/`: Third‑party assets (Quill, Fabric). Treat as read‑only; update via scripts only.
- `static/fa/`: Font Awesome assets (CSS, webfonts). Do not hand‑edit; managed via scripts.
- `build/` and packaging scripts: Only change when addressing platform packaging; keep entitlements and signing intact.
- `preload.cjs`: Public IPC surface for the renderer. Changes require updating `docs/ipc-api.md` and tests; coordinate carefully.
- IPC file picker flows: Never introduce timeouts for user‑interactive pickers.
- `index.html`: Keep minimal; coordinate layout or preload changes carefully with Electron security constraints.
- Error code catalog in `src/config.js` (`ERROR_CODES`): Do not rename existing codes. Add new codes only when necessary and document their usage.

## Extension Patterns

Follow these patterns to add features safely and consistently.

1) Types first
- Add/extend types in `types/global.d.ts` (e.g., new options, payloads, state types).
- Reference types via JSDoc: `@param {import('../types/global').TypeName}`.

2) Public API Surface + Module Contract
- For any edited or new module, include at the top:
  - Public API Surface: list public methods with brief descriptions.
  - Module Contract: Inputs, Outputs, Side‑effects, Invariants, Failure Modes (reference `ERROR_CODES`).

3) Recording & Mixing changes
- Update `src/recording/recordingSystem.js` for MediaRecorder behavior.
- Update `src/recording/mixerSystem.js` for Web Audio/Canvas pipeline and device switching.
- Use coded errors via `createError()` and wrap device access in `errorBoundary.wrapDeviceAccess()`.
- Maintain blob URL lifecycle invariants (always revoke previous URL before creating a new one).

4) Editor customizations
- Add blots in `src/editor/customBlots.js`; register before initializing Quill.
- Update toolbar and handlers in `src/main.js` (renderer) with clear wiring.
- For images/drawings, integrate with `imageManager` and ensure export cleanup in `exportSystem.stripFabricData()`.

5) IPC & Persistence
- Changing preload APIs: update `docs/ipc-api.md` and tests. Never wrap file picker dialogs with timeouts.
- For background I/O/streaming, use `errorBoundary.wrapIPC()` and report progress using existing event channels.
- Keep `.notepack` structure stable; if adding files, update load/save, schema(s), and docs.

6) Validation & Schemas
- `schemas/session.schema.json` and `schemas/notes-embed.schema.json`: adjust only with corresponding code and type updates.
- Session validation remains non‑blocking: log warnings; never block file pickers.

## Error Handling Rules

- Always throw coded errors from modules using `createError(ERROR_CODES.X, message, cause)`.
- Map browser/device errors precisely (e.g., `NotAllowedError` -> `DEVICE_PERMISSION_DENIED`).
- Wrap device ops with `errorBoundary.wrapDeviceAccess()` and background IPC with `errorBoundary.wrapIPC()`.
- Do not throw in event handlers that could crash capture; propagate state safely and surface UI messages.

## State & UI Synchronization

- Drive UI through dedicated update methods in the renderer `src/main.js`:
  - `updateUIState()` for full refresh on major changes.
  - `updateContentState()` for content‑only updates.
  - `updateRecordingControlsState()` and `updateRecordingControlsStateForRecording()` for control states.
- Query `recordingSystem.isRecording()` before mutating controls to avoid race conditions.

## Memory & Resource Management

- Track and revoke blob URLs (`URL.revokeObjectURL`) on finalize, load, and reset paths.
- On device errors, stop tracks and disconnect nodes to prevent leaks.
- Temp media files are streamed and cleaned up; keep the zero‑buffering pattern intact.

## Practical PR Checklist

Use this as a gate before opening a PR.

- Types and Docs
  - [ ] Types added/updated in `types/global.d.ts` for any new data shapes.
  - [ ] Public API Surface + Module Contract present/updated at module tops.
  - [ ] `docs/ipc-api.md` updated if preload or IPC shapes changed.
  - [ ] Schemas updated with matching code + type changes; validation remains non‑blocking.

- Correctness & Safety
  - [ ] Uses coded errors from `ERROR_CODES`; no renamed codes.
  - [ ] Device access wrapped with `errorBoundary.wrapDeviceAccess()`; background I/O with `wrapIPC()`.
  - [ ] No timeouts added to file picker IPC calls.
  - [ ] Blob URLs created and revoked correctly; no leaks.
  - [ ] Recording state transitions respect `recordingSystem.isRecording()`; UI updates use dedicated methods.

- Tests & Tooling
  - [ ] New/changed logic covered by tests in `tests/*.test.mjs` (use `// @vitest-environment jsdom` where needed).
  - [ ] `npm test` passes locally.
  - [ ] Lint/format pass (project eslint settings).

- Boundaries & Assets
  - [ ] No manual edits to `vendor/` or `static/fa/`; scripts handle updates.
  - [ ] Packaging/build scripts changed only when necessary; platform constraints respected.
  - [ ] `.notepack` format intact or documented with corresponding loader/saver changes.

- Documentation Touch‑ups
  - [ ] README or docs updated if the user flow or developer setup changed.
  - [ ] Inline JSDoc added for all public methods, including side effects and invariants.

## File Reference Quicklinks

- Config, constants, error codes: `src/config.js`
- Renderer coordinator and UI wiring: `src/main.js`
- Editor customizations: `src/editor/`
- Recording systems: `src/recording/`
- Modules/utilities: `src/modules/`
- IPC contract docs: `docs/ipc-api.md`
- Schemas: `schemas/session.schema.json`, `schemas/notes-embed.schema.json`
- Types: `types/global.d.ts`
- Tests: `tests/`

## When to Ask for Review Guidance

- Any change to preload IPC shapes or session format.
- New error codes or remapping of existing device errors.
- Behavior changes in recording lifecycle, mixing pipeline, or drawing edit flow.

By following this guide, contributions remain consistent, safe, and easy to review while preserving the app’s core guarantees.