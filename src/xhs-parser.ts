import { requestUrl } from "obsidian";
import type { ParsedXhsMedia, ParsedXhsNote } from "./xhs-types";

interface XhsLink {
  sourceUrl: string;
}

type UnknownRecord = Record<string, unknown>;

export function extractXhsLink(input: string): XhsLink | null {
  const shortLink = input.match(/https?:\/\/(?:www\.)?xhslink\.com\/[^\s,，]+/i);
  if (shortLink) return { sourceUrl: trimLink(shortLink[0]) };
  const noteLink = input.match(
    /https?:\/\/(?:www\.)?xiaohongshu\.com\/(?:discovery\/item|explore)\/[A-Za-z0-9]+(?:\?[^\s,，]*)?/i,
  );
  return noteLink ? { sourceUrl: trimLink(noteLink[0]) } : null;
}

function trimLink(value: string): string {
  return value.replace(/[)\]}>。！？；;]+$/g, "");
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function stringValue(...values: unknown[]): string {
  const value = values.find((item) => typeof item === "string" && item.trim());
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    const match = normalized.match(/^([\d.]+)(万|w|k)?$/i);
    if (!match) return null;
    const base = Number(match[1]);
    if (!Number.isFinite(base)) return null;
    if (match[2] === "万" || match[2]?.toLowerCase() === "w") return Math.round(base * 10000);
    if (match[2]?.toLowerCase() === "k") return Math.round(base * 1000);
    return Math.round(base);
  }
  return null;
}

function parseInitialState(html: string): UnknownRecord {
  const match = html.match(/window\.__INITIAL_STATE__\s*=\s*([\s\S]*?)<\/script>/i);
  if (!match) throw new Error("页面中没有找到小红书笔记数据，笔记可能需要登录或已失效");
  const raw = match[1].trim().replace(/;\s*$/, "").replace(/\bundefined\b/g, "null");
  try {
    return record(JSON.parse(raw));
  } catch {
    throw new Error("小红书页面数据格式发生变化，暂时无法解析");
  }
}

function findNote(state: UnknownRecord): { note: UnknownRecord; id: string } {
  const noteState = record(state.note);
  const detailMap = record(noteState.noteDetailMap);
  for (const [id, detail] of Object.entries(detailMap)) {
    const note = record(record(detail).note);
    if (Object.keys(note).length > 0) return { note, id };
  }
  const note = record(noteState.noteDetail);
  if (Object.keys(note).length > 0) {
    return { note, id: stringValue(note.noteId, note.id) };
  }
  throw new Error("解析结果中没有小红书笔记内容");
}

function imageUrl(item: unknown): string {
  const image = record(item);
  const infoList = Array.isArray(image.infoList) ? image.infoList : [];
  const info = record(infoList[infoList.length - 1]);
  return stringValue(image.urlDefault, image.urlPre, image.url, info.url);
}

function videoUrl(note: UnknownRecord): string {
  const stream = record(record(record(note.video).media).stream);
  for (const codec of ["h264", "h265", "av1"]) {
    const variants = stream[codec];
    if (!Array.isArray(variants)) continue;
    for (const variant of variants) {
      const item = record(variant);
      const url = stringValue(item.masterUrl, item.backupUrls && (item.backupUrls as unknown[])[0]);
      if (url) return url;
    }
  }
  return "";
}

function parseDate(note: UnknownRecord): Date | null {
  const value = note.time ?? note.createTime ?? note.lastUpdateTime;
  const timestamp = typeof value === "string" ? Number(value) : value;
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function parseXhsNote(input: string): Promise<ParsedXhsNote> {
  const link = extractXhsLink(input);
  if (!link) throw new Error("没有找到有效的小红书笔记链接");
  const response = await requestUrl({
    url: link.sourceUrl,
    method: "GET",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "zh-CN,zh;q=0.9",
    },
    throw: false,
  });
  if (response.status < 200 || response.status >= 400) {
    throw new Error(`读取小红书笔记失败（HTTP ${response.status}）`);
  }
  const state = parseInitialState(response.text);
  const { note, id: mapId } = findNote(state);
  const sourceId = stringValue(note.noteId, note.id, mapId);
  if (!sourceId) throw new Error("解析结果中没有小红书笔记 ID");
  const user = record(note.user);
  const interact = record(note.interactInfo);
  const isVideo = stringValue(note.type).toLowerCase() === "video";
  const media: ParsedXhsMedia[] = [];
  const parsedVideoUrl = videoUrl(note);
  if (isVideo && parsedVideoUrl) media.push({ type: "video", url: parsedVideoUrl });
  const images = Array.isArray(note.imageList) ? note.imageList : [];
  for (const item of images) {
    const url = imageUrl(item);
    if (url && !media.some((entry) => entry.url === url)) media.push({ type: "image", url });
  }
  const listedTags = (Array.isArray(note.tagList) ? note.tagList : [])
    .map((item) => stringValue(record(item).name))
    .filter(Boolean);
  const text = stringValue(note.desc);
  const inlineTags = Array.from(text.matchAll(/#([^#\s]+)/g), (match) => match[1]);
  const tags = Array.from(new Set([...listedTags, ...inlineTags]));
  const title = stringValue(note.title, text.split(/\r?\n/)[0], "未命名小红书笔记");
  return {
    sourceUrl: `https://www.xiaohongshu.com/explore/${sourceId}`,
    sourceId,
    title,
    text,
    authorName: stringValue(user.nickname, user.nickName, "未知作者"),
    authorId: stringValue(user.userId, user.id),
    createdAt: parseDate(note),
    tags,
    likes: numberValue(interact.likedCount ?? interact.likeCount),
    collects: numberValue(interact.collectedCount ?? interact.collectCount),
    comments: numberValue(interact.commentCount),
    shares: numberValue(interact.shareCount),
    media,
    isVideo,
  };
}

export async function downloadXhsMedia(url: string): Promise<ArrayBuffer> {
  const response = await requestUrl({ url, method: "GET", throw: false });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`小红书媒体下载失败（HTTP ${response.status}）`);
  }
  if (response.arrayBuffer.byteLength === 0) throw new Error("小红书媒体下载结果为空");
  return response.arrayBuffer;
}
