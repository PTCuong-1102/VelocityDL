import { getYtdlpPath } from "../utils/paths.ts";

export async function getVideoInfo(url: string): Promise<void> {
  const ytdlpPath = getYtdlpPath();

  try {
    const command = new Deno.Command(ytdlpPath, {
      args: ["--dump-json", "--no-playlist", url],
      stdout: "piped",
      stderr: "piped",
    });

    const output = await command.output();
    
    if (!output.success) {
      const errorStr = new TextDecoder().decode(output.stderr);
      throw new Error(errorStr || "Failed to extract metadata");
    }

    const stdoutStr = new TextDecoder().decode(output.stdout);
    const rawData = JSON.parse(stdoutStr);

    // Format duration into hh:mm:ss
    const durationSec = rawData.duration;
    let durationStr = "";
    if (durationSec) {
      const h = Math.floor(durationSec / 3600);
      const m = Math.floor((durationSec % 3600) / 60);
      const s = Math.floor(durationSec % 60);
      durationStr = h > 0 
        ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
        : `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }

    // Determine platform
    let platform = "other";
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
      platform = "youtube";
    } else if (hostname.includes("tiktok.com")) {
      platform = "tiktok";
    } else if (hostname.includes("facebook.com")) {
      platform = "facebook";
    } else if (hostname.includes("instagram.com")) {
      platform = "instagram";
    }

    const payload = {
      type: "info",
      data: {
        title: rawData.title || "Unknown Video",
        thumbnailUrl: rawData.thumbnail || (rawData.thumbnails && rawData.thumbnails[0]?.url) || "",
        duration: durationStr,
        durationSeconds: durationSec || 0,
        uploader: rawData.uploader || "Unknown",
        format: rawData.ext || "mp4",
        quality: rawData.width && rawData.height ? `${rawData.width}x${rawData.height}` : "1080p",
        platform,
      }
    };

    console.log(JSON.stringify(payload));
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.log(JSON.stringify({
      status: "error",
      message: `Failed to extract URL info: ${errorMsg}`
    }));
  }
}
