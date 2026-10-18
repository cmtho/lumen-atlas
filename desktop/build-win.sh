#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/desktop"
VERSION="${ELECTRON_VERSION:-44.9.0}"
OUT="$ROOT/desktop-dist"
ZIP="$ROOT/releases/LUMEN-ATLAS-Windows-portable-$(date +%Y%m%d).zip"
rm -rf "$OUT"
mkdir -p "$OUT" ../releases
curl -L --fail -o "$OUT/electron.zip" "https://github.com/electron/electron/releases/download/v${VERSION}/electron-v${VERSION}-win32-x64.zip"
unzip -q "$OUT/electron.zip" -d "$OUT/app"
rm "$OUT/electron.zip"
mkdir -p "$OUT/app/resources/app"
cp package.json main.js icon.png "$OUT/app/resources/app/"
mv "$OUT/app/electron.exe" "$OUT/app/LUMEN ATLAS.exe"
(cd "$OUT/app" && zip -qr "$ZIP" .)
echo "Built $ZIP"
