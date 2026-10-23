// Scrapes ONE public page and prints what was found. No Gemma, no MongoDB writes.
// Run: pnpm scrape:one nasa
import { loadConfig, requireBrowserbase } from "../src/config.js";
import { InstagramBlockedError, openScraper } from "../src/scraper.js";

const username = process.argv[2]?.replace(/^@/, "");
if (!username) {
  console.error("Usage: pnpm scrape:one <username>");
  process.exit(1);
}

const cfg = loadConfig();
requireBrowserbase();
const scraper = await openScraper(cfg);
const started = Date.now();

try {
  const posts = await scraper.fetchPosts({ username });
  console.log(`\n@${username}: ${posts.length} post(s) in the last 24h (${((Date.now() - started) / 1000).toFixed(0)}s)\n`);
  for (const p of posts) {
    console.log(`- ${p.postedAt.toISOString()} [${p.type}] ${p.url}`);
    console.log(`  caption: ${p.caption.slice(0, 160).replace(/\s+/g, " ") || "(none)"}`);
    if (p.altText) console.log(`  alt: ${p.altText.slice(0, 160)}`);
    console.log(`  image: ${p.imageUrl ? "yes" : "no"}`);
  }
} catch (err) {
  if (err instanceof InstagramBlockedError) {
    console.error(`\nSTOPPED: ${err.message}\nNot retrying. Check the session replay above.`);
    process.exitCode = 2;
  } else {
    console.error(`\nFAILED @${username}: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
} finally {
  await scraper.close();
}
