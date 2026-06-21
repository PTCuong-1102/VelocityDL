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
