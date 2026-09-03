import * as path from "jsr:@std/path";
import { getYtdlpPath, getBinDir, getFfmpegPath, getFfprobePath, getFfmpegDir, getSpotdlPath, getGallerydlPath, getInstaloaderPath } from "../utils/paths.ts";

export async function ensureYtdlpInstalled(forceUpdate = false): Promise<string> {
  const ytdlpPath = getYtdlpPath();
  const binDir = getBinDir();

  // Check if binary exists
  let exists = false;
  try {
    const stat = await Deno.stat(ytdlpPath);
    exists = stat.isFile;
  } catch (_err) {
    exists = false;
  }

  if (exists && !forceUpdate) {
    return ytdlpPath;
  }

  console.log(JSON.stringify({ 
    status: "updating", 
    message: exists ? "Checking for yt-dlp update..." : "Downloading yt-dlp binary..." 
  }));

  // Create bin folder if missing (recursive, no-op if already exists)
  await Deno.mkdir(binDir, { recursive: true });

  const isWindows = Deno.build.os === "windows";
  const url = isWindows 
    ? "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
    : "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const file = await Deno.open(ytdlpPath, { write: true, create: true, truncate: true });
    await response.body?.pipeTo(file.writable);

    if (!isWindows) {
      await Deno.chmod(ytdlpPath, 0o755); // Make it executable on macOS/Linux
    }

    // --- Checksum Verification ---
    await verifyChecksum(ytdlpPath, isWindows);
    // --- End Checksum Verification ---

    console.log(JSON.stringify({ 
      status: "ready", 
      message: exists ? "yt-dlp updated successfully" : "yt-dlp installed successfully" 
    }));
    
    return ytdlpPath;
  } catch (err) {
    // Clean up a possibly corrupt or mismatched binary
    try { await Deno.remove(ytdlpPath); } catch (_) { /* ignore */ }

    const errorMsg = err instanceof Error ? err.message : String(err);
    console.log(JSON.stringify({ 
      status: "error", 
      message: `Failed to install yt-dlp: ${errorMsg}` 
    }));
    throw err;
  }
}

/**
 * Generic integrity gate for binaries that don't publish a SHA2-256SUMS file
 * (spotDL, gallery-dl, FFmpeg archives). Enforces minimum size + executable
 * bit so truncated / HTML-error-page downloads fail fast instead of
 * surfacing later as cryptic "spawn failed" errors.
 */
export async function verifyBinaryIntegrity(
  binaryPath: string,
  opts: { minSizeBytes: number; label: string },
): Promise<void> {
  const stat = await Deno.stat(binaryPath);
  if (!stat.isFile) {
    throw new Error(`${opts.label}: not a file at ${binaryPath}`);
  }
  if (stat.size < opts.minSizeBytes) {
    throw new Error(
      `${opts.label}: file too small (${stat.size} bytes, expected >= ${opts.minSizeBytes}). ` +
        `Likely a truncated download or an HTML error page.`,
    );
  }
  if (Deno.build.os !== "windows") {
    try {
      await Deno.chmod(binaryPath, 0o755);
    } catch (_) { /* ignore chmod failures on exotic FS */ }
    // Magic-byte sanity: ELF on Linux, Mach-O (CF FA ED FE) on macOS.
    const head = new Uint8Array(4);
    const f = await Deno.open(binaryPath, { read: true });
    try {
      await f.read(head);
    } finally {
      f.close();
    }
    const isElf = head[0] === 0x7f && head[1] === 0x45 && head[2] === 0x4c && head[3] === 0x46;
    const isMachO = (head[0] === 0xcf && head[1] === 0xfa) || (head[0] === 0xfe && head[1] === 0xed);
    const isScript = head[0] === 0x23 && head[1] === 0x21; // #! (pip shim / .bin wrapper)
    if (Deno.build.os === "linux" && !isElf && !isScript) {
      throw new Error(`${opts.label}: unexpected magic bytes — not a Linux binary/script.`);
    }
    if (Deno.build.os === "darwin" && !isMachO && !isElf && !isScript) {
      throw new Error(`${opts.label}: unexpected magic bytes — not a macOS binary/script.`);
    }
  }
}

/**
 * Best-effort SHA-256 check against a `<binary-url>.sha256` sidecar file
 * when the publisher provides one. Returns true if verified, false if the
 * sidecar is absent (caller falls back to verifyBinaryIntegrity).
 * Throws on MISMATCH.
 */
