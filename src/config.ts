// Typed config loaded from process.env. Env files are loaded by Node's
// --env-file flag (see package.json scripts), not by this module.
// Values are never logged; errors name missing variables only.

export const CATEGORIES = [
  "News",
  "Tech",
  "Food",
  "Fitness",
  "Finance",
  "Entertainment",
  "Memes",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Config {
  mongo: { uri: string; db: string };
  browserbase: { apiKey?: string; projectId?: string; contextId?: string };
  ai: { provider: string; baseUrl?: string; model: string; apiKey?: string };
  embed: { provider: string; model: string; apiKey?: string };
  elevenlabs: { apiKey?: string };
  email: {
    to?: string;
    resendApiKey?: string;
    smtp?: { host: string; port: number; user?: string; pass?: string };
  };
  digestTimezone: string;
}

export class ConfigError extends Error {
  constructor(missing: string[], feature: string) {
    super(`Missing env vars for ${feature}: ${missing.join(", ")}`);
    this.name = "ConfigError";
  }
}

function opt(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

function requireVars(names: string[], feature: string): void {
  const missing = names.filter((n) => !opt(n));
  if (missing.length) throw new ConfigError(missing, feature);
}

function parsePort(name: string): number {
  const raw = opt(name)!;
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`${name} must be a valid port number`);
  }
  return port;
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Loads config. Only MongoDB is required everywhere; other features are checked by the require* helpers. */
export function loadConfig(): Config {
  requireVars(["MONGODB_URI"], "MongoDB");

  const digestTimezone = opt("DIGEST_TIMEZONE") ?? "UTC";
  if (!isValidTimezone(digestTimezone)) {
    throw new Error(`DIGEST_TIMEZONE is not a valid IANA timezone`);
  }

  const smtpHost = opt("SMTP_HOST");

  return {
    mongo: { uri: opt("MONGODB_URI")!, db: opt("MONGODB_DB") ?? "slothscroll" },
    browserbase: {
      apiKey: opt("BROWSERBASE_API_KEY"),
      projectId: opt("BROWSERBASE_PROJECT_ID"),
      contextId: opt("BROWSERBASE_CONTEXT_ID"),
    },
    ai: {
      provider: opt("AI_PROVIDER") ?? "openai-compatible",
      baseUrl: opt("AI_BASE_URL"),
      model: opt("AI_MODEL") ?? "gemma-4-26b-a4b-it",
      apiKey: opt("AI_API_KEY"),
    },
    embed: {
      provider: opt("AI_EMBED_PROVIDER") ?? "huggingface",
      model: opt("AI_EMBED_MODEL") ?? "google/embeddinggemma-300m",
      apiKey: opt("AI_EMBED_API_KEY"),
    },
    elevenlabs: { apiKey: opt("ELEVENLABS_API_KEY") },
    email: {
      to: opt("EMAIL_TO"),
      resendApiKey: opt("RESEND_API_KEY"),
      smtp: smtpHost
        ? {
            host: smtpHost,
            port: opt("SMTP_PORT") ? parsePort("SMTP_PORT") : 587,
            user: opt("SMTP_USER"),
            pass: opt("SMTP_PASS"),
          }
        : undefined,
    },
    digestTimezone,
  };
}

/** Call before scraping. The context ID is optional (needed only for logged-in sessions). */
export function requireBrowserbase(): void {
  requireVars(["BROWSERBASE_API_KEY", "BROWSERBASE_PROJECT_ID"], "Browserbase");
}

/** Call before Gemma calls. Ollama doesn't need a key, so only the base URL is required. */
export function requireAi(): void {
  requireVars(["AI_BASE_URL"], "Gemma (AI)");
}

/** Call before embedding calls. */
export function requireEmbeddings(): void {
  requireVars(["AI_EMBED_API_KEY"], "EmbeddingGemma");
}

export const audioEnabled = (c: Config): boolean => Boolean(c.elevenlabs.apiKey);

export const emailEnabled = (c: Config): boolean =>
  Boolean(c.email.to && (c.email.resendApiKey || c.email.smtp));
