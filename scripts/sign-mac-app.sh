#!/bin/bash

# Post-build script to sign macOS app with camera/microphone entitlements
# This ensures the app can access camera and microphone on macOS

APP_PATH="dist/mac/Note Timestamper.app"
ENTITLEMENTS_PATH="build/entitlements.mac.plist"

if [ -d "$APP_PATH" ]; then
  echo "Signing macOS app with camera/microphone entitlements..."
  codesign --force --deep --sign - --entitlements "$ENTITLEMENTS_PATH" "$APP_PATH"

  if [ $? -eq 0 ]; then
    echo "✅ App signed successfully"
    echo "The app now has proper entitlements for camera and microphone access"
  else
    echo "❌ Failed to sign app"
    exit 1
  fi
else
  echo "❌ App not found at $APP_PATH"
  exit 1
fi