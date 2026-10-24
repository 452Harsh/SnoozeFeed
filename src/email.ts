// Optional email of the daily digest. Sends through Resend's REST API with fetch.
// Never throws: every outcome becomes an EmailResult that is logged and stored on the digest.
import type { Db } from "mongodb";
import type { Config } from "./config.js";
import { COLLECTIONS } from "./db.js";
import type { DigestDoc, EmailResult } from "./types.js";
import { clean, esc, formatDate, greeting, sectionTitle } from "./web/render.js";

const RESEND_URL = "https://api.resend.com/emails";
const TIMEOUT_MS = 15_000;
const SECONDS_PER_POST = 8;

// Email clients drop most CSS and web fonts: layout is tables with inline styles, light-only,
// with Georgia standing in for the website's serif. Colours match the website.
const C = {
  bg: "#F8F6F0",
  paper: "#FFFFFF",
  ink: "#242820",
  ink2: "#3B4036",
  muted: "#656D61",
  rule: "#E5E1D8",
  ruleStrong: "#CDC8BB",
  accent: "#526B4D",
  sage: "#EBF0E5",
  sageInk: "#3E5438",
};
// Single quotes only: these go inside style="..." attributes.
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', Times, serif";
/** Longhand font properties; some clients (Outlook) mishandle the `font` shorthand. */
const font = (family: string, weight: number, size: number, lineHeight: number) =>
  `font-family:${family};font-size:${size}px;font-weight:${weight};line-height:${lineHeight};`;
