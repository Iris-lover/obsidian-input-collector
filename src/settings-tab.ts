import { App, PluginSettingTab, Setting } from "obsidian";
import type WeChatChannelsImporterPlugin from "./main";

export class WeChatChannelsImporterSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: WeChatChannelsImporterPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("默认保存目录")
      .setDesc("分类文件夹会创建在这个目录下")
      .addText((text) =>
        text
          .setPlaceholder("WeChat Channels")
          .setValue(this.plugin.settings.defaultFolder)
          .onChange(async (value) => {
            this.plugin.settings.defaultFolder = value.trim() || "WeChat Channels";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("媒体子目录")
      .setDesc("相对于默认保存目录，用于存放视频和封面")
      .addText((text) =>
        text
          .setPlaceholder("_attachments/wechat-channels")
          .setValue(this.plugin.settings.mediaFolder)
          .onChange(async (value) => {
            this.plugin.settings.mediaFolder =
              value.trim() || "_attachments/wechat-channels";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("分类")
      .setDesc("每行一个分类；分类文件夹会创建在默认保存目录下")
      .addTextArea((text) =>
        text
          .setValue(this.plugin.settings.categories.join("\n"))
          .onChange(async (value) => {
            const categories = value
              .split(/\r?\n/)
              .map((item) => item.trim())
              .filter(Boolean);
            if (categories.length > 0) {
              this.plugin.settings.categories = Array.from(new Set(categories));
              if (!this.plugin.settings.categories.includes(this.plugin.settings.lastCategory)) {
                this.plugin.settings.lastCategory = this.plugin.settings.categories[0];
              }
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName("解析接口")
      .setDesc("可替换为你自己部署的兼容接口")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.parserEndpoint)
          .onChange(async (value) => {
            this.plugin.settings.parserEndpoint = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("默认下载视频")
      .setDesc("将 MP4 保存进 Vault，避免临时地址失效")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.downloadVideo).onChange(async (value) => {
          this.plugin.settings.downloadVideo = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("默认下载封面")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.downloadCover).onChange(async (value) => {
          this.plugin.settings.downloadCover = value;
          await this.plugin.saveSettings();
        }),
      );

    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "隐私说明：默认解析接口由 wx_channels_download 项目作者运营。导入时分享链接会发送到该接口；视频和封面则直接从微信 CDN 下载。",
    });
  }
}
