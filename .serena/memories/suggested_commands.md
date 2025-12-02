# Suggested Commands

## Development & Run

- `npm install` — install deps and run postinstall vendor fetch scripts
- `npm start` — launch Electron app in dev
- `npm run dev` — alias of `npm start`

## Build & Package

- `npm run build:mac` — build macOS dmg + zip (x64)
- `npm run build:mac:universal` — build macOS dmg + zip (x64 + arm64)
- `npm run build:win` — build Windows NSIS installer (recommended on Windows)

## Vendor Assets (auto via postinstall)

- `node scripts/fetch-quill.mjs` — copy Quill assets to `vendor/`
- `node scripts/fetch-fabric.mjs` — copy Fabric.js to `vendor/`
- `node scripts/copy-fa.mjs` — copy FontAwesome to `static/fa`

## Utility/Test Scripts

- `node scripts/test-notepack.mjs` — exercise notepack save/load
- `node scripts/test-notepack-file.mjs` — read/write a `.notepack` file
- `node scripts/test-cleanup.mjs` — cleanup orphaned temp media files

## macOS (Darwin) Shell Tips

- `ls -la` — list files (including hidden)
- `pbcopy` / `pbpaste` — macOS clipboard
- `open .` — open current folder in Finder
- `mdfind "Note Timestamper"` — Spotlight search
- `codesign --verify --deep --strict app.app` — macOS app signing verify

## Electron Builder Notes

- Ensure `build/icon.ico` exists for Windows builds
- On macOS, signing script: `./scripts/sign-mac-app.sh` (requires valid identity)
