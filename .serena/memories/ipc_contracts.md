# IPC Contracts (Preload API)

This app exposes a sandboxed preload API to the renderer with four categories. File picker operations are user-facing and must NOT be wrapped with timeouts; background operations SHOULD be wrapped using `errorBoundary.wrapIPC`.

## Session Handlers

- `saveSession(payload: SaveSessionPayload): Promise<{ ok: boolean, path?: string }>`
  - Writes `.notepack` zip with `notes.html`, `media.*`, `session.json`.
  - Background zip creation is streamed (yazl). Emits `save-progress` events.
- `loadSession(): Promise<{ ok: boolean, notesHtml?: string, mediaArrayBuffer?: ArrayBuffer, mediaFile?: string }>`
  - Opens a `.notepack` via file picker, extracts `notes.html`, media, and `session.json`.
  - Validates `session.json` against `schemas/session.schema.json` (non-blocking; warnings only).

## Temp Media Streaming (Renderer → Main)

Used to stream large recording blobs without buffering.

- `createTempMedia(opts: { fileName: string, sessionId: string }): Promise<{ ok: true, id: string, path: string }>`
  - Creates a write stream in OS tmp dir and returns stream id + path.
- `appendTempMedia(id: string, chunk: Uint8Array): Promise<{ ok: boolean, bytesWritten?: number }>`
  - Appends a chunk to the temp media file, reports bytes written and emits progress.
- `closeTempMedia(id: string): Promise<{ ok: boolean, path: string }>`
  - Finalizes write stream and returns the temp file path.

## File Operations

- `saveHtml(html: string): Promise<{ ok: boolean, path?: string }>`
  - Saves exported HTML (either embedded or linked media variants).
- `pickImage(): Promise<{ ok: boolean, file?: ArrayBuffer | string }>`
  - Opens a file picker to select an image for insertion.

## Event Listeners (Renderer subscribes)

- `onSaveProgress(cb: (p: SaveProgress) => void): void`
  - Receives phases: `creating-zip`, `streaming-media`, `writing-zip`, `completed` with `percent`, `statusText`, `bytesWritten?`.
- `onFileLoadingStart(cb: (info: { path?: string }) => void): void`
- `onFileLoadingComplete(cb: (result: { ok: boolean }) => void): void`

## Timeout & Error Policies

- **No timeouts** for user-facing pickers: `saveSession()` (prompt to choose location) and `loadSession()`.
- **Background operations** (temp media streaming, zip creation, file writes) should be wrapped with `errorBoundary.wrapIPC()` and may have timeouts/retries.
- **Device access** uses `errorBoundary.wrapDeviceAccess()` with coded errors (`ERROR_CODES.*`).

## Return Shapes & Types

- `SaveSessionPayload` includes `noteHtml`, `mediaFilePath` (temp path), `sessionId`.
- `SaveProgress` includes `phase`, `percent`, `statusText`, `bytesWritten?`.
- `SessionMeta` fields in `session.json`: `createdAt` (ISO), `mediaFile` (nullable), `notesFile`, `version`.

## Security

- Main process validates media permission requests: allow only `file://` origins.
- Renderer has no direct file system access; all I/O via IPC handlers.

## Notes

- Blob URLs must be revoked when replaced or resetting.
- `loadSession()` response uses `mediaFile` (string path/name) for consistency.
