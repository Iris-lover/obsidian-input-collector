# Input Collector

把单条微信视频号、公开 X 帖子、小红书笔记或 YouTube 视频保存到 Obsidian。四种来源共用一个可停靠的侧边栏、同一套 `6-Input` 分组和重复检测。

> 当前版本：`1.6.0`
>
> 当前状态：仅本地使用，未提交 Obsidian 社区市场

## 支持的内容

### 微信视频号

- 接受 `https://weixin.qq.com/sph/...` 分享链接。
- 保存视频、封面、作者、原文、发布时间、互动数据和来源链接。
- 视频与封面默认下载到 `6-Input/_attachments/wechat-channels/`。

### X

- 接受 `x.com/.../status/...` 和 `twitter.com/.../status/...` 的单条公开帖子链接。
- 保存正文、作者、发布时间、语言、喜欢、转帖、回复、引用、收藏和浏览数据。
- 保存帖子中的图片、GIF 和视频，并保留引用帖正文。
- X 媒体默认下载到 `6-Input/_attachments/x/`。

首版不抓取整条 Thread，也无法读取私密、已删除或受地区限制的帖子。

### 小红书

- 接受完整分享文案、`xhslink.com` 短链接，以及公开笔记链接。
- 支持图文与视频笔记，保存标题、正文、作者、标签和互动数据。
- 可选择保留远程媒体，或下载到 `6-Input/_attachments/xiaohongshu/`。
- 私密、已删除、仅登录可见或触发平台验证的笔记无法导入。

### YouTube

- 接受 `youtube.com/watch`、`youtu.be`、Shorts、直播和嵌入页的单条视频链接。
- 通过电脑上的 `yt-dlp` 读取标题、频道、简介、日期、时长和互动数据。
- 可下载最高 720p、1080p、1440p 或 4K 的视频，并保存封面及中英文 VTT 字幕。
- YouTube 媒体默认下载到 `6-Input/_attachments/youtube/`。
- YouTube 离线导入只支持 Obsidian 桌面版；其他三个来源仍可按原方式使用。

## 使用方法

1. 在 Obsidian 左侧功能区点击收件箱图标，打开右侧 **Input Collector**。
2. 在“来源”中选择“微信视频号”“X”“小红书”或“YouTube”。
3. 粘贴单条内容链接。
4. 选择 `6-Input` 下的分组，例如 `Earn money`。点击右侧的管理按钮，可以新增、重命名或移除分组。
5. 选择是否下载媒体，然后点击导入。

导入完成后，插件会打开新笔记；侧边栏会继续保留，方便导入下一条。你可以把面板拖到左侧或右侧，Obsidian 会记住它的位置。

原有的“用弹窗导入微信视频号”命令仍然保留。

## 管理分组

- 在 Input Collector 侧边栏的“分组”右侧点击管理按钮。
- 新增分组时，插件会创建对应文件夹并自动选中它。
- 重命名分组时，插件会同步重命名对应文件夹，原有笔记不会丢失。
- 移除分组只会从选择列表中移除，不会删除文件夹或其中的笔记。
- 至少需要保留一个分组，且不允许重名或使用路径特殊字符。

## 默认目录

```text
6-Input/
├── Earn money/
│   ├── [视频号]视频标题.md
│   ├── [X]@作者 帖子摘要.md
│   └── [小红书]笔记标题.md
└── _attachments/
    ├── wechat-channels/
    │   ├── 视频ID.mp4
    │   └── 视频ID-cover.jpg
    ├── x/
        ├── 帖子ID-1.jpg
        └── 帖子ID-2.mp4
    ├── xiaohongshu/
        ├── 笔记ID-1.jpg
        └── 笔记ID-2.mp4
    └── youtube/
        ├── 视频ID.mp4
        ├── 视频ID.jpg
        └── 视频ID.zh-Hans.vtt
```

## 网络与隐私

插件没有遥测、广告、付费功能或用户账号，只会在你主动导入时联网。

- 视频号优先请求本地 `wx_video_download`：`http://127.0.0.1:2022/api/channels/parse_sph`。
- 本地服务不可用时，才会请求备用解析接口；默认是公共 Worker，也可以在设置中替换为自建 Worker。
- X 链接默认发送到 `https://api.fxtwitter.com`，随后从 X CDN 下载媒体。
- 小红书链接由插件直接读取公开笔记页面，媒体按你的设置从小红书 CDN 下载。
- YouTube 链接由电脑上的 `yt-dlp` 处理。默认使用 WPC 生成临时 PO Token；只有你在设置中主动选择 Cookie 模式时，`yt-dlp` 才会读取对应浏览器的 YouTube 登录状态。
- 视频号与 X 的解析地址可以在插件设置中替换；YouTube 可以配置 `yt-dlp` 路径、验证方式和最高画质。
- 笔记、媒体与导入记录仅保存在你的 Vault 和插件数据中。

FxTwitter 是第三方开源服务，与 X 或 Obsidian 没有隶属关系。请只保存和使用你有权下载的内容。

## YouTube 本地下载

YouTube 功能依赖本机安装的 `yt-dlp`、`ffmpeg` 和 Node.js，插件不会将这些二进制文件打包进 Vault。其他平台功能不依赖这些工具。

当前测试环境使用：

- `yt-dlp 2026.08.19`
- `ffmpeg`
- Node.js JavaScript runtime
- `yt-dlp-getpot-wpc 1.1.2`

在插件设置的 **YouTube（桌面版）** 中可以修改 `yt-dlp` 路径、验证方式和最高画质。验证顺序建议如下：

1. 先使用 **WPC 浏览器 Token**，它不会读取账号 Cookie。
2. 如果出现“确认你不是机器人”或 WPC 超时，再由用户主动选择 **Chrome Cookie**。
3. Cookie 由 `yt-dlp` 在本机使用，不会写进笔记、插件数据或 GitHub。

Chrome Cookie 模式会自动启用 yt-dlp 官方 EJS 挑战组件，并使用已在 macOS 上实测成功的 `web_safari` HLS 下载路径。

YouTube 会持续调整下载验证规则，因此应保持 `yt-dlp` 和 PO Token 插件为最新版本。

## 视频号本地解析

1. 从 `wx_channels_download` 官方 Releases 下载与你系统匹配的版本。
2. 在程序同目录的 `config.yaml` 中设置 `cloudflare.sphCookie`。Cookie 来自你自己登录的元宝网页，属于敏感凭证，不要提交到 GitHub 或分享给别人。
3. 启动 `wx_video_download`，确认本地 API 监听在 `127.0.0.1:2022`。
4. Input Collector 会自动优先调用本地服务；本地与备用接口都失败时，提示中会分别显示失败原因。

## 开发

```bash
npm install
npm run build
```

## License

[MIT](LICENSE)
