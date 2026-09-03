import {
  getYtdlpPath,
  getFfmpegDir,
  getSpotdlPath,
  getFfmpegPath,
  getGallerydlPath,
  getInstaloaderPath,
  getSettings
} from "../utils/paths.ts";
import { readCookieHeader } from "../utils/cookies.ts";

export interface DownloadOptions {
  maxHeight: number;
  extractSubs: boolean;
  audioOnly: boolean;
  audioFormat?: string;
  audioQuality?: string;
  selectedSubtitles?: string[];
  embedSubs?: boolean;
}

// Helper function to extract cookies using yt-dlp to a temp file
async function extractCookiesToFile(source: string): Promise<string | null> {
  const ytdlpPath = getYtdlpPath();
  try {
    const tempFile = await Deno.makeTempFile({ suffix: ".txt" });
    const command = new Deno.Command(ytdlpPath, {
      args: [
        "--cookies-from-browser", source,
        "--cookies", tempFile,
        "--skip-download",
        "https://www.youtube.com"
      ],
      stdout: "null",
      stderr: "null"
    });

    const output = await command.output();
    if (output.success) {
      return tempFile;
    }
    try { await Deno.remove(tempFile); } catch (_) {}
  } catch (_) {
    // Ignore error
  }
  return null;
}

export async function downloadMedia(
  id: string,
  url: string,
  saveDir: string,
  options: DownloadOptions
): Promise<void> {
  const lowerUrl = url.toLowerCase();

  // Load Settings for Cookie configuration and Speed Limit
  const settings = await getSettings();
  const cookieSource = settings?.engine?.cookieSource || "none";
  const cookieFilePath = settings?.engine?.cookieFilePath || "";
  const speedLimit = settings?.engine?.speedLimit || 0;

  let tempCookieFile: string | null = null;
  let finalCookieFile: string | null = null;

  try {
    if (cookieSource === "file" && cookieFilePath) {
      finalCookieFile = cookieFilePath;
    } else if (cookieSource !== "none") {
      tempCookieFile = await extractCookiesToFile(cookieSource);
      if (tempCookieFile) {
        finalCookieFile = tempCookieFile;
      }
    }

    // 1. Route Facebook Stories (/stories/ path) to the dedicated scraper.
    // NOTE: story.php?story_fbid=... URLs stay on the yt-dlp route below —
    // yt-dlp's FacebookIE matches story.php natively.
    if (isFacebookStoryUrl(url)) {
      await downloadFacebookStory(id, url, saveDir, finalCookieFile);
      return;
    }

    // 2. Route Instagram Stories to Instaloader
    if (lowerUrl.includes("instagram.com/stories") || (lowerUrl.includes("instagram.com") && lowerUrl.includes("/stories/"))) {
      await downloadInstagramStory(id, url, saveDir, finalCookieFile);
      return;
    }

    // 3. Route Instagram Posts / Reels to gallery-dl (to support photos & video downloading)
    if (lowerUrl.includes("instagram.com") && (lowerUrl.includes("/p/") || lowerUrl.includes("/reel/") || lowerUrl.includes("/reels/"))) {
      await downloadGallerydl(id, url, saveDir, finalCookieFile, "Instagram Post", speedLimit);
      return;
    }

    // 4. Route Facebook Photos / Albums / Posts to gallery-dl (excluding standard video links)
    if (lowerUrl.includes("facebook.com") && 
        !lowerUrl.includes("/videos/") && 
        !lowerUrl.includes("/watch") && 
        !lowerUrl.includes("/reel/") && 
        (lowerUrl.includes("/photo") || lowerUrl.includes("/posts/") || lowerUrl.includes("/permalink") || lowerUrl.includes("/media/"))) {
      await downloadGallerydl(id, url, saveDir, finalCookieFile, "Facebook Post/Photo", speedLimit);
      return;
    }

    // 5. Route TikTok Stories / Slideshows to gallery-dl
    if (lowerUrl.includes("tiktok.com") && (lowerUrl.includes("/story/") || lowerUrl.includes("/photo/"))) {
      await downloadGallerydl(id, url, saveDir, finalCookieFile, "TikTok Story/Slideshow", speedLimit);
      return;
    }

    // 6. Route Spotify
    const isSpotify = lowerUrl.includes("spotify.com") || lowerUrl.includes("open.spotify.com");
    if (isSpotify) {
      await downloadSpotify(id, url, saveDir, options);
      return;
    }

    // 7. Default Route: yt-dlp
    await downloadYtdlp(id, url, saveDir, options, cookieSource, finalCookieFile, speedLimit);

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.log(JSON.stringify({
      id,
      status: "error",
      error: errorMsg,
      progress: 0
    }));
  } finally {
    // Always clean up temp cookie files
    if (tempCookieFile) {
      try {
        await Deno.remove(tempCookieFile);
      } catch (_) {}
    }
  }
}

