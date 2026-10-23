// Web service: today's digest, archive, and past digests. Reads only.
// Run: pnpm dev (local) / pnpm start (Render)
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { loadConfig } from "./config.js";
import { COLLECTIONS, connect } from "./db.js";
import { localDate } from "./pipeline.js";
import type { DigestDoc, PageDoc, PostDoc } from "./types.js";
import { greeting, renderArchive, renderDigest, renderMessage, type ArchiveEntry } from "./web/render.js";
import { renderFeed } from "./web/rss.js";

const cfg = loadConfig();
const { client, db } = await connect(cfg);
const digests = db.collection<DigestDoc>(COLLECTIONS.digests);
const site = { publicUrl: cfg.publicUrl };

const app = new Hono();

app.get("/healthz", (c) => c.text("ok"));

app.get("/", async (c) => {
  const now = new Date();
  const today = localDate(now, cfg.digestTimezone);
  const latest = await digests.findOne({}, { sort: { date: -1 } });
  if (!latest) {
    return c.html(renderMessage("No digest yet", "The first digest appears after the daily run (or pnpm demo).", site));
  }
  const note = latest.date === today ? undefined : `No digest for today yet. Showing the most recent one.`;
  return c.html(
    renderDigest(latest, {
      note,
      greeting: greeting(now, cfg.digestTimezone),
      meta: { ...site, path: "/", current: "today" },
    }),
  );
});

app.get("/archive", async (c) => {
  const list = await digests
    .find<ArchiveEntry>(
      {},
      { projection: { _id: 0, date: 1, demo: 1, stats: 1, "categories.category": 1 }, sort: { date: -1 }, limit: 90 },
    )
    .toArray();
  const feeds = await db
    .collection<PageDoc>(COLLECTIONS.pages)
    .find({ source: "instagram" }, { projection: { _id: 0, username: 1 }, sort: { username: 1 } })
    .toArray();
  return c.html(renderArchive(list, feeds.map((p) => p.username), site));
});

// RSS per Instagram page: /feeds/nasa.xml
app.get("/feeds/:file", async (c) => {
  const username = c.req.param("file").match(/^([A-Za-z0-9._]{1,30})\.xml$/)?.[1];
  if (!username) return c.html(renderMessage("Not found", "Feeds look like /feeds/username.xml."), 404);

  const posts = await db
    .collection<PostDoc>(COLLECTIONS.posts)
    .find({ username }, { sort: { postedAt: -1 }, limit: 50 })
    .toArray();
  if (!posts.length) return c.html(renderMessage("Not found", `No posts stored for @${username}.`), 404);

  // Render terminates TLS at its proxy, so trust x-forwarded-proto for the self link.
  const url = new URL(c.req.url);
  const proto = c.req.header("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.replace(":", "");
  const selfUrl = `${proto}://${url.host}${url.pathname}`;

  c.header("Content-Type", "application/rss+xml; charset=utf-8");
  c.header("Cache-Control", "public, max-age=900");
  return c.body(renderFeed({ username, selfUrl, posts }));
});

app.get("/digest/:date", async (c) => {
  const date = c.req.param("date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.html(renderMessage("Not found", "Dates look like 2026-10-23."), 404);
  }
  const digest = await digests.findOne({ date });
  if (!digest) return c.html(renderMessage("Not found", `No digest for ${date}.`, site), 404);
  return c.html(renderDigest(digest, { meta: { ...site, path: `/digest/${date}` } }));
});

app.notFound((c) => c.html(renderMessage("Not found", "That page doesn't exist.", site), 404));

app.onError((err, c) => {
  console.error(err);
  return c.html(renderMessage("Something went wrong", "Try again in a moment.", site), 500);
});

const port = Number(process.env.PORT ?? 3000);
const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`SlothScroll web listening on http://localhost:${info.port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close();
    void client.close().finally(() => process.exit(0));
  });
}
