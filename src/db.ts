import { MongoClient, type Db, type IndexDescription } from "mongodb";
import type { Config } from "./config.js";

export const COLLECTIONS = {
  pages: "pages",
  posts: "posts",
  digests: "digests",
} as const;

export const INDEXES: Record<keyof typeof COLLECTIONS, IndexDescription[]> = {
  pages: [{ key: { username: 1 }, name: "username_unique", unique: true }],
  posts: [
    // Dedupe across runs: the same Instagram post is stored once.
    { key: { url: 1 }, name: "url_unique", unique: true },
    { key: { username: 1, postedAt: -1 }, name: "username_postedAt" },
    { key: { digestDate: 1 }, name: "digestDate" },
  ],
  // One digest per day, in DIGEST_TIMEZONE, as YYYY-MM-DD.
  digests: [{ key: { date: 1 }, name: "date_unique", unique: true }],
};

export async function connect(cfg: Config): Promise<{ client: MongoClient; db: Db }> {
  const client = new MongoClient(cfg.mongo.uri, { appName: "slothscroll" });
  await client.connect();
  return { client, db: client.db(cfg.mongo.db) };
}
