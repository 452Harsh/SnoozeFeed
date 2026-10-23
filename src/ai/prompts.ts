// Gemma prompts. Each one asks for a small JSON object and validates the reply,
// so a bad answer degrades to a safe default instead of breaking the run.
import { CATEGORIES, type Category } from "../config.js";
import type { ScrapedPost, SkipReason } from "../types.js";
import type { ContentPart, GemmaClient } from "./client.js";

const SKIP_REASONS: SkipReason[] = ["ad", "repost", "giveaway"];

export async function categorizePage(
  ai: GemmaClient,
  username: string,
  captions: string[],
): Promise<Category> {
  const sample = captions.slice(0, 5).map((c, i) => `${i + 1}. ${c.slice(0, 300)}`).join("\n");
  const reply = await ai.json<{ category?: string }>(
    `You sort Instagram accounts into exactly one category.
Categories: ${CATEGORIES.join(", ")}.

Account: @${username}
Recent captions:
${sample || "(none)"}

Reply with JSON only: {"category": "<one of the categories>"}`,
  );
  return CATEGORIES.find((c) => c.toLowerCase() === reply.category?.trim().toLowerCase()) ?? "Other";
}

/** True when the caption is mostly emojis/hashtags/mentions and says little on its own. */
export function isWeakCaption(caption: string): boolean {
  const words = caption
    .replace(/[#@]\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
  return words.length < 4;
}

export interface GistResult {
  gist: string;
  skip?: SkipReason;
}

export async function gistPost(ai: GemmaClient, post: ScrapedPost): Promise<GistResult> {
  const weak = isWeakCaption(post.caption);
  const text = `You write a one-line gist of an Instagram post for a morning digest.

Account: @${post.username}
Post type: ${post.type}
Caption: ${post.caption || "(no caption)"}
${post.altText ? `Image alt text: ${post.altText}\n` : ""}${
    weak ? "The caption says little, so describe what the image shows.\n" : ""
  }
Rules:
- "gist": one plain sentence, max 20 words, no emojis or hashtags, no "this post".
- "skip": "ad" for paid promotions or discount codes, "giveaway" for contests/giveaways,
  "repost" for reshared content from another account, otherwise null.

Reply with JSON only: {"gist": "...", "skip": null}`;

  // Attach the image only for real http(s) URLs; fixtures use placeholder URLs.
  const prompt: string | ContentPart[] =
    weak && post.imageUrl?.startsWith("http") && !post.imageUrl.includes("example.com")
      ? [
          { type: "text", text },
          { type: "image_url", image_url: { url: post.imageUrl } },
        ]
      : text;

  const reply = await ai.json<{ gist?: string; skip?: string | null }>(prompt);
  const gist = reply.gist?.trim();
  if (!gist) throw new Error("Gemma reply had no gist");
  const skip = SKIP_REASONS.find((r) => r === reply.skip);
  return skip ? { gist, skip } : { gist };
}

export interface SummaryInput {
  id: string;
  username: string;
  gist: string;
}

export interface CategorySummary {
  summary: string;
  pickIds: string[];
}

export async function summarizeCategory(
  ai: GemmaClient,
  category: Category,
  posts: SummaryInput[],
): Promise<CategorySummary> {
  const list = posts.map((p) => `[${p.id}] @${p.username}: ${p.gist}`).join("\n");
  const reply = await ai.json<{ summary?: string; picks?: unknown }>(
    `You write the "${category}" section of a short morning digest of Instagram posts.

Posts from the last 24 hours:
${list}

Rules:
- "summary": 2-3 sentences on what happened across these posts. Plain, friendly, no emojis.
- "picks": ids of the 1-3 posts most worth opening, best first.

Reply with JSON only: {"summary": "...", "picks": ["p1"]}`,
  );
  const summary = reply.summary?.trim();
  if (!summary) throw new Error("Gemma reply had no summary");
  const valid = new Set(posts.map((p) => p.id));
  const pickIds = Array.isArray(reply.picks)
    ? [...new Set(reply.picks.map(String).filter((id) => valid.has(id)))].slice(0, 3)
    : [];
  return { summary, pickIds: pickIds.length ? pickIds : posts.slice(0, 1).map((p) => p.id) };
}
