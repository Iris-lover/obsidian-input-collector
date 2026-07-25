import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { ImportModal } from "./import-modal";
import {
  WECHAT_CHANNELS_IMPORTER_VIEW,
  WeChatChannelsImporterView,
} from "./import-view";
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

    this.registerView(
      WECHAT_CHANNELS_IMPORTER_VIEW,
      (leaf) => new WeChatChannelsImporterView(leaf, this),
    );

    this.addRibbonIcon("video", "打开视频号 Input", () => {
      void this.activateView();
    });

    this.addCommand({
      id: "open-wechat-channels-importer-view",
      name: "打开视频号 Input 侧边栏",
      callback: () => void this.activateView(),
    });

    this.addCommand({
      id: "import-wechat-channels-video",
      name: "用弹窗导入微信视频号",
      callback: () => new ImportModal(this.app, this).open(),
    });

    this.addSettingTab(new WeChatChannelsImporterSettingTab(this.app, this));
  }

  async activateView(): Promise<void> {
    let leaf: WorkspaceLeaf | null =
      this.app.workspace.getLeavesOfType(WECHAT_CHANNELS_IMPORTER_VIEW)[0] || null;

    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);
      if (!leaf) {
        new Notice("无法打开视频号 Input 侧边栏");
        return;
      }
      await leaf.setViewState({
        type: WECHAT_CHANNELS_IMPORTER_VIEW,
        active: true,
      });
    }

    await this.app.workspace.revealLeaf(leaf);
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
