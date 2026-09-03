/**
 * Netscape cookies.txt parsing + Cookie-header building for raw `fetch()`
 * calls (Deno has no cookie jar, so FB-story scraping sends cookies manually).
 */

export interface ParsedCookie {
  domain: string;
  name: string;
  value: string;
}

/**
 * Parse Netscape/Mozilla cookies.txt content.
 * Skips comments (#...), HttpOnly prefixes (#HttpOnly_), and malformed lines.
 * Expected columns: domain, flag, path, secure, expiry, name, value.
 */
export function parseNetscapeCookies(text: string): ParsedCookie[] {
  const out: ParsedCookie[] = [];
  for (const rawLine of text.split("\n")) {
    let line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    // Strip optional "#HttpOnly_" marker prefix (some exporters inline it).
    if (line.startsWith("#HttpOnly_")) line = line.slice("#HttpOnly_".length);
    const cols = line.split("\t");
    if (cols.length < 7) continue;
    const [domain, , , , , name, ...valueParts] = cols;
    if (!domain || !name) continue;
    out.push({ domain: domain.toLowerCase(), name, value: valueParts.join("\t") });
  }
  return out;
}

/** True when `cookieDomain` (e.g. ".facebook.com") covers `host`. */
export function cookieDomainMatches(cookieDomain: string, host: string): boolean {
  const d = cookieDomain.startsWith(".") ? cookieDomain.slice(1) : cookieDomain;
  const h = host.toLowerCase();
  return h === d || h.endsWith(`.${d}`);
}

/**
 * Build a `Cookie: a=b; c=d` header for `host` from parsed cookies.
 * Returns "" when nothing matches (caller must treat as auth failure).
 */
export function buildCookieHeader(cookies: ParsedCookie[], host: string): string {
  const seen = new Map<string, string>();
  for (const c of cookies) {
    if (cookieDomainMatches(c.domain, host) && !seen.has(c.name)) {
      seen.set(c.name, c.value);
    }
  }
  return [...seen.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

/** Read a cookies.txt file and build the header for `host`. "" on any failure. */
export async function readCookieHeader(cookieFilePath: string, host: string): Promise<string> {
  try {
    const text = await Deno.readTextFile(cookieFilePath);
    return buildCookieHeader(parseNetscapeCookies(text), host);
  } catch (_) {
    return "";
  }
}
