// Web service: today's digest, archive, and past digests. Reads only.
// Run: pnpm dev (local) / pnpm start (Render)
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { loadConfig } from "./config.js";
import { COLLECTIONS, connect } from "./db.js";
import { localDate } from "./pipeline.js";
import type { DigestDoc } from "./types.js";
import { renderArchive, renderDigest, renderMessage } from "./web/render.js";

const cfg = loadConfig();
const { client, db } = await connect(cfg);
const digests = db.collection<DigestDoc>(COLLECTIONS.digests);

const app = new Hono();

app.get("/healthz", (c) => c.text("ok"));

app.get("/", async (c) => {
  const today = localDate(new Date(), cfg.digestTimezone);
  const latest = await digests.findOne({}, { sort: { date: -1 } });
  if (!latest) {
    return c.html(renderMessage("No digest yet", "The first digest appears after the daily run (or pnpm demo)."));
  }
  const note = latest.date === today ? undefined : `No digest for today yet. Showing the most recent one.`;
  return c.html(renderDigest(latest, { note }));
});

app.get("/archive", async (c) => {
  const list = await digests
    .find({}, { projection: { _id: 0, date: 1, demo: 1, stats: 1 }, sort: { date: -1 }, limit: 90 })
    .toArray();
  return c.html(renderArchive(list));
});

app.get("/digest/:date", async (c) => {
  const date = c.req.param("date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.html(renderMessage("Not found", "Dates look like 2026-10-23."), 404);
  }
  const digest = await digests.findOne({ date });
  if (!digest) return c.html(renderMessage("Not found", `No digest for ${date}.`), 404);
  return c.html(renderDigest(digest));
});

app.notFound((c) => c.html(renderMessage("Not found", "That page doesn't exist."), 404));

app.onError((err, c) => {
  console.error(err);
  return c.html(renderMessage("Something went wrong", "Try again in a moment."), 500);
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
