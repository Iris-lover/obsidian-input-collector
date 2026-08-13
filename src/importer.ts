import { App, TFile, normalizePath } from "obsidian";
import { downloadBinary, parseWeChatChannelsVideo } from "./parser";
import type {
  ImportOptions,
  ParsedVideo,
  WeChatChannelsImporterSettings,
} from "./types";
import {
  escapeHtml,
  formatDate,
  formatDateTime,
  joinVaultPath,
  sanitizeFilename,
  yamlString,
} from "./utils";

export interface ImportResult {
  note: TFile;
  videoPath: string;
  coverPath: string;
  parsed: ParsedVideo;
  reused: boolean;
}

async function ensureFolder(app: App, folderPath: string): Promise<void> {
  const normalized = normalizePath(folderPath);
  if (!normalized || app.vault.getAbstractFileByPath(normalized)) return;

  const segments = normalized.split("/");
  let current = "";
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    if (!app.vault.getAbstractFileByPath(current)) {
      await app.vault.createFolder(current);
    }
  }
}

async function writeBinary(app: App, path: string, data: ArrayBuffer): Promise<boolean> {
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) {
    await app.vault.modifyBinary(existing, data);
    return false;
  } else if (existing) {
    throw new Error(`目标路径已存在且不是文件：${path}`);
  } else {
    await app.vault.createBinary(path, data);
    return true;
  }
}

function buildMarkdown(
  parsed: ParsedVideo,
  options: ImportOptions,
  videoPath: string,
  coverPath: string,
): string {
  const importedAt = new Date();
  const lines = [
    "---",
    `title: ${yamlString(parsed.title)}`,
    `platform: ${yamlString("微信视频号")}`,
    `author: ${yamlString(parsed.author)}`,
    `source: ${yamlString(parsed.sourceUrl)}`,
    `source_id: ${yamlString(parsed.sourceId)}`,
    `date: ${yamlString(formatDate(parsed.createdAt))}`,
    `imported_at: ${yamlString(formatDateTime(importedAt))}`,
    `category: ${yamlString(options.category)}`,
    `media_type: ${yamlString("video")}`,
    `likes: ${yamlString(parsed.likes)}`,
    `favorites: ${yamlString(parsed.favorites)}`,
    `comments: ${yamlString(parsed.comments)}`,
    `forwards: ${yamlString(parsed.forwards)}`,
    `video_file: ${yamlString(videoPath)}`,
    `cover_file: ${yamlString(coverPath)}`,
    "---",
    "",
    `# ${parsed.title}`,
    "",
  ];

  if (coverPath) {
    lines.push(`![[${coverPath}]]`, "");
  } else if (parsed.coverUrl) {
    lines.push(`![](${parsed.coverUrl})`, "");
  }

  if (videoPath) {
    lines.push(`![[${videoPath}]]`, "");
  } else {
    lines.push(
      `<video controls src="${escapeHtml(parsed.videoUrl)}" width="100%"></video>`,
      "",
    );
  }

  lines.push("## 原文", "", parsed.description || "（无文字描述）", "");
  lines.push(
    "## 数据",
    "",
    `- 作者：${parsed.author || "未知"}`,
    `- 点赞：${parsed.likes || "—"}`,
    `- 收藏：${parsed.favorites || "—"}`,
    `- 评论：${parsed.comments || "—"}`,
    `- 转发：${parsed.forwards || "—"}`,
    `- [打开原始视频号链接](${parsed.sourceUrl})`,
    "",
  );

  return lines.join("\n");
}

async function uniqueNotePath(app: App, folder: string, title: string): Promise<string> {
  const base = `[视频号]${sanitizeFilename(title)}`;
  let candidate = joinVaultPath(folder, `${base}.md`);
  let index = 2;
  while (app.vault.getAbstractFileByPath(candidate)) {
    candidate = joinVaultPath(folder, `${base} ${index}.md`);
    index += 1;
  }
  return candidate;
}

export async function importVideo(
  app: App,
  settings: WeChatChannelsImporterSettings,
  options: ImportOptions,
  onProgress: (message: string) => void,
): Promise<ImportResult> {
  const existingRecord = settings.importedSources[options.sourceUrl];
  if (existingRecord) {
    const existing = app.vault.getAbstractFileByPath(existingRecord.notePath);
    if (existing instanceof TFile) {
      return {
        note: existing,
        videoPath: "",
        coverPath: "",
        reused: true,
        parsed: {
          sourceUrl: options.sourceUrl,
          sourceId: "",
          title: existing.basename,
          description: "",
          author: "",
          authorAvatarUrl: "",
          createdAt: null,
          coverUrl: "",
          videoUrl: "",
          likes: "",
          favorites: "",
          comments: "",
          forwards: "",
        },
      };
    }
  }

  onProgress("正在解析视频号链接…");
  const parsed = await parseWeChatChannelsVideo(
    settings.localParserEndpoint,
    settings.parserEndpoint,
    options.sourceUrl,
  );

  const noteFolder = joinVaultPath(settings.defaultFolder, options.category);
  const mediaFolder = joinVaultPath(settings.defaultFolder, settings.mediaFolder);
  await ensureFolder(app, noteFolder);
  await ensureFolder(app, mediaFolder);

  let videoPath = "";
  let coverPath = "";
  const createdMediaPaths: string[] = [];

  try {
    if (options.downloadVideo) {
      onProgress("正在下载视频…");
      videoPath = joinVaultPath(mediaFolder, `${parsed.sourceId}.mp4`);
      const videoData = await downloadBinary(parsed.videoUrl);
      if (await writeBinary(app, videoPath, videoData)) {
        createdMediaPaths.push(videoPath);
      }
    }

    if (options.downloadCover && parsed.coverUrl) {
      onProgress("正在下载封面…");
      coverPath = joinVaultPath(mediaFolder, `${parsed.sourceId}-cover.jpg`);
      try {
        const coverData = await downloadBinary(parsed.coverUrl);
        if (await writeBinary(app, coverPath, coverData)) {
          createdMediaPaths.push(coverPath);
        }
      } catch {
        coverPath = "";
      }
    }

    onProgress("正在创建 Obsidian 笔记…");
    const notePath = await uniqueNotePath(app, noteFolder, parsed.title);
    const markdown = buildMarkdown(parsed, options, videoPath, coverPath);
    const note = await app.vault.create(notePath, markdown);

    return { note, videoPath, coverPath, parsed, reused: false };
  } catch (error) {
    for (const path of createdMediaPaths) {
      const file = app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        await app.fileManager.trashFile(file);
      }
    }
    throw error;
  }
}
