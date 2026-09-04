/**
 * Resolve the *device default browser* into a yt-dlp `--cookies-from-browser`
 * key, with validation + fallback chain.
 *
 * yt-dlp has no "default browser" mode — it needs an explicit key — so we
 * detect the OS default ourselves (registry / LaunchServices / xdg-settings)
 * and map ProgIds, bundle IDs and .desktop filenames onto cookie-source keys.
 */

export const KNOWN_COOKIE_SOURCES = [
  "chrome",
  "edge",
  "firefox",
  "brave",
  "opera",
  "chromium",
  "vivaldi",
  "whale",
  "safari",
] as const;

export type CookieSourceKey = typeof KNOWN_COOKIE_SOURCES[number];

/**
 * Map a raw OS token (ProgId, bundle ID, .desktop filename, ...) onto a
 * cookie-source key. Returns null when unrecognized.
 */
export function mapBrowserToken(raw: string): CookieSourceKey | null {
  const t = raw.toLowerCase();
  if (t.includes("firefox")) return "firefox";
  if (t.includes("msedge") || t.includes("edge")) return "edge";
  if (t.includes("brave")) return "brave";
  if (t.includes("opera")) return "opera";
  if (t.includes("vivaldi")) return "vivaldi";
  if (t.includes("whale")) return "whale";
  if (t.includes("chromium")) return "chromium";
  if (t.includes("chrome")) return "chrome";
  if (t.includes("safari")) return "safari";
  return null;
}

/** Parse `reg query ... UserChoice /v ProgId` output → cookie-source key. */
export function parseWindowsProgId(regOutput: string): CookieSourceKey | null {
  for (const line of regOutput.split("\n")) {
    const m = line.match(/ProgId\s+REG_\w+\s+(\S+)/i);
    if (m) return mapBrowserToken(m[1]);
  }
  return null;
}

/**
 * Parse `plutil -p ...launchservices.secure.plist` output: find the handler
 * dict whose URL scheme is http(s) and return its RoleAll bundle mapping.
 */
export function parseMacOSDefaultBrowser(plutilOutput: string): CookieSourceKey | null {
  for (const m of plutilOutput.matchAll(/\{([^{}]*)\}/g)) {
    const block = m[1];
    if (!/"LSHandlerURLScheme"\s*=>\s*"https?"/.test(block)) continue;
    const role = block.match(/"LSHandlerRoleAll"\s*=>\s*"([^"]+)"/);
    if (role) {
      const mapped = mapBrowserToken(role[1]);
      if (mapped) return mapped;
    }
  }
  return null;
}

async function runCapture(bin: string, args: string[]): Promise<string | null> {
  try {
    const cmd = new Deno.Command(bin, {
      args,
      stdout: "piped",
      stderr: "null",
      signal: AbortSignal.timeout(5000),
    });
    const out = await cmd.output();
    if (!out.success) return null;
    const text = new TextDecoder().decode(out.stdout).trim();
    return text || null;
  } catch (_) {
    return null;
  }
}

/** Detect the OS default browser → cookie-source key. Null when unknown. */
export async function detectDefaultBrowser(): Promise<CookieSourceKey | null> {
  const os = Deno.build.os;
  try {
    if (os === "windows") {
      const out = await runCapture("reg", [
        "query",
        "HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice",
        "/v", "ProgId",
      ]);
      return out ? parseWindowsProgId(out) : null;
    }
    if (os === "darwin") {
      const home = Deno.env.get("HOME") || "";
      const plist = `${home}/Library/Preferences/com.apple.LaunchServices/com.apple.launchservices.secure.plist`;
      const out = await runCapture("plutil", ["-p", plist]);
      return out ? parseMacOSDefaultBrowser(out) : null;
    }
    // linux + others: freedesktop default
    const out = await runCapture("xdg-settings", ["get", "default-web-browser"]);
    return out ? mapBrowserToken(out) : null;
  } catch (_) {
    return null;
  }
}

/**
 * Cookie-domain hint for validating an export against the download target
 * (e.g. youtu.be cookies live under youtube.com).
 */
export function cookieDomainHintForUrl(rawUrl: string): string {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    if (host.includes("youtu.be")) return "youtube.com";
    if (host.includes("fb.watch")) return "facebook.com";
    const parts = host.split(".").filter(Boolean);
    if (parts.length >= 2) return parts.slice(-2).join(".");
    return host;
  } catch (_) {
    return "";
  }
}
