import { dialog, BrowserWindow } from "electron";
import updater from "electron-updater";
import type { UpdateCheckResult } from "electron-updater";

const { autoUpdater } = updater;

const updateFeedUrl =
  "https://mirror.ghproxy.com/https://github.com/1402771410/LX-WMS/releases/latest/download/";

const applyUpdateFeed = () => {
  autoUpdater.setFeedURL({ provider: "generic", url: updateFeedUrl });
};

export const setupAutoUpdater = (mainWindow: BrowserWindow): void => {
  applyUpdateFeed();
  autoUpdater.autoDownload = false;

  autoUpdater.on("update-available", async (info) => {
    const result = await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "发现新版本",
      message: `检测到新版本 ${info.version}，是否立即下载更新？`,
      buttons: ["立即下载", "稍后"],
      defaultId: 0,
      cancelId: 1,
    });
    if (result.response === 0) {
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on("update-downloaded", async () => {
    const result = await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "更新就绪",
      message: "更新已下载完成，是否立即重启并安装？",
      buttons: ["立即重启", "稍后"],
      defaultId: 0,
      cancelId: 1,
    });
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
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
