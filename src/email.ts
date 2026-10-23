// Optional email of the daily digest. Sends through Resend's REST API with fetch.
// Never throws: every outcome becomes an EmailResult that is logged and stored on the digest.
import type { Db } from "mongodb";
import type { Config } from "./config.js";
import { COLLECTIONS } from "./db.js";
import type { DigestDoc, EmailResult } from "./types.js";
import { esc, formatDate } from "./web/render.js";

const RESEND_URL = "https://api.resend.com/emails";
const TIMEOUT_MS = 15_000;

// Email clients ignore <style> and dark-mode CSS, so everything is inline and light-only.
const C = {
  bg: "#f4f1ec",
  card: "#ffffff",
  text: "#1d1b19",
  muted: "#6b6560",
  border: "#e8e3dc",
  accent: "#2f6f5e",
  accentSoft: "#e3f0ec",
  warn: "#9a5b13",
  warnSoft: "#fbefdc",
};
// Single quotes only: this goes inside style="..." attributes.
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
/** Longhand font properties; some clients (Outlook) mishandle the `font` shorthand. */
const font = (weight: number, size: number, lineHeight = 1.3) =>
  `font-family:${FONT};font-size:${size}px;font-weight:${weight};line-height:${lineHeight};`;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const safeHref = (u: string) => (/^https?:\/\//i.test(u) ? esc(u) : "#");

/** First sentence of a summary, capped, for the "1-line summary per category". */
export function firstSentence(text: string, max = 240): string {
  const s = text.trim().split(/(?<=[.!?])\s+/)[0] ?? "";
  const chars = Array.from(s); // code points, so emoji are never split
  if (chars.length <= max) return s;
  const cut = chars.slice(0, max - 1).join("");
  return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : cut.length).trimEnd()}…`;
}

export function emailSubject(d: DigestDoc): string {
  return `${d.demo ? "[demo] " : ""}SlothScroll · ${d.date} · ${plural(d.stats.posts, "post")}, ~${d.stats.minutesSaved} min saved`;
}

export function digestUrl(cfg: Pick<Config, "publicUrl">, d: Pick<DigestDoc, "date">): string | undefined {
  return cfg.publicUrl ? `${cfg.publicUrl}/digest/${d.date}` : undefined;
}

export function renderEmailHtml(d: DigestDoc, fullUrl?: string): string {
  const stats = `${plural(d.stats.pages, "page")} · ${plural(d.stats.posts, "post")} · ~${d.stats.minutesSaved} min of scrolling saved`;
  const preheader = d.categories.map((c) => c.category).join(" · ") || "Nothing new today";

  const categories = d.categories
    .map(
      (c) => `
<tr><td style="padding:0 0 12px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.card};border:1px solid ${C.border};border-radius:12px;">
    <tr><td style="padding:16px 18px 6px 18px;${font(600, 17, 1.3)};color:${C.text};">
      ${esc(c.category)} <span style="${font(400, 13)};color:${C.muted};">· ${plural(c.posts.length, "post")}</span>
    </td></tr>
    <tr><td style="padding:0 18px 10px 18px;${font(400, 15, 1.5)};color:${C.text};">${esc(firstSentence(c.summary))}</td></tr>
    ${c.picks
      .slice(0, 3)
      .map(
        (p) => `
    <tr><td style="padding:0 18px 8px 18px;">
      <a href="${safeHref(p.url)}" style="display:block;background:${C.accentSoft};border-radius:8px;padding:10px 12px;text-decoration:none;color:${C.text};${font(400, 14, 1.45)};">
        <span style="display:block;${font(600, 12)};color:${C.accent};">@${esc(p.username)}</span>${esc(p.gist)}
      </a>
    </td></tr>`,
      )
      .join("")}
    <tr><td style="padding:0 0 8px 0;font-size:0;line-height:0;">&nbsp;</td></tr>
  </table>
</td></tr>`,
    )
    .join("");

  const empty = d.categories.length
    ? ""
    : `<tr><td style="padding:0 0 12px 0;${font(400, 15)};color:${C.muted};">Nothing new in the last 24 hours. Enjoy the quiet.</td></tr>`;

  const extras = [
    d.skipped.length ? `${plural(d.skipped.length, "post")} skipped (ads, giveaways, reposts)` : "",
    d.failed.length ? `${plural(d.failed.length, "page")} failed: ${d.failed.map((f) => `@${esc(f.username)}`).join(", ")}` : "",
  ].filter(Boolean);

  const button = fullUrl
    ? `
<tr><td align="center" style="padding:8px 0 4px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="background:${C.accent};border-radius:10px;">
      <a href="${safeHref(fullUrl)}" style="display:inline-block;padding:13px 26px;${font(600, 15)};color:#ffffff;text-decoration:none;">View full digest</a>
    </td>
  </tr></table>
