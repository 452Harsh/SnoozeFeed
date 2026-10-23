// One run = one digest. The post source is injected so demo (fixtures) and
// live (Browserbase scraper) share the same pipeline.
import type { Collection, Db } from "mongodb";
import type { Category, Config } from "./config.js";
import type { GemmaClient } from "./ai/client.js";
import { categorizePage, gistPost, isWeakCaption, summarizeCategory } from "./ai/prompts.js";
import { COLLECTIONS } from "./db.js";
import type {
  DigestCategory,
  DigestDoc,
  DigestPick,
  PageDoc,
  PageInput,
  PostDoc,
  ScrapedPost,
} from "./types.js";

const WINDOW_MS = 24 * 60 * 60 * 1000;
const SECONDS_PER_POST = 8;

export interface RunOptions {
  cfg: Config;
  db: Db;
  ai: GemmaClient;
  pages: PageInput[];
  fetchPosts: (page: PageInput) => Promise<ScrapedPost[]>;
  source: PostDoc["source"];
  now?: Date;
  log?: (msg: string) => void;
}

/** YYYY-MM-DD for `date` in the given IANA timezone. */
export function localDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const toPick = (p: PostDoc): DigestPick => ({ url: p.url, username: p.username, gist: p.gist });

export async function runPipeline(opts: RunOptions): Promise<DigestDoc> {
  const { cfg, db, ai, source } = opts;
  const now = opts.now ?? new Date();
  const log = opts.log ?? console.log;
  const date = localDate(now, cfg.digestTimezone);
  const pagesCol = db.collection<PageDoc>(COLLECTIONS.pages);
  const postsCol = db.collection<PostDoc>(COLLECTIONS.posts);

  const failed: DigestDoc["failed"] = [];
  const kept: PostDoc[] = [];
  let pageCount = 0;

  // 1-2. Fetch each page sequentially; one bad page never fails the run.
  for (const page of opts.pages) {
    let scraped: ScrapedPost[];
    try {
      scraped = await opts.fetchPosts(page);
    } catch (err) {
      failed.push({ username: page.username, error: errorMessage(err) });
      log(`✗ @${page.username}: ${errorMessage(err)}`);
      continue;
    }
    pageCount++;

    const category = await resolveCategory(page, scraped, { ai, pagesCol, source, log });

    // 3. Last 24h only, then reuse posts already stored (dedupe by URL).
    const recent = scraped.filter((p) => now.getTime() - p.postedAt.getTime() <= WINDOW_MS);
    const existing = new Map(
      (await postsCol.find({ url: { $in: recent.map((p) => p.url) } }).toArray()).map((d) => [d.url, d]),
    );

    for (const post of recent) {
      const stored = existing.get(post.url);
      // Reuse a stored gist unless it was a caption fallback; a page's category may have changed since.
      if (stored && !stored.aiError) {
        kept.push({ ...stored, category });
        continue;
      }
      // 4. Gemma gist per new post; on failure fall back to the caption.
      const { createdAt = now, digestDate = date } = stored ?? {};
      const doc: PostDoc = { ...post, category, gist: "", source, digestDate, createdAt };
      try {
        const g = await gistPost(ai, post);
        doc.gist = g.gist;
        if (g.skip) doc.skip = g.skip;
      } catch (err) {
        doc.gist = post.caption.slice(0, 140) || "(no caption)";
        doc.aiError = errorMessage(err);
      }
      await postsCol.replaceOne({ url: doc.url }, doc, { upsert: true });
      kept.push(doc);
    }
    log(`✓ @${page.username} [${category}]: ${recent.length} post(s) in last 24h`);
  }

  // 5. Per-category summary + picks.
  const byCategory = new Map<Category, PostDoc[]>();
  for (const p of kept.filter((p) => !p.skip)) {
    byCategory.set(p.category, [...(byCategory.get(p.category) ?? []), p]);
  }

  const categories: DigestCategory[] = [];
  for (const [category, posts] of byCategory) {
    const inputs = posts.map((p, i) => ({ id: `p${i + 1}`, username: p.username, gist: p.gist }));
    let summary: string;
    let picks: DigestPick[];
    try {
      const s = await summarizeCategory(ai, category, inputs);
      summary = s.summary;
      picks = s.pickIds.map((id) => toPick(posts[Number(id.slice(1)) - 1]!));
    } catch (err) {
      log(`! summary for ${category} failed: ${errorMessage(err)}`);
      summary = `${posts.length} new post(s) from ${new Set(posts.map((p) => p.username)).size} page(s).`;
      picks = posts.slice(0, 1).map(toPick);
    }
    categories.push({ category, summary, picks, posts: posts.map(toPick) });
    log(`✓ summarized ${category} (${posts.length} post(s))`);
  }
  categories.sort((a, b) => b.posts.length - a.posts.length);

  const digest: DigestDoc = {
    date,
    generatedAt: now,
    demo: source === "fixture",
    model: ai.model,
    stats: {
      pages: pageCount,
      posts: kept.length,
      minutesSaved: Math.round((kept.length * SECONDS_PER_POST) / 60),
    },
    categories,
    skipped: kept.filter((p) => p.skip).map((p) => ({ ...toPick(p), reason: p.skip! })),
    failed,
  };

  // 6. Save. A demo run must never overwrite a real digest for the same day.
  const digests = db.collection<DigestDoc>(COLLECTIONS.digests);
  const current = await digests.findOne({ date }, { projection: { demo: 1 } });
  if (current && !current.demo && digest.demo) {
    throw new Error(`A live digest already exists for ${date}; not overwriting it with demo data`);
  }
  await digests.replaceOne({ date }, digest, { upsert: true });
  return digest;
}

async function resolveCategory(
  page: PageInput,
  posts: ScrapedPost[],
  ctx: {
    ai: GemmaClient;
    pagesCol: Collection<PageDoc>;
    source: PostDoc["source"];
    log: (msg: string) => void;
  },
): Promise<Category> {
  const now = new Date();
  if (page.category) {
    await ctx.pagesCol.updateOne(
      { username: page.username },
      { $set: { category: page.category, categorySource: "config", source: ctx.source, updatedAt: now } },
      { upsert: true },
    );
    return page.category;
  }
  // Reuse a category Gemma assigned on an earlier run.
  const stored = await ctx.pagesCol.findOne({ username: page.username });
  if (stored?.category) return stored.category;

  let category: Category;
  try {
    category = await categorizePage(
      ctx.ai,
      page.username,
      posts.map((p) => (isWeakCaption(p.caption) && p.altText ? p.altText : p.caption)),
    );
  } catch (err) {
    // Not stored, so the next run retries.
    ctx.log(`! categorize @${page.username} failed, using Other: ${errorMessage(err)}`);
    return "Other";
  }
  await ctx.pagesCol.updateOne(
    { username: page.username },
    { $set: { category, categorySource: "gemma", source: ctx.source, updatedAt: now } },
    { upsert: true },
  );
  return category;
}
