// RSS 2.0 feed of one page's stored posts, newest first.
import type { PostDoc } from "../types.js";
import { esc } from "./render.js";

export interface FeedInput {
  username: string;
  /** Absolute URL of this feed, for the atom:link self reference. */
  selfUrl: string;
  posts: PostDoc[];
}

const isHttp = (u: string | undefined): u is string => Boolean(u && /^https?:\/\//i.test(u));

function itemTitle(p: PostDoc): string {
  const text = p.gist || p.caption.split("\n")[0] || "(no caption)";
  return p.skip ? `[${p.skip}] ${text}` : text;
}

function itemDescription(p: PostDoc): string {
  const parts: string[] = [];
  if (isHttp(p.imageUrl)) parts.push(`<p><img src="${esc(p.imageUrl)}" alt="${esc(p.altText ?? "")}"></p>`);
  if (p.gist && p.caption) parts.push(`<p><strong>${esc(p.gist)}</strong></p>`);
  parts.push(`<p>${esc(p.caption || p.gist).replace(/\n/g, "<br>")}</p>`);
  // The HTML is escaped once more by esc() below, as RSS requires for description.
  return parts.join("");
}

export function renderFeed({ username, selfUrl, posts }: FeedInput): string {
  const profile = `https://www.instagram.com/${encodeURIComponent(username)}/`;
  const lastBuild = posts[0]?.postedAt ?? new Date();
  const items = posts
    .map(
      (p) => `  <item>
    <title>${esc(itemTitle(p))}</title>
    <link>${esc(p.url)}</link>
    <guid isPermaLink="true">${esc(p.url)}</guid>
    <pubDate>${new Date(p.postedAt).toUTCString()}</pubDate>
    <category>${esc(p.category)}</category>
    <description>${esc(itemDescription(p))}</description>
  </item>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>@${esc(username)} · SlothScroll</title>
  <link>${esc(profile)}</link>
  <description>Posts from @${esc(username)} on Instagram, with one-line gists by Gemma.</description>
  <atom:link href="${esc(selfUrl)}" rel="self" type="application/rss+xml"/>
  <lastBuildDate>${new Date(lastBuild).toUTCString()}</lastBuildDate>
  <ttl>360</ttl>
${items}
</channel>
</rss>
`;
}
