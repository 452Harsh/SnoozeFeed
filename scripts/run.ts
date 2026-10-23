// The daily run: scrape every page in pages.yaml, then Gemma, then save the digest.
// Run: pnpm run:daily (Render cron runs the compiled version)
import { loadConfig, requireAi, requireBrowserbase } from "../src/config.js";
import { createGemmaClient } from "../src/ai/client.js";
import { connect } from "../src/db.js";
import { loadPages } from "../src/pages.js";
import { runPipeline } from "../src/pipeline.js";
import { InstagramBlockedError, openScraper, randomDelay } from "../src/scraper.js";
import type { PageInput } from "../src/types.js";

const cfg = loadConfig();
requireBrowserbase();
requireAi();

const pages = await loadPages();
const ai = createGemmaClient(cfg);
const { client, db } = await connect(cfg);
const scraper = await openScraper(cfg);
const started = Date.now();

// Sequential, with a random pause between pages.
let first = true;
const fetchPosts = async (page: PageInput) => {
  if (!first) await randomDelay(5_000, 15_000);
  first = false;
  return scraper.fetchPosts(page);
};

try {
  console.log(`run: ${pages.length} page(s), model ${ai.model}\n`);
  const digest = await runPipeline({ cfg, db, ai, pages, fetchPosts, source: "instagram" });
  console.log(
    `\nsaved digest ${digest.date}: ${digest.stats.pages} pages · ${digest.stats.posts} posts · ` +
      `~${digest.stats.minutesSaved} min saved · ${digest.failed.length} failed ` +
      `(${((Date.now() - started) / 1000).toFixed(0)}s)`,
  );
} catch (err) {
  if (err instanceof InstagramBlockedError) {
    console.error(`\nSTOPPED: ${err.message}\nNo digest saved. Not retrying.`);
    process.exitCode = 2;
  } else {
    throw err;
  }
} finally {
  await scraper.close();
  await client.close();
}
