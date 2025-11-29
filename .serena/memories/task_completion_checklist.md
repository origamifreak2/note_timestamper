# Task Completion Checklist

When finishing a coding task:

- **Type Safety:** Ensure JSDoc present with accurate types; `// @ts-check` enabled; update `types/global.d.ts` if new types introduced.
- **Public API Docs:** Update the "Public API Surface" section for modules with any new or changed public methods.
- **Config & Constants:** Add or adjust values in `src/config.js` (RECORDING/AUDIO/UI/STATES/ERRORS/MESSAGES) as needed.
- **Error Handling:** Use `createError` with `ERROR_CODES` and wrap risky ops (`errorBoundary.wrapIPC` for background; `wrapDeviceAccess` for device access). Provide actionable user messages.
- **IPC Docs:** If preload APIs change, update `docs/ipc-api.md` with contracts, args/returns, timeouts, and non-wrapped calls.
- **Session Persistence:** For new save/load flows, consider coded wrappers in `zipUtils`; preserve cancel semantics and avoid timeouts in pickers.
- **Memory Management:** Revoke any blob URLs before creating new ones; clean up on reset/load.
- **Build/Run:** Verify `npm start` still works; run relevant `scripts/test-*.mjs` if persistence was touched. On macOS builds, confirm `build:mac`.
- **Documentation:** Update `README.md` or `ARCHITECTURE.md` if feature-level changes were made.
