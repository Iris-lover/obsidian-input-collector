import { App, FileSystemAdapter, TFile, normalizePath } from "obsidian";
import type {
  ParsedYoutubeVideo,
  WeChatChannelsImporterSettings,
  YoutubeImportOptions,
} from "./types";
import {
  formatDate,
  formatDateTime,
  joinVaultPath,
  sanitizeFilename,
  yamlString,
} from "./utils";
import {
  parseYoutubeVideo,
  runYtDlp,
  youtubeCommonArgs,
} from "./youtube-parser";

export interface YoutubeImportResult {
  note: TFile;
  videoPath: string;
  coverPath: string;
  subtitlePaths: string[];
  parsed: ParsedYoutubeVideo;
  reused: boolean;
}

async function ensureFolder(app: App, folderPath: string): Promise<void> {
  const normalized = normalizePath(folderPath);
  if (!normalized || app.vault.getAbstractFileByPath(normalized)) return;
  let current = "";
  for (const segment of normalized.split("/")) {
    current = current ? `${current}/${segment}` : segment;
    if (!app.vault.getAbstractFileByPath(current)) {
      await app.vault.createFolder(current);
    }
  }
}

function formatDuration(seconds: number): string {
  if (!seconds) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = Math.floor(seconds % 60);
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function buildMarkdown(
  parsed: ParsedYoutubeVideo,
  options: YoutubeImportOptions,
  videoPath: string,
  coverPath: string,
  subtitlePaths: string[],
): string {
  const lines = [
    "---",
    `title: ${yamlString(parsed.title)}`,
    `platform: ${yamlString("YouTube")}`,
    `author: ${yamlString(parsed.author)}`,
    `source: ${yamlString(parsed.sourceUrl)}`,
    `source_id: ${yamlString(parsed.sourceId)}`,
    `date: ${yamlString(formatDate(parsed.createdAt))}`,
    `imported_at: ${yamlString(formatDateTime(new Date()))}`,
    `category: ${yamlString(options.category)}`,
    `media_type: ${yamlString("video")}`,
    `duration: ${yamlString(formatDuration(parsed.durationSeconds))}`,
    `views: ${yamlString(parsed.views)}`,
    `likes: ${yamlString(parsed.likes)}`,
    `video_file: ${yamlString(videoPath)}`,
    `cover_file: ${yamlString(coverPath)}`,
    "---",
    "",
    `# ${parsed.title}`,
    "",
  ];

  if (coverPath) lines.push(`![[${coverPath}]]`, "");
  else if (parsed.thumbnailUrl) lines.push(`![](${parsed.thumbnailUrl})`, "");

  if (videoPath) lines.push(`![[${videoPath}]]`, "");
  else lines.push(`![](${parsed.sourceUrl})`, "");

  lines.push("## 简介", "", parsed.description || "（无视频简介）", "");
  lines.push(
    "## 信息",
    "",
    `- 频道：${parsed.author || "未知"}`,
    `- 时长：${formatDuration(parsed.durationSeconds) || "—"}`,
    `- 播放：${parsed.views || "—"}`,
    `- 喜欢：${parsed.likes || "—"}`,
    `- [在 YouTube 打开](${parsed.sourceUrl})`,
    "",
  );
  if (subtitlePaths.length) {
    lines.push("## 字幕文件", "");
    for (const path of subtitlePaths) lines.push(`- [[${path}]]`);
    lines.push("");
  }
  lines.push("## 我的笔记", "", "");
  return lines.join("\n");
}

async function uniqueNotePath(app: App, folder: string, title: string): Promise<string> {
  const base = `[YouTube]${sanitizeFilename(title)}`;
  let candidate = joinVaultPath(folder, `${base}.md`);
  let index = 2;
  while (app.vault.getAbstractFileByPath(candidate)) {
    candidate = joinVaultPath(folder, `${base} ${index}.md`);
    index += 1;
  }
  return candidate;
}

async function downloadYoutubeAssets(
  app: App,
  settings: WeChatChannelsImporterSettings,
  options: YoutubeImportOptions,
  parsed: ParsedYoutubeVideo,
  mediaFolder: string,
  onProgress: (message: string) => void,
): Promise<{ videoPath: string; coverPath: string; subtitlePaths: string[] }> {
  const adapter = app.vault.adapter;
  if (!(adapter instanceof FileSystemAdapter)) {
    throw new Error("YouTube 离线下载目前只支持 Obsidian 桌面版的本地 Vault");
  }
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  const os = require("node:os") as typeof import("node:os");
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "input-collector-youtube-"));
  const outputTemplate = path.join(tempDir, `${parsed.sourceId}.%(ext)s`);

  try {
    const args = [
      ...youtubeCommonArgs(settings),
      "--newline",
      "--no-overwrites",
      "--output",
      outputTemplate,
    ];
    if (options.downloadVideo) {
      args.push(
        "--format",
        `bv[height<=${settings.youtubeMaxHeight}]+ba/b[height<=${settings.youtubeMaxHeight}]/best`,
        "--merge-output-format",
        "mp4",
        "--remux-video",
        "mp4",
      );
    } else {
      args.push("--skip-download");
    }
    if (options.downloadCover) {
      args.push("--write-thumbnail", "--convert-thumbnails", "jpg");
    }
    if (options.downloadSubtitles) {
      args.push(
        "--write-subs",
        "--write-auto-subs",
        "--sub-langs",
        "zh-Hans,zh-Hant,zh,en",
        "--sub-format",
        "vtt",
      );
    }
    args.push(parsed.sourceUrl);

    await runYtDlp(settings.youtubeYtDlpPath, args, (line) => {
      const percent = line.match(/\[download\]\s+([\d.]+%)/)?.[1];
      if (percent) onProgress(`正在下载 YouTube 视频… ${percent}`);
    });

    const names = await fs.promises.readdir(tempDir);
    const videoName = names.find((name) => /\.(mp4|mkv|webm|mov)$/i.test(name)) || "";
    const coverName = names.find((name) => /\.jpg$/i.test(name)) || "";
    const subtitleNames = names.filter((name) => /\.vtt$/i.test(name));
    const vaultBase = adapter.getBasePath();
    const absoluteMediaFolder = path.join(vaultBase, mediaFolder);
    await fs.promises.mkdir(absoluteMediaFolder, { recursive: true });

    const copy = async (name: string): Promise<string> => {
      if (!name) return "";
      const safeName = sanitizeFilename(name, 160).replace(/\s+\./g, ".");
      await fs.promises.copyFile(
        path.join(tempDir, name),
        path.join(absoluteMediaFolder, safeName),
      );
      return joinVaultPath(mediaFolder, safeName);
    };

    return {
      videoPath: await copy(videoName),
      coverPath: await copy(coverName),
      subtitlePaths: await Promise.all(subtitleNames.map(copy)),
    };
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}