async function downloadSpotify(
  id: string,
  url: string,
  saveDir: string,
  options: DownloadOptions
): Promise<void> {
  const spotdlPath = getSpotdlPath();
  const ffmpegPath = getFfmpegPath();

  const args: string[] = ["download", url];
  args.push("--ffmpeg", ffmpegPath);
  args.push("--output", `${saveDir}/{artists} - {title}.{output-ext}`);

  const format = options.audioFormat || "mp3";
  args.push("--format", format);

  if (options.audioQuality) {
    args.push("--bitrate", options.audioQuality);
  }

  const command = new Deno.Command(spotdlPath, {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  const child = command.spawn();

  const decoder = new TextDecoder();
  const stdoutReader = child.stdout.getReader();
  const stderrReader = child.stderr.getReader();
  
  let stderrOutput = "";
  const stderrPromise = (async () => {
    while (true) {
      const { value, done } = await stderrReader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      stderrOutput = (stderrOutput + text).slice(-4096);
    }
  })();
  
  let buffer = "";
  let playlistIndex = 1;
  let playlistTotal = null;
  let lastEmitTime = 0;
  let outputPath = "";

  while (true) {
    const { value, done } = await stdoutReader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/[\r\n]+/);
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('Downloaded "')) {
        const match = trimmed.match(/Downloaded ".*":\s*(.*)/);
        if (match) outputPath = match[1].trim();
      }

      const totalMatch = trimmed.match(/Total\s+(\d+)\/(\d+)\s+complete/i);
      if (totalMatch) {
        const completed = parseInt(totalMatch[1]);
        const total = parseInt(totalMatch[2]);
        playlistIndex = completed + 1;
        playlistTotal = total;
      }

      const percentMatch = trimmed.match(/(\d+)%/);
      if (percentMatch) {
        const progress = parseInt(percentMatch[1]);
        const now = Date.now();

        if (now - lastEmitTime >= 200 || progress === 100) {
          lastEmitTime = now;
          console.log(JSON.stringify({
            id,
            progress,
            downloadedBytes: 0,
            totalBytes: 0,
            speed: 0,
            eta: 0,
            status: "downloading",
            playlistIndex,
            playlistTotal,
            outputPath: outputPath || undefined
          }));
        }
      }
    }
  }

  const status = await child.status;
  await stderrPromise;

  if (status.success) {
    console.log(JSON.stringify({
      id,
      progress: 100,
      status: "finished",
      outputPath: outputPath || undefined
    }));
  } else {
    throw new Error(stderrOutput || "Unknown error during Spotify download");
  }
}

