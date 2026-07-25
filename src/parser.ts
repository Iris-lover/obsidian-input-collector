import { requestUrl } from "obsidian";
import type { ParsedVideo, ParserResponse } from "./types";
import { parseCreatedAt, sanitizeFilename, sourceIdFromUrl } from "./utils";

export async function parseWeChatChannelsVideo(
  endpoint: string,
  sourceUrl: string,
): Promise<ParsedVideo> {
  const response = await requestUrl({
    url: endpoint,
    method: "POST",
    contentType: "application/json",
    body: JSON.stringify({ url: sourceUrl }),
    throw: false,
  });

  let payload: ParserResponse;
  try {
    payload = response.json as ParserResponse;
  } catch {
    throw new Error("解析服务返回了无法识别的数据");
  }

  if (response.status < 200 || response.status >= 300) {
    throw new Error(payload.error || `解析服务请求失败（HTTP ${response.status}）`);
  }

  const feed = payload.data?.feedInfo;
  const author = payload.data?.authorInfo;
  if (!feed) {
    throw new Error(payload.error || "解析结果中没有视频信息");
  }

  const videoUrl =
    feed.h264VideoInfo?.videoUrl ||
    feed.h265VideoInfo?.videoUrl ||
    feed.videoUrl ||
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