export async function importYoutubeVideo(
  app: App,
  settings: WeChatChannelsImporterSettings,
  options: YoutubeImportOptions,
  onProgress: (message: string) => void,
): Promise<YoutubeImportResult> {
  const existingRecord = settings.importedSources[options.sourceUrl];
  if (existingRecord) {
    const existing = app.vault.getAbstractFileByPath(existingRecord.notePath);
    if (existing instanceof TFile) {
      return {
        note: existing,
        videoPath: "",
        coverPath: "",
        subtitlePaths: [],
        reused: true,
        parsed: {
          sourceUrl: options.sourceUrl,
          sourceId: "",
          title: existing.basename,
          description: "",
          author: "",
          channelUrl: "",
          createdAt: null,
          durationSeconds: 0,
          thumbnailUrl: "",
          views: "",
          likes: "",
        },
      };
    }
  }

  onProgress("正在通过 yt-dlp 读取 YouTube 信息…");
  const parsed = await parseYoutubeVideo(settings, options.sourceUrl);
  const canonicalRecord = settings.importedSources[parsed.sourceUrl];
  if (canonicalRecord) {
    const existing = app.vault.getAbstractFileByPath(canonicalRecord.notePath);
    if (existing instanceof TFile) {
      return { note: existing, videoPath: "", coverPath: "", subtitlePaths: [], parsed, reused: true };
    }
  }

  const noteFolder = joinVaultPath(settings.defaultFolder, options.category);
  const mediaFolder = joinVaultPath(settings.defaultFolder, "_attachments/youtube");
  await ensureFolder(app, noteFolder);
  await ensureFolder(app, mediaFolder);

  let assets = { videoPath: "", coverPath: "", subtitlePaths: [] as string[] };
  if (options.downloadVideo || options.downloadCover || options.downloadSubtitles) {
    onProgress("正在下载 YouTube 媒体…");
    assets = await downloadYoutubeAssets(
      app,
      settings,
      options,
      parsed,
      mediaFolder,
      onProgress,
    );
  }

  onProgress("正在创建 Obsidian 笔记…");
  const notePath = await uniqueNotePath(app, noteFolder, parsed.title);
  const note = await app.vault.create(
    notePath,
    buildMarkdown(
      parsed,
      options,
      assets.videoPath,
      assets.coverPath,
      assets.subtitlePaths,
    ),
  );
  return { note, parsed, reused: false, ...assets };
}
