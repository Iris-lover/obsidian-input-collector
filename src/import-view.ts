import {
  ButtonComponent,
  ItemView,
  Notice,
  Setting,
  TextAreaComponent,
  Platform,
  WorkspaceLeaf,
} from "obsidian";
import type WeChatChannelsImporterPlugin from "./main";
import { runImport } from "./import-runner";
import type {
  ImportOptions,
  XImportOptions,
  XhsImportOptions,
  YoutubeImportOptions,
} from "./types";
import { extractXLink } from "./x-parser";
import { runXImport } from "./x-import-runner";
import { GroupManagerModal } from "./group-manager-modal";
import { extractXhsLink } from "./xhs-parser";
import { runXhsImport } from "./xhs-import-runner";
import { extractYoutubeLink } from "./youtube-parser";
import { runYoutubeImport } from "./youtube-import-runner";

export const WECHAT_CHANNELS_IMPORTER_VIEW = "wechat-channels-importer-view";
type InputPlatform = "wechat" | "x" | "xhs" | "youtube";

export class WeChatChannelsImporterView extends ItemView {
  private platform: InputPlatform = "wechat";
  private sourceUrl = "";
  private category = "";
  private downloadVideo = true;
  private downloadCover = true;
  private downloadXMedia = true;
  private downloadXhsMedia = false;
  private downloadYoutubeVideo = true;
  private downloadYoutubeCover = true;
  private downloadYoutubeSubtitles = true;
  private sourceInput: TextAreaComponent | null = null;
  private submitButton: ButtonComponent | null = null;
  private progressEl: HTMLElement | null = null;
  private running = false;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: WeChatChannelsImporterPlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return WECHAT_CHANNELS_IMPORTER_VIEW;
  }

  getDisplayText(): string {
    return "Input Collector";
  }

  getIcon(): string {
    return "inbox";
  }

  async onOpen(): Promise<void> {
    this.category =
      this.plugin.settings.lastCategory ||
      this.plugin.settings.categories[0] ||
      "Inbox";
    this.downloadVideo = this.plugin.settings.downloadVideo;
    this.downloadCover = this.plugin.settings.downloadCover;
    this.downloadXMedia = this.plugin.settings.downloadXMedia;
    this.downloadXhsMedia = this.plugin.settings.downloadXhsMedia;
    this.downloadYoutubeVideo = this.plugin.settings.downloadYoutubeVideo;
    this.downloadYoutubeCover = this.plugin.settings.downloadYoutubeCover;
    this.downloadYoutubeSubtitles = this.plugin.settings.downloadYoutubeSubtitles;
    this.render();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("wechat-channels-importer-view");

    const header = contentEl.createDiv({
      cls: "wechat-channels-importer-view-header",
    });
    header.createEl("h3", { text: "Input Collector" });
    header.createEl("p", {
      text: "把视频号、X、小红书与 YouTube 的单条内容统一收进 Obsidian。",
    });

    new Setting(contentEl)
      .setName("来源")
      .setDesc("选择要导入的平台")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("wechat", "微信视频号")
          .addOption("x", "X")
          .addOption("xhs", "小红书")
          .addOption("youtube", "YouTube")
          .setValue(this.platform)
          .onChange((value) => {
            this.platform = value as InputPlatform;
            this.render();
          }),
      );

    const isX = this.platform === "x";
    const isXhs = this.platform === "xhs";
    const isYoutube = this.platform === "youtube";
    new Setting(contentEl)
      .setName(
        isX
          ? "X 帖子链接"
          : isXhs
            ? "小红书分享链接或文案"
            : isYoutube
              ? "YouTube 视频链接"
              : "视频号分享链接",
      )
      .setDesc(
        isX
          ? "支持 x.com 或 twitter.com 的 status 链接"
          : isXhs
            ? "支持 xhslink.com 短链接及小红书公开笔记链接"
            : isYoutube
              ? "支持 youtube.com、youtu.be、Shorts 与直播回放的单条链接"
            : "支持 weixin.qq.com/sph/…",
      )
      .addTextArea((text) => {
        this.sourceInput = text;
        text
          .setPlaceholder(
            isX
              ? "https://x.com/username/status/…"
              : isXhs
                ? "粘贴小红书分享文案或链接…"
                : isYoutube
                  ? "https://youtu.be/…"
                : "https://weixin.qq.com/sph/…",
          )
          .setValue(this.sourceUrl)
          .onChange((value) => {
            this.sourceUrl = value.trim();
          });
      });

    new Setting(contentEl)
      .setName("分组")
      .setDesc(`保存到 ${this.plugin.settings.defaultFolder}/分组`)
      .addDropdown((dropdown) => {
        for (const category of this.plugin.settings.categories) {
          dropdown.addOption(category, category);
        }
        dropdown.setValue(this.category).onChange((value) => {
          this.category = value;
        });
      })
      .addExtraButton((button) =>
        button
          .setIcon("settings-2")
          .setTooltip("新增和管理分组")
          .onClick(() => {
            new GroupManagerModal(this.app, this.plugin, (selectedGroup) => {
              this.category = selectedGroup;
              this.render();
            }).open();
          }),
      );

    if (isYoutube) {
      new Setting(contentEl)
        .setName("下载视频")
        .setDesc(`保存最高 ${this.plugin.settings.youtubeMaxHeight}p 的 MP4 到 Vault`)
        .addToggle((toggle) =>
          toggle.setValue(this.downloadYoutubeVideo).onChange((value) => {
            this.downloadYoutubeVideo = value;
          }),
        );
      new Setting(contentEl)
        .setName("下载封面")
        .setDesc("保存 YouTube 缩略图；失败时笔记仍会使用在线封面")
        .addToggle((toggle) =>
          toggle.setValue(this.downloadYoutubeCover).onChange((value) => {
            this.downloadYoutubeCover = value;
          }),
        );
      new Setting(contentEl)
        .setName("下载字幕")
        .setDesc("优先保存中文和英文的人工或自动字幕（VTT）")
        .addToggle((toggle) =>
          toggle.setValue(this.downloadYoutubeSubtitles).onChange((value) => {
            this.downloadYoutubeSubtitles = value;
          }),
        );
    } else if (isXhs) {
      new Setting(contentEl)
        .setName("下载小红书媒体")
        .setDesc("把图片或视频保存到 Vault；关闭时保留远程链接")
        .addToggle((toggle) =>
          toggle.setValue(this.downloadXhsMedia).onChange((value) => {
            this.downloadXhsMedia = value;
          }),
        );
    } else if (isX) {
      new Setting(contentEl)
        .setName("下载 X 媒体")
        .setDesc("把图片、GIF 和视频保存到 Vault")
        .addToggle((toggle) =>
          toggle.setValue(this.downloadXMedia).onChange((value) => {
            this.downloadXMedia = value;
          }),
        );
    } else {
      new Setting(contentEl)
        .setName("下载视频")
        .setDesc("保存 MP4，避免临时地址失效")
        .addToggle((toggle) =>
          toggle.setValue(this.downloadVideo).onChange((value) => {
            this.downloadVideo = value;
          }),
        );
      new Setting(contentEl)
        .setName("下载封面")
        .setDesc("封面失败不会影响笔记导入")
        .addToggle((toggle) =>
          toggle.setValue(this.downloadCover).onChange((value) => {
            this.downloadCover = value;
          }),
        );
    }

    contentEl.createDiv({
      cls: "wechat-channels-importer-disclosure",
      text: isX
        ? `X 链接会发送到 ${this.plugin.settings.xApiEndpoint} 解析。媒体随后从 X CDN 下载。`
        : isXhs
          ? "插件会直接读取公开的小红书笔记页面；媒体按你的选择从小红书 CDN 下载。"
          : isYoutube
            ? Platform.isDesktopApp
              ? `YouTube 由本机 yt-dlp 下载；当前验证方式：${this.plugin.settings.youtubeVerificationMode}。登录 Cookie 仅在你主动选择 Cookie 模式后使用。`
              : "YouTube 离线导入需要 Obsidian 桌面版。"
          : `视频号优先使用 ${this.plugin.settings.localParserEndpoint || "本地解析服务"}；失败后再调用备用接口。`,
    });

    this.progressEl = contentEl.createDiv({
      cls: "wechat-channels-importer-progress",
      attr: { "aria-live": "polite" },
    });
    const actions = contentEl.createDiv({
      cls: "wechat-channels-importer-view-actions",
    });
    this.submitButton = new ButtonComponent(actions)
      .setButtonText(
        `导入${isX ? " X" : isXhs ? "小红书" : isYoutube ? " YouTube" : "视频号"}内容`,
      )
      .setCta()
      .onClick(() => void this.submit());
  }

  private async submit(): Promise<void> {
    if (this.running) return;
    const isX = this.platform === "x";
    const isXhs = this.platform === "xhs";
    const isYoutube = this.platform === "youtube";
    if (isYoutube && !Platform.isDesktopApp) {
      const message = "YouTube 离线导入目前只支持 Obsidian 桌面版";
      new Notice(message);
      this.progressEl?.setText(message);
      return;
    }
    const valid = isX
      ? extractXLink(this.sourceUrl) !== null
      : isXhs
        ? extractXhsLink(this.sourceUrl) !== null
        : isYoutube
          ? extractYoutubeLink(this.sourceUrl) !== null
        : /^https:\/\/weixin\.qq\.com\/sph\/[A-Za-z0-9_-]+/.test(this.sourceUrl);
    if (!valid) {
      const message = isX
        ? "请输入有效的 X 帖子链接"
        : isXhs
          ? "请输入有效的小红书分享文案或链接"
          : isYoutube
            ? "请输入有效的 YouTube 单条视频链接"
          : "请输入有效的视频号分享链接";
      new Notice(message);
      this.progressEl?.setText(message);
      return;
    }

    this.running = true;
    this.submitButton?.setDisabled(true);
    try {
      const result = isX
        ? await runXImport(
            this.plugin,
            {
              sourceUrl: this.sourceUrl,
              category: this.category,
              downloadMedia: this.downloadXMedia,
            } satisfies XImportOptions,
            (message) => this.progressEl?.setText(message),
          )
        : isXhs
          ? await runXhsImport(
              this.plugin,
              {
                sourceUrl: this.sourceUrl,
                category: this.category,
                downloadMedia: this.downloadXhsMedia,
              } satisfies XhsImportOptions,
              (message) => this.progressEl?.setText(message),
            )
          : isYoutube
            ? await runYoutubeImport(
                this.plugin,
                {
                  sourceUrl: this.sourceUrl,
                  category: this.category,
                  downloadVideo: this.downloadYoutubeVideo,
                  downloadCover: this.downloadYoutubeCover,
                  downloadSubtitles: this.downloadYoutubeSubtitles,
                } satisfies YoutubeImportOptions,
                (message) => this.progressEl?.setText(message),
              )
          : await runImport(
              this.plugin,
              {
                sourceUrl: this.sourceUrl,
                category: this.category,
                downloadVideo: this.downloadVideo,
                downloadCover: this.downloadCover,
              } satisfies ImportOptions,
              (message) => this.progressEl?.setText(message),
            );

      if (result.reused) {
        this.progressEl?.setText("这条内容已经导入，已打开原笔记。");
        new Notice("这条内容已经导入，已打开原笔记");
      } else {
        this.progressEl?.setText(`已保存：${result.note.path}`);
        new Notice(
          `${isX ? "X" : isXhs ? "小红书" : isYoutube ? "YouTube" : "视频号"}内容已保存到 Obsidian`,
        );
      }
      this.sourceUrl = "";
      this.sourceInput?.setValue("");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.progressEl?.setText(`导入失败：${message}`);
      new Notice(`导入失败：${message}`, 8000);
    } finally {
      this.running = false;
      this.submitButton?.setDisabled(false);
    }
  }
}
