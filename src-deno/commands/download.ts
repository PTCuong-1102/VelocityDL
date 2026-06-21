import { getYtdlpPath } from "../utils/paths.ts";

export interface DownloadOptions {
  auto4k: boolean;
  extractSubs: boolean;
  audioOnly: boolean;
}

export async function downloadMedia(
  id: string,
  url: string,
  saveDir: string,
  options: DownloadOptions
): Promise<void> {
  const ytdlpPath = getYtdlpPath();

  const args: string[] = [];

  // Add formatting / extraction quality options
  if (options.audioOnly) {
    args.push("-f", "ba", "--extract-audio", "--audio-format", "mp3");
  } else if (options.auto4k) {
    args.push("-f", "bv*[height<=2160]+ba/b[height<=2160]");
  } else {
    // Default to best quality up to 1080p
    args.push("-f", "bv*[height<=1080]+ba/b[height<=1080]");
  }

  // Subtitles
  if (options.extractSubs) {
    args.push("--write-subs", "--sub-langs", "all");
  }

  // Set output file template
  args.push("-o", `${saveDir}/%(title)s.%(ext)s`);

  // Progress reporting formatting template
  // Format: downloading:downloaded_bytes:total_bytes:speed:eta
  args.push(
    "--progress-template", 
    "downloading:%(progress.downloaded_bytes)s:%(progress.total_bytes)s:%(progress.speed)s:%(progress.eta)s"
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
        if (trimmed.startsWith("downloading:")) {
          const parts = trimmed.split(":");
          if (parts.length >= 5) {
            const downloadedBytes = parseInt(parts[1]) || 0;
            
            // Check for NA values in total_bytes, speed, and eta
            const totalBytes = parts[2] === "NA" ? 0 : parseInt(parts[2]) || 0;
            const speed = parts[3] === "NA" ? 0 : parseInt(parts[3]) || 0;
            const eta = parts[4] === "NA" ? 0 : parseInt(parts[4]) || 0;
            
            const progress = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;

            console.log(JSON.stringify({
              id,
              progress,
              downloadedBytes,
              totalBytes,
              speed,
              eta,
              status: "downloading"
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
