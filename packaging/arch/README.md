# VelocityDL on Arch Linux

Tauri has no native `pacman` bundle target, so Arch is covered two ways:
a **binary AUR package** (from the official `.deb`) and a **portable `.tar.gz`**.

## Option A — AUR (recommended)

```bash
# with an AUR helper
yay -S velocitydl
# or
paru -S velocitydl

# manually
git clone https://aur.archlinux.org/velocitydl.git
cd velocitydl
makepkg -si
```

Maintainer notes (`packaging/arch/`):
- `PKGBUILD` extracts `VelocityDL_<ver>_amd64.deb` from GitHub Releases.
- After bumping `pkgver`, run `makepkg -g` and paste the hash into
  `sha256sums_x86_64`, then `makepkg --printsrcinfo > .SRCINFO` before pushing.

## Option B — portable tarball (no root needed)

Download `VelocityDL-<ver>-linux-x86_64.tar.gz` (+ `.sha256`) from GitHub Releases:

```bash
sha256sum -c VelocityDL-0.6.2-linux-x86_64.tar.gz.sha256
tar -xzf VelocityDL-0.6.2-linux-x86_64.tar.gz
cd velocitydl
./velocity-dl
```

Dependencies:

```bash
sudo pacman -S webkit2gtk-4.1 gtk3 cairo gdk-pixbuf2 glib2 \
  hicolor-icon-theme libsoup3 pango python python-pip
```

Optional system-wide install from the extracted folder:

```bash
sudo install -Dm755 velocity-dl /usr/bin/velocitydl
sudo install -Dm755 deno-engine /usr/lib/velocitydl/deno-engine
```

## Build the tarball locally

```bash
npm run build:deno:linux
npm run tauri build
npm run bundle:tar   # → release/VelocityDL-<ver>-linux-x86_64.tar.gz
```
