import { App, PluginSettingTab, Setting } from "obsidian";
import type WeChatChannelsImporterPlugin from "./main";
import { GroupManagerModal } from "./group-manager-modal";

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
      .setDesc("分组文件夹会创建在这个目录下")
      .addText((text) =>
        text
          .setPlaceholder("6-Input")
          .setValue(this.plugin.settings.defaultFolder)
          .onChange(async (value) => {
            this.plugin.settings.defaultFolder = value.trim() || "6-Input";
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
      .setName("分组")
      .setDesc(`${this.plugin.settings.categories.length} 个分组；新增、重命名或移除`)
      .addButton((button) =>
        button.setButtonText("管理分组").onClick(() => {
          new GroupManagerModal(this.app, this.plugin, () => this.display()).open();
        }),
      );

    new Setting(containerEl)
      .setName("解析接口")
      .setDesc("视频号解析接口；可替换为你自己部署的兼容接口")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.parserEndpoint)
          .onChange(async (value) => {
            this.plugin.settings.parserEndpoint = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("X 解析接口")
      .setDesc("默认使用 FxTwitter；可替换为兼容接口")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.xApiEndpoint)
          .onChange(async (value) => {
            this.plugin.settings.xApiEndpoint = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("视频号：默认下载视频")
      .setDesc("将 MP4 保存进 Vault，避免临时地址失效")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.downloadVideo).onChange(async (value) => {
          this.plugin.settings.downloadVideo = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("视频号：默认下载封面")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.downloadCover).onChange(async (value) => {
          this.plugin.settings.downloadCover = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("X：默认下载媒体")
      .setDesc("将帖子中的图片、GIF 和视频保存到 Vault")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.downloadXMedia).onChange(async (value) => {
          this.plugin.settings.downloadXMedia = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("小红书：默认下载媒体")
      .setDesc("将笔记中的图片或视频保存到 Vault；默认关闭以节省空间")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.downloadXhsMedia).onChange(async (value) => {
          this.plugin.settings.downloadXhsMedia = value;
          await this.plugin.saveSettings();
        }),
      );

    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "隐私说明：视频号链接会发送到 wx_channels_download 的默认解析接口；X 链接会发送到 FxTwitter；小红书由插件直接读取公开笔记页面。媒体文件随后按你的设置从对应平台 CDN 下载。",
    });
  }
}
