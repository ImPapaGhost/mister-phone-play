#!/bin/sh
# Install or remove the phone controls add-on for MiSTer Control 0.8.3.
set -eu
umask 077
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
APP=${MISTER_CONTROL_DIR:-/media/fat/mister-control}
SD=${MISTER_SD_ROOT:-/media/fat}
case "$APP" in /*) ;; *) echo "MISTER_CONTROL_DIR must be an absolute path." >&2; exit 1 ;; esac
case "$SD" in /*) ;; *) echo "MISTER_SD_ROOT must be an absolute path." >&2; exit 1 ;; esac
WEB=$APP/web
INDEX=$WEB/index.html
STATE=$APP/.phone-play
ASSETS=$WEB/phone-play
MAP=$SD/config/inputs/input_4d43_0001_v3.map
MODE=install
MIGRATE=0
for arg in "$@"; do
  case "$arg" in
    --remove) MODE=remove ;;
    --replace-prototype) MIGRATE=1 ;;
    *) echo "Usage: sh install.sh [--remove | --replace-prototype]" >&2; exit 2 ;;
  esac
done
[ -f "$INDEX" ] || { echo "MiSTer Control is not installed at $APP." >&2; exit 1; }
TMP=$INDEX.phone-play.$$
PATCHED=$TMP.patched
trap 'rm -f "$TMP" "$PATCHED"' EXIT HUP INT TERM
strip_block() {
  begins=$(grep -c '<!-- mister-phone-play:begin -->' "$INDEX" || true)
  ends=$(grep -c '<!-- mister-phone-play:end -->' "$INDEX" || true)
  if [ "$begins" -ne "$ends" ] || [ "$begins" -gt 1 ]; then
    echo "Unbalanced add-on markers in index.html; no changes applied." >&2
    exit 1
  fi
  awk '
    /<!-- mister-phone-play:begin -->/ {skip=1; next}
    /<!-- mister-phone-play:end -->/ {skip=0; next}
    !skip {print}
  ' "$INDEX" > "$TMP"
}
backup_index() {
  mkdir -p "$STATE"
  cp "$INDEX" "$STATE/index.$(date +%Y%m%d-%H%M%S).$$.html"
}
if [ "$MODE" = remove ]; then
  backup_index
  strip_block
  mv "$TMP" "$INDEX"
  rm -f "$ASSETS/phone-play.css" "$ASSETS/phone-play.js" "$ASSETS/zoom-lock.js" "$ASSETS/recording.js"
  rmdir "$ASSETS" 2>/dev/null || true
  # Remove a map only if this installer created it and it is still unchanged.
  if [ -f "$STATE/created-controller-map" ] && [ -f "$MAP" ]; then
    expected=$(cat "$STATE/created-controller-map")
    actual=$(sha256sum "$MAP" | awk '{print $1}')
    if [ "$actual" = "$expected" ]; then
      rm -f "$MAP" "$STATE/created-controller-map"
    else
      echo "Keeping your modified controller map: $MAP"
    fi
  fi
  echo "Phone controls add-on removed. Reload the player."
  echo "Index backups are in $STATE."
  exit 0
fi
[ -x "$APP/mister-control" ] || { echo "MiSTer Control executable not found." >&2; exit 1; }
version=$("$APP/mister-control" -version 2>/dev/null)
case "$version" in
  0.8.3|"mister-control 0.8.3"|"MiSTer Control 0.8.3") ;;
  *) echo "This add-on supports MiSTer Control 0.8.3. Found: $version" >&2; exit 1 ;;
esac
if grep -q 'controller-layout-fix.css\|controller-view-fix.js' "$INDEX" && [ "$MIGRATE" -ne 1 ]; then
  echo "An earlier phone UI patch is installed. Use --replace-prototype to replace it." >&2
  exit 1
fi
(cd "$HERE" && sha256sum -c ASSET-SHA256SUMS) || { echo "Asset checksum check failed." >&2; exit 1; }
backup_index
strip_block
if [ "$MIGRATE" -eq 1 ]; then
  sed '/controller-layout-fix\.css/d; /controller-view-fix\.js/d' "$TMP" > "$PATCHED"
  mv "$PATCHED" "$TMP"
fi
[ "$(grep -c '</head>' "$TMP")" -eq 1 ] || { echo "Expected one </head> in index.html; no changes applied." >&2; exit 1; }
mkdir -p "$ASSETS"
cp "$HERE/assets/phone-play.css" "$ASSETS/phone-play.css"
cp "$HERE/assets/phone-play.js" "$ASSETS/phone-play.js"
cp "$HERE/assets/zoom-lock.js" "$ASSETS/zoom-lock.js"
cp "$HERE/assets/recording.js" "$ASSETS/recording.js"
awk '
  /<\/head>/ {
    print "    <!-- mister-phone-play:begin -->"
    print "    <link rel=\"stylesheet\" href=\"/phone-play/phone-play.css?v=0.2.0\">"
    print "    <script defer src=\"/phone-play/zoom-lock.js?v=0.2.0\"></script>"
    print "    <script defer src=\"/phone-play/phone-play.js?v=0.2.0\"></script>"
    print "    <script defer src=\"/phone-play/recording.js?v=0.2.0\"></script>"
    print "    <!-- mister-phone-play:end -->"
  }
  {print}
' "$TMP" > "$PATCHED"
mv "$PATCHED" "$INDEX"
if [ ! -f "$MAP" ]; then
  mkdir -p "$SD/config/inputs"
  cp "$HERE/assets/input_4d43_0001_v3.map" "$MAP"
  sha256sum "$MAP" | awk '{print $1}' > "$STATE/created-controller-map"
  echo "Added the virtual controller map. Reload the core if the buttons do not respond."
else
  echo "Keeping the existing virtual controller map."
fi
echo "Phone controls add-on installed. Reload the player."
echo "Use View > Picture brightness to adjust the picture."
