// Creates collections and indexes. Safe to re-run.
// Run: pnpm db:setup
import { loadConfig } from "../src/config.js";
import { COLLECTIONS, INDEXES, connect } from "../src/db.js";

const cfg = loadConfig();
const { client, db } = await connect(cfg);

try {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));

  for (const [key, name] of Object.entries(COLLECTIONS) as [keyof typeof COLLECTIONS, string][]) {
    if (!existing.has(name)) {
      await db.createCollection(name);
      console.log(`created collection ${name}`);
    }
    const created = await db.collection(name).createIndexes(INDEXES[key]);
    console.log(`${name}: indexes ${created.join(", ")}`);
  }

  console.log(`done (db: ${cfg.mongo.db})`);
} finally {
  await client.close();
}
