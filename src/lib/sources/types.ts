/** A news article / feed entry before it becomes a draft. */
export type NewsItem = {
  url: string;
  title: string;
  summary: string;
  sourceName: string;
  publishedAt: Date | null;
  imageUrl?: string;
};
