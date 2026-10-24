// Runs the full pipeline on made-up fixtures (no Browserbase, no Instagram)
// and saves the digest to MongoDB.
// Run: pnpm demo [--email] [--preview <file.html>]
import { readFile, writeFile } from "node:fs/promises";
import { loadConfig, requireAi } from "../src/config.js";
import { createGemmaClient } from "../src/ai/client.js";
import { connect } from "../src/db.js";
import { deliverDigest, digestUrl, renderEmailHtml } from "../src/email.js";
import { runPipeline } from "../src/pipeline.js";
import type { PageInput, PostType, ScrapedPost } from "../src/types.js";

interface FixturePost {
  id: string;
  username: string;
  type: PostType;
  hoursAgo: number;
  caption: string;
  altText?: string;
}

interface FixtureFile {
  failingPages: Record<string, string>;
  posts: FixturePost[];
}

const readJson = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(new URL(path, import.meta.url), "utf8")) as T;

const args = process.argv.slice(2);
const sendEmail = args.includes("--email");
const previewIdx = args.indexOf("--preview");
const previewPath = previewIdx >= 0 ? args[previewIdx + 1] : undefined;

const cfg = loadConfig();
requireAi();

const pages = await readJson<PageInput[]>("../fixtures/pages.json");
const fixtures = await readJson<FixtureFile>("../fixtures/posts.json");
const now = new Date();

const fetchPosts = async (page: PageInput): Promise<ScrapedPost[]> => {
  const failure = fixtures.failingPages[page.username];
  if (failure) throw new Error(failure);
  return fixtures.posts
    .filter((p) => p.username === page.username)
    .map((p) => ({
      url: `https://example.com/slothscroll/p/${p.id}`,
      username: p.username,
      caption: p.caption,
      imageUrl: `https://example.com/slothscroll/img/${p.id}.jpg`,
      altText: p.altText,
      postedAt: new Date(now.getTime() - p.hoursAgo * 3_600_000),
      type: p.type,
    }));
};

const ai = createGemmaClient(cfg);
const { client, db } = await connect(cfg);
const started = Date.now();

try {
  console.log(`demo: ${pages.length} fixture pages, model ${ai.model}${sendEmail ? ", email on" : ""}\n`);
  const { digest, saved } = await runPipeline({ cfg, db, ai, pages, fetchPosts, source: "fixture", now });

  console.log(`\n=== Digest ${digest.date} (demo) ===`);
  console.log(
    `${digest.stats.pages} pages · ${digest.stats.posts} posts · ~${digest.stats.minutesSaved} min of scrolling saved\n`,
  );
  for (const c of digest.categories) {
    console.log(`## ${c.category}\n${c.summary}`);
    for (const p of c.picks) console.log(`  → @${p.username}: ${p.gist}\n    ${p.url}`);
    console.log();
  }
  if (digest.skipped.length) {
    console.log("## Skipped");
    for (const s of digest.skipped) console.log(`  - [${s.reason}] @${s.username}: ${s.gist}`);
    console.log();
  }
  if (digest.failed.length) {
    console.log("## Failed pages");
    for (const f of digest.failed) console.log(`  - @${f.username}: ${f.error}`);
    console.log();
  }
  console.log(
    `${saved ? "saved" : "built (not saved)"} digest ${digest.date} in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );

  if (previewPath) {
    await writeFile(previewPath, renderEmailHtml(digest, digestUrl(cfg, digest), { timeZone: cfg.digestTimezone }));
    console.log(`email preview written to ${previewPath}`);
  }
  // Email only on request, so demo runs don't spam the inbox.
  if (sendEmail) await deliverDigest(cfg, db, digest, { saved });
  else console.log("email skipped: pass --email to send the demo digest");
} finally {
  await client.close();
}