async function downloadYtdlp(
  id: string,
  url: string,
  saveDir: string,
  options: DownloadOptions,
  cookieSource: string,
  cookieFilePath: string | null,
  speedLimit: number
): Promise<void> {
  const ytdlpPath = getYtdlpPath();
  const ffmpegDir = getFfmpegDir();

  const args: string[] = [];

  args.push("--ffmpeg-location", ffmpegDir);

  if (options.audioOnly) {
    const format = options.audioFormat || "mp3";
    const quality = options.audioQuality || "320k";
    args.push("-f", "ba/b", "--extract-audio", "--audio-format", format, "--audio-quality", quality);
  } else {
    const height = options.maxHeight > 0 ? options.maxHeight : 1080;
    args.push("-f", `bv*[height<=${height}]+ba/b[height<=${height}]/best`);
    args.push("--merge-output-format", "mp4");
  }

  if (options.selectedSubtitles && options.selectedSubtitles.length > 0) {
    args.push("--write-subs", "--write-auto-subs");
    args.push("--sub-langs", options.selectedSubtitles.join(","));
    if (options.embedSubs !== false) {
      args.push("--embed-subs", "--compat-options", "no-keep-subs");
    }
  } else if (options.extractSubs) {
    args.push("--write-subs", "--write-auto-subs", "--sub-langs", "all");
    if (options.embedSubs !== false) {
      args.push("--embed-subs", "--compat-options", "no-keep-subs");
    }
  }

  args.push("-o", `${saveDir}/%(title)s.%(ext)s`);

  // Handle cookies
  if (cookieFilePath) {
    args.push("--cookies", cookieFilePath);
  } else if (cookieSource !== "none" && cookieSource !== "file") {
    args.push("--cookies-from-browser", cookieSource);
  }

  // Handle speed limit
  if (speedLimit > 0) {
    args.push("--limit-rate", `${speedLimit}K`);
  }

  args.push(
    "--progress-template", 
    "downloading:%(progress.downloaded_bytes)s:%(progress.total_bytes)s:%(progress.speed)s:%(progress.eta)s:%(info.playlist_index)s:%(info.n_entries)s"
  );

  args.push(
    "--progress-template",
    "postprocess:merging:%(info.playlist_index)s:%(info.n_entries)s"
  );

  args.push(url);

  const command = new Deno.Command(ytdlpPath, {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  const child = command.spawn();

  const decoder = new TextDecoder();
  const stdoutReader = child.stdout.getReader();
  const stderrReader = child.stderr.getReader();
  
  let stderrOutput = "";
  const stderrPromise = (async () => {
    while (true) {
      const { value, done } = await stderrReader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      stderrOutput = (stderrOutput + text).slice(-4096);
    }
  })();

  let buffer = "";
  let lastEmitTime = 0;
  let outputPath = "";

  while (true) {
    const { value, done } = await stdoutReader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    
    const lines = buffer.split(/[\r\n]+/);
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.includes('[download] Destination: ')) {
        outputPath = trimmed.split('[download] Destination: ')[1].trim();
      } else if (trimmed.includes('has already been downloaded')) {
        const match = trimmed.match(/\[download\]\s+(.*?)\s+has already been downloaded/);
        if (match) outputPath = match[1].trim();
      } else if (trimmed.includes('[Merger] Merging formats into "')) {
        const match = trimmed.match(/\[Merger\] Merging formats into "(.*?)"/);
        if (match) outputPath = match[1].trim();
      } else if (trimmed.includes('Remuxing video from') && trimmed.includes('to "')) {
        const match = trimmed.match(/to "(.*?)"/);
        if (match) outputPath = match[1].trim();
      } else if (trimmed.includes('[FixupM4a] Correcting container of "')) {
        const match = trimmed.match(/\[FixupM4a\] Correcting container of "(.*?)"/);
        if (match) outputPath = match[1].trim();
      }

      if (trimmed.startsWith("postprocess:merging:")) {
        const parts = trimmed.split(":");
        const playlistIndex = parts[2] && parts[2] !== "NA" ? parseInt(parts[2]) : null;
        const playlistTotal = parts[3] && parts[3] !== "NA" ? parseInt(parts[3]) : null;

        console.log(JSON.stringify({
          id,
          progress: 99,
          downloadedBytes: 0,
          totalBytes: 0,
          speed: 0,
          eta: 0,
          status: "merging",
          playlistIndex,
          playlistTotal,
          outputPath: outputPath || undefined
        }));
        continue;
      }

      if (trimmed.startsWith("downloading:")) {
        const parts = trimmed.split(":");
        if (parts.length >= 5) {
          const downloadedBytes = parseInt(parts[1]) || 0;
          const totalBytes = parts[2] === "NA" ? 0 : parseInt(parts[2]) || 0;
          const speed = parts[3] === "NA" ? 0 : parseInt(parts[3]) || 0;
          const eta = parts[4] === "NA" ? 0 : parseInt(parts[4]) || 0;
          
          const playlistIndex = parts[5] && parts[5] !== "NA" ? parseInt(parts[5]) : null;
          const playlistTotal = parts[6] && parts[6] !== "NA" ? parseInt(parts[6]) : null;
          
          const progress = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;

          const now = Date.now();
          if (now - lastEmitTime >= 200 || progress === 100) {
            lastEmitTime = now;
            console.log(JSON.stringify({
              id,
              progress,
              downloadedBytes,
              totalBytes,
              speed,
              eta,
              status: "downloading",
              playlistIndex,
              playlistTotal,
              outputPath: outputPath || undefined
            }));
          }
        }
      }
    }
  }

  const status = await child.status;
  await stderrPromise;
  
  if (status.success) {
    console.log(JSON.stringify({
      id,
      progress: 100,
      status: "finished",
      outputPath: outputPath || undefined
    }));
  } else {
    throw new Error(stderrOutput || "Unknown error during yt-dlp download");
  }
}

