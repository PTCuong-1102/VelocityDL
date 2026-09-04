/**
 * Browser profile discovery + `--cookies-from-browser` spec building.
 *
 * Why this exists: yt-dlp only looks at stock profile locations with the
 * default profile. That misses the most common real-world setups:
 * - Firefox/Chrome installed as Ubuntu **snaps** (different home dirs)
 * - **multiple profiles** (yt-dlp reads the most-recent one, which may not
 *   hold the site login)
 * - Linux Chromium-family cookie **encryption** (needs +gnomekeyring/+kwallet)
 *
 * All filesystem roots are parameterizable so the pure parts are unit-testable.
 */

export interface HomeVars {
  HOME: string;
  APPDATA: string;
  LOCALAPPDATA: string;
  XDG_CONFIG_HOME: string;
}

export function getHomeVars(): HomeVars {
  const home = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || ".";
  return {
    HOME: home,
    APPDATA: Deno.env.get("APPDATA") || "",
    LOCALAPPDATA: Deno.env.get("LOCALAPPDATA") || "",
    XDG_CONFIG_HOME: Deno.env.get("XDG_CONFIG_HOME") || "",
  };
}

type OS = "windows" | "darwin" | "linux";

function linuxConfig(home: HomeVars): string {
  return home.XDG_CONFIG_HOME || (home.HOME ? `${home.HOME}/.config` : "");
}

/** User-Data roots per Chromium-family browser (profile subdirs live inside). */
export function chromiumUserDataRoots(
  source: string,
  os: OS,
  home: HomeVars,
): string[] {
  const cfg = linuxConfig(home);
  const join = (...p: string[]) => p.filter(Boolean).join("/");
  switch (source) {
    case "chrome":
      if (os === "windows") return home.LOCALAPPDATA ? [join(home.LOCALAPPDATA, "Google/Chrome/User Data")] : [];
      if (os === "darwin") return [join(home.HOME, "Library/Application Support/Google/Chrome")];
      return cfg ? [join(cfg, "google-chrome")] : [];
    case "chromium":
      if (os === "windows") return home.LOCALAPPDATA ? [join(home.LOCALAPPDATA, "Chromium/User Data")] : [];
      if (os === "darwin") return [join(home.HOME, "Library/Application Support/Chromium")];
      return [
        ...(cfg ? [join(cfg, "chromium")] : []),
        ...(home.HOME ? [join(home.HOME, "snap/chromium/common/chromium")] : []),
      ];
    case "edge":
      if (os === "windows") return home.LOCALAPPDATA ? [join(home.LOCALAPPDATA, "Microsoft/Edge/User Data")] : [];
      if (os === "darwin") return [join(home.HOME, "Library/Application Support/Microsoft Edge")];
      return cfg ? [join(cfg, "microsoft-edge")] : [];
    case "brave":
      if (os === "windows") return home.LOCALAPPDATA ? [join(home.LOCALAPPDATA, "BraveSoftware/Brave-Browser/User Data")] : [];
      if (os === "darwin") return [join(home.HOME, "Library/Application Support/BraveSoftware/Brave-Browser")];
      return cfg ? [join(cfg, "BraveSoftware/Brave-Browser")] : [];
    case "opera":
      if (os === "windows") return home.APPDATA ? [join(home.APPDATA, "Opera Software/Opera Stable")] : [];
      if (os === "darwin") return [join(home.HOME, "Library/Application Support/com.operasoftware.Opera")];
      return cfg ? [join(cfg, "opera")] : [];
    case "vivaldi":
      if (os === "windows") return home.LOCALAPPDATA ? [join(home.LOCALAPPDATA, "Vivaldi/User Data")] : [];
      if (os === "darwin") return [join(home.HOME, "Library/Application Support/Vivaldi")];
      return cfg ? [join(cfg, "vivaldi")] : [];
    case "whale":
      if (os === "windows") return home.LOCALAPPDATA ? [join(home.LOCALAPPDATA, "Naver/Naver Whale/User Data")] : [];
      if (os === "darwin") return [join(home.HOME, "Library/Application Support/Naver/Whale")];
      return cfg ? [join(cfg, "naver-whale")] : [];
    default:
      return [];
  }
}

/** firefox profiles.ini locations (stock + snap). */
export function firefoxIniPaths(os: OS, home: HomeVars): string[] {
  const cfg = linuxConfig(home);
  if (os === "windows") {
    return [
      ...(home.APPDATA ? [`${home.APPDATA}/Mozilla/Firefox/profiles.ini`] : []),
      ...(home.HOME && !home.APPDATA ? [`${home.HOME}/snap/firefox/common/.mozilla/firefox/profiles.ini`] : []),
    ];
  }
  if (os === "darwin") {
    return [`${home.HOME}/Library/Application Support/Firefox/profiles.ini`];
  }
  return [
    ...(home.HOME ? [`${home.HOME}/.mozilla/firefox/profiles.ini`] : []),
    ...(home.HOME ? [`${home.HOME}/snap/firefox/common/.mozilla/firefox/profiles.ini`] : []),
    ...(cfg && cfg !== `${home.HOME}/.config` ? [`${cfg}/mozilla/firefox/profiles.ini`] : []),
  ];
}

