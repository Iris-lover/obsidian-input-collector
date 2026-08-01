export interface ParsedXMedia {
  type: "photo" | "video" | "gif";
  url: string;
  thumbnailUrl: string;
  altText: string;
  format: string;
}

export interface QuotedXPost {
  url: string;
  text: string;
  authorName: string;
  authorHandle: string;
}

export interface ParsedXPost {
  sourceUrl: string;
  sourceId: string;
  text: string;
  authorName: string;
  authorHandle: string;
  createdAt: Date | null;
  language: string;
  likes: number | null;
  reposts: number | null;
  replies: number | null;
  quotes: number | null;
  bookmarks: number | null;
  views: number | null;
  media: ParsedXMedia[];
  quote: QuotedXPost | null;
}

export interface FxMediaItem {
  type?: string;
  url?: string;
  thumbnail_url?: string;
  altText?: string;
  alt_text?: string;
  format?: string;
}

export interface FxPost {
  id?: string;
  url?: string;
  text?: string;
  created_at?: string;
  created_timestamp?: number;
  lang?: string;
  likes?: number;
  retweets?: number;
  reposts?: number;
  replies?: number;
  quotes?: number;
  bookmarks?: number;
  views?: number | null;
  author?: {
    name?: string;
    screen_name?: string;
  };
  media?: {
    photos?: FxMediaItem[];
    videos?: FxMediaItem[];
  };
  quote?: FxPost;
}

export interface FxResponse {
  code?: number;
  message?: string;
  tweet?: FxPost;
  status?: FxPost;
}
