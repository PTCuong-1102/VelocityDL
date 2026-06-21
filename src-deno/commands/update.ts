import { getYtdlpPath, getBinDir, getFfmpegPath, getFfprobePath, getFfmpegDir } from "../utils/paths.ts";

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

    // Verify the binaries exist after extraction
    const ffmpegStat = await Deno.stat(ffmpegPath);
    const ffprobeStat = await Deno.stat(ffprobePath);

    if (!ffmpegStat.isFile || !ffprobeStat.isFile) {
      throw new Error("FFmpeg extraction failed: binaries not found after extraction.");
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

export default ensureYtdlpInstalled;