export async function tryVerifySidecarSha256(
  binaryPath: string,
  downloadUrl: string,
  label: string,
): Promise<boolean> {
  let expected = "";
  for (const candidate of [`${downloadUrl}.sha256`, `${downloadUrl}.sha256sum`]) {
    try {
      const res = await fetch(candidate);
      if (!res.ok) continue;
      const text = (await res.text()).trim();
      const first = text.split(/\s+/)[0].toLowerCase();
      if (/^[0-9a-f]{64}$/.test(first)) {
        expected = first;
        break;
      }
    } catch (_) { /* try next candidate */ }
  }
  if (!expected) return false;

  const fileData = await Deno.readFile(binaryPath);
  const hashBuffer = await crypto.subtle.digest("SHA-256", fileData);
  const actual = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (actual !== expected) {
    throw new Error(
      `${label}: checksum mismatch!\n  Expected: ${expected}\n  Actual:   ${actual}`,
    );
  }
  console.log(JSON.stringify({ status: "info", message: `Checksum verified OK for ${label}.` }));
  return true;
}

/**
 * Download SHA2-256SUMS from GitHub, extract expected hash for the given binary filename,
 * compute the actual SHA-256 of the downloaded file, and compare them.
 */
async function verifyChecksum(binaryPath: string, isWindows: boolean): Promise<void> {
  const checksumUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS";
  const expectedFilename = isWindows ? "yt-dlp.exe" : "yt-dlp";

  let expectedHash: string | undefined;

  try {
    const res = await fetch(checksumUrl);
    if (!res.ok) {
      // Non-fatal: if we can't fetch checksums, log warning and continue
      console.error(JSON.stringify({
        status: "warning",
        message: `Could not fetch checksums (${res.statusText}), skipping verification.`
      }));
      return;
    }

    const text = await res.text();
    // SHA2-256SUMS format: "<hash>  <filename>" one per line
    for (const line of text.split("\n")) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2 && parts[1] === expectedFilename) {
        expectedHash = parts[0].toLowerCase();
        break;
      }
    }
  } catch (err) {
    console.error(JSON.stringify({
      status: "warning",
      message: `Checksum fetch error: ${err instanceof Error ? err.message : String(err)}, skipping verification.`
    }));
    return;
  }

  if (!expectedHash) {
    console.error(JSON.stringify({
      status: "warning",
      message: `Could not find hash for "${expectedFilename}" in SHA2-256SUMS, skipping verification.`
    }));
    return;
  }

  // Compute actual SHA-256 of the downloaded file
  const fileData = await Deno.readFile(binaryPath);
  const hashBuffer = await crypto.subtle.digest("SHA-256", fileData);
  const actualHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (actualHash !== expectedHash) {
    throw new Error(
      `Checksum mismatch for ${expectedFilename}!\n  Expected: ${expectedHash}\n  Actual:   ${actualHash}\nThe binary has been removed. Please try again.`
    );
  }

  console.log(JSON.stringify({
    status: "info",
    message: `Checksum verified OK for ${expectedFilename}.`
  }));
}

/**
 * Ensure FFmpeg and FFprobe binaries are installed.
 * Downloads static builds from BtbN/FFmpeg-Builds on GitHub.
 * On Windows: downloads zip, extracts ffmpeg.exe + ffprobe.exe
 * On Linux/macOS: downloads tar.xz, extracts ffmpeg + ffprobe
 */
