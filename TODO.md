# TODO

## 1) Take photos while recording and insert into notes
- [ ] **Feature:** Add a “📸 Capture Photo” button.
- [ ] **Behavior:** While recording video, grab a still frame and insert into Quill at the caret.
- [ ] **Tech plan:**
  - Use the existing **mixer** pipeline’s camera path (hidden `<video>` fed by `getUserMedia`).
  - Draw current frame to an offscreen `<canvas>`, `toDataURL()` (PNG/WebP), insert as Quill image embed.
  - Include timestamp metadata (e.g., insert a timestamp button right before/after the image).
- [ ] **Acceptance:** Capturing does not stop or glitch the ongoing recording; image appears instantly in notes; exported HTML shows the captured image.

## 2) Movable divider between video and notes (split view)
- [ ] **Feature:** Draggable resizer between the preview pane and the notes pane.
- [ ] **Tech plan:**
  - Convert main layout to CSS grid or flex with a central **drag handle**.
  - Implement mouse/touch drag to adjust `grid-template-columns`/flex-basis.
  - Persist user split preference in `localStorage`.
- [ ] **Accessibility:** Resizer is keyboard-focusable; support arrow keys to nudge widths.
- [ ] **Acceptance:** Smooth resizing; state restored across app restarts.

## 3) Icons on toolbar and controls
- [ ] **Feature:** Add clear icons to common actions (Start, Pause, Stop, Save, Load, Export, Reset, Timestamp, Image, Refresh Devices).
- [ ] **Tech plan:**
  - Use an inline icon set (e.g., SVG sprite or a small local icon font) to avoid external deps.
  - Provide `title`/`aria-label` for accessibility; ensure high-contrast focus styles.
- [ ] **Acceptance:** Buttons have consistent iconography + labels/tooltips; no external network needed.

## 4) Export media and HTML separately (no embedded media)
- [ ] **Feature:** New export option: **“Export (HTML + separate media)”**.
- [ ] **Behavior:** Save HTML that references a separate media file next to it (relative path).
- [ ] **Tech plan:**
  - Provide a save dialog that creates a folder or writes two files: `notes.html` and `media.webm` (or audio-only).
  - In HTML, set `<video src="./media.webm">` instead of embedding base64.
  - Keep current “single-file HTML” as a separate menu button.
- [ ] **Acceptance:** Opening the exported HTML alongside the media file plays correctly; timestamp buttons still work.

---

## Nice-to-haves (future)
- [ ] Device Diagnostics panel (recorder state, current device IDs, last chunk size, canvas fps).
- [ ] Waveform preview for audio tracks (from analyzer node).
- [ ] Clip trimming and export selections.
- [ ] Optional Markdown export alongside HTML.
- [ ] Configurable stop delay (50–200 ms) in a settings panel.

