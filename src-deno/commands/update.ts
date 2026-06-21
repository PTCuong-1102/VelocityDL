import { getYtdlpPath, getBinDir } from "../utils/paths.ts";

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

export default ensureYtdlpInstalled;
