import type { Category } from "./config.js";

/** One entry from pages.yaml (or fixtures/pages.json). */
export interface PageInput {
  username: string;
  category?: Category;
}

export type PostType = "image" | "carousel" | "video" | "reel";

/** What a scraper (or fixture loader) returns for one post. */
export interface ScrapedPost {
  url: string;
  username: string;
  caption: string;
  imageUrl?: string;
  /** Instagram's alt text ("May be an image of ..."), used when the caption is weak. */
  altText?: string;
  postedAt: Date;
  type: PostType;
}

export type SkipReason = "ad" | "repost" | "giveaway";

export interface PostDoc extends ScrapedPost {
  category: Category;
  gist: string;
  skip?: SkipReason;
  /** Set when Gemma failed for this post and the gist is a caption fallback. */
  aiError?: string;
  source: "fixture" | "instagram";
  digestDate: string;
  createdAt: Date;
}

export interface PageDoc {
  username: string;
  category: Category;
  categorySource: "config" | "gemma";
  source: "fixture" | "instagram";
  updatedAt: Date;
}

export interface DigestPick {
  url: string;
  username: string;
  gist: string;
}

export interface DigestCategory {
  category: Category;
  summary: string;
  picks: DigestPick[];
  posts: DigestPick[];
}

export interface DigestDoc {
  date: string;
  generatedAt: Date;
  demo: boolean;
  model: string;
  stats: { pages: number; posts: number; minutesSaved: number };
  categories: DigestCategory[];
  skipped: (DigestPick & { reason: SkipReason })[];
  failed: { username: string; error: string }[];
  /** Outcome of the email delivery for this digest, if one was attempted. */
  email?: EmailResult;
}

export interface EmailResult {
  status: "sent" | "skipped" | "failed";
  provider?: "resend" | "smtp";
  /** Provider message id when sent. */
  id?: string;
  /** Why it was skipped or how it failed. */
  reason?: string;
  at: Date;
}
