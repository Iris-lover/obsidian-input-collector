import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { ImportModal } from "./import-modal";
import {
  WECHAT_CHANNELS_IMPORTER_VIEW,
  WeChatChannelsImporterView,
} from "./import-view";
import { WeChatChannelsImporterSettingTab } from "./settings-tab";
import type { WeChatChannelsImporterSettings } from "./types";

const DEFAULT_SETTINGS: WeChatChannelsImporterSettings = {
  defaultFolder: "6-Input",
  mediaFolder: "_attachments/wechat-channels",
  categories: ["AI", "Design", "Work", "English", "Earn money", "Content"],
  lastCategory: "Earn money",
  localParserEndpoint: "http://127.0.0.1:2022/api/channels/parse_sph",
  parserEndpoint: "https://sph.litao.workers.dev/api/fetch_video_profile",
  xApiEndpoint: "https://api.fxtwitter.com",
  downloadVideo: true,
  downloadCover: true,
  downloadXMedia: true,
  downloadXhsMedia: false,
  youtubeYtDlpPath: "/Library/Frameworks/Python.framework/Versions/3.11/bin/yt-dlp",
  youtubeVerificationMode: "wpc",
  downloadYoutubeVideo: true,
  downloadYoutubeCover: true,
  downloadYoutubeSubtitles: true,
  youtubeMaxHeight: "1080",
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

    this.addRibbonIcon("inbox", "打开 Input Collector", () => {
      void this.activateView();
    });

    this.addCommand({
      id: "open-wechat-channels-importer-view",
      name: "打开 Input Collector 侧边栏",
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
        new Notice("无法打开 Input Collector 侧边栏");
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
