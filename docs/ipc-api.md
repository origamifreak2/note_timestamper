# IPC API Contract Documentation

This document describes the Electron IPC contract for Note Timestamper, detailing all exposed preload APIs, their arguments and return types, timeout/error handling, and which calls must not be wrapped (e.g., file pickers).

## Overview

The preload script (`preload.cjs`) exposes a set of APIs to the renderer for session management, file operations, temp media streaming, and event listeners. These APIs are designed for secure, robust communication between the renderer and main process.

## Exposed APIs

### Session Handlers

- `saveSession(payload: SaveSessionPayload): Promise<{ ok: boolean, path?: string, error?: string }>`
- `loadSession(): Promise<{ ok: boolean, notesHtml?: string, mediaArrayBuffer?: ArrayBuffer, mediaFile?: string, error?: string }>`

### File Operations

- `saveHtml(html: string): Promise<{ ok: boolean, path?: string, error?: string }>`
- `pickImage(): Promise<{ ok: boolean, path?: string, error?: string }>`

### Temp Media Streaming

- `createTempMedia(opts: { fileName: string, sessionId: string }): Promise<{ ok: boolean, id: string, path: string }>`
- `appendTempMedia(id: string, chunk: ArrayBuffer): Promise<{ ok: boolean, bytesWritten: number }>`
- `closeTempMedia(id: string): Promise<{ ok: boolean, path: string }>`

### Event Listeners

- `onSaveProgress(callback: (progress: SaveProgress) => void): void`
- `onFileLoadingStart(callback: () => void): void`
- `onFileLoadingComplete(callback: () => void): void`

## Arguments & Return Types

- All APIs use structured objects for arguments and return values.
- Errors are returned as `{ ok: false, error: string }`.
- Success responses include relevant data fields (e.g., `path`, `id`, `bytesWritten`).

## Timeout & Error Handling

- **Background IPC operations** (e.g., temp media streaming, zip creation) should be wrapped with `errorBoundary.wrapIPC()` for timeout and retry logic.
- **User-facing operations** (e.g., file pickers) must NOT be wrapped with timeouts; users require unlimited time to choose files.
- All errors use coded error responses (see `ERROR_CODES` in `src/config.js`).
- File picker dialogs are never wrapped with timeouts or error boundaries.

## Calls That Must Not Be Wrapped

- `saveSession()` and `loadSession()` when invoking file picker dialogs
- `pickImage()`

## Example Usage

```js
// Save session (no timeout on file picker)
const result = await window.api.saveSession(payload);
if (!result.ok) {
  // Handle error
}

// Stream media in background (with error boundary)
await errorBoundary.wrapIPC(() => window.api.appendTempMedia(id, chunk), {
  operationName: 'append temp media',
  context: { id },
});
```

## Invariants

- All IPC APIs validate input types and sanitize file paths.
- Only trusted origins are allowed media permissions.
- All temp files are cleaned up on app startup.

## References

- See `src/config.js` for error codes
- See `types/global.d.ts` for type definitions
- See `preload.cjs` for API implementation
