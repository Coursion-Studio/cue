#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --user-data-dir="$tmp/profile" --window-size=1200,630 --default-background-color=0E1224FF \
  --virtual-time-budget=2000 --screenshot="$tmp/og.png" "file://$PWD/og/og.html" >/dev/null 2>&1
sips -s format jpeg -s formatOptions 88 "$tmp/og.png" --out og.jpg >/dev/null
sips -g pixelWidth -g pixelHeight og.jpg | tail -2
