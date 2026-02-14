import { BrowserWindow } from "electron";
import updater from "electron-updater";
import type { UpdateCheckResult } from "electron-updater";

const { autoUpdater } = updater;

const applyUpdateFeed = () => {
  autoUpdater.setFeedURL({
    provider: "github",
    owner: "1402771410",
    repo: "LX-WMS",
  });
};

export const setupAutoUpdater = (mainWindow: BrowserWindow): void => {
  applyUpdateFeed();
  autoUpdater.autoDownload = false;

  autoUpdater.on("update-available", (info) => {
    mainWindow.webContents.send("update:available", {
      version: info.version,
      releaseName: info.releaseName,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    mainWindow.webContents.send("update:download-progress", {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on("update-downloaded", () => {
    mainWindow.webContents.send("update:downloaded");
  });

  autoUpdater.on("error", (error) => {
    const message = error instanceof Error ? error.message : "下载失败";
    mainWindow.webContents.send("update:error", { message });
  });
};

export const checkForUpdates = async (): Promise<UpdateCheckResult | null> => {
  try {
    applyUpdateFeed();
    const result = await autoUpdater.checkForUpdates();
    return result ?? null;
  } catch {
    return null;
  }
};
