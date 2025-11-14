# TODO

## 2) Movable divider between video and notes (split view)
- [ ] **Feature:** Draggable resizer between the preview pane and the notes pane.
- [ ] **Tech plan:**
  - Convert main layout to CSS grid or flex with a central **drag handle**.
  - Implement mouse/touch drag to adjust `grid-template-columns`/flex-basis.
  - Persist user split preference in `localStorage`.
- [ ] **Accessibility:** Resizer is keyboard-focusable; support arrow keys to nudge widths.
- [ ] **Acceptance:** Smooth resizing; state restored across app restarts.

---

## Nice-to-haves (future)
- [ ] Device Diagnostics panel (recorder state, current device IDs, last chunk size, canvas fps).
- [ ] Waveform preview for audio tracks (from analyzer node).
- [ ] Clip trimming and export selections.
- [ ] Optional Markdown export alongside HTML.
- [ ] Configurable stop delay (50–200 ms) in a settings panel.

