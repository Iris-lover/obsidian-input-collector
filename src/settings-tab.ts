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
      .setName("视频号本地解析接口")
      .setDesc("优先使用；需要启动 wx_video_download 并配置 cloudflare.sphCookie")
      .addText((text) =>
        text
          .setPlaceholder("http://127.0.0.1:2022/api/channels/parse_sph")
          .setValue(this.plugin.settings.localParserEndpoint)
          .onChange(async (value) => {
            this.plugin.settings.localParserEndpoint = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("视频号备用解析接口")
      .setDesc("本地服务不可用时调用；公共服务可能临时失效，也可以替换为自建 Worker")
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

    containerEl.createEl("h3", { text: "YouTube（桌面版）" });

    new Setting(containerEl)
      .setName("yt-dlp 路径")
      .setDesc("Input Collector 用这个本机程序读取并下载 YouTube")
      .addText((text) =>
        text
          .setPlaceholder("/usr/local/bin/yt-dlp")
          .setValue(this.plugin.settings.youtubeYtDlpPath)
          .onChange(async (value) => {
            this.plugin.settings.youtubeYtDlpPath = value.trim() || "yt-dlp";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("YouTube 验证方式")
      .setDesc("WPC 不读取账号 Cookie；若被 YouTube 拦截，可主动改用浏览器 Cookie")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("wpc", "WPC 浏览器 Token（推荐）")
          .addOption("none", "不验证")
          .addOption("chrome", "Chrome Cookie")
          .addOption("safari", "Safari Cookie")
          .addOption("firefox", "Firefox Cookie")
          .setValue(this.plugin.settings.youtubeVerificationMode)
          .onChange(async (value) => {
            this.plugin.settings.youtubeVerificationMode = value as typeof this.plugin.settings.youtubeVerificationMode;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("YouTube：最高画质")
      .setDesc("更高画质占用更多 Vault 与同步空间")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("720", "720p")
          .addOption("1080", "1080p")
          .addOption("1440", "1440p")
          .addOption("2160", "2160p / 4K")
          .setValue(this.plugin.settings.youtubeMaxHeight)
          .onChange(async (value) => {
            this.plugin.settings.youtubeMaxHeight = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("YouTube：默认下载视频")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.downloadYoutubeVideo).onChange(async (value) => {
          this.plugin.settings.downloadYoutubeVideo = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("YouTube：默认下载封面")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.downloadYoutubeCover).onChange(async (value) => {
          this.plugin.settings.downloadYoutubeCover = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("YouTube：默认下载字幕")
      .setDesc("保存可用的中英文 VTT 字幕")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.downloadYoutubeSubtitles).onChange(async (value) => {
          this.plugin.settings.downloadYoutubeSubtitles = value;
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
      text: "隐私说明：视频号会优先请求你电脑上的本地服务；仅在本地服务失败时才会发送到备用接口。X 链接会发送到 FxTwitter；小红书由插件直接读取公开笔记页面；YouTube 由本机 yt-dlp 处理。只有你主动选择浏览器 Cookie 模式时，yt-dlp 才会读取对应浏览器的登录状态。媒体文件随后按你的设置下载。",
    });
  }
}