/**
 * Sum of file sizes (bytes) under a directory — used as a REAL progress
 * signal for tools (gallery-dl / instaloader) that don't print
 * yt-dlp-style %(progress)s templates. Polled periodically while the
 * child process runs; speed is derived from delta between polls.
 */
async function dirSizeBytes(dir: string): Promise<number> {
  let total = 0;
  try {
    for await (const entry of Deno.readDir(dir)) {
      const full = `${dir}/${entry.name}`;
      try {
        if (entry.isFile) {
          total += (await Deno.stat(full)).size;
        } else if (entry.isDirectory) {
          total += await dirSizeBytes(full);
        }
      } catch (_) { /* file vanished mid-download — ignore */ }
    }
  } catch (_) { /* saveDir not created yet — ignore */ }
  return total;
}

/** A line is treated as "one file completed" only if it looks like a media file path. */
export function looksLikeMediaFile(line: string): boolean {
  return /\.(mp4|mkv|webm|mov|m4a|mp3|opus|flac|ogg|wav|jpg|jpeg|png|webp)(\s|$|")/i.test(line);
}

function emitFileProgress(opts: {
  id: string;
  filesCompleted: number;
  downloadedBytes: number;
  speed: number;
  outputPath?: string;
}): number {
  // Monotonic but honest: base 10% + 10% per completed file (cap 90),
  // plus 1% per 5MB written (cap +5) so large single files still move.
  const filePart = Math.min(80, opts.filesCompleted * 20);
  const bytePart = Math.min(5, Math.floor(opts.downloadedBytes / (5 * 1024 * 1024)));
  const progress = Math.min(95, 10 + filePart + bytePart);
  console.log(JSON.stringify({
    id: opts.id,
    progress,
    downloadedBytes: opts.downloadedBytes,
    totalBytes: 0,
    speed: Math.round(opts.speed),
    eta: 0,
    status: "downloading",
    outputPath: opts.outputPath || undefined,
  }));
  return progress;
}
/**
 * True for facebook.com/stories/<...> path URLs, which yt-dlp's FacebookIE
 * does NOT match (falls through to generic → "Unsupported URL").
 * story.php?story_fbid=... URLs are deliberately excluded — yt-dlp handles
 * those natively on the default route.
 */
export function isFacebookStoryUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (!parsed.hostname.toLowerCase().includes("facebook.com")) return false;
  return /(^|\/)stories(\/|$|\?)/i.test(parsed.pathname);
}

/** Unescape JS-string encoding found in FB Relay payloads: \/ and \uXXXX. */
export function unescapeJsString(s: string): string {
  return s
    .replace(/\\\//g, "/")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) =>
      String.fromCharCode(parseInt(h, 16)))
    .replace(/\\"/g, '"');
}

export interface FacebookStoryMedia {
  videos: string[];
  images: string[];
}

/** Extract direct media URLs from a Facebook story page HTML. */
export function extractFacebookStoryMedia(html: string): FacebookStoryMedia {
  const pick = (re: RegExp): string[] => {
    const out: string[] = [];
    for (const m of html.matchAll(re)) {
      const u = unescapeJsString(m[1]);
      if ((u.startsWith("http://") || u.startsWith("https://")) && !out.includes(u)) {
        out.push(u);
      }
    }
    return out;
  };

  const videos = [
    ...pick(/"playable_url_quality_hd"\s*:\s*"([^"]+)"/g),
    ...pick(/"playable_url"\s*:\s*"([^"]+)"/g),
    ...pick(/<meta[^>]+property="og:video(?::url)?"[^>]+content="([^"]+)"/gi),
  ];
  const images = videos.length === 0
    ? [
      ...pick(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/gi),
      ...pick(/"hd_src"\s*:\s*"([^"]+)"/g),
      ...pick(/"display_url"\s*:\s*"([^"]+)"/g),
    ]
    : [];
  return { videos, images };
}

