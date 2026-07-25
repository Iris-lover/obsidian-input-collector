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
import type { ImportOptions } from "./types";

export const WECHAT_CHANNELS_IMPORTER_VIEW = "wechat-channels-importer-view";

export class WeChatChannelsImporterView extends ItemView {
  private sourceUrl = "";
  private category = "";
  private downloadVideo = true;
  private downloadCover = true;
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
    return "视频号 Input";
  }

  getIcon(): string {
    return "video";
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("wechat-channels-importer-view");

    this.category =
      this.plugin.settings.lastCategory ||
      this.plugin.settings.categories[0] ||
      "Inbox";
    this.downloadVideo = this.plugin.settings.downloadVideo;
    this.downloadCover = this.plugin.settings.downloadCover;

    const header = contentEl.createDiv({
      cls: "wechat-channels-importer-view-header",
    });
    header.createEl("h3", { text: "视频号 Input" });
    header.createEl("p", {
      text: "粘贴一条视频号分享链接，把视频、封面和原文一起收进 Obsidian。",
    });

    new Setting(contentEl)
      .setName("分享链接")
      .setDesc("支持 weixin.qq.com/sph/…")
      .addTextArea((text) => {
        this.sourceInput = text;
        text
          .setPlaceholder("https://weixin.qq.com/sph/…")
          .setValue(this.sourceUrl)
          .onChange((value) => {
            this.sourceUrl = value.trim();
          });
      });

    new Setting(contentEl)
      .setName("分类")
      .setDesc(`保存到 ${this.plugin.settings.defaultFolder}/分类`)
      .addDropdown((dropdown) => {
        for (const category of this.plugin.settings.categories) {
          dropdown.addOption(category, category);
        }
        dropdown.setValue(this.category).onChange((value) => {
          this.category = value;
        });
      });

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

    contentEl.createDiv({
      cls: "wechat-channels-importer-disclosure",
      text: `解析时，分享链接会发送到 ${this.plugin.settings.parserEndpoint}。`,
    });

    this.progressEl = contentEl.createDiv({
      cls: "wechat-channels-importer-progress",
      attr: { "aria-live": "polite" },
    });

    const actions = contentEl.createDiv({
      cls: "wechat-channels-importer-view-actions",
    });
    this.submitButton = new ButtonComponent(actions)
      .setButtonText("导入到 Obsidian")
      .setCta()
      .onClick(() => void this.submit());
  }

  private async submit(): Promise<void> {
    if (this.running) return;
    if (!/^https:\/\/weixin\.qq\.com\/sph\/[A-Za-z0-9_-]+/.test(this.sourceUrl)) {
      new Notice("请输入有效的微信视频号分享链接");
      this.progressEl?.setText("链接格式不正确，请重新粘贴。");
      return;
    }

    const options: ImportOptions = {
      sourceUrl: this.sourceUrl,
      category: this.category,
      downloadVideo: this.downloadVideo,
      downloadCover: this.downloadCover,
    };

    this.running = true;
    this.submitButton?.setDisabled(true);
    try {
      const result = await runImport(this.plugin, options, (message) => {
        this.progressEl?.setText(message);
      });

      if (result.reused) {
        this.progressEl?.setText("这条视频已经导入，已打开原笔记。");
        new Notice("这条视频已经导入，已打开原笔记");
      } else {
        this.progressEl?.setText(`已保存：${result.note.path}`);
        new Notice("视频号内容已保存到 Obsidian");
      }

      this.sourceUrl = "";
      this.sourceInput?.setValue("");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.progressEl?.setText(`导入失败：${message}`);
      new Notice(`视频号导入失败：${message}`, 8000);
    } finally {
      this.running = false;
      this.submitButton?.setDisabled(false);
    }
  }
}
