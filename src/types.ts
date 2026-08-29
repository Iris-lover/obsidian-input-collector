export interface ImportedRecord {
  notePath: string;
  importedAt: string;
}

export interface WeChatChannelsImporterSettings {
  defaultFolder: string;
  mediaFolder: string;
  categories: string[];
  lastCategory: string;
  localParserEndpoint: string;
  parserEndpoint: string;
  xApiEndpoint: string;
  downloadVideo: boolean;
  downloadCover: boolean;
  downloadXMedia: boolean;
  downloadXhsMedia: boolean;
  youtubeYtDlpPath: string;
  youtubeVerificationMode: YoutubeVerificationMode;
  downloadYoutubeVideo: boolean;
  downloadYoutubeCover: boolean;
  downloadYoutubeSubtitles: boolean;
  youtubeMaxHeight: string;
  importedSources: Record<string, ImportedRecord>;
}

export type YoutubeVerificationMode = "wpc" | "chrome" | "firefox" | "safari" | "none";

export interface ImportOptions {
  sourceUrl: string;
  category: string;
  downloadVideo: boolean;
  downloadCover: boolean;
}

export interface XImportOptions {
  sourceUrl: string;
  category: string;
  downloadMedia: boolean;
}

export interface XhsImportOptions {
  sourceUrl: string;
  category: string;
  downloadMedia: boolean;
}

export interface YoutubeImportOptions {
  sourceUrl: string;
  category: string;
  downloadVideo: boolean;
  downloadCover: boolean;
  downloadSubtitles: boolean;
}

export interface ParsedYoutubeVideo {
  sourceUrl: string;
  sourceId: string;
  title: string;
  description: string;
  author: string;
  channelUrl: string;
  createdAt: Date | null;
  durationSeconds: number;
  thumbnailUrl: string;
  views: string;
  likes: string;
}

export interface AuthorInfo {
  nickname?: string;
  headImgUrl?: string;
}

export interface VideoVariant {
  videoUrl?: string;
}

export interface FeedInfo {
  description?: string;
  createtime?: number | string;
  coverUrl?: string;
  videoUrl?: string;
  originVideoUrl?: string;
  h264VideoInfo?: VideoVariant;
  h265VideoInfo?: VideoVariant;
  likeCountFmt?: string;
  favCountFmt?: string;
  commentCountFmt?: string;
  forwardCountFmt?: string;
}

export interface ParserResponse {
  data?: {
    authorInfo?: AuthorInfo;
    feedInfo?: FeedInfo;
  };
  error?: string;
  msg?: string;
}

export interface ParsedVideo {
  sourceUrl: string;
  sourceId: string;
  title: string;
  description: string;
  author: string;
  authorAvatarUrl: string;
  createdAt: Date | null;
  coverUrl: string;
  videoUrl: string;
  likes: string;
  favorites: string;
  comments: string;
  forwards: string;
}
