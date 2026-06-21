import { getYtdlpPath, getSpotdlPath } from "../utils/paths.ts";

interface FormatEntry {
  format_id?: string;
  ext?: string;
  width?: number;
  height?: number;
  vcodec?: string;
  acodec?: string;
  tbr?: number;
  filesize?: number;
  format_note?: string;
}

/**
 * Extract the best available video resolution from the formats array.
 * Scans all formats that have a video codec (vcodec != "none") and
 * returns the one with the highest height (resolution).
 */
function extractBestResolution(formats: FormatEntry[]): { width: number; height: number } | null {
  let bestWidth = 0;
  let bestHeight = 0;

  for (const fmt of formats) {
    // Only consider formats that have video (vcodec is not "none" or missing)
    if (fmt.vcodec && fmt.vcodec !== "none" && fmt.height) {
      if (fmt.height > bestHeight) {
        bestHeight = fmt.height;
        bestWidth = fmt.width || 0;
      }
    }
  }

  if (bestHeight > 0) {
    return { width: bestWidth, height: bestHeight };
  }
  return null;
}

/**
 * Build a sorted list of unique available video quality labels from formats.
 * Example output: ["2160p", "1440p", "1080p", "720p", "480p", "360p"]
 */
function extractAvailableQualities(formats: FormatEntry[]): string[] {
  const heights = new Set<number>();

  for (const fmt of formats) {
    if (fmt.vcodec && fmt.vcodec !== "none" && fmt.height) {
      heights.add(fmt.height);
    }
  }

  // Sort descending and convert to labels
  return Array.from(heights)
    .sort((a, b) => b - a)
    .map((h) => `${h}p`);
}

/**
 * Format resolution into a human-readable quality string.
 * Examples: "1920x1080", "3840x2160"
 */
function formatQuality(width: number, height: number): string {
  if (width > 0 && height > 0) {
    return `${width}x${height}`;
  }
  if (height > 0) {
    return `${height}p`;
  }
  return "Unknown";
}

export async function getVideoInfo(url: string): Promise<void> {
  const isSpotify = url.toLowerCase().includes("spotify.com") || url.toLowerCase().includes("open.spotify.com");

  if (isSpotify) {
    try {
      const spotdlPath = getSpotdlPath();
      const tempFile = await Deno.makeTempFile({ suffix: ".spotdl" });

      const command = new Deno.Command(spotdlPath, {
        args: ["save", url, "--save-file", tempFile],
        stdout: "piped",
        stderr: "piped",
      });

      const output = await command.output();
      if (!output.success) {
        const errorStr = new TextDecoder().decode(output.stderr);
        throw new Error(errorStr || "Failed to extract Spotify metadata");
      }

      const contentStr = await Deno.readTextFile(tempFile);
      const rawData = JSON.parse(contentStr);

      try {
        await Deno.remove(tempFile);
      } catch (_) { /* ignore */ }

      const songs = rawData.songs || [];
      if (songs.length === 0) {
        throw new Error("No tracks found in the Spotify URL");
      }

      if (songs.length === 1) {
        const song = songs[0];
        const durationSec = song.duration;
        let durationStr = "";
        if (durationSec) {
          const m = Math.floor(durationSec / 60);
          const s = Math.floor(durationSec % 60);
          durationStr = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
        }

        const payload = {
          type: "info",
          data: {
            isPlaylist: false,
            title: `${song.name} - ${song.artists.join(", ")}`,
            thumbnailUrl: song.cover_url || "",
            duration: durationStr,
            durationSeconds: durationSec || 0,
            uploader: song.album_name || "Unknown Album",
            format: "mp3",
            quality: "320kbps",
            availableQualities: ["320k", "256k", "192k", "128k"],
            platform: "spotify"
          }
        };

        console.log(JSON.stringify(payload));
      } else {
        const payload = {
          type: "info",
          data: {
            isPlaylist: true,
            title: "Spotify Playlist / Album",
            thumbnailUrl: songs[0]?.cover_url || "",
            duration: `${songs.length} tracks`,
            totalItems: songs.length,
            uploader: "Spotify",
            format: "playlist",
            quality: "Playlist",
            platform: "spotify",
            entries: songs.map((song: any) => {
              const durationSec = song.duration;
              const m = Math.floor(durationSec / 60);
              const s = Math.floor(durationSec % 60);
              const durationStr = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
              return {
                title: `${song.name} - ${song.artists.join(", ")}`,
                id: song.song_id || Math.random().toString(36).substring(7),
                duration: durationStr,
                url: song.download_url || `https://open.spotify.com/track/${song.song_id}`
              };
            })
          }
        };

        console.log(JSON.stringify(payload));
      }
      return;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.log(JSON.stringify({
        status: "error",
        message: `Failed to extract Spotify metadata: ${errorMsg}`
      }));
      return;
    }
  }

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

      // Extract real resolution from formats array instead of relying on top-level width/height
      let quality = "Unknown";
      let availableQualities: string[] = [];

      // First try: use the formats array (most reliable)
      const formats: FormatEntry[] = rawData.formats || [];
      if (formats.length > 0) {
        const bestRes = extractBestResolution(formats);
        if (bestRes) {
          quality = formatQuality(bestRes.width, bestRes.height);
        }
        availableQualities = extractAvailableQualities(formats);
      }

      // Fallback: use top-level width/height if formats parsing found nothing
      if (quality === "Unknown" && rawData.width && rawData.height) {
        quality = `${rawData.width}x${rawData.height}`;
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
          quality,
          availableQualities,
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
