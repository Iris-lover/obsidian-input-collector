import {
  App,
  ButtonComponent,
  Modal,
  Notice,
  Setting,
  TextAreaComponent,
} from "obsidian";
import type WeChatChannelsImporterPlugin from "./main";
import { runImport } from "./import-runner";
import type { ImportOptions } from "./types";

export class ImportModal extends Modal {
  private sourceUrl = "";
  private category: string;
  private downloadVideo: boolean;
  private downloadCover: boolean;
  private submitButton: ButtonComponent | null = null;
  private progressEl: HTMLElement | null = null;
  private running = false;

  constructor(
    app: App,
    private readonly plugin: WeChatChannelsImporterPlugin,
  ) {
    super(app);
    this.category = plugin.settings.lastCategory || plugin.settings.categories[0] || "Content";
    this.downloadVideo = plugin.settings.downloadVideo;
    this.downloadCover = plugin.settings.downloadCover;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("wechat-channels-importer-modal");
    contentEl.createEl("h2", { text: "导入微信视频号" });
    contentEl.createEl("p", {
      text: "粘贴一条 weixin.qq.com/sph/… 分享链接，插件会保存视频、封面、元数据和来源链接。",
    });

    new Setting(contentEl)
      .setName("视频号分享链接")
      .setDesc("在微信视频号中选择分享，然后复制链接")
      .addTextArea((text: TextAreaComponent) => {
        text
          .setPlaceholder("https://weixin.qq.com/sph/…")
          .onChange((value) => {
            this.sourceUrl = value.trim();
          });
        text.inputEl.focus();
      });

    new Setting(contentEl)
      .setName("分类")
      .setDesc(`笔记将保存到 ${this.plugin.settings.defaultFolder}/分类`)
      .addDropdown((dropdown) => {
        for (const category of this.plugin.settings.categories) {
          dropdown.addOption(category, category);
        }
        dropdown.setValue(this.category).onChange((value) => {
          this.category = value;
        });
      });

    new Setting(contentEl)
      .setName("下载视频到本地")
      .setDesc("推荐开启，避免临时视频地址失效")
      .addToggle((toggle) =>
        toggle.setValue(this.downloadVideo).onChange((value) => {
          this.downloadVideo = value;
        }),
      );

    new Setting(contentEl)
      .setName("下载封面到本地")
      .setDesc("封面失败不会影响视频和笔记导入")
      .addToggle((toggle) =>
        toggle.setValue(this.downloadCover).onChange((value) => {
          this.downloadCover = value;
        }),
      );

    contentEl.createDiv({
      cls: "wechat-channels-importer-disclosure",
      text: `隐私提示：解析时，分享链接会发送到 ${this.plugin.settings.parserEndpoint}。视频文件随后直接从微信 CDN 下载到你的 Vault。`,
    });

    this.progressEl = contentEl.createDiv({
      cls: "wechat-channels-importer-progress",
      attr: { "aria-live": "polite" },
    });

    const actions = contentEl.createDiv({ cls: "wechat-channels-importer-actions" });
    new ButtonComponent(actions).setButtonText("取消").onClick(() => this.close());
    this.submitButton = new ButtonComponent(actions)
      .setButtonText("导入")
      .setCta()
      .onClick(() => void this.submit());
  }

  onClose(): void {
    if (!this.running) {
      this.contentEl.empty();
    }
  }

  private async submit(): Promise<void> {
    if (this.running) return;
    if (!/^https:\/\/weixin\.qq\.com\/sph\/[A-Za-z0-9_-]+/.test(this.sourceUrl)) {
      new Notice("请输入有效的微信视频号分享链接");
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
        if (this.progressEl) this.progressEl.setText(message);
      });

      if (!result.reused) {
        new Notice("视频号内容已保存到 Obsidian");
      } else {
        new Notice("这条视频已经导入，已打开原笔记");
      }

      this.running = false;
      this.close();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.progressEl) this.progressEl.setText(`导入失败：${message}`);
      new Notice(`视频号导入失败：${message}`, 8000);
      this.running = false;
      this.submitButton?.setDisabled(false);
    }
  }
}