/**
 * Parse a Firefox profiles.ini into absolute profile dirs, default first.
 * `iniDir` is the directory containing the ini (relative Path= entries
 * resolve against it).
 */
export function parseFirefoxProfilesIni(text: string, iniDir: string): string[] {
  const profiles: { path: string; isDefault: boolean; order: number }[] = [];
  let current: Record<string, string> | null = null;
  let order = 0;
  const flush = () => {
    if (current && current["Path"]) {
      const raw = current["Path"];
      const abs = current["IsRelative"] === "0" ? raw : `${iniDir}/${raw}`;
      profiles.push({
        path: abs,
        isDefault: current["Default"] === "1",
        order: order++,
      });
    }
    current = null;
  };
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith(";") || line.startsWith("#")) continue;
    if (line.startsWith("[") && line.endsWith("]")) {
      flush();
      current = {};
      continue;
    }
    if (current) {
      const eq = line.indexOf("=");
      if (eq > 0) current[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
  }
  flush();
  return profiles
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.order - b.order)
    .map((p) => p.path);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const st = await Deno.stat(path);
    return st.isFile;
  } catch (_) {
    return false;
  }
}

/**
 * Discover usable profile dirs for a browser (max 3): Chromium-family scans
 * User-Data roots for subdirs holding a Cookies/Login Data file; Firefox
 * resolves profiles.ini entries (also snap locations).
 */
export async function discoverBrowserProfiles(
  source: string,
  os: OS,
  home: HomeVars,
): Promise<string[]> {
  const out: string[] = [];
  if (source === "firefox") {
    for (const ini of firefoxIniPaths(os, home)) {
      try {
        const text = await Deno.readTextFile(ini);
        const iniDir = ini.slice(0, ini.lastIndexOf("/"));
        for (const dir of parseFirefoxProfilesIni(text, iniDir)) {
          if (out.length >= 3) break;
          if (await fileExists(`${dir}/cookies.sqlite`) && !out.includes(dir)) {
            out.push(dir);
          }
        }
      } catch (_) { /* missing ini — try next */ }
      if (out.length >= 3) break;
    }
    return out;
  }
  if (source === "safari") return out; // yt-dlp handles Safari by name; no profiles
  for (const root of chromiumUserDataRoots(source, os, home)) {
    try {
      for await (const entry of Deno.readDir(root)) {
        if (out.length >= 3) break;
        if (!entry.isDirectory) continue;
        const dir = `${root}/${entry.name}`;
        if ((await fileExists(`${dir}/Cookies`) || await fileExists(`${dir}/Login Data`)) &&
            !out.includes(dir)) {
          out.push(dir);
        }
      }
    } catch (_) { /* missing root — try next */ }
    if (out.length >= 3) break;
  }
  // Least surprise: Default profile first when present.
  out.sort((a, b) => {
    const rank = (p: string) => p.endsWith("/Default") ? 0 : 1;
    return rank(a) - rank(b);
  });
  return out;
}

/** Keyring variants to try on Linux for encrypted Chromium cookie stores. */
export function keyringVariants(source: string, os: OS): string[] {
  const chromiumFamily = ["chrome", "chromium", "edge", "brave", "opera", "vivaldi", "whale"];
  if (os === "linux" && chromiumFamily.includes(source)) {
    return ["", "gnomekeyring", "kwallet"];
  }
  return [""];
}

/**
 * Build ordered `--cookies-from-browser` specs: `src[+keyring][:profile]`,
 * capped so a full sweep stays within ~15 attempts.
 */
export function buildCookieSpecs(
  browsers: string[],
  profilesByBrowser: Record<string, string[]>,
  os: OS,
  maxSpecs = 15,
): string[] {
  const specs: string[] = [];
  for (const src of browsers) {
    const profiles = profilesByBrowser[src] ?? [];
    const keyrings = keyringVariants(src, os);
    // Explicit profiles first (most likely the right login), then bare key.
    const profileFirst: (string | undefined)[] = [...profiles, undefined];
    for (const profile of profileFirst) {
      for (const kr of keyrings) {
        if (specs.length >= maxSpecs) return specs;
        let spec = src;
        if (kr) spec += `+${kr}`;
        if (profile) spec += `:${profile}`;
        if (!specs.includes(spec)) specs.push(spec);
      }
    }
  }
  return specs;
}
