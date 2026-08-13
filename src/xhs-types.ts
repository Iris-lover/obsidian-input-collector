export interface ParsedXhsMedia {
  type: "image" | "video";
  url: string;
}

export interface ParsedXhsNote {
  sourceUrl: string;
  sourceId: string;
  title: string;
  text: string;
  authorName: string;
  authorId: string;
  createdAt: Date | null;
  tags: string[];
  likes: number | null;
  collects: number | null;
  comments: number | null;
  shares: number | null;
  media: ParsedXhsMedia[];
  isVideo: boolean;
}
