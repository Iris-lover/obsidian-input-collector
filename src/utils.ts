import { normalizePath } from "obsidian";

export function sanitizeFilename(input: string, maxLength = 80): string {
  const cleaned = input
    .replace(/[\u0000-\u001f]/g, "")
    .replace(/[\\/:*?"<>|#^[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || "未命名视频").slice(0, maxLength).trim();
}

export function sourceIdFromUrl(sourceUrl: string): string {
  try {
    const parsed = new URL(sourceUrl);
    const segments = parsed.pathname.split("/").filter(Boolean);
    return sanitizeFilename(segments.at(-1) || "wechat-channel", 48);
  } catch {
    return "wechat-channel";
  }
}

export function yamlString(value: string): string {
  return JSON.stringify(value);
}

export function formatDate(date: Date | null): string {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateTime(date: Date): string {
  const datePart = formatDate(date);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${datePart} ${hours}:${minutes}:${seconds}`;
}

export function parseCreatedAt(value: number | string | undefined): Date | null {
  if (value === undefined || value === null || value === "") return null;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
  const milliseconds = numberValue < 10_000_000_000 ? numberValue * 1000 : numberValue;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function joinVaultPath(...parts: string[]): string {
  return normalizePath(parts.filter(Boolean).join("/"));
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
