import { requestUrl } from "obsidian";
import type { ParsedDouyinMedia, ParsedDouyinVideo } from "./douyin-types";

type UnknownRecord = Record<string, unknown>;

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
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  return null;
}

/**
 * Extract a Douyin link from user input (share text or direct URL).
 * Supports:
 *   - v.douyin.com short links (often embedded in share text)
 *   - www.douyin.com/video/xxx
 *   - www.douyin.com/note/xxx
 *   - www.iesdouyin.com/share/video/xxx
 */
export function extractDouyinLink(input: string): { sourceUrl: string } | null {
  const shortLink = input.match(/https?:\/\/v\.douyin\.com\/[A-Za-z0-9]+\/?/i);
  if (shortLink) return { sourceUrl: shortLink[0].replace(/\/$/, "") };

  const videoLink = input.match(
    /https?:\/\/(?:www\.)?douyin\.com\/(?:video|note)\/(\d+)/i,
  );
  if (videoLink) return { sourceUrl: `https://www.douyin.com/video/${videoLink[1]}` };

  const iesLink = input.match(
    /https?:\/\/(?:www\.)?iesdouyin\.com\/share\/video\/(\d+)/i,
  );
  if (iesLink) return { sourceUrl: `https://www.douyin.com/video/${iesLink[1]}` };

  return null;
}

/**
 * Resolve a v.douyin.com short link to a full douyin.com/video/xxx URL
 * by following the 302 redirect.
 */
async function resolveShortLink(url: string, cookie: string): Promise<string> {
  const headers: Record<string, string> = {
    Accept: "text/html,application/xhtml+xml",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
  if (cookie) headers.Cookie = cookie;

  // Obsidian's requestUrl follows redirects automatically; we read the final URL from the response
  const response = await requestUrl({ url, method: "GET", headers, throw: false });
  if (response.status >= 400) {
    throw new Error(`抖音短链接解析失败（HTTP ${response.status}）`);
  }

  // Try to extract the video ID from the final page HTML
  const idMatch = response.text.match(/\/video\/(\d+)/);
  if (idMatch) return `https://www.douyin.com/video/${idMatch[1]}`;

  // Also try note format
  const noteMatch = response.text.match(/\/note\/(\d+)/);
  if (noteMatch) return `https://www.douyin.com/video/${noteMatch[1]}`;

  throw new Error("无法从抖音短链接中解析出视频 ID");
}

/**
 * Extract the __RENDER_DATA__ or SSR data from a Douyin page.
 */
function parseRenderData(html: string): UnknownRecord {
  // Try RENDER_DATA (URL-encoded JSON)
  const renderMatch = html.match(/window\.__RENDER_DATA__\s*=\s*'([^']+)'/);
  if (renderMatch) {
    try {
      const decoded = decodeURIComponent(renderMatch[1]);
      return record(JSON.parse(decoded));
    } catch {
      // fall through
    }
  }

  // Try SSR_HYDRATED_DATA
  const ssrMatch = html.match(
    /self\.__pace_f\.push\(\[\d+,"[^"]*\\?"type\\?":\\?"hydrateData\\?"[^"]*"\]\)/,
  );
  if (ssrMatch) {
    // Complex; try alternative approach
  }

  // Try generic JSON data blocks
  const jsonMatch = html.match(
    /(?:window\._SSR_DATA|window\.__INITIAL_STATE__|<script[^>]*id="RENDER_DATA"[^>]*>)\s*[=:]\s*([\s\S]*?)<\/script>/i,
  );
  if (jsonMatch) {
    const raw = jsonMatch[1].trim().replace(/;\s*$/, "").replace(/\bundefined\b/g, "null");
    try {
      return record(JSON.parse(raw));
    } catch {
      // Try URL-decode first
      try {
        return record(JSON.parse(decodeURIComponent(raw)));
      } catch {
        // fall through
      }
    }
  }

  // Try the RENDER_DATA script tag variant
  const scriptMatch = html.match(/<script\s+id="RENDER_DATA"\s+type="application\/json"[^>]*>([\s\S]*?)<\/script>/i);
  if (scriptMatch) {
    try {
      return record(JSON.parse(decodeURIComponent(scriptMatch[1].trim())));
    } catch {
      try {
        return record(JSON.parse(scriptMatch[1].trim()));
      } catch {
        // fall through
      }
    }
  }

  throw new Error("抖音页面中没有找到视频数据，可能需要登录或 Cookie 已失效");
}

/**
 * Recursively search for the aweme detail object in the parsed data.
 */