const FB_CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Mobile/mbasic variants render simpler HTML that is easier to parse. */
export function facebookStoryPageVariants(rawUrl: string): string[] {
  try {
    const variants = [rawUrl];
    const mobile = new URL(rawUrl);
    mobile.hostname = "m.facebook.com";
    variants.push(mobile.toString());
    return variants;
  } catch {
    return [rawUrl];
  }
}

async function fetchFacebookPage(pageUrl: string, cookieHeader: string): Promise<string> {
  const resp = await fetch(pageUrl, {
    headers: {
      "Cookie": cookieHeader,
      "User-Agent": FB_CHROME_UA,
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://www.facebook.com/",
    },
    redirect: "follow",
  });
  // fetch follows redirects: a landing on login.php means cookies are bad/expired.
  if (resp.url.includes("login.php")) {
    throw new Error(
      "Facebook rejected the login cookies (redirected to login). " +
      "Re-login in your browser or re-export cookies.txt, then retry.",
    );
  }
  if (!resp.ok) {
    throw new Error(`Facebook returned HTTP ${resp.status} for the story page.`);
  }
  const html = await resp.text();
  if (html.includes("login.php") && !html.includes("playable_url")) {
    throw new Error(
      "Facebook requires login to view this story. " +
      "Set Cookie Authentication in Settings, then retry.",
    );
  }
  return html;
}

/** Stream-download a URL to disk with real byte progress events. */
async function downloadCdnFile(
  id: string,
  fileUrl: string,
  destPath: string,
  cookieHeader: string,
  outputPathForEvents: string,
): Promise<void> {
  const resp = await fetch(fileUrl, {
    headers: {
      "Cookie": cookieHeader,
      "User-Agent": FB_CHROME_UA,
      "Referer": "https://www.facebook.com/",
    },
  });
  if (!resp.ok || !resp.body) {
    throw new Error(`CDN download failed with HTTP ${resp.status}.`);
  }
  const totalBytes = parseInt(resp.headers.get("content-length") || "0", 10) || 0;
  const file = await Deno.open(destPath, { write: true, create: true, truncate: true });

  const reader = resp.body.getReader();
  const writer = file.writable.getWriter();
  let downloaded = 0;
  let lastEmit = 0;
  const start = Date.now();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await writer.write(value);
      downloaded += value.length;
      const now = Date.now();
      if (now - lastEmit >= 200 || (totalBytes > 0 && downloaded >= totalBytes)) {
        lastEmit = now;
        const elapsed = Math.max(1, (now - start) / 1000);
        console.log(JSON.stringify({
          id,
          progress: totalBytes > 0 ? Math.min(99, (downloaded / totalBytes) * 100) : 10,
          downloadedBytes: downloaded,
          totalBytes,
          speed: Math.round(downloaded / elapsed),
          eta: 0,
          status: "downloading",
          outputPath: outputPathForEvents,
        }));
      }
    }
  } finally {
    try { await writer.close(); } catch (_) { /* ignore */ }
  }
}

/**
 * Download a Facebook Story by scraping the story page with the user's
 * login cookies (yt-dlp stock cannot handle /stories/ URLs; cookies are
 * mandatory — even public stories redirect to login without them).
 */
