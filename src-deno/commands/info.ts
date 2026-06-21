import { getYtdlpPath } from "../utils/paths.ts";

export async function getVideoInfo(url: string): Promise<void> {
  const ytdlpPath = getYtdlpPath();

  try {
    const isPlaylist = url.toLowerCase().includes("list=") || url.toLowerCase().includes("playlist");
    const args = isPlaylist 
      ? ["--flat-playlist", "--dump-single-json", url]
      : ["--dump-json", "--no-playlist", url];

    const command = new Deno.Command(ytdlpPath, {
      args,
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

    // Determine platform
    let platform = "other";
    try {
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
    } catch {
      // Ignored if URL parsing fails
    }

    let payload;
    if (isPlaylist && rawData._type === "playlist") {
      const entriesCount = rawData.entries?.length || 0;
      payload = {
        type: "info",
        data: {
          isPlaylist: true,
          title: rawData.title || "Unknown Playlist",
          thumbnailUrl: rawData.entries?.[0]?.thumbnail || (rawData.entries?.[0]?.thumbnails?.[0]?.url) || "",
          duration: `${entriesCount} item${entriesCount !== 1 ? 's' : ''}`,
          totalItems: entriesCount,
          uploader: rawData.uploader || "Unknown",
          format: "playlist",
          quality: "Playlist",
          platform,
          entries: rawData.entries?.map((e: any) => ({
            title: e.title || "Unknown Video",
            id: e.id,
            duration: e.duration ? `${Math.floor(e.duration / 60).toString().padStart(2, "0")}:${Math.floor(e.duration % 60).toString().padStart(2, "0")}` : "00:00",
            url: e.url || (e.id ? `https://www.youtube.com/watch?v=${e.id}` : "")
          })) || []
        }
      };
    } else {
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

      payload = {
        type: "info",
        data: {
          isPlaylist: false,
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
    }

    console.log(JSON.stringify(payload));
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.log(JSON.stringify({
      status: "error",
      message: `Failed to extract URL info: ${errorMsg}`
    }));
  }
}
