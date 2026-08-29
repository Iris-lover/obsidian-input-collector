import type {
  ParsedYoutubeVideo,
  WeChatChannelsImporterSettings,
} from "./types";

interface YtDlpMetadata {
  id?: string;
  title?: string;
  description?: string;
  uploader?: string;
  channel?: string;
  channel_url?: string;
  uploader_url?: string;
  upload_date?: string;
  timestamp?: number;
  duration?: number;
  thumbnail?: string;
  view_count?: number;
  like_count?: number;
  webpage_url?: string;
}

export interface YtDlpResult {
  stdout: string;
  stderr: string;
}

export function extractYoutubeLink(input: string): string | null {
  const match = input.match(
    /https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?[^\s]*v=|shorts\/|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})[^\s)]*/i,
  );
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : null;
}

export function youtubeIdFromUrl(input: string): string | null {
  return extractYoutubeLink(input)?.match(/[?&]v=([A-Za-z0-9_-]{11})/)?.[1] || null;
}

function verificationArgs(settings: WeChatChannelsImporterSettings): string[] {
  switch (settings.youtubeVerificationMode) {
    case "wpc":
      return [
        "--extractor-args",
        "youtube:player_client=mweb;fetch_pot=always",
      ];
    case "chrome":
    case "firefox":
    case "safari":
      return [
        "--cookies-from-browser",
        settings.youtubeVerificationMode,
        "--extractor-args",
        "youtube:player_client=web_safari;fetch_pot=never",
      ];
    default:
      return [
        "--extractor-args",
        "youtube:player_client=web_safari;fetch_pot=never",
      ];
  }
}

export function youtubeCommonArgs(
  settings: WeChatChannelsImporterSettings,
): string[] {
  return [
    "--no-playlist",
    "--no-warnings",
    "--js-runtimes",
    "node",
    "--remote-components",
    "ejs:github",
    ...verificationArgs(settings),
  ];
}

export async function runYtDlp(
  executable: string,
  args: string[],
  onOutput?: (line: string) => void,
): Promise<YtDlpResult> {
  const { spawn } = require("node:child_process") as typeof import("node:child_process");

  return await new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      env: process.env,
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      for (const line of chunk.split(/\r?\n/)) {
        if (line.trim()) onOutput?.(line.trim());
      }
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
      for (const line of chunk.split(/\r?\n/)) {
        if (line.trim()) onOutput?.(line.trim());
      }
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(new Error(`找不到 yt-dlp：${executable}。请在插件设置中检查路径。`));
      } else {
        reject(error);
      }
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(formatYtDlpError(stderr || stdout)));
    });
  });
}

function formatYtDlpError(output: string): string {
  if (/Timed out waiting for WebPoClient|Could not find WebPoClient/i.test(output)) {
    return "WPC 浏览器验证超时。请在设置中把 YouTube 验证方式改为 Chrome Cookie 后重试。";
  }
  if (/Sign in to confirm you.re not a bot|LOGIN_REQUIRED/i.test(output)) {
    return "YouTube 要求登录验证。请在设置中选择 Chrome Cookie，或稍后更换网络重试。";
  }
  if (/HTTP Error 403|Forbidden/i.test(output)) {
    return "YouTube 拒绝了媒体请求（HTTP 403）。请更新 yt-dlp，或改用 Chrome Cookie 验证。";
  }
  const errorLine = output
    .split(/\r?\n/)
    .reverse()
    .find((line) => /ERROR:/i.test(line));
  return (errorLine || output.trim() || "yt-dlp 执行失败").replace(/^ERROR:\s*/i, "");
}

function parseUploadDate(metadata: YtDlpMetadata): Date | null {
  if (/^\d{8}$/.test(metadata.upload_date || "")) {
    const value = metadata.upload_date as string;
    return new Date(
      Number(value.slice(0, 4)),
      Number(value.slice(4, 6)) - 1,
      Number(value.slice(6, 8)),
    );
  }
  if (metadata.timestamp) {
    const date = new Date(metadata.timestamp * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export async function parseYoutubeVideo(
  settings: WeChatChannelsImporterSettings,
  sourceUrl: string,
): Promise<ParsedYoutubeVideo> {
  const canonicalUrl = extractYoutubeLink(sourceUrl);
  if (!canonicalUrl) throw new Error("请输入有效的 YouTube 单条视频链接");

  const result = await runYtDlp(settings.youtubeYtDlpPath, [
    ...youtubeCommonArgs(settings),
    "--dump-single-json",
    canonicalUrl,
  ]);
  let metadata: YtDlpMetadata;
  try {
    metadata = JSON.parse(result.stdout.trim()) as YtDlpMetadata;
  } catch {
    throw new Error("yt-dlp 已返回结果，但视频信息格式无法识别");
  }
  if (!metadata.id || !metadata.title) {
    throw new Error("没有读取到 YouTube 视频标题或 ID");
  }

  return {
    sourceUrl: metadata.webpage_url || canonicalUrl,
    sourceId: metadata.id,
    title: metadata.title,
    description: metadata.description || "",
    author: metadata.channel || metadata.uploader || "",
    channelUrl: metadata.channel_url || metadata.uploader_url || "",
    createdAt: parseUploadDate(metadata),
    durationSeconds: Number(metadata.duration) || 0,
    thumbnailUrl: metadata.thumbnail || "",
    views: metadata.view_count?.toLocaleString("en-US") || "",
    likes: metadata.like_count?.toLocaleString("en-US") || "",
  };
}