export async function ensureFfmpegInstalled(forceUpdate = false): Promise<string> {
  const ffmpegPath = getFfmpegPath();
  const ffprobePath = getFfprobePath();
  const ffmpegDir = getFfmpegDir();

  // Check if both binaries exist
  let ffmpegExists = false;
  let ffprobeExists = false;
  try {
    const stat = await Deno.stat(ffmpegPath);
    ffmpegExists = stat.isFile;
  } catch (_) { ffmpegExists = false; }
  try {
    const stat = await Deno.stat(ffprobePath);
    ffprobeExists = stat.isFile;
  } catch (_) { ffprobeExists = false; }

  if (ffmpegExists && ffprobeExists && !forceUpdate) {
    return ffmpegDir;
  }

  console.log(JSON.stringify({
    status: "updating",
    message: "Downloading FFmpeg binaries (first-time setup, ~80MB)..."
  }));

  // Create ffmpeg directory
  await Deno.mkdir(ffmpegDir, { recursive: true });

  const isWindows = Deno.build.os === "windows";

  try {
    if (isWindows) {
      await downloadFfmpegWindows(ffmpegDir);
    } else {
      await downloadFfmpegUnix(ffmpegDir);
    }

    // Verify the binaries exist after extraction + integrity gate
    // (BtbN publishes .sha256 sidecars, but filenames vary per build;
    // size+magic check catches truncated archives reliably).
    await verifyBinaryIntegrity(ffmpegPath, { minSizeBytes: 10_000_000, label: "ffmpeg" });
    try {
      await verifyBinaryIntegrity(ffprobePath, { minSizeBytes: 5_000_000, label: "ffprobe" });
    } catch (_) {
      // Some macOS evermeet zips ship ffmpeg only — ffprobe is optional there.
      if (Deno.build.os !== "darwin") throw new Error("FFmpeg extraction failed: ffprobe missing.");
    }

    console.log(JSON.stringify({
      status: "ready",
      message: "FFmpeg installed successfully."
    }));

    return ffmpegDir;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.log(JSON.stringify({
      status: "error",
      message: `Failed to install FFmpeg: ${errorMsg}`
    }));
    throw err;
  }
}

/**
 * Download FFmpeg for Windows using BtbN builds.
 * Downloads zip, extracts ffmpeg.exe and ffprobe.exe into target dir.
 */
async function downloadFfmpegWindows(targetDir: string): Promise<void> {
  const downloadUrl = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip";
  
  const tempZip = await Deno.makeTempFile({ suffix: ".zip" });

  try {
    // Download the zip file
    console.log(JSON.stringify({
      status: "updating",
      message: "Downloading FFmpeg archive..."
    }));

    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download FFmpeg: ${response.statusText}`);
    }

    const file = await Deno.open(tempZip, { write: true, create: true, truncate: true });
    await response.body?.pipeTo(file.writable);

    // Use PowerShell to extract specific files from the zip
    console.log(JSON.stringify({
      status: "updating",
      message: "Extracting FFmpeg binaries..."
    }));

    // Extract zip to a temp directory first
    const tempExtractDir = await Deno.makeTempDir();

    const extractCmd = new Deno.Command("powershell", {
      args: [
        "-NoProfile", "-NonInteractive", "-Command",
        `Expand-Archive -Path '${tempZip}' -DestinationPath '${tempExtractDir}' -Force`
      ],
      stdout: "piped",
      stderr: "piped"
    });

    const extractResult = await extractCmd.output();
    if (!extractResult.success) {
      const errStr = new TextDecoder().decode(extractResult.stderr);
      throw new Error(`Failed to extract zip: ${errStr}`);
    }

    // Find ffmpeg.exe and ffprobe.exe recursively in extracted dir
    const ffmpegBin = await findFileRecursive(tempExtractDir, "ffmpeg.exe");
    const ffprobeBin = await findFileRecursive(tempExtractDir, "ffprobe.exe");

    if (!ffmpegBin || !ffprobeBin) {
      throw new Error("Could not find ffmpeg.exe or ffprobe.exe in the downloaded archive.");
    }

    // Copy binaries to target directory
    await Deno.copyFile(ffmpegBin, `${targetDir}\\ffmpeg.exe`);
    await Deno.copyFile(ffprobeBin, `${targetDir}\\ffprobe.exe`);

    // Clean up temp files
    try { await Deno.remove(tempZip); } catch (_) { /* ignore */ }
    try { await Deno.remove(tempExtractDir, { recursive: true }); } catch (_) { /* ignore */ }

  } catch (err) {
    // Clean up temp zip on error
    try { await Deno.remove(tempZip); } catch (_) { /* ignore */ }
    throw err;
  }
}

/**
 * Download FFmpeg for Linux/macOS using BtbN builds.
 * Downloads tar.xz, extracts ffmpeg and ffprobe into target dir.
 */
async function downloadFfmpegUnix(targetDir: string): Promise<void> {
  const isMac = Deno.build.os === "darwin";
  // BtbN only provides Linux builds; for macOS we use a different strategy
  const downloadUrl = isMac
    ? "https://evermeet.cx/ffmpeg/getrelease/zip"
    : "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz";

  const tempFile = await Deno.makeTempFile({ suffix: isMac ? ".zip" : ".tar.xz" });

  try {
    console.log(JSON.stringify({
      status: "updating",
      message: "Downloading FFmpeg archive..."
    }));

    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download FFmpeg: ${response.statusText}`);
    }

    const file = await Deno.open(tempFile, { write: true, create: true, truncate: true });
    await response.body?.pipeTo(file.writable);

    console.log(JSON.stringify({
      status: "updating",
      message: "Extracting FFmpeg binaries..."
    }));

    const tempExtractDir = await Deno.makeTempDir();

    if (isMac) {
      // Extract zip on macOS
      const cmd = new Deno.Command("unzip", {
        args: ["-o", tempFile, "-d", tempExtractDir],
        stdout: "piped",
        stderr: "piped"
      });
      const result = await cmd.output();
      if (!result.success) {
        throw new Error("Failed to extract FFmpeg zip on macOS.");
      }
    } else {
      // Extract tar.xz on Linux
      const cmd = new Deno.Command("tar", {
        args: ["-xf", tempFile, "-C", tempExtractDir],
        stdout: "piped",
        stderr: "piped"
      });
      const result = await cmd.output();
      if (!result.success) {
        throw new Error("Failed to extract FFmpeg tar.xz on Linux.");
      }
    }

    // Find and copy binaries
    const ffmpegBin = await findFileRecursive(tempExtractDir, "ffmpeg");
    const ffprobeBin = await findFileRecursive(tempExtractDir, "ffprobe");

    if (!ffmpegBin) {
      throw new Error("Could not find ffmpeg binary in the downloaded archive.");
    }

    await Deno.copyFile(ffmpegBin, `${targetDir}/ffmpeg`);
    await Deno.chmod(`${targetDir}/ffmpeg`, 0o755);

    if (ffprobeBin) {
      await Deno.copyFile(ffprobeBin, `${targetDir}/ffprobe`);
      await Deno.chmod(`${targetDir}/ffprobe`, 0o755);
    }

    // Clean up
    try { await Deno.remove(tempFile); } catch (_) { /* ignore */ }
    try { await Deno.remove(tempExtractDir, { recursive: true }); } catch (_) { /* ignore */ }

  } catch (err) {
    try { await Deno.remove(tempFile); } catch (_) { /* ignore */ }
    throw err;
  }
}

