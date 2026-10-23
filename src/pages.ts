// Loads and validates pages.yaml: a list of { username, category? }.
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { CATEGORIES } from "./config.js";
import type { PageInput } from "./types.js";

const USERNAME = /^[A-Za-z0-9._]{1,30}$/;

export async function loadPages(path = process.env.PAGES_FILE ?? "pages.yaml"): Promise<PageInput[]> {
  const raw: unknown = parse(await readFile(path, "utf8"));
  if (!Array.isArray(raw)) throw new Error(`${path}: expected a list of { username, category? }`);

  const seen = new Set<string>();
  return raw.map((entry, i) => {
    const item = typeof entry === "string" ? { username: entry } : (entry as Record<string, unknown>);
    const username = String(item?.username ?? "").replace(/^@/, "").trim();
    if (!USERNAME.test(username)) throw new Error(`${path}[${i}]: invalid username "${username}"`);
    if (seen.has(username.toLowerCase())) throw new Error(`${path}[${i}]: duplicate username "${username}"`);
    seen.add(username.toLowerCase());

    if (item.category == null) return { username };
    const category = CATEGORIES.find((c) => c.toLowerCase() === String(item.category).trim().toLowerCase());
    if (!category) {
      throw new Error(`${path}[${i}]: category "${String(item.category)}" must be one of ${CATEGORIES.join(", ")}`);
    }
    return { username, category };
  });
}
