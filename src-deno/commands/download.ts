import { 
  getYtdlpPath, 
  getFfmpegDir, 
  getSpotdlPath, 
  getFfmpegPath, 
  getGallerydlPath, 
  getInstaloaderPath, 
  getSettings 
} from "../utils/paths.ts";

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

  // 1. Block Facebook stories
  if (lowerUrl.includes("facebook.com/stories") || lowerUrl.includes("facebook.com/story")) {
    console.log(JSON.stringify({
      id,
      status: "error",
      error: "Facebook Stories are currently not supported due to security and API restrictions.",
      progress: 0
    }));
    return;
  }

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
  const stderrPromise = (async () => {
    while (true) {
      const { value, done } = await stderrReader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      stderrOutput = (stderrOutput + text).slice(-4096);
    }
  })();

  let buffer = "";
  let progress = 10;
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

      if (trimmed.includes(username + "/")) {
        const pathMatch = trimmed.match(new RegExp(`(${username}/.*\\.(?:mp4|jpg|jpeg|png|json|txt))`, "i"));
        if (pathMatch) {
          outputPath = `${saveDir}/${pathMatch[1].substring(username.length + 1)}`;
        }
      }

      if (trimmed.includes(".jpg") || trimmed.includes(".mp4")) {
        progress = Math.min(progress + 15, 95);
        console.log(JSON.stringify({
          id,
          progress,
          status: "downloading",
          outputPath: outputPath || undefined
        }));
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
  const stderrPromise = (async () => {
    while (true) {
      const { value, done } = await stderrReader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      stderrOutput = (stderrOutput + text).slice(-4096);
    }
  })();

  let buffer = "";
  let progress = 10;
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

      if (trimmed.startsWith(saveDir) || trimmed.includes(":\\") || trimmed.includes("/")) {
        outputPath = trimmed;
      }

      progress = Math.min(progress + 15, 95);
      console.log(JSON.stringify({
        id,
        progress,
        status: "downloading",
        outputPath: outputPath || undefined
      }));
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
