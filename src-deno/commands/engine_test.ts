import { assert, assertEquals } from "jsr:@std/assert";
import { isPlaylistUrl } from "./info.ts";
import {
  looksLikeMediaFile,
  isFacebookStoryUrl,
  unescapeJsString,
  extractFacebookStoryMedia,
  facebookStoryPageVariants,
} from "./download.ts";
import {
  parseNetscapeCookies,
  cookieDomainMatches,
  buildCookieHeader,
} from "../utils/cookies.ts";
import {
  mapBrowserToken,
  parseWindowsProgId,
  parseMacOSDefaultBrowser,
  cookieDomainHintForUrl,
} from "../utils/defaultBrowser.ts";
import {
  validateCookieExport,
  explainCookieError,
  resolveCookieBrowsers,
} from "./download.ts";
import {
  chromiumUserDataRoots,
  firefoxIniPaths,
  parseFirefoxProfilesIni,
  keyringVariants,
  buildCookieSpecs,
} from "../utils/browserProfiles.ts";

Deno.test("isPlaylistUrl — true YouTube playlists", () => {
  assertEquals(isPlaylistUrl("https://www.youtube.com/watch?v=abc&list=PL123"), true);
  assertEquals(isPlaylistUrl("https://www.youtube.com/playlist?list=PL123"), true);
  assertEquals(isPlaylistUrl("https://open.spotify.com/playlist/abc"), true);
  assertEquals(isPlaylistUrl("https://open.spotify.com/album/abc"), true);
});

Deno.test("isPlaylistUrl — rejects former false-positives", () => {
  // Old code: includes("list=") / includes("playlist") matched these.
  assertEquals(isPlaylistUrl("https://example.com/playlist-review"), false);
  assertEquals(isPlaylistUrl("https://example.com/video?playlistName=foo"), false);
  assertEquals(isPlaylistUrl("https://www.youtube.com/watch?v=abc"), false);
  assertEquals(isPlaylistUrl("https://youtu.be/abc?list=PL123"), false);
  assertEquals(isPlaylistUrl("not a url"), false);
});

Deno.test("looksLikeMediaFile — only real media paths count", () => {
  assert(looksLikeMediaFile("/dl/video.mp4"));
  assert(looksLikeMediaFile("C:\\dl\\photo.jpg"));
  assert(!looksLikeMediaFile("Downloading 15% ..."));
  assert(!looksLikeMediaFile("/dl/page.html"));
  assert(!looksLikeMediaFile(""));
});

Deno.test("isFacebookStoryUrl — only /stories/ path form", () => {
  assert(isFacebookStoryUrl("https://www.facebook.com/stories/123456/"));
  assert(isFacebookStoryUrl("https://www.facebook.com/stories/123456?view_single=1"));
  assert(isFacebookStoryUrl("https://m.facebook.com/stories/abc"));
  // story.php is yt-dlp native — must NOT route to the scraper.
  assert(!isFacebookStoryUrl("https://www.facebook.com/story.php?story_fbid=1&id=2"));
  assert(!isFacebookStoryUrl("https://www.facebook.com/watch/?v=1"));
  assert(!isFacebookStoryUrl("https://www.youtube.com/watch?v=x"));
  assert(!isFacebookStoryUrl("not a url"));
});

Deno.test("unescapeJsString — decodes FB escaping", () => {
  assertEquals(
    unescapeJsString("https:\\/\\/scontent.xx\\/v\\/t.mp4?\\u0026oh=abc"),
    "https://scontent.xx/v/t.mp4?&oh=abc",
  );
});

Deno.test("extractFacebookStoryMedia — HD preferred, photo fallback", () => {
  const html = `
    {"playable_url":"https:\\/\\/cdn\\/sd.mp4","playable_url_quality_hd":"https:\\/\\/cdn\\/hd.mp4"}
    <meta property="og:video" content="https://cdn/og.mp4" />
    <meta property="og:image" content="https://cdn/thumb.jpg" />`;
  const { videos, images } = extractFacebookStoryMedia(html);
  assertEquals(videos[0], "https://cdn/hd.mp4");
  assert(videos.includes("https://cdn/sd.mp4"));
  assertEquals(images, []);

  const photoHtml = `<meta property="og:image" content="https://cdn/p.jpg" />`;
  const photo = extractFacebookStoryMedia(photoHtml);
  assertEquals(photo.videos, []);
  assertEquals(photo.images, ["https://cdn/p.jpg"]);

  assertEquals(extractFacebookStoryMedia("<html>login</html>").videos, []);
});

