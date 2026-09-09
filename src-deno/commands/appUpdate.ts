import * as path from "jsr:@std/path";

export interface LinuxDistroInfo {
  id: string;
  name: string;
  idLike: string;
  base: "arch" | "debian" | "fedora" | "unknown";
}

/** Detect the Linux distribution family from /etc/os-release or /usr/lib/os-release */
export async function detectLinuxDistroBase(): Promise<LinuxDistroInfo> {
  let text = "";
  try {
    text = await Deno.readTextFile("/etc/os-release");
  } catch {
    try {
      text = await Deno.readTextFile("/usr/lib/os-release");
    } catch {
      return { id: "unknown", name: "Linux", idLike: "", base: "unknown" };
    }
  }

  let id = "";
  let name = "Linux";
  let idLike = "";

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("ID=")) {
      id = line.slice(3).replace(/["']/g, "").toLowerCase();
    } else if (line.startsWith("NAME=")) {
      name = line.slice(5).replace(/["']/g, "");
    } else if (line.startsWith("ID_LIKE=")) {
      idLike = line.slice(8).replace(/["']/g, "").toLowerCase();
    }
  }

  const combined = `${id} ${idLike}`.toLowerCase();
  if (
    combined.includes("arch") ||
    combined.includes("manjaro") ||
    combined.includes("endeavouros") ||
    combined.includes("cachyos") ||
    combined.includes("prismlinux") ||
    combined.includes("garuda") ||
    combined.includes("artix")
  ) {
    return { id, name, idLike, base: "arch" };
  }

  if (
    combined.includes("debian") ||
    combined.includes("ubuntu") ||
    combined.includes("linuxmint") ||
    combined.includes("pop") ||
    combined.includes("kali") ||
    combined.includes("elementary") ||
    combined.includes("zorin")
  ) {
    return { id, name, idLike, base: "debian" };
  }

  if (
    combined.includes("fedora") ||
    combined.includes("rhel") ||
    combined.includes("centos") ||
    combined.includes("redhat") ||
    combined.includes("suse") ||
    combined.includes("opensuse") ||
    combined.includes("rocky") ||
    combined.includes("alma")
  ) {
    return { id, name, idLike, base: "fedora" };
  }

  return { id, name, idLike, base: "unknown" };
}

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
    const latestTag = releaseData.tag_name || ""; // e.g. "v0.6.2"
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

    // Find installer assets for current platform & Linux distro family
    const assets = releaseData.assets || [];
    const os = Deno.build.os;
    let asset = null;
    let distro: LinuxDistroInfo = { id: "", name: "", idLike: "", base: "unknown" };

    if (os === "windows") {
      // Prefer .exe (NSIS), fallback to .msi
      asset = assets.find((a: any) => a.name.endsWith(".exe")) ||
              assets.find((a: any) => a.name.endsWith(".msi"));
    } else if (os === "linux") {
      distro = await detectLinuxDistroBase();
      if (distro.base === "arch") {
        // Arch Linux base: prefer .AppImage (runs seamlessly without root) or portable .tar.gz
        asset = assets.find((a: any) => a.name.endsWith(".AppImage")) ||
                assets.find((a: any) => a.name.endsWith(".tar.gz") && a.name.includes("linux")) ||
                assets.find((a: any) => a.name.endsWith(".deb"));
      } else if (distro.base === "debian") {
        // Debian/Ubuntu base: prefer native .deb, fallback to AppImage
        asset = assets.find((a: any) => a.name.endsWith(".deb")) ||
                assets.find((a: any) => a.name.endsWith(".AppImage")) ||
                assets.find((a: any) => a.name.endsWith(".tar.gz") && a.name.includes("linux"));
      } else if (distro.base === "fedora") {
        // Fedora/RHEL base: prefer native .rpm, fallback to AppImage
        asset = assets.find((a: any) => a.name.endsWith(".rpm")) ||
                assets.find((a: any) => a.name.endsWith(".AppImage")) ||
                assets.find((a: any) => a.name.endsWith(".tar.gz") && a.name.includes("linux"));
      } else {
        // Generic Linux: prefer portable AppImage
        asset = assets.find((a: any) => a.name.endsWith(".AppImage")) ||
                assets.find((a: any) => a.name.endsWith(".tar.gz") && a.name.includes("linux")) ||
                assets.find((a: any) => a.name.endsWith(".deb")) ||
                assets.find((a: any) => a.name.endsWith(".rpm"));
      }
    } else if (os === "darwin") {
      // macOS: .dmg
      asset = assets.find((a: any) => a.name.endsWith(".dmg"));
    }

    let installerType = "unknown";
    if (asset) {
      const name = asset.name.toLowerCase();
      if (name.endsWith(".exe")) installerType = "exe";
      else if (name.endsWith(".msi")) installerType = "msi";
      else if (name.endsWith(".appimage")) installerType = "appimage";
      else if (name.endsWith(".deb")) installerType = "deb";
      else if (name.endsWith(".rpm")) installerType = "rpm";
      else if (name.endsWith(".tar.gz")) installerType = "tar";
      else if (name.endsWith(".dmg")) installerType = "dmg";
    }

    console.log(JSON.stringify({
      status: "success",
      updateAvailable,
      latestVersion,
      currentVersion,
      changelog: releaseData.body || "",
      downloadUrl: asset ? asset.browser_download_url : null,
      fileName: asset ? asset.name : null,
      distroBase: os === "linux" ? distro.base : os,
      distroName: os === "linux" ? distro.name : os,
      installerType,
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