/**
 * Recursively search for a file by name within a directory.
 */
async function findFileRecursive(dir: string, filename: string): Promise<string | null> {
  for await (const entry of Deno.readDir(dir)) {
    const fullPath = `${dir}/${entry.name}`;
    if (entry.isFile && entry.name === filename) {
      return fullPath;
    }
    if (entry.isDirectory) {
      const found = await findFileRecursive(fullPath, filename);
      if (found) return found;
    }
  }
  return null;
}

export async function ensureSpotdlInstalled(forceUpdate = false): Promise<string> {
  const spotdlPath = getSpotdlPath();
  const binDir = getBinDir();

  // Check if binary exists
  let exists = false;
  try {
    const stat = await Deno.stat(spotdlPath);
    exists = stat.isFile;
  } catch (_err) {
    exists = false;
  }

  if (exists && !forceUpdate) {
    return spotdlPath;
  }

  console.log(JSON.stringify({ 
    status: "updating", 
    message: exists ? "Checking for spotDL update..." : "Downloading spotDL binary..." 
  }));

  // Create bin folder if missing (recursive, no-op if already exists)
  await Deno.mkdir(binDir, { recursive: true });

  const isWindows = Deno.build.os === "windows";
  const isMac = Deno.build.os === "darwin";

  let url = "";
  try {
    const response = await fetch("https://api.github.com/repos/spotDL/spotify-downloader/releases/latest");
    if (response.ok) {
      const releaseData = await response.json();
      const assets = releaseData.assets || [];
      let matchedAsset;
      if (isWindows) {
        matchedAsset = assets.find((a: any) => a.name.startsWith("spotdl-") && a.name.endsWith("-win32.exe"));
      } else if (isMac) {
        matchedAsset = assets.find((a: any) => a.name.startsWith("spotdl-") && a.name.endsWith("-darwin"));
      } else {
        matchedAsset = assets.find((a: any) => a.name.startsWith("spotdl-") && a.name.endsWith("-linux"));
      }
      if (matchedAsset && matchedAsset.browser_download_url) {
        url = matchedAsset.browser_download_url;
      }
    }
  } catch (err) {
    console.error(JSON.stringify({
      status: "warning",
      message: `Failed to fetch latest spotDL release info: ${err instanceof Error ? err.message : String(err)}. Using fallback version 4.5.0.`
    }));
  }

  if (!url) {
    const fallbackVersion = "4.5.0";
    if (isWindows) {
      url = `https://github.com/spotDL/spotify-downloader/releases/download/v${fallbackVersion}/spotdl-${fallbackVersion}-win32.exe`;
    } else if (isMac) {
      url = `https://github.com/spotDL/spotify-downloader/releases/download/v${fallbackVersion}/spotdl-${fallbackVersion}-darwin`;
    } else {
      url = `https://github.com/spotDL/spotify-downloader/releases/download/v${fallbackVersion}/spotdl-${fallbackVersion}-linux`;
    }
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const file = await Deno.open(spotdlPath, { write: true, create: true, truncate: true });
    await response.body?.pipeTo(file.writable);

    if (!isWindows) {
      await Deno.chmod(spotdlPath, 0o755); // Make it executable on macOS/Linux
    }

    // Publisher has no stable SHA2-256SUMS file: try sidecar, else size+magic gate.
    const sidecarOk = await tryVerifySidecarSha256(spotdlPath, url, "spotDL").catch(() => false);
    if (!sidecarOk) {
      await verifyBinaryIntegrity(spotdlPath, { minSizeBytes: 3_000_000, label: "spotDL" });
    }

    console.log(JSON.stringify({ 
      status: "ready", 
      message: exists ? "spotDL updated successfully" : "spotDL installed successfully" 
    }));
    
    return spotdlPath;
  } catch (err) {
    // Clean up a possibly corrupt binary
    try { await Deno.remove(spotdlPath); } catch (_) { /* ignore */ }

    const errorMsg = err instanceof Error ? err.message : String(err);
    console.log(JSON.stringify({ 
      status: "error", 
      message: `Failed to install spotDL: ${errorMsg}` 
    }));
    throw err;
  }
}

