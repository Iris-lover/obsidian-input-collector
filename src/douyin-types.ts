export interface ParsedDouyinMedia {
  type: "image" | "video";
  url: string;
}

export interface ParsedDouyinVideo {
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
  media: ParsedDouyinMedia[];
  isVideo: boolean;
  coverUrl: string;
}
