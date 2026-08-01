import {
  ButtonComponent,
  ItemView,
  Notice,
  Setting,
  TextAreaComponent,
  WorkspaceLeaf,
} from "obsidian";
import type WeChatChannelsImporterPlugin from "./main";
import { runImport } from "./import-runner";
import type { ImportOptions, XImportOptions } from "./types";
import { extractXLink } from "./x-parser";
import { runXImport } from "./x-import-runner";
import { GroupManagerModal } from "./group-manager-modal";

export const WECHAT_CHANNELS_IMPORTER_VIEW = "wechat-channels-importer-view";
type InputPlatform = "wechat" | "x";

export class WeChatChannelsImporterView extends ItemView {
  private platform: InputPlatform = "wechat";
  private sourceUrl = "";
  private category = "";
  private downloadVideo = true;
  private downloadCover = true;
  private downloadXMedia = true;
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
      text: "把视频号与 X 的单条内容统一收进 Obsidian。",
    });

    new Setting(contentEl)
      .setName("来源")
      .setDesc("选择要导入的平台")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("wechat", "微信视频号")
          .addOption("x", "X")
          .setValue(this.platform)
          .onChange((value) => {
            this.platform = value as InputPlatform;
            this.render();
          }),
      );

    const isX = this.platform === "x";
    new Setting(contentEl)
      .setName(isX ? "X 帖子链接" : "视频号分享链接")
      .setDesc(isX ? "支持 x.com 或 twitter.com 的 status 链接" : "支持 weixin.qq.com/sph/…")
      .addTextArea((text) => {
        this.sourceInput = text;
        text
          .setPlaceholder(
            isX
              ? "https://x.com/username/status/…"
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

    if (isX) {
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
        : `视频号链接会发送到 ${this.plugin.settings.parserEndpoint} 解析。视频随后从微信 CDN 下载。`,
    });

    this.progressEl = contentEl.createDiv({
      cls: "wechat-channels-importer-progress",
      attr: { "aria-live": "polite" },
    });
    const actions = contentEl.createDiv({
      cls: "wechat-channels-importer-view-actions",
    });
    this.submitButton = new ButtonComponent(actions)
      .setButtonText(`导入${isX ? " X" : "视频号"}内容`)
      .setCta()
      .onClick(() => void this.submit());
  }

  private async submit(): Promise<void> {
    if (this.running) return;
    const isX = this.platform === "x";
    const valid = isX
      ? extractXLink(this.sourceUrl) !== null
      : /^https:\/\/weixin\.qq\.com\/sph\/[A-Za-z0-9_-]+/.test(this.sourceUrl);
    if (!valid) {
      const message = isX ? "请输入有效的 X 帖子链接" : "请输入有效的视频号分享链接";
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
        new Notice(`${isX ? "X" : "视频号"}内容已保存到 Obsidian`);
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