export async function ensureGallerydlInstalled(forceUpdate = false): Promise<string> {
  const gallerydlPath = getGallerydlPath();
  const binDir = getBinDir();

  // Check if binary exists
  let exists = false;
  try {
    const stat = await Deno.stat(gallerydlPath);
    exists = stat.isFile;
  } catch (_err) {
    exists = false;
  }

  if (exists && !forceUpdate) {
    return gallerydlPath;
  }

  console.log(JSON.stringify({ 
    status: "updating", 
    message: exists ? "Checking for gallery-dl update..." : "Downloading gallery-dl binary..." 
  }));

  // Create bin folder if missing
  await Deno.mkdir(binDir, { recursive: true });

  const isWindows = Deno.build.os === "windows";
  let url = "";

  try {
    const response = await fetch("https://codeberg.org/api/v1/repos/mikf/gallery-dl/releases");
    if (response.ok) {
      const releases = await response.json();
      if (releases && releases.length > 0) {
        const latestRelease = releases[0];
        const assets = latestRelease.assets || [];
        let matchedAsset;
        if (isWindows) {
          matchedAsset = assets.find((a: any) => a.name === "gallery-dl.exe");
        } else {
          matchedAsset = assets.find((a: any) => a.name === "gallery-dl.bin");
        }
        if (matchedAsset && matchedAsset.browser_download_url) {
          url = matchedAsset.browser_download_url;
        }
      }
    }
  } catch (err) {
    console.error(JSON.stringify({
      status: "warning",
      message: `Failed to fetch latest gallery-dl release info: ${err instanceof Error ? err.message : String(err)}. Using fallback.`
    }));
  }

  if (!url) {
    const fallbackVersion = "1.32.4";
    if (isWindows) {
      url = `https://codeberg.org/mikf/gallery-dl/releases/download/v${fallbackVersion}/gallery-dl.exe`;
    } else {
      url = `https://codeberg.org/mikf/gallery-dl/releases/download/v${fallbackVersion}/gallery-dl.bin`;
    }
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const file = await Deno.open(gallerydlPath, { write: true, create: true, truncate: true });
    await response.body?.pipeTo(file.writable);

    if (!isWindows) {
      await Deno.chmod(gallerydlPath, 0o755); // Make it executable on macOS/Linux
    }

    const gallerySidecarOk = await tryVerifySidecarSha256(gallerydlPath, url, "gallery-dl").catch(() => false);
    if (!gallerySidecarOk) {
      await verifyBinaryIntegrity(gallerydlPath, { minSizeBytes: 2_000_000, label: "gallery-dl" });
    }

    console.log(JSON.stringify({ 
      status: "ready", 
      message: exists ? "gallery-dl updated successfully" : "gallery-dl installed successfully" 
    }));
    
    return gallerydlPath;
  } catch (err) {
    // Clean up a possibly corrupt binary
    try { await Deno.remove(gallerydlPath); } catch (_) { /* ignore */ }

    const errorMsg = err instanceof Error ? err.message : String(err);
    console.log(JSON.stringify({ 
      status: "error", 
      message: `Failed to install gallery-dl: ${errorMsg}` 
    }));
    throw err;
  }
}

