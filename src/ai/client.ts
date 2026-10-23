// Minimal OpenAI-compatible chat client for Gemma (hosted endpoint or Ollama).
// Uses fetch so there is no SDK dependency.
import type { Config } from "../config.js";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface GemmaClient {
  model: string;
  /** Sends one user turn and parses a JSON object from the reply. */
  json<T>(prompt: string | ContentPart[]): Promise<T>;
}

const TIMEOUT_MS = 90_000;

export function createGemmaClient(cfg: Config): GemmaClient {
  const { baseUrl, apiKey, model, reasoningEffort } = cfg.ai;
  if (!baseUrl) throw new Error("AI_BASE_URL is not set");
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

  async function complete(content: string | ContentPart[]): Promise<string> {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      // Instructions go in the user turn: Gemma chat templates don't all support a system role.
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [{ role: "user", content }],
        // Provider-specific; Google AI Studio accepts "minimal" for Gemma 4 (skips the <thought> block).
        ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      throw new Error(`Gemma request failed: HTTP ${res.status} ${body}`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("Gemma returned an empty reply");
    return text;
  }

  return {
    model,
    async json<T>(prompt: string | ContentPart[]): Promise<T> {
      // One retry covers the occasional malformed JSON reply.
      let lastError: unknown;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          return extractJson<T>(await complete(prompt));
        } catch (err) {
          lastError = err;
        }
      }
      throw lastError;
    },
  };
}

/**
 * Pulls the answer object out of a reply. Gemma 4 may emit inline reasoning
 * (<thought>...</thought>) that itself contains example JSON, so the reasoning
 * is dropped and the last balanced, parseable {...} wins.
 */
export function extractJson<T>(text: string): T {
  const answer = text.replace(/<(thought|think)>[\s\S]*?<\/\1>/gi, "").replace(/^[\s\S]*<\/(thought|think)>/i, "");
  const candidates = balancedObjects(answer);
  for (let i = candidates.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(candidates[i]!) as T;
    } catch {
      // try the previous candidate
    }
  }
  throw new Error("No JSON object in Gemma reply");
}

/** Top-level {...} spans, skipping braces inside JSON strings. */
function balancedObjects(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"' && depth > 0) {
      inString = true;
    } else if (ch === "{") {
      if (depth++ === 0) start = i;
    } else if (ch === "}" && depth > 0) {
      if (--depth === 0) out.push(text.slice(start, i + 1));
    }
  }
  return out;
}
