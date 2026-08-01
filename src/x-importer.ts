import { App, TFile, normalizePath } from "obsidian";
import type { WeChatChannelsImporterSettings, XImportOptions } from "./types";
import {
  extensionForMedia,
  formatDate,
  formatDateTime,
  joinVaultPath,
  markdownBlockquote,
  sanitizeFilename,
  yamlString,
} from "./utils";
import { downloadXMedia, parseXPost } from "./x-parser";
import type { ParsedXPost } from "./x-types";

export interface XImportResult {
  note: TFile;
  mediaPaths: string[];
  parsed: ParsedXPost;
  reused: boolean;
}

async function ensureFolder(app: App, folderPath: string): Promise<void> {
  const normalized = normalizePath(folderPath);
  if (!normalized || app.vault.getAbstractFileByPath(normalized)) return;
  const segments = normalized.split("/");
  let current = "";
  for (const segment of segments) {
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

function buildMarkdown(
  parsed: ParsedXPost,
  options: XImportOptions,
  mediaPaths: string[],
): string {
  const titleText = sanitizeFilename(parsed.title, 72);
  const title = `@${parsed.authorHandle}：${titleText}`;
  const lines = [
    "---",
    `title: ${yamlString(title)}`,
    `platform: ${yamlString("X")}`,
    `author: ${yamlString(parsed.authorName)}`,
    `handle: ${yamlString(`@${parsed.authorHandle}`)}`,
    `source: ${yamlString(parsed.sourceUrl)}`,
    `source_id: ${yamlString(parsed.sourceId)}`,
    `date: ${yamlString(formatDate(parsed.createdAt))}`,
    `imported_at: ${yamlString(formatDateTime(new Date()))}`,
    `category: ${yamlString(options.category)}`,
    `language: ${yamlString(parsed.language)}`,
    `content_type: ${yamlString(parsed.isArticle ? "article" : "post")}`,
    `likes: ${parsed.likes ?? "null"}`,
    `reposts: ${parsed.reposts ?? "null"}`,
    `replies: ${parsed.replies ?? "null"}`,
    `quotes: ${parsed.quotes ?? "null"}`,
    `bookmarks: ${parsed.bookmarks ?? "null"}`,
    `views: ${parsed.views ?? "null"}`,
    `media_files: ${yamlString(JSON.stringify(mediaPaths.filter(Boolean)))}`,
    "---",
    "",
    `# ${title}`,
    "",
    `**${parsed.authorName}** · [@${parsed.authorHandle}](${parsed.sourceUrl})`,
    "",
    parsed.text,
    "",
  ];

  parsed.media.forEach((media, index) => {
    const localPath = mediaPaths[index];
    if (localPath) lines.push(`![[${localPath}]]`, "");
    else if (media.type === "photo") {
      lines.push(`![${media.altText || `图片 ${index + 1}`}](${media.url})`, "");
    } else {
      lines.push(`<video controls src="${media.url}" width="100%"></video>`, "");
    }
  });

  if (parsed.quote) {
    const author = parsed.quote.authorHandle
      ? `${parsed.quote.authorName} (@${parsed.quote.authorHandle})`
      : parsed.quote.authorName || "引用的帖子";
    lines.push("## 引用的帖子", "", `> **${author}**`, markdownBlockquote(parsed.quote.text));
    if (parsed.quote.url) lines.push(">", `> [打开引用帖子](${parsed.quote.url})`);
    lines.push("");
  }

  lines.push(
    "## 数据",
    "",
    `- 喜欢：${parsed.likes ?? "—"}`,
    `- 转帖：${parsed.reposts ?? "—"}`,
    `- 回复：${parsed.replies ?? "—"}`,
    `- 引用：${parsed.quotes ?? "—"}`,
    `- 收藏：${parsed.bookmarks ?? "—"}`,
    `- 浏览：${parsed.views ?? "—"}`,
    `- [在 X 中打开原帖](${parsed.sourceUrl})`,
    "",
  );
  return lines.join("\n");
}

async function uniqueNotePath(
  app: App,
  folder: string,
  parsed: ParsedXPost,
): Promise<string> {
  const snippet = sanitizeFilename(parsed.title, 64);
  const base = `[X]@${sanitizeFilename(parsed.authorHandle, 24)} ${snippet}`;
  let candidate = joinVaultPath(folder, `${base}.md`);
  let index = 2;
  while (app.vault.getAbstractFileByPath(candidate)) {
    candidate = joinVaultPath(folder, `${base} ${index}.md`);
    index += 1;
  }
  return candidate;
}

export async function importXPost(
  app: App,
  settings: WeChatChannelsImporterSettings,
  options: XImportOptions,
  onProgress: (message: string) => void,
): Promise<XImportResult> {
  onProgress("正在读取 X 帖子…");
  const parsed = await parseXPost(settings.xApiEndpoint, options.sourceUrl);
  const existingRecord = settings.importedSources[parsed.sourceUrl];
  if (existingRecord) {
    const existing = app.vault.getAbstractFileByPath(existingRecord.notePath);
    if (existing instanceof TFile) {
      return { note: existing, mediaPaths: [], parsed, reused: true };
    }
  }

  const noteFolder = joinVaultPath(settings.defaultFolder, options.category);
  const mediaFolder = joinVaultPath(settings.defaultFolder, "_attachments/x");
  await ensureFolder(app, noteFolder);
  if (options.downloadMedia && parsed.media.length > 0) await ensureFolder(app, mediaFolder);

  const mediaPaths: string[] = [];
  const createdMediaPaths: string[] = [];
  try {
    for (let index = 0; index < parsed.media.length; index += 1) {
      const media = parsed.media[index];
      if (!options.downloadMedia) {
        mediaPaths.push("");
        continue;
      }
      onProgress(`正在下载 X 媒体 ${index + 1}/${parsed.media.length}…`);
      const extension = extensionForMedia(media.url, media.type, media.format);
      const path = joinVaultPath(
        mediaFolder,
        `${parsed.sourceId}-${index + 1}.${extension}`,
      );
      const data = await downloadXMedia(media.url);
      if (await writeBinary(app, path, data)) createdMediaPaths.push(path);
      mediaPaths.push(path);
    }

    onProgress("正在创建 X 笔记…");
    const notePath = await uniqueNotePath(app, noteFolder, parsed);
    const note = await app.vault.create(notePath, buildMarkdown(parsed, options, mediaPaths));
    return { note, mediaPaths, parsed, reused: false };
  } catch (error) {
    for (const path of createdMediaPaths) {
      const file = app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) await app.fileManager.trashFile(file);
    }
    throw error;
  }
}