</td></tr>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(emailSubject(d))}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bg};">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};">
<tr><td align="center" style="padding:20px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
    <tr><td style="padding:0 0 4px 0;${font(700, 14)};color:${C.text};">Sloth<span style="color:${C.accent};">Scroll</span></td></tr>
    <tr><td style="padding:6px 0 4px 0;${font(700, 24, 1.25)};color:${C.text};">
      ${esc(formatDate(d.date))}${
        d.demo
          ? ` <span style="display:inline-block;vertical-align:middle;${font(600, 12)};background:${C.warnSoft};color:${C.warn};border-radius:999px;padding:2px 8px;">demo data</span>`
          : ""
      }
    </td></tr>
    <tr><td style="padding:0 0 16px 0;${font(400, 15)};color:${C.muted};">${esc(stats)}</td></tr>
    ${categories}${empty}
    ${extras.length ? `<tr><td style="padding:0 0 12px 0;${font(400, 13, 1.5)};color:${C.muted};">${extras.join("<br>")}</td></tr>` : ""}
    ${button}
    <tr><td align="center" style="padding:18px 0 0 0;${font(400, 12)};color:${C.muted};">Summaries by Gemma · posts from the last 24 hours</td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

export function renderEmailText(d: DigestDoc, fullUrl?: string): string {
  const lines = [
    `SlothScroll · ${formatDate(d.date)}${d.demo ? " (demo data)" : ""}`,
    `${plural(d.stats.pages, "page")} · ${plural(d.stats.posts, "post")} · ~${d.stats.minutesSaved} min of scrolling saved`,
    "",
  ];
  for (const c of d.categories) {
    lines.push(`${c.category.toUpperCase()}: ${firstSentence(c.summary)}`);
    for (const p of c.picks.slice(0, 3)) lines.push(`  - @${p.username}: ${p.gist}`, `    ${p.url}`);
    lines.push("");
  }
  if (d.skipped.length) lines.push(`${plural(d.skipped.length, "post")} skipped (ads, giveaways, reposts)`);
  if (d.failed.length) lines.push(`${plural(d.failed.length, "page")} failed: ${d.failed.map((f) => `@${f.username}`).join(", ")}`);
  if (fullUrl) lines.push("", `View full digest: ${fullUrl}`);
  return lines.join("\n");
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Sends the digest email. Returns the outcome; never throws. */
export async function sendDigestEmail(
  cfg: Config,
  d: DigestDoc,
  opts: { idempotencyKey?: string } = {},
): Promise<EmailResult> {
  const at = new Date();
  const { to, from, resendApiKey, smtp } = cfg.email;
  if (!to.length) return { status: "skipped", reason: "EMAIL_TO not set", at };
  if (!resendApiKey) {
    return smtp
      ? { status: "skipped", provider: "smtp", reason: "SMTP is configured but not supported yet (needs nodemailer)", at }
      : { status: "skipped", reason: "no provider: set RESEND_API_KEY (or SMTP_*)", at };
  }

  const fullUrl = digestUrl(cfg, d);
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${resendApiKey}`,
        "content-type": "application/json",
        // Stops a retried cron run from sending the same day's email twice.
        ...(opts.idempotencyKey ? { "idempotency-key": opts.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from,
        to,
        subject: emailSubject(d),
        html: renderEmailHtml(d, fullUrl),
        text: renderEmailText(d, fullUrl),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!res.ok) {
      return { status: "failed", provider: "resend", reason: `HTTP ${res.status}: ${(body.message ?? body.name ?? "").slice(0, 300)}`, at };
    }
    return { status: "sent", provider: "resend", id: body.id, at };
  } catch (err) {
    return { status: "failed", provider: "resend", reason: errorMessage(err), at };
  }
}

/** Sends (or skips) the email, logs the outcome and records it on the saved digest. Never throws. */
export async function deliverDigest(
  cfg: Config,
  db: Db,
  d: DigestDoc,
  opts: { saved: boolean; idempotencyKey?: string; log?: (msg: string) => void },
): Promise<EmailResult> {
  const log = opts.log ?? console.log;
  let result: EmailResult;
  try {
    result = await sendDigestEmail(cfg, d, { idempotencyKey: opts.idempotencyKey });
  } catch (err) {
    result = { status: "failed", reason: errorMessage(err), at: new Date() };
  }

  if (result.status === "sent") log(`✓ email sent to ${cfg.email.to.length} recipient(s) via ${result.provider} (id ${result.id ?? "?"})`);
  else if (result.status === "skipped") log(`email skipped: ${result.reason}`);
  else log(`! email failed: ${result.reason}`);
  if (!cfg.publicUrl && result.status === "sent") log(`! PUBLIC_URL not set: email has no "View full digest" button`);

  if (opts.saved) {
    try {
      await db.collection<DigestDoc>(COLLECTIONS.digests).updateOne({ date: d.date }, { $set: { email: result } });
    } catch (err) {
      log(`! could not record email result: ${errorMessage(err)}`);
    }
  }
  return result;
}
