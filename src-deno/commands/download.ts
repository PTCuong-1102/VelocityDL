import { getYtdlpPath, getFfmpegDir } from "../utils/paths.ts";

export interface DownloadOptions {
  maxHeight: number;
  extractSubs: boolean;
  audioOnly: boolean;
  audioFormat?: string;
  audioQuality?: string;
}

export async function downloadMedia(
  id: string,
  url: string,
  saveDir: string,
  options: DownloadOptions
): Promise<void> {
  const ytdlpPath = getYtdlpPath();
  const ffmpegDir = getFfmpegDir();

  const args: string[] = [];

  // Point yt-dlp to our bundled FFmpeg so it can merge video+audio automatically
  args.push("--ffmpeg-location", ffmpegDir);

  // Add formatting / extraction quality options
  if (options.audioOnly) {
    const format = options.audioFormat || "mp3";
    const quality = options.audioQuality || "320k";
    args.push("-f", "ba/b", "--extract-audio", "--audio-format", format, "--audio-quality", quality);
  } else {
    // Use the selected max height for quality cap
    const height = options.maxHeight > 0 ? options.maxHeight : 1080;
    args.push("-f", `bv*[height<=${height}]+ba/b[height<=${height}]`);
    // Ensure merged output is always a single mp4 file
    args.push("--merge-output-format", "mp4");
  }

  // Subtitles
  if (options.extractSubs) {
    args.push("--write-subs", "--sub-langs", "all");
  }

  // Set output file template
  args.push("-o", `${saveDir}/%(title)s.%(ext)s`);

  // Progress reporting formatting template
  // Format: downloading:downloaded_bytes:total_bytes:speed:eta:playlist_index:n_entries
  args.push(
    "--progress-template", 
    "downloading:%(progress.downloaded_bytes)s:%(progress.total_bytes)s:%(progress.speed)s:%(progress.eta)s:%(info.playlist_index)s:%(info.n_entries)s"
  );

  // Post-processor progress template — emit 'merging' status when FFmpeg is muxing
  args.push(
    "--progress-template",
    "postprocess:merging:%(info.playlist_index)s:%(info.n_entries)s"
  );

  // Add target URL
  args.push(url);

  try {
    const command = new Deno.Command(ytdlpPath, {
      args,
      stdout: "piped",
      stderr: "piped",
    });

    const child = command.spawn();

    const decoder = new TextDecoder();
    const stdoutReader = child.stdout.getReader();
    let buffer = "";

    // Read progress stdout stream in real time
    while (true) {
      const { value, done } = await stdoutReader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // Split lines supporting carriage return updates (\r)
      const lines = buffer.split(/[\r\n]+/);
      buffer = lines.pop() || ""; // Keep the remainder

      for (const line of lines) {
        const trimmed = line.trim();

        // Handle merge/postprocess status
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
            playlistTotal
          }));
          continue;
        }

        // Handle download progress
        if (trimmed.startsWith("downloading:")) {
          const parts = trimmed.split(":");
          if (parts.length >= 5) {
            const downloadedBytes = parseInt(parts[1]) || 0;
            
            // Check for NA values in total_bytes, speed, and eta
            const totalBytes = parts[2] === "NA" ? 0 : parseInt(parts[2]) || 0;
            const speed = parts[3] === "NA" ? 0 : parseInt(parts[3]) || 0;
            const eta = parts[4] === "NA" ? 0 : parseInt(parts[4]) || 0;
            
            const playlistIndex = parts[5] && parts[5] !== "NA" ? parseInt(parts[5]) : null;
            const playlistTotal = parts[6] && parts[6] !== "NA" ? parseInt(parts[6]) : null;
            
            const progress = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;

            console.log(JSON.stringify({
              id,
              progress,
              downloadedBytes,
              totalBytes,
              speed,
              eta,
              status: "downloading",
              playlistIndex,
              playlistTotal
            }));
          }
        }
      }
    }

    // Wait for the exit code
    const status = await child.status;
    
    if (status.success) {
      console.log(JSON.stringify({
        id,
        progress: 100,
        status: "finished"
      }));
    } else {
      const errorBytes = await child.stderr.getReader().read();
      const errorStr = errorBytes.value ? decoder.decode(errorBytes.value) : "Unknown error during download";
      throw new Error(errorStr);
    }

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.log(JSON.stringify({
      id,
      status: "error",
      error: errorMsg,
      progress: 0
    }));
  }
}
export default downloadMedia;
