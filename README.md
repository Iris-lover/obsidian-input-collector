# WeChat Channels Importer

Import one WeChat Channels video at a time into your Obsidian vault.

## Features

- Paste a `https://weixin.qq.com/sph/...` share link.
- Import the video, cover, author, description, publish time, engagement metadata, and source link.
- Store media locally so temporary CDN links do not break your notes.
- Organize notes into configurable folders and categories.
- Detect previously imported links and open the existing note.
- Replace the parser endpoint with a compatible self-hosted service.
- Works on desktop and mobile.

## Usage

1. In WeChat Channels, share a video and copy its link.
2. In Obsidian, select the video icon in the ribbon, or run **Import WeChat Channels video** from the command palette.
3. Paste the link, choose a category, and select **Import**.

The default destination is `WeChat Channels/Inbox`. You can change the note
folder, media folder, categories, parser endpoint, and download defaults in the
plugin settings.

## Network and privacy disclosure

This plugin does not include telemetry, advertising, payments, or user accounts.
It only makes network requests when you start an import.

- The pasted share URL is sent to the parser endpoint configured in the plugin settings.
- The default endpoint is `https://sph.litao.workers.dev/api/fetch_video_profile`,
  operated by the maintainer of
  [`ltaoo/wx_channels_download`](https://github.com/ltaoo/wx_channels_download).
  It is a third-party service and is not affiliated with Obsidian or WeChat.
- The parser response contains temporary WeChat CDN URLs. The plugin requests
  those URLs to save the selected video and cover inside your vault.
- Imported media, Markdown notes, and the local import history are stored only
  in your vault and plugin data.

You can replace the default parser endpoint with a compatible service you
control. Review the privacy policy and availability of any endpoint you choose.

## Limitations

- WeChat can change its share pages or media APIs without notice, which may
  temporarily break parsing or downloads.
- Large videos are loaded into memory before Obsidian writes them to the vault.
- Only import media you have permission to save and use.

## Manual installation

Download `main.js`, `manifest.json`, and `styles.css` from the latest GitHub
release and copy them into:

```text
<vault>/.obsidian/plugins/wechat-channels-importer/
```

Restart Obsidian, then enable **WeChat Channels Importer** under **Community
plugins**.

## Development

```bash
npm install
npm run build
```

The production build creates `main.js`. Release assets must contain
`main.js`, `manifest.json`, and `styles.css`.

## License

[MIT](LICENSE)
