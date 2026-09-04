#!/usr/bin/env bash
# Build a portable .tar.gz for Linux (incl. Arch) from a finished `tauri build`.
#
# Usage:
#   bash scripts/make-linux-tar.sh [version] [arch]
#   bash scripts/make-linux-tar.sh 0.6.2 x86_64
#
# Inputs (produced by `npm run tauri build` on Linux):
#   src-tauri/target/release/velocity-dl                        # app binary
#   src-tauri/binaries/deno-engine-<target>.{exe,}              # compiled sidecar
#   (fallback) src-tauri/target/release/deno-engine             # sidecar copied by bundler
#
# Output (kept out of Vite's `dist/` frontend folder, which is gitignored):
#   release/VelocityDL-<version>-linux-<arch>.tar.gz
#   release/VelocityDL-<version>-linux-<arch>.tar.gz.sha256
#
# Layout inside the tarball:
#   velocitydl/
#     velocity-dl          # main binary (run this)
#     deno-engine          # sidecar, resolved at runtime next to the main binary
#     README.txt
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${1:-$(node -p "require('$ROOT/package.json').version" 2>/dev/null || echo 0.6.2)}"
ARCH="${2:-x86_64}"
TRIPLE="x86_64-unknown-linux-gnu"
if [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]]; then
  TRIPLE="aarch64-unknown-linux-gnu"
fi

APP_BIN="$ROOT/src-tauri/target/release/velocity-dl"
SIDECAR_CANDIDATES=(
  "$ROOT/src-tauri/binaries/deno-engine-$TRIPLE"
  "$ROOT/src-tauri/target/release/deno-engine"
  "$ROOT/src-tauri/binaries/deno-engine"
)

if [[ ! -f "$APP_BIN" ]]; then
  echo "ERROR: app binary not found at $APP_BIN" >&2
  echo "Run 'npm run tauri build' on Linux first." >&2
  exit 1
fi

SIDECAR=""
for c in "${SIDECAR_CANDIDATES[@]}"; do
  if [[ -f "$c" ]]; then SIDECAR="$c"; break; fi
done
if [[ -z "$SIDECAR" ]]; then
  echo "ERROR: deno-engine sidecar not found. Tried:" >&2
  printf '  - %s\n' "${SIDECAR_CANDIDATES[@]}" >&2
  echo "Run 'npm run build:deno:linux' first." >&2
  exit 1
fi

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
PKGDIR="$STAGE/velocitydl"
mkdir -p "$PKGDIR"
cp "$APP_BIN" "$PKGDIR/velocity-dl"
cp "$SIDECAR" "$PKGDIR/deno-engine"
chmod +x "$PKGDIR/velocity-dl" "$PKGDIR/deno-engine"
cat > "$PKGDIR/README.txt" <<EOF
VelocityDL $VERSION (portable Linux tarball, $ARCH)

Run:
  ./velocity-dl

Requires (Arch): webkit2gtk-4.1 gtk3 cairo gdk-pixbuf2 glib2 hicolor-icon-theme \
  libsoup3 pango python python-pip
  sudo pacman -S webkit2gtk-4.1 gtk3 cairo gdk-pixbuf2 glib2 hicolor-icon-theme libsoup3 pango python python-pip

Optional system install:
  sudo install -Dm755 velocity-dl /usr/bin/velocitydl
  sudo install -Dm755 deno-engine /usr/lib/velocitydl/deno-engine
EOF

mkdir -p "$ROOT/release"
OUT="$ROOT/release/VelocityDL-${VERSION}-linux-${ARCH}.tar.gz"
tar -czf "$OUT" -C "$STAGE" velocitydl
( cd "$ROOT/release" && sha256sum "$(basename "$OUT")" > "$(basename "$OUT").sha256" )

echo "Created: $OUT"
cat "$OUT.sha256"
