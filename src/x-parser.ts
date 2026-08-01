import { requestUrl } from "obsidian";
import type {
  FxMediaItem,
  FxPost,
  FxResponse,
  FxArticle,
  ParsedXMedia,
  ParsedXPost,
  QuotedXPost,
} from "./x-types";

interface XLinkParts {
  sourceUrl: string;
  username: string;
  statusId: string;
}

export function extractXLink(input: string): XLinkParts | null {
  const match = input.match(
    /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/([A-Za-z0-9_]+)\/status\/(\d+)/i,
  );
  if (!match) return null;
  return {
    username: match[1],
    statusId: match[2],
    sourceUrl: `https://x.com/${match[1]}/status/${match[2]}`,
  };
}

function mediaFromItem(
  item: FxMediaItem,
  fallbackType: "photo" | "video",
): ParsedXMedia | null {
  if (!item.url) return null;
  const rawType = (item.type || fallbackType).toLowerCase();
  const type: ParsedXMedia["type"] =
    rawType === "gif" ? "gif" : rawType === "photo" ? "photo" : fallbackType;
  return {
    type,
    url: item.url,
    thumbnailUrl: item.thumbnail_url || "",
    altText: item.altText || item.alt_text || "",
    format: item.format || "",
  };
}

function parseMedia(post: FxPost): ParsedXMedia[] {
  const photos = (post.media?.photos || [])
    .map((item) => mediaFromItem(item, "photo"))
    .filter((item): item is ParsedXMedia => item !== null);
  const videos = (post.media?.videos || [])
    .map((item) => mediaFromItem(item, "video"))
    .filter((item): item is ParsedXMedia => item !== null);
  const articleImageUrls = [
    post.article?.cover_media?.media_info?.original_img_url,
    ...(post.article?.media_entities || []).map(
      (item) => item.media_info?.original_img_url,
    ),
  ].filter((url): url is string => Boolean(url));
  const articleImages = articleImageUrls.map((url): ParsedXMedia => ({
    type: "photo",
    url,
    thumbnailUrl: "",
    altText: post.article?.title || "X Article 图片",
    format: "jpg",
  }));
  const unique = new Map<string, ParsedXMedia>();
  for (const media of [...photos, ...videos, ...articleImages]) {
    if (!unique.has(media.url)) unique.set(media.url, media);
  }
  return Array.from(unique.values());
}

function articleToMarkdown(article: FxArticle | undefined): string {
  if (!article) return "";
  const blocks = article.content?.blocks || [];
  const lines: string[] = [];
  for (const block of blocks) {
    const text = (block.text || "").trim();
    if (!text || block.type === "atomic") continue;
    switch (block.type) {
      case "header-one":
        lines.push(`# ${text}`);
        break;
      case "header-two":
        lines.push(`## ${text}`);
        break;
      case "header-three":
        lines.push(`### ${text}`);
        break;
      case "ordered-list-item":
        lines.push(`1. ${text}`);
        break;
      case "unordered-list-item":
        lines.push(`- ${text}`);
        break;
      case "blockquote":
        lines.push(
          text
            .split(/\r?\n/)
            .map((line) => `> ${line}`)
            .join("\n"),
        );
        break;
      default:
        lines.push(text);
    }
    lines.push("");
  }
  return lines.join("\n").trim() || article.preview_text?.trim() || "";
}

function parseQuote(post: FxPost | undefined): QuotedXPost | null {
  if (!post) return null;
  return {
    url: post.url || "",
    text: post.text || "",
    authorName: post.author?.name || "",
    authorHandle: post.author?.screen_name || "",
  };
}

function parseDate(post: FxPost): Date | null {
  if (post.created_timestamp) {
    const date = new Date(post.created_timestamp * 1000);
    if (!Number.isNaN(date.getTime())) return date;
  }
  if (post.created_at) {
    const date = new Date(post.created_at);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

export async function parseXPost(
  endpoint: string,
  input: string,
): Promise<ParsedXPost> {
  const link = extractXLink(input);
  if (!link) throw new Error("没有找到有效的 X 帖子链接");

  const base = endpoint.replace(/\/+$/, "");
  const response = await requestUrl({
    url: `${base}/${encodeURIComponent(link.username)}/status/${link.statusId}`,
    method: "GET",
    headers: { Accept: "application/json" },
    throw: false,
  });

  let payload: FxResponse;
  try {
    payload = response.json as FxResponse;
  } catch {
    throw new Error("X 解析服务返回了无法识别的数据");
  }
  if (response.status < 200 || response.status >= 300 || payload.code !== 200) {
    throw new Error(payload.message || `X 解析失败（HTTP ${response.status}）`);
  }

  const post = payload.tweet || payload.status;
  if (!post?.id) throw new Error("解析结果中没有帖子 ID");
  const articleBody = articleToMarkdown(post.article);
  const text = post.text?.trim() || articleBody || post.article?.preview_text?.trim() || "";
  if (!text) throw new Error("解析结果中没有帖子正文");
  const authorHandle = post.author?.screen_name || link.username;
  const title =
    post.article?.title?.trim() ||
    text.split(/\r?\n/).find((line) => line.trim()) ||
    `@${authorHandle} 的帖子`;
  return {
    sourceUrl: post.url || `https://x.com/${authorHandle}/status/${post.id}`,
    sourceId: post.id,
    title,
    text,
    authorName: post.author?.name || authorHandle,
    authorHandle,
    createdAt: parseDate(post),
    language: post.lang || "",
    likes: post.likes ?? null,
    reposts: post.reposts ?? post.retweets ?? null,
    replies: post.replies ?? null,
    quotes: post.quotes ?? null,
    bookmarks: post.bookmarks ?? null,
    views: post.views ?? null,
    media: parseMedia(post),
    quote: parseQuote(post.quote),
    isArticle: Boolean(post.article),
  };
}

export async function downloadXMedia(url: string): Promise<ArrayBuffer> {
  const response = await requestUrl({ url, method: "GET", throw: false });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`X 媒体下载失败（HTTP ${response.status}）`);
  }
  if (response.arrayBuffer.byteLength === 0) throw new Error("X 媒体下载结果为空");
  return response.arrayBuffer;
}