async function resolveInstaloaderOnPath(): Promise<string | null> {
  for (const probe of [
    ["which", "instaloader"],
    ["sh", "-c", "command -v instaloader"],
  ]) {
    try {
      const cmd = new Deno.Command(probe[0], {
        args: probe.slice(1),
        stdout: "piped",
        stderr: "null",
      });
      const out = await cmd.output();
      if (out.success) {
        const p = new TextDecoder().decode(out.stdout).trim().split("\n")[0]?.trim();
        if (p) return p;
      }
    } catch (_) { /* try next probe */ }
  }
  return null;
}

async function installInstaloaderViaPip(): Promise<void> {
  const candidates: string[][] = [
    ["python3", "-m", "pip", "install", "--user", "instaloader"],
    ["python", "-m", "pip", "install", "--user", "instaloader"],
    ["pip3", "install", "--user", "instaloader"],
  ];
  let lastErr = "";
  for (const [bin, ...args] of candidates) {
    try {
      const cmd = new Deno.Command(bin, {
        args,
        stdout: "piped",
        stderr: "piped",
      });
      const out = await cmd.output();
      if (out.success) return;
      lastErr = new TextDecoder().decode(out.stderr).slice(-2000);
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(`pip install instaloader failed: ${lastErr}`);
}

async function upgradeInstaloaderViaPip(): Promise<void> {
  try {
    const cmd = new Deno.Command("python3", {
      args: ["-m", "pip", "install", "--user", "--upgrade", "instaloader"],
      stdout: "null",
      stderr: "null",
    });
    await cmd.output();
  } catch (_) { /* best-effort only */ }
}

export async function ensureInstaloaderInstalled(forceUpdate = false): Promise<string> {
  const instaloaderPath = getInstaloaderPath();
  const binDir = getBinDir();
  const isWindows = Deno.build.os === "windows";

  if (!isWindows) {
    // No standalone binary on Unix: resolve via PATH, else auto-install with pip.
    // tauri.conf already declares python3+pip as deb/rpm deps, so pip should exist.
    const found = await resolveInstaloaderOnPath();
    if (found && !forceUpdate) return found;
    if (found && forceUpdate) {
      // Best-effort upgrade, ignore failures and keep the working binary.
      await upgradeInstaloaderViaPip().catch(() => {});
      return (await resolveInstaloaderOnPath()) ?? found;
    }
    console.log(JSON.stringify({
      status: "updating",
      message: "Installing Instaloader via pip (first-time setup)...",
    }));
    await installInstaloaderViaPip();
    const after = await resolveInstaloaderOnPath();
    if (!after) {
      throw new Error(
        "Instaloader not found after pip install. Install manually: python3 -m pip install --user instaloader",
      );
    }
    console.log(JSON.stringify({ status: "ready", message: "Instaloader installed successfully." }));
    return after;
  }

  // Check if binary exists
  let exists = false;
  try {
    const stat = await Deno.stat(instaloaderPath);
    exists = stat.isFile;
  } catch (_err) {
    exists = false;
  }

  if (exists && !forceUpdate) {
    return instaloaderPath;
  }

  console.log(JSON.stringify({ 
    status: "updating", 
    message: exists ? "Checking for Instaloader update..." : "Downloading Instaloader binary..." 
  }));

  // Create bin folder if missing
  await Deno.mkdir(binDir, { recursive: true });

  let url = "";
  try {
    const response = await fetch("https://api.github.com/repos/instaloader/instaloader/releases/latest");
    if (response.ok) {
      const releaseData = await response.json();
      const assets = releaseData.assets || [];
      const matchedAsset = assets.find((a: any) => a.name.endsWith("-windows-standalone.zip"));
      if (matchedAsset && matchedAsset.browser_download_url) {
        url = matchedAsset.browser_download_url;
      }
    }
  } catch (err) {
    console.error(JSON.stringify({
      status: "warning",
      message: `Failed to fetch latest Instaloader release info: ${err instanceof Error ? err.message : String(err)}. Using fallback.`
    }));
  }

  if (!url) {
    const fallbackVersion = "4.15.1";
    url = `https://github.com/instaloader/instaloader/releases/download/v${fallbackVersion}/instaloader-v${fallbackVersion}-windows-standalone.zip`;
  }

  const tempZip = await Deno.makeTempFile({ suffix: ".zip" });

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const file = await Deno.open(tempZip, { write: true, create: true, truncate: true });
    await response.body?.pipeTo(file.writable);

    // Extract instaloader.exe from zip
    console.log(JSON.stringify({
      status: "updating",
      message: "Extracting Instaloader binary..."
    }));

    const tempExtractDir = await Deno.makeTempDir();

    const extractCmd = new Deno.Command("powershell", {
      args: [
        "-NoProfile", "-NonInteractive", "-Command",
        `Expand-Archive -Path '${tempZip}' -DestinationPath '${tempExtractDir}' -Force`
      ],
      stdout: "piped",
      stderr: "piped"
    });

    const extractResult = await extractCmd.output();
    if (!extractResult.success) {
      const errStr = new TextDecoder().decode(extractResult.stderr);
      throw new Error(`Failed to extract Instaloader zip: ${errStr}`);
    }

    const extractedExe = `${tempExtractDir}\\instaloader.exe`;
    await Deno.copyFile(extractedExe, instaloaderPath);

    // Clean up temp
    try { await Deno.remove(tempZip); } catch (_) { /* ignore */ }
    try { await Deno.remove(tempExtractDir, { recursive: true }); } catch (_) { /* ignore */ }

    console.log(JSON.stringify({ 
      status: "ready", 
      message: exists ? "Instaloader updated successfully" : "Instaloader installed successfully" 
    }));
    
    return instaloaderPath;
  } catch (err) {
    // Clean up
    try { await Deno.remove(tempZip); } catch (_) { /* ignore */ }
    try { await Deno.remove(instaloaderPath); } catch (_) { /* ignore */ }

    const errorMsg = err instanceof Error ? err.message : String(err);
    console.log(JSON.stringify({ 
      status: "error", 
      message: `Failed to install Instaloader: ${errorMsg}` 
    }));
    throw err;
  }
}

export default ensureYtdlpInstalled;

const TOOLS_UPDATE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // weekly

function toolsMarkerPath(): string {
  return path.join(getBinDir(), ".last_tools_update");
}

/** Record a successful tools install/update check. Never throws. */
export async function touchToolsMarker(): Promise<void> {
  try {
    await Deno.mkdir(getBinDir(), { recursive: true });
    await Deno.writeTextFile(toolsMarkerPath(), String(Date.now()));
  } catch (_) { /* non-fatal */ }
}

/**
 * Honor the `engine.autoUpdateYtdlp` setting: when enabled and the last
 * check is older than a week, force-update all download tools.
 * Never throws — startup must not break because an update failed.
 */
export async function maybeAutoUpdateTools(autoUpdateEnabled: boolean): Promise<void> {
  if (!autoUpdateEnabled) return;
  try {
    const raw = await Deno.readTextFile(toolsMarkerPath());
    const last = parseInt(raw.trim(), 10);
    if (!isNaN(last) && Date.now() - last < TOOLS_UPDATE_INTERVAL_MS) return;
  } catch (_) {
    // No marker yet: normal ensure-flow below installs tools, then main()
    // touches the marker. Only force-update when a stale marker exists.
    return;
  }

  console.log(JSON.stringify({
    status: "updating",
    message: "Auto-updating download tools (weekly check)...",
  }));
  try {
    await ensureYtdlpInstalled(true);
    await ensureFfmpegInstalled(true);
    await ensureSpotdlInstalled(true);
    await ensureGallerydlInstalled(true);
    await ensureInstaloaderInstalled(true);
    await touchToolsMarker();
    console.log(JSON.stringify({ status: "ready", message: "Download tools updated." }));
  } catch (err) {
    console.error(JSON.stringify({
      status: "warning",
      message: `Auto-update failed, keeping current tools: ${err instanceof Error ? err.message : String(err)}`,
    }));
  }
}