Deno.test("facebookStoryPageVariants — desktop first, mobile fallback", () => {
  const v = facebookStoryPageVariants("https://www.facebook.com/stories/123");
  assertEquals(v[0], "https://www.facebook.com/stories/123");
  assert(v[1].includes("m.facebook.com"));
});

Deno.test("mapBrowserToken — ProgIds, bundle IDs, .desktop files", () => {
  assertEquals(mapBrowserToken("ChromeHTML"), "chrome");
  assertEquals(mapBrowserToken("MSEdgeHTM"), "edge");
  assertEquals(mapBrowserToken("FirefoxURL-abc"), "firefox");
  assertEquals(mapBrowserToken("OperaStable"), "opera");
  assertEquals(mapBrowserToken("BraveHTML"), "brave");
  assertEquals(mapBrowserToken("com.google.chrome"), "chrome");
  assertEquals(mapBrowserToken("org.mozilla.firefox"), "firefox");
  assertEquals(mapBrowserToken("com.apple.safari"), "safari");
  assertEquals(mapBrowserToken("google-chrome.desktop"), "chrome");
  assertEquals(mapBrowserToken("firefox.desktop"), "firefox");
  assertEquals(mapBrowserToken("org.chromium.chromium"), "chromium");
  assertEquals(mapBrowserToken("random-stuff"), null);
});

Deno.test("parseWindowsProgId — reads REG_SZ value", () => {
  const out = [
    "HKEY_CURRENT_USER\\...\\UserChoice",
    "    ProgId    REG_SZ    ChromeHTML",
  ].join("\n");
  assertEquals(parseWindowsProgId(out), "chrome");
  assertEquals(parseWindowsProgId("nothing here"), null);
});

Deno.test("parseMacOSDefaultBrowser — http handler bundle", () => {
  const plutil = `
    "LSHandlers" => [
      0 => {
        "LSHandlerURLScheme" => "http"
        "LSHandlerRoleAll" => "org.mozilla.firefox"
      }
      1 => {
        "LSHandlerURLScheme" => "ftp"
        "LSHandlerRoleAll" => "com.apple.safari"
      }
    ]`;
  assertEquals(parseMacOSDefaultBrowser(plutil), "firefox");
  assertEquals(parseMacOSDefaultBrowser("empty"), null);
});

Deno.test("cookieDomainHintForUrl — registrable domain + aliases", () => {
  assertEquals(cookieDomainHintForUrl("https://www.youtube.com/watch?v=x"), "youtube.com");
  assertEquals(cookieDomainHintForUrl("https://youtu.be/x"), "youtube.com");
  assertEquals(cookieDomainHintForUrl("https://fb.watch/x"), "facebook.com");
  assertEquals(cookieDomainHintForUrl("https://m.facebook.com/stories/1"), "facebook.com");
  assertEquals(cookieDomainHintForUrl("not a url"), "");
});

Deno.test("validateCookieExport — needs matching-domain cookies", async () => {
  const good = await Deno.makeTempFile({ suffix: ".txt" });
  await Deno.writeTextFile(
    good,
    ".facebook.com\tTRUE\t/\tTRUE\t0\tc_user\t123\n.youtube.com\tTRUE\t/\tTRUE\t0\tVISITOR\tz\n",
  );
  try {
    assertEquals(await validateCookieExport(good, "www.facebook.com", "facebook.com"), true);
    assertEquals(await validateCookieExport(good, "www.tiktok.com", "tiktok.com"), false);
  } finally {
    await Deno.remove(good);
  }
  const empty = await Deno.makeTempFile({ suffix: ".txt" });
  await Deno.writeTextFile(empty, "# Netscape HTTP Cookie File\n");
  try {
    assertEquals(await validateCookieExport(empty, "www.facebook.com", "facebook.com"), false);
  } finally {
    await Deno.remove(empty);
  }
  assertEquals(await validateCookieExport("/nonexistent/file.txt", "x", "y"), false);
});

Deno.test("parseNetscapeCookies — skips comments and bad lines", () => {
  const text = [
    "# Netscape HTTP Cookie File",
    "#HttpOnly_.facebook.com\tTRUE\t/\tTRUE\t0\tc_user\t123",
    ".facebook.com\tTRUE\t/\tTRUE\t0\txs\tabc",
    ".youtube.com\tTRUE\t/\tTRUE\t0\tVISITOR\tzzz",
    "malformed-line",
    "",
  ].join("\n");
  const cookies = parseNetscapeCookies(text);
  assertEquals(cookies.length, 3);
  assertEquals(cookies[0], { domain: ".facebook.com", name: "c_user", value: "123" });
});

