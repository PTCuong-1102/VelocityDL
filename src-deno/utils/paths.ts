import * as path from "https://deno.land/std@0.224.0/path/mod.ts";

export function getBinDir(): string {
  const isWindows = Deno.build.os === "windows";
  let baseDir = "";

  if (isWindows) {
    baseDir = Deno.env.get("LOCALAPPDATA") || Deno.env.get("APPDATA") || Deno.env.get("USERPROFILE") || ".";
  } else {
    baseDir = Deno.env.get("HOME") || ".";
  }

  return path.join(baseDir, "VelocityDL", "bin");
}

export function getYtdlpPath(): string {
  const binDir = getBinDir();
  const isWindows = Deno.build.os === "windows";
  const binaryName = isWindows ? "yt-dlp.exe" : "yt-dlp";
  return path.join(binDir, binaryName);
}

export function getFfmpegDir(): string {
  return path.join(getBinDir(), "ffmpeg");
}

export function getFfmpegPath(): string {
  const ffmpegDir = getFfmpegDir();
  const isWindows = Deno.build.os === "windows";
  const binaryName = isWindows ? "ffmpeg.exe" : "ffmpeg";
  return path.join(ffmpegDir, binaryName);
}

export function getFfprobePath(): string {
  const ffmpegDir = getFfmpegDir();
  const isWindows = Deno.build.os === "windows";
  const binaryName = isWindows ? "ffprobe.exe" : "ffprobe";
  return path.join(ffmpegDir, binaryName);
}

export function getSpotdlPath(): string {
  const binDir = getBinDir();
  const isWindows = Deno.build.os === "windows";
  const binaryName = isWindows ? "spotdl.exe" : "spotdl";
  return path.join(binDir, binaryName);
}

export function getGallerydlPath(): string {
  const binDir = getBinDir();
  const isWindows = Deno.build.os === "windows";
  const binaryName = isWindows ? "gallery-dl.exe" : "gallery-dl.bin";
  return path.join(binDir, binaryName);
}

export function getInstaloaderPath(): string {
  const binDir = getBinDir();
  const isWindows = Deno.build.os === "windows";
  const binaryName = isWindows ? "instaloader.exe" : "instaloader";
  return path.join(binDir, binaryName);
}

export function getAppConfigDir(): string {
  const isWindows = Deno.build.os === "windows";
  const isMac = Deno.build.os === "darwin";
  
  if (isWindows) {
    const appData = Deno.env.get("APPDATA") || ".";
    return path.join(appData, "com.ptcmh.velocitydl");
  } else if (isMac) {
    const home = Deno.env.get("HOME") || ".";
    return path.join(home, "Library", "Application Support", "com.ptcmh.velocitydl");
  } else {
    const configHome = Deno.env.get("XDG_CONFIG_HOME");
    if (configHome) {
      return path.join(configHome, "com.ptcmh.velocitydl");
    }
    const home = Deno.env.get("HOME") || ".";
    return path.join(home, ".config", "com.ptcmh.velocitydl");
  }
}

export function getSettingsPath(): string {
  return path.join(getAppConfigDir(), "settings.json");
}

export async function getSettings(): Promise<any> {
  try {
    const p = getSettingsPath();
    const content = await Deno.readTextFile(p);
    return JSON.parse(content);
  } catch (_) {
    return {};
  }
}

