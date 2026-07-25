# WeChat Channels Importer

把单条微信视频号内容保存到 Obsidian：视频、封面、作者、原文、发布时间、互动数据和来源链接，一次整理进你的知识库。

> 当前版本：`1.0.0`
>
> 支持平台：Obsidian 桌面端与移动端
>
> 当前状态：已提供 GitHub Release，Obsidian 社区插件市场上架申请待提交

## 适合什么场景

刷到值得长期保存的视频号内容时，分享链接和临时播放地址并不适合作为个人知识库素材。这个插件将“一条视频号链接”转换成一篇结构化 Markdown 笔记，并把视频与封面保存到 Vault，方便你继续分类、引用和整理。

它适合：

- 把视频号、小红书等平台的输入素材统一收进 Obsidian。
- 保存商业、设计、AI、内容创作等领域的案例和灵感。
- 避免原始分享链接或临时视频地址失效后无法查看。
- 保留来源、作者和互动数据，方便之后追溯。

## 功能

- 导入单条 `https://weixin.qq.com/sph/...` 视频号分享链接。
- 解析视频标题、作者、原文、发布时间和互动数据。
- 将 MP4 视频和封面图片下载到 Vault。
- 自动创建带 YAML 属性的 Markdown 笔记。
- 通过自定义分类整理不同主题的内容。
- 识别重复导入，并直接打开已经存在的笔记。
- 可关闭视频或封面下载。
- 可替换为自己部署的兼容解析接口。

## 使用方法

1. 在微信视频号中打开目标视频。
2. 选择“分享”，然后复制链接。
3. 在 Obsidian 左侧边栏点击视频图标；也可以打开命令面板，运行“导入微信视频号”。
4. 粘贴链接，选择分类，并决定是否下载视频和封面。
5. 点击“导入”。

默认保存结构：

```text
WeChat Channels/
├── Inbox/
│   └── [视频号]视频标题.md
└── _attachments/
    └── wechat-channels/
        ├── 视频ID.mp4
        └── 视频ID-cover.jpg
```

笔记会包含标题、平台、作者、原始链接、发布时间、导入时间、分类、互动数据以及本地媒体路径。保存目录、媒体目录、分类列表、解析接口和默认下载选项均可在插件设置中修改。

## 安装

### 从 GitHub Release 手动安装

在插件进入 Obsidian 社区市场之前，可以先手动安装：

1. 打开 [最新 Release](https://github.com/Iris-lover/obsidian-wechat-channels-importer/releases/latest)。
2. 下载 `main.js`、`manifest.json` 和 `styles.css`。
3. 在你的 Vault 中创建以下目录：

   ```text
   <你的 Vault>/.obsidian/plugins/wechat-channels-importer/
   ```

4. 将三个文件放入该目录。
5. 重启 Obsidian。
6. 打开“设置 → 第三方插件”，启用 **WeChat Channels Importer**。

### 从社区插件市场安装

插件通过 Obsidian 社区审核后，可以在“设置 → 第三方插件 → 浏览”中搜索 **WeChat Channels Importer** 并安装。

## 网络与隐私说明

插件不包含客户端遥测、广告、付费功能或用户账号，仅在你主动执行导入时发起网络请求。

- 你粘贴的视频号分享链接会发送到插件设置中的解析接口。
- 默认接口为 `https://sph.litao.workers.dev/api/fetch_video_profile`，由 [`ltaoo/wx_channels_download`](https://github.com/ltaoo/wx_channels_download) 项目维护者运营。它是第三方服务，与 Obsidian 或微信均无隶属关系。
- 解析接口返回临时的微信 CDN 地址，插件随后从这些地址下载你选择保存的视频与封面。
- Markdown 笔记、媒体文件和本地导入记录仅保存在你的 Vault 和插件数据中。

如果你不希望使用默认第三方接口，可以在设置中替换为自己部署的兼容服务。请自行评估所使用接口的隐私政策和可用性。

## 已知限制

- 微信可能随时调整分享页或媒体接口，解析与下载功能可能因此暂时失效。
- 大型视频需要先读入内存，再写入 Vault；移动设备导入超大视频时可能受到内存限制。
- 请只保存和使用你有权下载的内容。

## 开发

```bash
npm install
npm run build
```

生产构建会生成 `main.js`。每个 GitHub Release 都应附带：

- `main.js`
- `manifest.json`
- `styles.css`

## English

WeChat Channels Importer saves one WeChat Channels post at a time to an Obsidian vault. It imports the video, cover, author, description, publish time, engagement metadata, and source link, then creates a structured Markdown note with locally stored media.

To use it, copy a `https://weixin.qq.com/sph/...` share link, run **Import WeChat Channels video** in Obsidian, choose a category, and start the import. The default destination is `WeChat Channels/Inbox`, and all folders and download options are configurable.

The plugin makes network requests only when the user starts an import. The share URL is sent to the configured parser endpoint, and media is downloaded from the temporary WeChat CDN URLs returned by that endpoint. See **网络与隐私说明** above for the full disclosure.

## License

[MIT](LICENSE)
