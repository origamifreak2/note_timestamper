# Style and Conventions

- **Modules as Singletons:** Each system exports a singleton instance (e.g., `export const recordingSystem = new RecordingSystem();`). All singletons initialized in `src/main.js`.
- **Documentation:** Every module begins with a "Public API Surface" block listing public methods. JSDoc includes `@param`, `@returns`, `@throws`, plus side effects and invariants. Internal helpers marked 'Internal'.
- **Type Safety:** Use `// @ts-check` in JS files and shared types via `types/global.d.ts` (reference types with `import('../../types/global').TypeName`).
- **Errors:** Use standardized `ERROR_CODES` and `createError(code, message?, cause?)`. Wrap critical ops using `errorBoundary.wrapIPC`, `wrapDeviceAccess`, or `wrapAsync`. Do not throw from MediaRecorder event handlers; update state instead.
- **IPC Policy:** File pickers (`saveSession`, `loadSession`, etc.) must NOT be wrapped with timeouts. Background file operations SHOULD be wrapped.
- **Configuration:** Centralize constants in `src/config.js` (`CONFIG`, `STATES`, `ERRORS`, `MESSAGES`). Avoid magic strings.
- **State Updates:** Use the specialized UI sync methods (`updateUIState`, `updateContentState`, `updateRecordingControlsState*`). Check `recordingSystem.isRecording()` before changing controls.
- **Memory Management:** Track and revoke blob URLs consistently during finalize/load/reset to prevent leaks.
- **Persistence:** Use zip-based `.notepack` with yazl/yauzl; validation via AJV (non-blocking). For coded flows, prefer `zipUtils.saveSessionWithCodes()`/`loadSessionWithCodes()`.
