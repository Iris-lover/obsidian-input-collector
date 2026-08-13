import { App, TFile, normalizePath } from "obsidian";
import type { WeChatChannelsImporterSettings, XhsImportOptions } from "./types";
import { formatDate, formatDateTime, joinVaultPath, sanitizeFilename, yamlString } from "./utils";
import { downloadXhsMedia, parseXhsNote } from "./xhs-parser";
import type { ParsedXhsNote } from "./xhs-types";

export interface XhsImportResult {
  note: TFile;
  mediaPaths: string[];
  parsed: ParsedXhsNote;
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

function markdown(parsed: ParsedXhsNote, options: XhsImportOptions, mediaPaths: string[]): string {
  const lines = [
    "---",
    `title: ${yamlString(parsed.title)}`,
    `platform: ${yamlString("小红书")}`,
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
    `**${parsed.authorName}** · [在小红书中打开原文](${parsed.sourceUrl})`,
    "",
    parsed.text,
    "",
  ];
  if (parsed.tags.length > 0) lines.push(parsed.tags.map((tag) => `#${tag}`).join(" "), "");
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
    `- [在小红书中打开原文](${parsed.sourceUrl})`,
    "",
  );
  return lines.join("\n");
}

async function uniquePath(app: App, folder: string, parsed: ParsedXhsNote): Promise<string> {
  const base = `[小红书]${sanitizeFilename(parsed.title, 64)}`;
  let candidate = joinVaultPath(folder, `${base}.md`);
  let index = 2;
  while (app.vault.getAbstractFileByPath(candidate)) {
    candidate = joinVaultPath(folder, `${base} ${index}.md`);
    index += 1;
  }
  return candidate;
}

export async function importXhsNote(
  app: App,
  settings: WeChatChannelsImporterSettings,
  options: XhsImportOptions,
  onProgress: (message: string) => void,
): Promise<XhsImportResult> {
  onProgress("正在读取小红书笔记…");
  const parsed = await parseXhsNote(options.sourceUrl);
  const existingRecord = settings.importedSources[parsed.sourceUrl];
  if (existingRecord) {
    const existing = app.vault.getAbstractFileByPath(existingRecord.notePath);
    if (existing instanceof TFile) return { note: existing, mediaPaths: [], parsed, reused: true };
  }
  const noteFolder = joinVaultPath(settings.defaultFolder, options.category);
  const mediaFolder = joinVaultPath(settings.defaultFolder, "_attachments/xiaohongshu");
  await ensureFolder(app, noteFolder);
  if (options.downloadMedia && parsed.media.length > 0) await ensureFolder(app, mediaFolder);
  const mediaPaths: string[] = [];
  const created: string[] = [];
  try {
    for (let index = 0; index < parsed.media.length; index += 1) {
      const media = parsed.media[index];
      if (!options.downloadMedia) {
        mediaPaths.push("");
        continue;
      }
      onProgress(`正在下载小红书媒体 ${index + 1}/${parsed.media.length}…`);
      const extension = media.type === "video" ? "mp4" : "jpg";
      const path = joinVaultPath(mediaFolder, `${parsed.sourceId}-${index + 1}.${extension}`);
      if (await writeBinary(app, path, await downloadXhsMedia(media.url))) created.push(path);
      mediaPaths.push(path);
    }
    onProgress("正在创建小红书笔记…");
    const note = await app.vault.create(
      await uniquePath(app, noteFolder, parsed),
      markdown(parsed, options, mediaPaths),
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