Deno.test("buildCookieHeader — domain-scoped, first wins", () => {  const cookies = [
    { domain: ".facebook.com", name: "c_user", value: "1" },
    { domain: ".facebook.com", name: "c_user", value: "dup" },
    { domain: ".youtube.com", name: "VISITOR", value: "z" },
  ];
  assertEquals(buildCookieHeader(cookies, "www.facebook.com"), "c_user=1");
  assertEquals(buildCookieHeader(cookies, "m.facebook.com"), "c_user=1");
  assertEquals(buildCookieHeader(cookies, "www.youtube.com"), "VISITOR=z");
  assertEquals(buildCookieHeader(cookies, "example.com"), "");
  assert(cookieDomainMatches(".facebook.com", "www.facebook.com"));
  assert(!cookieDomainMatches(".facebook.com", "notfacebook.com"));
});

Deno.test("chromiumUserDataRoots — per-OS vendor paths", () => {
  const win = { HOME: "C:/Users/u", APPDATA: "C:/Users/u/AppData/Roaming", LOCALAPPDATA: "C:/Users/u/AppData/Local", XDG_CONFIG_HOME: "" };
  const mac = { HOME: "/Users/u", APPDATA: "", LOCALAPPDATA: "", XDG_CONFIG_HOME: "" };
  const lin = { HOME: "/home/u", APPDATA: "", LOCALAPPDATA: "", XDG_CONFIG_HOME: "" };
  assertEquals(chromiumUserDataRoots("edge", "windows", win), ["C:/Users/u/AppData/Local/Microsoft/Edge/User Data"]);
  assertEquals(chromiumUserDataRoots("chrome", "darwin", mac), ["/Users/u/Library/Application Support/Google/Chrome"]);
  assertEquals(chromiumUserDataRoots("brave", "linux", lin), ["/home/u/.config/BraveSoftware/Brave-Browser"]);
  // snap location included for chromium/firefox-adjacent
  assert(chromiumUserDataRoots("chromium", "linux", lin).some((p) => p.includes("snap/chromium")));
  assertEquals(chromiumUserDataRoots("unknown", "linux", lin), []);
});

Deno.test("firefoxIniPaths — stock + snap locations", () => {
  const lin = { HOME: "/home/u", APPDATA: "", LOCALAPPDATA: "", XDG_CONFIG_HOME: "" };
  const paths = firefoxIniPaths("linux", lin);
  assert(paths.includes("/home/u/.mozilla/firefox/profiles.ini"));
  assert(paths.includes("/home/u/snap/firefox/common/.mozilla/firefox/profiles.ini"));
});

Deno.test("parseFirefoxProfilesIni — default first, relative resolved", () => {
  const ini = [
    "[Profile0]",
    "Name=old",
    "IsRelative=1",
    "Path=abc123.old",
    "",
    "[Profile1]",
    "Name=default",
    "IsRelative=1",
    "Path=xyz.default",
    "Default=1",
  ].join("\n");
  assertEquals(parseFirefoxProfilesIni(ini, "/base"), ["/base/xyz.default", "/base/abc123.old"]);
  assertEquals(parseFirefoxProfilesIni("garbage", "/base"), []);
});

Deno.test("keyringVariants — only Linux Chromium family", () => {
  assertEquals(keyringVariants("chrome", "linux"), ["", "gnomekeyring", "kwallet"]);
  assertEquals(keyringVariants("edge", "linux"), ["", "gnomekeyring", "kwallet"]);
  assertEquals(keyringVariants("firefox", "linux"), [""]);
  assertEquals(keyringVariants("chrome", "windows"), [""]);
});

Deno.test("buildCookieSpecs — profiles first, capped, deduped", () => {
  const specs = buildCookieSpecs(
    ["chrome", "firefox"],
    { chrome: ["/p/Default", "/p/Profile 1"], firefox: [] },
    "linux",
    100,
  );
  // explicit profiles before bare key, keyring variants per profile
  assert(specs.indexOf("chrome:/p/Default") < specs.indexOf("chrome"));
  assert(specs.includes("chrome+gnomekeyring:/p/Default"));
  assert(specs.includes("firefox"));
  assertEquals(buildCookieSpecs(["chrome"], {}, "linux", 2).length, 2);
});

Deno.test("explainCookieError — maps stderr to guidance", () => {
  assert(explainCookieError("ERROR: could not find a suitable browser").includes("not found"));
  assert(explainCookieError("sqlite database is locked").includes("locked"));
  assert(explainCookieError("Failed to get password from keyring").includes("keyring"));
  assertEquals(explainCookieError(""), "unknown error");
});

Deno.test("resolveCookieBrowsers — explicit passes through", async () => {
  assertEquals(await resolveCookieBrowsers("edge"), ["edge"]);
});