function findAwemeDetail(obj: unknown, depth = 0): UnknownRecord | null {
  if (depth > 8 || !obj || typeof obj !== "object") return null;
  const rec = obj as UnknownRecord;

  // Direct aweme_detail or awemeDetail
  if (rec.aweme_detail && typeof rec.aweme_detail === "object") {
    return record(rec.aweme_detail);
  }
  if (rec.awemeDetail && typeof rec.awemeDetail === "object") {
    return record(rec.awemeDetail);
  }

  // Check for aweme_id as marker that this IS the detail
  if (rec.aweme_id && typeof rec.aweme_id === "string") {
    return rec;
  }

  // Recurse into object values
  for (const value of Object.values(rec)) {
    if (value && typeof value === "object") {
      const found = findAwemeDetail(value, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Fetch and parse a Douyin video page directly, using the user's Cookie.
 */
export async function parseDouyinVideo(
  sourceUrl: string,
  cookie: string,
): Promise<ParsedDouyinVideo> {
  let resolvedUrl = sourceUrl;

  // Resolve short links first
  if (/v\.douyin\.com/i.test(sourceUrl)) {
    resolvedUrl = await resolveShortLink(sourceUrl, cookie);
  }

  const headers: Record<string, string> = {
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "zh-CN,zh;q=0.9",
    Referer: "https://www.douyin.com/",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
  if (cookie) headers.Cookie = cookie;

  const response = await requestUrl({ url: resolvedUrl, method: "GET", headers, throw: false });
  if (response.status < 200 || response.status >= 400) {
    throw new Error(`读取抖音页面失败（HTTP ${response.status}）`);
  }

  const renderData = parseRenderData(response.text);
  const detail = findAwemeDetail(renderData);
  if (!detail) {
    throw new Error("抖音页面中没有找到视频详情数据，Cookie 可能已失效");
  }

  const awemeId = stringValue(detail.aweme_id, detail.id);
  if (!awemeId) throw new Error("解析结果中没有抖音视频 ID");

  const author = record(detail.author);
  const stats = record(detail.statistics);
  const desc = stringValue(detail.desc, detail.title);

  // Determine if video or image post
  const images = Array.isArray(detail.images) ? detail.images : [];
  const isVideo = images.length === 0;

  // Tags
  const inlineTags = Array.from(desc.matchAll(/#([^#\s]+)/g), (m) => m[1]);
  const textExtra = Array.isArray(detail.text_extra) ? detail.text_extra : [];
  const textTags = textExtra
    .map((t) => stringValue(record(t).hashtag_name))
    .filter(Boolean);
  const tags = Array.from(new Set([...textTags, ...inlineTags]));

  // Media
  const media: ParsedDouyinMedia[] = [];

  if (isVideo) {
    const video = record(detail.video);
    // Try play_addr first (no watermark), then bit_rate list
    const playAddr = record(video.play_addr);
    let videoUrl = "";
    const urlList = Array.isArray(playAddr.url_list) ? playAddr.url_list : [];
    videoUrl = stringValue(...urlList);

    // Try bit_rate for higher quality
    if (!videoUrl) {
      const bitRateList = Array.isArray(video.bit_rate) ? video.bit_rate : [];
      for (const br of bitRateList) {
        const brAddr = record(record(br).play_addr);
        const brUrls = Array.isArray(brAddr.url_list) ? brAddr.url_list : [];
        videoUrl = stringValue(...brUrls);
        if (videoUrl) break;
      }
    }

    if (videoUrl) media.push({ type: "video", url: videoUrl });
  } else {
    for (const img of images) {
      const imgRecord = record(img);
      const urlList = Array.isArray(imgRecord.url_list) ? imgRecord.url_list : [];
      const imgUrl = stringValue(...urlList);
      if (imgUrl) media.push({ type: "image", url: imgUrl });
    }
  }

  // Cover
  const cover = record(record(detail.video).cover);
  const coverUrlList = Array.isArray(cover.url_list) ? cover.url_list : [];
  const coverUrl = stringValue(...coverUrlList);

  // Date
  let createdAt: Date | null = null;
  const ts = detail.create_time;
  if (typeof ts === "number" && Number.isFinite(ts)) {
    createdAt = new Date(ts < 10_000_000_000 ? ts * 1000 : ts);
    if (Number.isNaN(createdAt.getTime())) createdAt = null;
  }

  const title = desc.split(/\r?\n/)[0] || "未命名抖音视频";

  return {
    sourceUrl: `https://www.douyin.com/video/${awemeId}`,
    sourceId: awemeId,
    title,
    text: desc,
    authorName: stringValue(author.nickname, author.nick_name, "未知作者"),
    authorId: stringValue(author.uid, author.id, author.sec_uid),
    createdAt,
    tags,
    likes: numberValue(stats.digg_count ?? stats.like_count),
    collects: numberValue(stats.collect_count),
    comments: numberValue(stats.comment_count),
    shares: numberValue(stats.share_count),
    media,
    isVideo,
    coverUrl,
  };
}

export async function downloadDouyinMedia(
  url: string,
  cookie: string,
): Promise<ArrayBuffer> {
  const headers: Record<string, string> = {
    Referer: "https://www.douyin.com/",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
  if (cookie) headers.Cookie = cookie;

  const response = await requestUrl({ url, method: "GET", headers, throw: false });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`抖音媒体下载失败（HTTP ${response.status}）`);
  }
  if (response.arrayBuffer.byteLength === 0) throw new Error("抖音媒体下载结果为空");
  return response.arrayBuffer;
}
