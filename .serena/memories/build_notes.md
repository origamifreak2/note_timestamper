# Build Notes (Packaging & Signing)

## macOS (Darwin)
- **Build commands:**
  - `npm run build:mac` — x64 dmg + zip
  - `npm run build:mac:universal` — x64 + arm64 dmg + zip
- **Entitlements & hardened runtime:** Configured in `build/entitlements.mac.plist`; `hardenedRuntime` currently disabled. If enabling, ensure correct entitlements (camera/microphone) and notarization workflow.
- **Code signing:**
  - `identity: null` in `package.json` → local unsigned builds. For distribution, set your Developer ID Application identity (e.g., `Developer ID Application: Your Name (TEAMID)`).
  - After build, run `./scripts/sign-mac-app.sh` (adjust to your signing identity). Verify with:
    - `codesign --verify --deep --strict path/to/YourApp.app`
    - `spctl --assess --type execute -v path/to/YourApp.app`
- **Notarization (optional for distribution):** Use Apple notarization with ASC credentials or keychain profile; configure electron-builder `mac.notarize` or post-process.
- **Permissions prompts:** `NSCameraUsageDescription` and `NSMicrophoneUsageDescription` set via `extendInfo`.

## Windows
- **Build command:** `npm run build:win` — NSIS installer (`.exe`).
- **Icon:** Ensure `build/icon.ico` exists before building.
- **Recommended platform:** Build on Windows for fewer cross-platform issues. Cross-building on macOS requires Wine + NSIS.
- **Code signing:** Optional for installer creation; set `certificateFile` and `certificatePassword` in builder config or environment variables for signing. Unsigned apps may trigger SmartScreen warnings.
- **Artifact naming:** Controlled by `artifactName` in `win` config.

## Linux (not configured)
- No Linux targets currently defined; add `linux` section in `package.json` `build` if needed (AppImage/deb/snap).

## Common Tips
- **Postinstall vendors:** `npm install` triggers copying Quill, Fabric.js, and FontAwesome assets; ensure vendor files exist before packaging.
- **Files included:** Controlled by `build.files` array (includes `src/**`, `schemas/**`, `vendor/**`, `scripts/**`, `static/**`, `build/entitlements.mac.plist`, `package.json`).
- **Debugging packaging issues:**
  - Run with `DEBUG=electron-builder` to see verbose logs.
  - Verify asar contents or disable asar if needed (not explicitly enabled here).
- **Versioning:** `package.json` `version` drives build artifacts; use semver.
- **Testing local builds:**
  - macOS: open dmg, drag app, launch, check permissions.
  - Windows: install NSIS, run app, verify media permissions and saving.

## Quick Commands
- `npm install`
- `npm start`
- `npm run build:mac`
- `npm run build:win`
- `codesign --verify --deep --strict Note Timestamper.app`
- `spctl --assess --type execute -v Note Timestamper.app`
