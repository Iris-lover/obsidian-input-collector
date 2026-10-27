import { App, TFile, normalizePath } from "obsidian";
import type { WeChatChannelsImporterSettings, DouyinImportOptions } from "./types";
import { formatDate, formatDateTime, joinVaultPath, sanitizeFilename, yamlString } from "./utils";
import { downloadDouyinMedia, parseDouyinVideo } from "./douyin-parser";
import type { ParsedDouyinVideo } from "./douyin-types";

export interface DouyinImportResult {
  note: TFile;
  mediaPaths: string[];
  parsed: ParsedDouyinVideo;
  reused: boolean;
}

async function ensureFolder(app: App, folderPath: string): Promise<void> {
  const normalized = normalizePath(folderPath);
  if (!normalized || app.vault.getAbstractFileByPath(normalized)) return;
  let current = "";
  for (const segment of normalized.split("/")) {
    current = current ? `${current}/${segment}` : segment;
    if (!app.vault.getAbstractFileByPath(current)) await app.vault.createFolder(current);
  }
}

async function writeBinary(app: App, path: string, data: ArrayBuffer): Promise<boolean> {
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) {
    await app.vault.modifyBinary(existing, data);
    return false;
  }
  if (existing) throw new Error(`目标路径已存在且不是文件：${path}`);
  await app.vault.createBinary(path, data);
  return true;
}

function markdown(
  parsed: ParsedDouyinVideo,
  options: DouyinImportOptions,
  mediaPaths: string[],
  coverPath: string,
): string {
  const lines = [
    "---",
    `title: ${yamlString(parsed.title)}`,
    `platform: ${yamlString("抖音")}`,
    `author: ${yamlString(parsed.authorName)}`,
    `author_id: ${yamlString(parsed.authorId)}`,
    `source: ${yamlString(parsed.sourceUrl)}`,
    `source_id: ${yamlString(parsed.sourceId)}`,
    `date: ${yamlString(formatDate(parsed.createdAt))}`,
    `imported_at: ${yamlString(formatDateTime(new Date()))}`,
    `category: ${yamlString(options.category)}`,
    `content_type: ${yamlString(parsed.isVideo ? "video" : "image")}`,
    `tags: ${JSON.stringify(parsed.tags)}`,
    `likes: ${parsed.likes ?? "null"}`,
    `collects: ${parsed.collects ?? "null"}`,
    `comments: ${parsed.comments ?? "null"}`,
    `shares: ${parsed.shares ?? "null"}`,
    `media_files: ${yamlString(JSON.stringify(mediaPaths.filter(Boolean)))}`,
    "---",
    "",
    `# ${parsed.title}`,
    "",
    `**${parsed.authorName}** · [在抖音中打开原文](${parsed.sourceUrl})`,
    "",
    parsed.text,
    "",
  ];
  if (parsed.tags.length > 0) lines.push(parsed.tags.map((tag) => `#${tag}`).join(" "), "");
  if (coverPath) lines.push(`![[${coverPath}]]`, "");
  else if (parsed.coverUrl) lines.push(`![封面](${parsed.coverUrl})`, "");
  parsed.media.forEach((media, index) => {
    const localPath = mediaPaths[index];
    if (localPath) lines.push(`![[${localPath}]]`, "");
    else if (media.type === "image") lines.push(`![图片 ${index + 1}](${media.url})`, "");
    else lines.push(`<video controls src="${media.url}" width="100%"></video>`, "");
  });
  lines.push(
    "## 数据",
    "",
    `- 点赞：${parsed.likes ?? "—"}`,
    `- 收藏：${parsed.collects ?? "—"}`,
    `- 评论：${parsed.comments ?? "—"}`,
    `- 分享：${parsed.shares ?? "—"}`,
    `- [在抖音中打开原文](${parsed.sourceUrl})`,
    "",
  );
  return lines.join("\n");
}

async function uniquePath(app: App, folder: string, parsed: ParsedDouyinVideo): Promise<string> {
  const base = `[抖音]${sanitizeFilename(parsed.title, 64)}`;
  let candidate = joinVaultPath(folder, `${base}.md`);
  let index = 2;
  while (app.vault.getAbstractFileByPath(candidate)) {
    candidate = joinVaultPath(folder, `${base} ${index}.md`);
    index += 1;
  }
  return candidate;
}

export async function importDouyinVideo(
  app: App,
  settings: WeChatChannelsImporterSettings,
  options: DouyinImportOptions,
  onProgress: (message: string) => void,
): Promise<DouyinImportResult> {
  onProgress("正在解析抖音视频…");
  const parsed = await parseDouyinVideo(
    options.sourceUrl,
    settings.douyinCookie,
  );

  const existingRecord = settings.importedSources[parsed.sourceUrl];
  if (existingRecord) {
    const existing = app.vault.getAbstractFileByPath(existingRecord.notePath);
    if (existing instanceof TFile) return { note: existing, mediaPaths: [], parsed, reused: true };
  }

  const noteFolder = joinVaultPath(settings.defaultFolder, options.category);
  const mediaFolder = joinVaultPath(settings.defaultFolder, "_attachments/douyin");
  await ensureFolder(app, noteFolder);
  if (options.downloadMedia && (parsed.media.length > 0 || options.downloadCover))
    await ensureFolder(app, mediaFolder);

  const mediaPaths: string[] = [];
  const created: string[] = [];
  let coverPath = "";

  try {
    // Download cover
    if (options.downloadCover && parsed.coverUrl) {
      onProgress("正在下载抖音封面…");
      const path = joinVaultPath(mediaFolder, `${parsed.sourceId}-cover.jpg`);
      try {
        if (await writeBinary(app, path, await downloadDouyinMedia(parsed.coverUrl, settings.douyinCookie)))
          created.push(path);
        coverPath = path;
      } catch {
        // Cover download is non-critical
      }
    }

    // Download media
    for (let index = 0; index < parsed.media.length; index += 1) {
      const media = parsed.media[index];
      if (!options.downloadMedia) {
        mediaPaths.push("");
        continue;
      }
      onProgress(`正在下载抖音媒体 ${index + 1}/${parsed.media.length}…`);
      const extension = media.type === "video" ? "mp4" : "jpg";
      const path = joinVaultPath(mediaFolder, `${parsed.sourceId}-${index + 1}.${extension}`);
      if (await writeBinary(app, path, await downloadDouyinMedia(media.url, settings.douyinCookie)))
        created.push(path);
      mediaPaths.push(path);
    }

    onProgress("正在创建抖音笔记…");
    const note = await app.vault.create(
      await uniquePath(app, noteFolder, parsed),
      markdown(parsed, options, mediaPaths, coverPath),
    );
    return { note, mediaPaths, parsed, reused: false };
  } catch (error) {
    for (const path of created) {
      const file = app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) await app.fileManager.trashFile(file);
    }
    throw error;
  }
}
