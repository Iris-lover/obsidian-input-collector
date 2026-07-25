import { Plugin } from "obsidian";
import { ImportModal } from "./import-modal";
import { WeChatChannelsImporterSettingTab } from "./settings-tab";
import type { WeChatChannelsImporterSettings } from "./types";

const DEFAULT_SETTINGS: WeChatChannelsImporterSettings = {
  defaultFolder: "WeChat Channels",
  mediaFolder: "_attachments/wechat-channels",
  categories: ["Inbox"],
  lastCategory: "Inbox",
  parserEndpoint: "https://sph.litao.workers.dev/api/fetch_video_profile",
  downloadVideo: true,
  downloadCover: true,
  importedSources: {},
};

export default class WeChatChannelsImporterPlugin extends Plugin {
  settings: WeChatChannelsImporterSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addRibbonIcon("video", "导入微信视频号", () => {
      new ImportModal(this.app, this).open();
    });

    this.addCommand({
      id: "import-wechat-channels-video",
      name: "导入微信视频号",
      callback: () => new ImportModal(this.app, this).open(),
    });

    this.addSettingTab(new WeChatChannelsImporterSettingTab(this.app, this));
  }

  async loadSettings(): Promise<void> {
    const saved = (await this.loadData()) as Partial<WeChatChannelsImporterSettings> | null;
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(saved || {}),
      categories:
        saved?.categories && saved.categories.length > 0
          ? saved.categories
          : DEFAULT_SETTINGS.categories,
      importedSources: saved?.importedSources || {},
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
