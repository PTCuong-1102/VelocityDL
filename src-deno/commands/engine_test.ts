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
import { validateCookieExport } from "./download.ts";

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

Deno.test("buildCookieHeader — domain-scoped, first wins", () => {
  const cookies = [
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