async function downloadFacebookStory(
  id: string,
  url: string,
  saveDir: string,
  cookieFilePath: string | null,
): Promise<void> {
  if (!cookieFilePath) {
    throw new Error(
      "Facebook Stories require login cookies. Go to Settings → Cookie " +
      "Authentication, pick your browser (or a cookies.txt file), then retry.",
    );
  }
  const cookieHeader = await readCookieHeader(cookieFilePath, "facebook.com");
  if (!cookieHeader) {
    throw new Error(
      "No Facebook cookies found. Make sure you are logged into Facebook " +
      "in the selected browser (close it and retry), or re-export cookies.txt.",
    );
  }

  console.log(JSON.stringify({
    id, progress: 5, status: "downloading",
    downloadedBytes: 0, totalBytes: 0, speed: 0, eta: 0,
  }));

  // 1. Fetch story HTML (desktop first, mobile fallback).
  let html = "";
  let lastErr = "";
  for (const variant of facebookStoryPageVariants(url)) {
    try {
      html = await fetchFacebookPage(variant, cookieHeader);
      if (html.includes("playable_url") || html.includes("og:video") || html.includes("og:image")) break;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      // Auth errors are definitive — don't mask them with fallbacks.
      if (lastErr.includes("login")) throw err;
    }
  }
  if (!html) throw new Error(lastErr || "Could not load the story page.");

  // 2. Extract direct media URLs.
  const { videos, images } = extractFacebookStoryMedia(html);
  const targets = videos.length > 0
    ? videos.map((u) => ({ url: u, ext: "mp4" }))
    : images.map((u) => ({ url: u, ext: u.includes(".png") ? "png" : "jpg" }));
  if (targets.length === 0) {
    // Distinguish expired/missing stories from parser breakage.
    if (/This content isn't available|content not found|story.*(expired|unavailable)/i.test(html)) {
      throw new Error("This story is unavailable (deleted or expired after 24h).");
    }
    throw new Error(
      "No playable media found on the story page — Facebook may have changed " +
      "its page format. Please update VelocityDL and retry.",
    );
  }

  // 3. Download each segment.
  await Deno.mkdir(saveDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  let outputPath = "";
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const name = targets.length > 1
      ? `facebook_story_${stamp}_part${i + 1}.${t.ext}`
      : `facebook_story_${stamp}.${t.ext}`;
    outputPath = `${saveDir}/${name}`;
    await downloadCdnFile(id, t.url, outputPath, cookieHeader, outputPath);
  }

  console.log(JSON.stringify({ id, progress: 100, status: "finished", outputPath }));
}

async function downloadInstagramStory(
  id: string,
  url: string,
  saveDir: string,
  cookieFilePath: string | null
): Promise<void> {
  const instaloaderPath = getInstaloaderPath();
  const match = url.match(/instagram\.com\/stories\/([a-zA-Z0-9_\.]+)/i);
  const username = match ? match[1] : null;

  if (!username) {
    throw new Error("Could not extract Instagram username from URL");
  }

  const args: string[] = [
    "--no-posts",
    "--stories",
    "--no-profile-pic",
    "--no-metadata-json",
    "--no-captions",
    "--no-compress-json",
    "--dirname-pattern", saveDir,
    "--filename-pattern", "{shortcode}",
  ];

  if (cookieFilePath) {
    args.push("--cookiefile", cookieFilePath);
  }

  args.push(username);

  console.log(JSON.stringify({
    id,
    progress: 5,
    status: "downloading",
    downloadedBytes: 0,
    totalBytes: 0,
    speed: 0,
    eta: 0
  }));

  const command = new Deno.Command(instaloaderPath, {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  const child = command.spawn();
  const decoder = new TextDecoder();
  const stdoutReader = child.stdout.getReader();
  const stderrReader = child.stderr.getReader();
  
  let stderrOutput = "";
  // Instaloader logs progress to STDERR — scan it for completed media files too.
  let filesCompleted = 0;
  let outputPath = "";
  const baseBytes = await dirSizeBytes(saveDir);
  let lastBytes = baseBytes;
  let lastTime = Date.now();
  const stderrPromise = (async () => {
    while (true) {
      const { value, done } = await stderrReader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      stderrOutput = (stderrOutput + text).slice(-4096);
      for (const rawLine of text.split(/[\r\n]+/)) {
        const trimmed = rawLine.trim();
        if (!trimmed) continue;
        if (trimmed.includes(username + "/")) {
          const pathMatch = trimmed.match(new RegExp(`(${username}/.*\\.(?:mp4|jpg|jpeg|png|json|txt))`, "i"));
          if (pathMatch) {
            outputPath = `${saveDir}/${pathMatch[1].substring(username.length + 1)}`;
          }
        }
        if (looksLikeMediaFile(trimmed)) {
          filesCompleted++;
          const now = Date.now();
          const currentBytes = await dirSizeBytes(saveDir);
          const dt = Math.max(1, (now - lastTime) / 1000);
          const speed = Math.max(0, (currentBytes - lastBytes) / dt);
          lastBytes = currentBytes;
          lastTime = now;
          emitFileProgress({
            id,
            filesCompleted,
            downloadedBytes: Math.max(0, currentBytes - baseBytes),
            speed,
            outputPath,
          });
        }
      }
    }
  })();

  let buffer = "";

  while (true) {
    const { value, done } = await stdoutReader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/[\r\n]+/);
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.includes(username + "/")) {
        const pathMatch = trimmed.match(new RegExp(`(${username}/.*\\.(?:mp4|jpg|jpeg|png|json|txt))`, "i"));
        if (pathMatch) {
          outputPath = `${saveDir}/${pathMatch[1].substring(username.length + 1)}`;
        }
      }

      if (looksLikeMediaFile(trimmed)) {
        filesCompleted++;
        const now = Date.now();
        const currentBytes = await dirSizeBytes(saveDir);
        const dt = Math.max(1, (now - lastTime) / 1000);
        const speed = Math.max(0, (currentBytes - lastBytes) / dt);
        lastBytes = currentBytes;
        lastTime = now;
        emitFileProgress({
          id,
          filesCompleted,
          downloadedBytes: Math.max(0, currentBytes - baseBytes),
          speed,
          outputPath,
        });
      }
    }
  }

  const status = await child.status;
  await stderrPromise;

  if (status.success) {
    console.log(JSON.stringify({
      id,
      progress: 100,
      status: "finished",
      outputPath: outputPath || undefined
    }));
  } else {
    throw new Error(stderrOutput || "Instagram Story requires authentication or login cookies.");
  }
}

