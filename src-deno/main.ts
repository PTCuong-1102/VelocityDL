import { ensureYtdlpInstalled, ensureFfmpegInstalled, ensureSpotdlInstalled, ensureGallerydlInstalled, ensureInstaloaderInstalled, maybeAutoUpdateTools, touchToolsMarker } from "./commands/update.ts";
import { getVideoInfo } from "./commands/info.ts";
import { downloadMedia, DownloadOptions } from "./commands/download.ts";
import { checkAppUpdate, downloadAppUpdate } from "./commands/appUpdate.ts";
import { getSettings } from "./utils/paths.ts";

async function main() {
  const command = Deno.args[0];

  if (!command) {
    console.log(JSON.stringify({ 
      status: "error", 
      message: "No command provided. Supported: info, download, update, check-app-update, download-app-update" 
    }));
    Deno.exit(1);
  }

  try {
    // 1. Apply proxy FIRST so binary downloads (fetch) also go through it.
    // Previously ensure*Installed() ran before this block and bypassed proxy.
    const settings = await getSettings();
    const proxyAddress = settings?.engine?.proxyAddress?.trim();
    const proxyType = settings?.engine?.proxyType;

    if (proxyAddress) {
      const prefix = proxyType === "SOCKS5" ? "socks5://" : "http://";
      let fullProxy = proxyAddress;
      if (!proxyAddress.startsWith("http://") && !proxyAddress.startsWith("socks5://") && !proxyAddress.startsWith("https://")) {
        fullProxy = `${prefix}${proxyAddress}`;
      }
      for (const key of ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]) {
        Deno.env.set(key, fullProxy);
      }
    }

    // 2. For core download commands, ensure dependencies are installed.
    // maybeAutoUpdateTools honors engine.autoUpdateYtdlp (weekly force-update).
    if (command !== "update" && command !== "check-app-update" && command !== "download-app-update") {
      await maybeAutoUpdateTools(settings?.engine?.autoUpdateYtdlp !== false);
      await ensureYtdlpInstalled();
      await ensureFfmpegInstalled();
      await ensureSpotdlInstalled();
      await ensureGallerydlInstalled();
      await ensureInstaloaderInstalled();
      await touchToolsMarker();
    }

    // 2. Command Router
    switch (command) {
      case "info": {
        const url = Deno.args[1];
        if (!url) {
          throw new Error("Missing URL for info command");
        }
        await getVideoInfo(url);
        break;
      }

      case "download": {
        const id = Deno.args[1];
        const url = Deno.args[2];
        const saveDir = Deno.args[3];
        const optionsJson = Deno.args[4];

        if (!id || !url || !saveDir || !optionsJson) {
          throw new Error("Missing arguments for download command. Args required: id, url, saveDir, optionsJson");
        }

        const options: DownloadOptions = JSON.parse(optionsJson);
        await downloadMedia(id, url, saveDir, options);
        break;
      }

      case "update": {
        // Trigger manual/forced update of yt-dlp, FFmpeg and spotDL
        await ensureYtdlpInstalled(true);
        await ensureFfmpegInstalled(true);
        await ensureSpotdlInstalled(true);
        await ensureGallerydlInstalled(true);
        await ensureInstaloaderInstalled(true);
        await touchToolsMarker();
        break;
      }

      case "check-app-update": {
        const currentVersion = Deno.args[1];
        if (!currentVersion) {
          throw new Error("Missing currentVersion for check-app-update command");
        }
        await checkAppUpdate(currentVersion);
        break;
      }

      case "download-app-update": {
        const downloadUrl = Deno.args[1];
        const saveDir = Deno.args[2];
        const fileName = Deno.args[3];
        if (!downloadUrl || !saveDir || !fileName) {
          throw new Error("Missing arguments for download-app-update command. Args required: downloadUrl, saveDir, fileName");
        }
        await downloadAppUpdate(downloadUrl, saveDir, fileName);
        break;
      }

      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.log(JSON.stringify({ 
      status: "error", 
      message: errorMsg 
    }));
    Deno.exit(1);
  }
}

main();
