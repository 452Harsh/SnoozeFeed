// Instagram scraper: Stagehand drives a Browserbase cloud browser that reuses
// a persisted Context (BROWSERBASE_CONTEXT_ID), so a one-time manual login
// carries over. Reads posts from page markup only (no LLM calls here).
//
// Politeness: one session per run, pages visited sequentially, random delays,
// public pages only. If Instagram blocks or rate-limits, the whole run stops
// (InstagramBlockedError); we never retry around it, rotate proxies or evade.
import { browserbase, Stagehand, type Page, type StagehandBrowser } from "@browserbasehq/stagehand";
import type { Config } from "./config.js";
import { AbortRunError } from "./pipeline.js";
import type { PageInput, PostType, ScrapedPost } from "./types.js";

const WINDOW_MS = 24 * 60 * 60 * 1000;
/** Profile grids show up to 3 pinned posts first, which can be older than newer posts. */
const MAX_PINNED = 3;
const MAX_POSTS_PER_PAGE = 12;
const NAV_TIMEOUT_MS = 30_000;

export class InstagramBlockedError extends AbortRunError {
  constructor(reason: string) {
    super(`Instagram blocked the scraper: ${reason}`);
    this.name = "InstagramBlockedError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const randomDelay = (minMs: number, maxMs: number) => sleep(minMs + Math.random() * (maxMs - minMs));

export interface Scraper {
  sessionId?: string;
  fetchPosts(page: PageInput): Promise<ScrapedPost[]>;
  close(): Promise<void>;
}

export async function openScraper(cfg: Config, log: (msg: string) => void = console.log): Promise<Scraper> {
  const { apiKey, projectId, contextId } = cfg.browserbase;
  if (!apiKey || !projectId) throw new Error("BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID are required");
  if (!contextId) log("! BROWSERBASE_CONTEXT_ID not set: browsing logged out, Instagram may show a login wall");

  const browser: StagehandBrowser = await browserbase.launch({
    apiKey,
    projectId,
    ...(contextId ? { browserSettings: { context: { id: contextId, persist: true } } } : {}),
  });
  log(`browserbase session ${browser.sessionId} (replay: https://www.browserbase.com/sessions/${browser.sessionId})`);

  let stagehand: Stagehand | undefined;
  const close = async () => {
    await stagehand?.close().catch(() => {});
    await browser.close().catch(() => {});
  };
  try {
    // No model: Stagehand only drives the browser here; Gemma runs later in the pipeline.
    stagehand = await Stagehand.create({ browser });
    const [existing] = await browser.context.pages();
    const tab = existing ?? (await browser.context.newPage());
    return {
      sessionId: browser.sessionId,
      fetchPosts: (page) => scrapeProfile(tab, page.username, log),
      close,
    };
  } catch (err) {
    await close();
    throw err;
  }
}

/** Navigates and classifies the result: blocked (stop the run), unavailable (page failure) or ok. */
async function visit(tab: Page, url: string): Promise<void> {
  const res = await tab.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
  if (res?.status() === 429) throw new InstagramBlockedError("HTTP 429 Too Many Requests");
  await tab.waitForLoadState("load", NAV_TIMEOUT_MS).catch(() => {});

  const landed = await tab.url();
  if (/\/(accounts\/login|challenge|checkpoint|accounts\/suspended)/.test(landed)) {
    throw new InstagramBlockedError(`redirected to ${new URL(landed).pathname}`);
  }
  const text = await tab.evaluate<string>(`(document.body ? document.body.innerText : "").slice(0, 4000)`);
  if (/please wait a few minutes|try again later|suspicious activity|confirm it'?s you/i.test(text)) {
    throw new InstagramBlockedError(`"${text.match(/[^\n]*(please wait|try again later|suspicious|confirm it)[^\n]*/i)?.[0]?.trim()}"`);
  }
  if (/sorry, this page isn'?t available/i.test(text)) throw new Error("Page not found or unavailable");
  if (/this account is private/i.test(text)) throw new Error("Account is private (public pages only)");
}

async function scrapeProfile(tab: Page, username: string, log: (msg: string) => void): Promise<ScrapedPost[]> {
  await visit(tab, `https://www.instagram.com/${encodeURIComponent(username)}/`);
  await tab.waitForSelector('a[href*="/p/"], a[href*="/reel/"]', { timeout: 15_000 }).catch(() => false);

  const links = await tab.evaluate<string[]>(PROFILE_LINKS_SCRIPT);
  if (!links.length) throw new Error("No posts visible on the profile (empty page or login wall)");
  log(`  @${username}: ${links.length} post link(s) on profile`);

  const now = Date.now();
  const posts: ScrapedPost[] = [];
  for (const [i, url] of links.entries()) {
    await randomDelay(1500, 4000);
    const post = await scrapePost(tab, url, username);
    if (!post) {
      log(`  · ${url}: no timestamp found, skipped`);
      continue;
    }
    const recent = now - post.postedAt.getTime() <= WINDOW_MS;
    log(`  · ${url}: ${post.postedAt.toISOString()} ${recent ? "kept" : "older than 24h"}`);
    if (!recent) {
      // Slots 0..MAX_PINNED-1 may be pinned (any age). Past them the grid is newest-first,
      // so everything after an old post is older too.
      if (i >= MAX_PINNED) break;
      continue;
    }
    posts.push(post);
  }
  return posts;
}

// In-page scripts are plain strings, not functions: tsx/esbuild inject helpers
// (e.g. __name) into compiled functions, and those don't exist in the page.
const PROFILE_LINKS_SCRIPT = `(() => {
  const out = [];
  for (const a of document.querySelectorAll('main a[href*="/p/"], main a[href*="/reel/"]')) {
    const m = (a.getAttribute("href") || "").match(/\\/(p|reel)\\/([A-Za-z0-9_-]+)/);
    if (!m) continue;
    const url = "https://www.instagram.com/" + m[1] + "/" + m[2] + "/";
    if (!out.includes(url)) out.push(url);
    if (out.length >= ${MAX_POSTS_PER_PAGE}) break;
  }
  return out;
})()`;

const POST_SCRIPT = `(() => {
  const root = document.querySelector("main") || document.body;
  const meta = (p) => (document.querySelector('meta[property="' + p + '"]') || {}).content || "";
  // Alt text must come from this post's own image, not the "more posts" grid below it:
  // match og:image's filename, else the first image inside the post's article.
  const ogFile = (meta("og:image").split("?")[0] || "").split("/").pop() || "";
  const imgs = Array.from(root.querySelectorAll("img[alt]"));
  const own =
    (ogFile && imgs.find((img) => (img.getAttribute("src") || "").includes(ogFile))) ||
    root.querySelector("article img[alt]");
  const ownAlt = own ? own.alt.trim() : "";
  const alts = ownAlt.length > 20 && !/profile picture/i.test(ownAlt) ? [ownAlt] : [];
  const h1 = root.querySelector("h1");
  return {
    datetimes: Array.from(
      (root.querySelector("time[datetime]") ? root : document).querySelectorAll("time[datetime]"),
    ).map((t) => t.getAttribute("datetime") || ""),
    caption: h1 ? h1.textContent.trim() : "",
    ogDescription: meta("og:description"),
    ogImage: meta("og:image"),
    altText: alts[0] || "",
    hasVideo: Boolean(root.querySelector("video")),
    hasCarousel: Boolean(root.querySelector('button[aria-label="Next"], [aria-label*="Carousel" i]')),
  };
})()`;

interface RawPost {
  datetimes: string[];
  caption: string;
  ogDescription: string;
  ogImage: string;
  altText: string;
  hasVideo: boolean;
  hasCarousel: boolean;
}

async function scrapePost(tab: Page, url: string, username: string): Promise<ScrapedPost | null> {
  // Reels are also served at /p/<code>/, which uses the post layout (with a timestamp);
  // the /reel/ page has none. Keep the /reel/ URL as the canonical link.
  await visit(tab, url.replace("/reel/", "/p/"));
  await tab.waitForSelector("time[datetime]", { timeout: 10_000 }).catch(() => false);

  const raw = await tab.evaluate<RawPost>(POST_SCRIPT);

  // Comments carry later timestamps, so the post's own time is the earliest one on the page.
  const times = raw.datetimes.map((d) => Date.parse(d)).filter((t) => !Number.isNaN(t));
  if (!times.length) return null;

  const type: PostType = url.includes("/reel/") ? "reel" : raw.hasVideo ? "video" : raw.hasCarousel ? "carousel" : "image";
  return {
    url,
    username,
    caption: raw.caption || captionFromOg(raw.ogDescription),
    imageUrl: raw.ogImage || undefined,
    altText: raw.altText || undefined,
    postedAt: new Date(Math.min(...times)),
    type,
  };
}

/** og:description looks like: `123 likes, 4 comments - nasa on October 22, 2026: "caption"`. */
export function captionFromOg(og: string): string {
  const m = og.match(/:\s*"([\s\S]*)"\s*\.?\s*$/);
  return (m?.[1] ?? "").trim();
}