async function downloadGallerydl(
  id: string,
  url: string,
  saveDir: string,
  cookieFilePath: string | null,
  platformLabel: string,
  speedLimit: number
): Promise<void> {
  const gallerydlPath = getGallerydlPath();

  const args: string[] = [
    "--destination", saveDir,
    "-o", "directory=[]",
    "--verbose",
  ];

  if (cookieFilePath) {
    args.push("--cookies", cookieFilePath);
  }

  if (speedLimit > 0) {
    args.push("--limit-rate", `${speedLimit}K`);
  }

  args.push(url);

  console.log(JSON.stringify({
    id,
    progress: 5,
    status: "downloading",
    downloadedBytes: 0,
    totalBytes: 0,
    speed: 0,
    eta: 0
  }));

  const command = new Deno.Command(gallerydlPath, {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  const child = command.spawn();
  const decoder = new TextDecoder();
  const stdoutReader = child.stdout.getReader();
  const stderrReader = child.stderr.getReader();
  
  let stderrOutput = "";
  let filesCompleted = 0;
  let outputPath = "";
  const baseBytes = await dirSizeBytes(saveDir);
  let lastBytes = baseBytes;
  let lastTime = Date.now();
  const handleGalleryLine = async (trimmed: string) => {
    if (!trimmed) return;
    // gallery-dl --verbose prints completed file paths; only those count.
    if (trimmed.startsWith(saveDir) || looksLikeMediaFile(trimmed)) {
      if (looksLikeMediaFile(trimmed) || trimmed.startsWith(saveDir)) {
        outputPath = trimmed.length < 1024 ? trimmed : outputPath;
      }
      if (looksLikeMediaFile(trimmed)) {
        filesCompleted++;
        const now = Date.now();
        const currentBytes = await dirSizeBytes(saveDir);
        const dt = Math.max(1, (now - lastTime) / 1000);
        const speed = Math.max(0, (currentBytes - lastBytes) / dt);
        lastBytes = currentBytes;
        lastTime = now;
        emitFileProgress({
          id,
          filesCompleted,
          downloadedBytes: Math.max(0, currentBytes - baseBytes),
          speed,
          outputPath,
        });
      }
    }
  };
  const stderrPromise = (async () => {
    while (true) {
      const { value, done } = await stderrReader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      stderrOutput = (stderrOutput + text).slice(-4096);
      for (const rawLine of text.split(/[\r\n]+/)) {
        await handleGalleryLine(rawLine.trim());
      }
    }
  })();

  let buffer = "";

  while (true) {
    const { value, done } = await stdoutReader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/[\r\n]+/);
    buffer = lines.pop() || "";

    for (const line of lines) {
      await handleGalleryLine(line.trim());
    }
  }

  const status = await child.status;
  await stderrPromise;

  if (status.success) {
    console.log(JSON.stringify({
      id,
      progress: 100,
      status: "finished",
      outputPath: outputPath || undefined
    }));
  } else {
    throw new Error(stderrOutput || `Failed during ${platformLabel} download`);
  }
}
