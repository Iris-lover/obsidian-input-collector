import { requestUrl } from "obsidian";
import type { ParsedVideo, ParserResponse } from "./types";
import { parseCreatedAt, sanitizeFilename, sourceIdFromUrl } from "./utils";

export async function parseWeChatChannelsVideo(
  localEndpoint: string,
  fallbackEndpoint: string,
  sourceUrl: string,
): Promise<ParsedVideo> {
  const failures: string[] = [];

  if (localEndpoint.trim()) {
    try {
      const endpoint = new URL(localEndpoint.trim());
      endpoint.searchParams.set("url", sourceUrl);
      const response = await requestUrl({
        url: endpoint.toString(),
        method: "GET",
        headers: { Accept: "application/json" },
        throw: false,
      });
      return parsedVideoFromResponse(response.status, response.text, sourceUrl, true);
    } catch (error) {
      failures.push(`本地服务：${errorMessage(error)}`);
    }
  }

  if (fallbackEndpoint.trim()) {
    try {
      const response = await requestUrl({
        url: fallbackEndpoint.trim(),
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify({ url: sourceUrl }),
        throw: false,
      });
      return parsedVideoFromResponse(response.status, response.text, sourceUrl, false);
    } catch (error) {
      failures.push(`备用服务：${errorMessage(error)}`);
    }
  }

  if (failures.length === 0) throw new Error("没有配置视频号解析接口");
  throw new Error(`视频号解析失败。${failures.join("；")}`);
}

function parsedVideoFromResponse(
  status: number,
  text: string,
  sourceUrl: string,
  local: boolean,
): ParsedVideo {
  const bodySummary = summarizeBody(text);
  if (status < 200 || status >= 300) {
    throw new Error(`HTTP ${status}${bodySummary ? `（${bodySummary}）` : ""}`);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`返回了非 JSON 数据${bodySummary ? `（${bodySummary}）` : ""}`);
  }

  let payload = raw as ParserResponse;
  if (local && isRecord(raw) && typeof raw.code === "number") {
    if (raw.code !== 0) {
      throw new Error(stringValue(raw.msg) || `接口错误 ${raw.code}`);
    }
    payload = (raw.data || {}) as ParserResponse;
  }

  const feed = payload.data?.feedInfo;
  const author = payload.data?.authorInfo;
  if (!feed) {
    throw new Error(payload.error || payload.msg || "解析结果中没有视频信息");
  }

  const videoUrl =
    feed.h264VideoInfo?.videoUrl ||
    feed.h265VideoInfo?.videoUrl ||
    feed.videoUrl ||
    feed.originVideoUrl ||
    "";

  if (!videoUrl) {
    throw new Error("解析成功，但没有找到可下载的视频地址");
  }

  const description = (feed.description || "").trim();
  const sourceId = sourceIdFromUrl(sourceUrl);
  const titleSource = description.split(/\r?\n/)[0] || `${author?.nickname || "视频号"}-${sourceId}`;

  return {
    sourceUrl,
    sourceId,
    title: sanitizeFilename(titleSource),
    description,
    author: (author?.nickname || "").trim(),
    authorAvatarUrl: author?.headImgUrl || "",
    createdAt: parseCreatedAt(feed.createtime),
    coverUrl: feed.coverUrl || "",
    videoUrl,
    likes: feed.likeCountFmt || "",
    favorites: feed.favCountFmt || "",
    comments: feed.commentCountFmt || "",
    forwards: feed.forwardCountFmt || "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function summarizeBody(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/ECONNREFUSED|ERR_CONNECTION_REFUSED|Failed to fetch|NetworkError/i.test(message)) {
    return "未运行或无法连接";
  }
  return message;
}

export async function downloadBinary(url: string): Promise<ArrayBuffer> {
  const response = await requestUrl({
    url,
    method: "GET",
    throw: false,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`媒体下载失败（HTTP ${response.status}）`);
  }
  if (response.arrayBuffer.byteLength === 0) {
    throw new Error("媒体下载结果为空");
  }
  return response.arrayBuffer;
}