const sans = (weight: number, size: number, lineHeight = 1.4) => font(SANS, weight, size, lineHeight);
const serif = (weight: number, size: number, lineHeight = 1.4) => font(SERIF, weight, size, lineHeight);
const eyebrow = (color = C.muted) => `${sans(600, 11, 1.4)}letter-spacing:1.5px;text-transform:uppercase;color:${color};`;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const safeHref = (u: string) => (/^https?:\/\//i.test(u) ? esc(u) : "#");

/** Caps text at a word boundary without splitting emoji. */
function cap(text: string, max: number): string {
  const chars = Array.from(text.trim());
  if (chars.length <= max) return text.trim();
  const cut = chars.slice(0, max - 1).join("");
  return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : cut.length).trimEnd()}…`;
}

/** First sentence of a summary, capped. */
export function firstSentence(text: string, max = 240): string {
  return cap(text.trim().split(/(?<=[.!?])\s+/)[0] ?? "", max);
}

export interface EmailOptions {
  /** DIGEST_TIMEZONE, for the greeting and post times. */
  timeZone?: string;
  now?: Date;
}

/** "Other" is a catch-all, so it never leads (same order as the website). */
const ordered = (d: DigestDoc) =>
  [...d.categories].sort((a, b) => Number(a.category === "Other") - Number(b.category === "Other"));

function savedLabel(stats: DigestDoc["stats"]): { value: number; unit: string } {
  return stats.minutesSaved >= 1 ? { value: stats.minutesSaved, unit: "min" } : { value: stats.posts * SECONDS_PER_POST, unit: "sec" };
}

const shortDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

function postedTime(at: Date | string | undefined, timeZone: string): string | undefined {
  if (!at) return undefined;
  const d = new Date(at);
  return Number.isNaN(d.getTime())
    ? undefined
    : d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone });
}

export function emailSubject(d: DigestDoc): string {
  const saved = savedLabel(d.stats);
  const topics = ordered(d).slice(0, 3).map((c) => c.category).join(", ");
  return `${d.demo ? "[demo] " : ""}SlothScroll · ${shortDate(d.date)}${topics ? ` · ${topics}` : ""} · ~${saved.value} ${saved.unit} saved`;
}

export function digestUrl(cfg: Pick<Config, "publicUrl">, d: Pick<DigestDoc, "date">): string | undefined {
  return cfg.publicUrl ? `${cfg.publicUrl}/digest/${d.date}` : undefined;
}

export function renderEmailHtml(d: DigestDoc, fullUrl?: string, opts: EmailOptions = {}): string {
  const tz = opts.timeZone ?? "UTC";
  const cats = ordered(d);
  const saved = savedLabel(d.stats);
  const siteUrl = fullUrl?.replace(/\/digest\/[^/]*$/, "");
  const lead = cats[0]?.picks[0] ?? cats[0]?.posts[0];
  const preheader = lead ? `${clean(lead.gist)} · ${cats.map((c) => c.category).join(", ")}` : "Nothing new in the last 24 hours.";

  const byline = (p: { username: string; postedAt?: Date | string }) => {
    const t = postedTime(p.postedAt, tz);
    return `<span style="${sans(600, 12)}color:${C.ink};">@${esc(p.username)}</span>${t ? `<span style="${sans(400, 12)}color:${C.muted};">&nbsp;·&nbsp;${esc(t)}</span>` : ""}`;
  };

  const stat = (value: string, label: string, first = false) => `
      <td width="33%" valign="top" style="padding:12px 0 0 ${first ? 0 : 14}px;border-top:1px solid ${C.ruleStrong};">
        <div style="${serif(400, 30, 1)}color:${C.ink};">${value}</div>
        <div style="padding-top:6px;${eyebrow()}">${label}</div>
      </td>`;

  const topics = cats
    .map((c) => {
      const featured = c.picks.length ? c.picks.slice(0, 3) : c.posts.slice(0, 1);
      const [top, ...others] = featured;
      const extra = c.posts.length - featured.length;
      const slug = c.category.toLowerCase();
      return `
    <tr><td style="padding:30px 0 0 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="padding:14px 0 0 0;border-top:2px solid ${C.ink};${eyebrow(C.accent)}">${esc(c.category)}<span style="color:${C.muted};font-weight:500;"> &nbsp;·&nbsp; ${plural(c.posts.length, "post")}</span></td></tr>
        <tr><td style="padding:6px 0 0 0;${serif(400, 24, 1.2)}color:${C.ink};">${esc(sectionTitle(c.category))}</td></tr>
        <tr><td style="padding:8px 0 0 0;${serif(400, 16, 1.6)}color:${C.ink2};">${esc(cap(clean(c.summary), 360))}</td></tr>
        ${
          top
            ? `<tr><td style="padding:16px 0 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};border-left:3px solid ${C.accent};border-radius:0 8px 8px 0;">
            <tr><td style="padding:14px 16px 4px 16px;">${c.picks.length ? `<span style="${eyebrow(C.accent)}">Worth your time</span><br>` : ""}${byline(top)}</td></tr>
            <tr><td style="padding:2px 16px 0 16px;"><a href="${safeHref(top.url)}" style="${serif(400, 19, 1.35)}color:${C.ink};text-decoration:none;">${esc(clean(top.gist))}</a></td></tr>
            <tr><td style="padding:8px 16px 14px 16px;"><a href="${safeHref(top.url)}" style="${sans(600, 13)}color:${C.accent};text-decoration:none;">Open post &rarr;</a></td></tr>
          </table>
        </td></tr>`
            : ""
        }
        ${others
          .map(
            (p) => `
        <tr><td style="padding:12px 0 12px 0;border-bottom:1px solid ${C.rule};">
          <div>${byline(p)}</div>
          <div style="padding-top:3px;"><a href="${safeHref(p.url)}" style="${serif(400, 16, 1.45)}color:${C.ink};text-decoration:none;">${esc(clean(p.gist))}</a></div>
        </td></tr>`,
          )
          .join("")}
        ${
          extra > 0 && fullUrl
            ? `<tr><td style="padding:12px 0 0 0;"><a href="${safeHref(`${fullUrl}#topic-${slug}`)}" style="${sans(600, 13)}color:${C.accent};text-decoration:none;">+ ${plural(extra, "more post")} in ${esc(c.category)} &rarr;</a></td></tr>`
            : ""
        }
      </table>
    </td></tr>`;
    })
    .join("");

  const empty = cats.length
    ? ""
    : `<tr><td style="padding:28px 0 0 0;${serif(400, 18, 1.5)}color:${C.ink2};">Nothing new in the last 24 hours. Enjoy the quiet.</td></tr>`;

  const quietParts = [
    d.skipped.length ? `${plural(d.skipped.length, "post")} skipped (ads, reposts, giveaways)` : "",
    d.failed.length ? `couldn't read ${d.failed.map((f) => `@${esc(f.username)}`).join(", ")}` : "",
  ].filter(Boolean);
  const quiet = quietParts.length
    ? `<tr><td style="padding:28px 0 0 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};border-radius:8px;">
        <tr><td style="padding:12px 16px;${sans(400, 13, 1.5)}color:${C.muted};"><span style="font-weight:600;color:${C.ink2};">Skipped &amp; unavailable:</span> ${quietParts.join(" · ")}</td></tr>
      </table>
    </td></tr>`
    : "";

  const button = fullUrl
    ? `<tr><td align="center" style="padding:32px 0 4px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="background:${C.accent};border-radius:999px;">
          <a href="${safeHref(fullUrl)}" style="display:inline-block;padding:14px 30px;${sans(600, 15, 1)}color:#ffffff;text-decoration:none;">Read the full edition &rarr;</a>
        </td>
      </tr></table>
    </td></tr>`
    : "";

  const topicLine = cats.length
    ? `<tr><td style="padding:18px 0 0 0;${sans(400, 14, 1.6)}color:${C.muted};">In this edition: ${cats
        .map((c) => `<span style="color:${C.ink};font-weight:600;">${esc(c.category)}</span>&nbsp;${c.posts.length}`)
        .join(" &nbsp;·&nbsp; ")}</td></tr>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(emailSubject(d))}</title>
<style>
  @media (max-width: 480px) {
    .paper { padding: 24px 18px !important; }
    .greeting { font-size: 32px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bg};">${esc(cap(preheader, 140))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};">
<tr><td align="center" style="padding:24px 12px 32px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
    <tr><td style="padding:0 4px 14px 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="${serif(700, 20, 1)}color:${C.ink};">Sloth<span style="font-style:italic;font-weight:400;color:${C.accent};">Scroll</span></td>
        <td align="right" style="${eyebrow()}">Daily edition</td>
      </tr></table>
    </td></tr>
    <tr><td class="paper" style="background:${C.paper};border:1px solid ${C.rule};border-radius:12px;padding:32px 32px 28px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="${eyebrow()}">${esc(formatDate(d.date))}${
          d.demo ? ` &nbsp;<span style="background:${C.sage};color:${C.sageInk};border-radius:999px;padding:2px 8px;letter-spacing:1px;">Demo data</span>` : ""
        }</td></tr>
        <tr><td class="greeting" style="padding:10px 0 0 0;${serif(400, 38, 1.1)}color:${C.ink};letter-spacing:-0.5px;">${esc(greeting(opts.now ?? new Date(), tz))}.</td></tr>
        <tr><td style="padding:6px 0 0 0;${serif(400, 20, 1.3)}font-style:italic;color:${C.accent};">Your world, caught up.</td></tr>
        <tr><td style="padding:24px 0 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${stat(
            `~${saved.value}<span style="${serif(400, 15, 1)}">&nbsp;${esc(saved.unit)}</span>`,
            "scrolling saved",
            true,
          )}${stat(String(d.stats.posts), "posts")}${stat(String(d.stats.pages), "pages")}
          </tr></table>
        </td></tr>
        ${topicLine}
        ${topics}${empty}
        ${quiet}
        ${button}
      </table>
    </td></tr>
    <tr><td align="center" style="padding:20px 8px 0 8px;${sans(400, 12, 1.6)}color:${C.muted};">
      Made slowly with Gemma &nbsp;·&nbsp; posts from the last 24 hours${
        siteUrl ? `<br><a href="${safeHref(`${siteUrl}/archive`)}" style="color:${C.muted};">Past editions</a>` : ""
      }
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

export function renderEmailText(d: DigestDoc, fullUrl?: string, opts: EmailOptions = {}): string {
  const tz = opts.timeZone ?? "UTC";
  const saved = savedLabel(d.stats);
  const lines = [
    `SlothScroll · ${formatDate(d.date)}${d.demo ? " (demo data)" : ""}`,
    `${greeting(opts.now ?? new Date(), tz)}. Your world, caught up.`,
    `~${saved.value} ${saved.unit} of scrolling saved · ${plural(d.stats.posts, "post")} · ${plural(d.stats.pages, "page")}`,
    "",
  ];
  for (const c of ordered(d)) {
    lines.push(`${c.category.toUpperCase()} · ${sectionTitle(c.category)}`, clean(c.summary));
    const featured = c.picks.length ? c.picks.slice(0, 3) : c.posts.slice(0, 1);
    for (const p of featured) lines.push(`  - @${p.username}: ${clean(p.gist)}`, `    ${p.url}`);
    lines.push("");
  }
  if (!d.categories.length) lines.push("Nothing new in the last 24 hours. Enjoy the quiet.", "");
  if (d.skipped.length) lines.push(`${plural(d.skipped.length, "post")} skipped (ads, reposts, giveaways)`);
  if (d.failed.length) lines.push(`Couldn't read: ${d.failed.map((f) => `@${f.username}`).join(", ")}`);
  if (fullUrl) lines.push("", `Read the full edition: ${fullUrl}`);
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
        html: renderEmailHtml(d, fullUrl, { timeZone: cfg.digestTimezone }),
        text: renderEmailText(d, fullUrl, { timeZone: cfg.digestTimezone }),
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
