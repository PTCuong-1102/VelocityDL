import * as path from "https://deno.land/std@0.224.0/path/mod.ts";

export async function checkAppUpdate(currentVersion: string): Promise<void> {
  const repo = "PTCuong-1102/VelocityDL";
  const url = `https://api.github.com/repos/${repo}/releases/latest`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "VelocityDL-Updater"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch latest release: ${response.statusText}`);
    }

    const releaseData = await response.json();
    const latestTag = releaseData.tag_name || ""; // e.g. "v0.2.2"
    const latestVersion = latestTag.startsWith("v") ? latestTag.slice(1) : latestTag;

    // Simple semver compare (major.minor.patch)
    const compareVersions = (v1: string, v2: string) => {
      const parts1 = v1.split(".").map(Number);
      const parts2 = v2.split(".").map(Number);
      for (let i = 0; i < 3; i++) {
        const num1 = parts1[i] || 0;
        const num2 = parts2[i] || 0;
        if (num1 > num2) return 1;
        if (num2 > num1) return -1;
      }
      return 0;
    };

    const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;

    // Find installer assets (prefer .exe, fallback to .msi)
    const assets = releaseData.assets || [];
    const exeAsset = assets.find((a: any) => a.name.endsWith(".exe"));
    const msiAsset = assets.find((a: any) => a.name.endsWith(".msi"));
    const asset = exeAsset || msiAsset;

    console.log(JSON.stringify({
      status: "success",
      updateAvailable,
      latestVersion,
      currentVersion,
      changelog: releaseData.body || "",
      downloadUrl: asset ? asset.browser_download_url : null,
      fileName: asset ? asset.name : null
    }));
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.log(JSON.stringify({
      status: "error",
      message: `Failed to check update: ${errorMsg}`
    }));
  }
}

export async function downloadAppUpdate(
  downloadUrl: string,
  saveDir: string,
  fileName: string
): Promise<void> {
  const filePath = path.join(saveDir, fileName);

  try {
    console.log(JSON.stringify({
      status: "downloading",
      progress: 0,
      message: "Starting download of new update..."
    }));

    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download update: ${response.statusText}`);
    }

    const contentLength = response.headers.get("content-length");
    const totalBytes = contentLength ? parseInt(contentLength) : 0;

    // Ensure directory exists
    await Deno.mkdir(saveDir, { recursive: true });

    const file = await Deno.open(filePath, { write: true, create: true, truncate: true });
    
    if (!response.body) {
      throw new Error("Response body is empty");
    }

    const reader = response.body.getReader();
    const writer = file.writable.getWriter();
    
    let downloadedBytes = 0;
    let lastEmitTime = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      await writer.write(value);
      downloadedBytes += value.length;

      if (totalBytes > 0) {
        const progress = (downloadedBytes / totalBytes) * 100;
        const now = Date.now();
        if (now - lastEmitTime >= 200 || progress === 100) {
          lastEmitTime = now;
          console.log(JSON.stringify({
            status: "downloading",
            progress: Math.round(progress),
            downloadedBytes,
            totalBytes
          }));
        }
      }
    }

    await writer.close();

    console.log(JSON.stringify({
      status: "ready",
      filePath
    }));

  } catch (err) {
    try { await Deno.remove(filePath); } catch (_) { /* ignore */ }
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.log(JSON.stringify({
      status: "error",
      message: `Failed to download update: ${errorMsg}`
    }));
  }
}
