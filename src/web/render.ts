// Server-rendered HTML for the digest pages: an editorial "morning paper" design.
// No framework, no build step. Small inline JS only enhances (theme toggle, active
// topic tab, hiding images that fail to load); every page works without it.
// All dynamic text goes through esc(), all hrefs and image sources through safeUrl().
import { CATEGORIES } from "../config.js";
import type { DigestDoc, DigestPick, PostType, SkipReason } from "../types.js";

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

/** Only http(s) links are rendered as hrefs. */
const safeUrl = (u: string): string => (/^https?:\/\//i.test(u) ? esc(u) : "#");

const MANAGE_PAGES_URL = "https://github.com/452Harsh/SnoozeFeed/blob/SlothScroll/pages.yaml";
const SECONDS_PER_POST = 8;

export function formatDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const dateParts = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`);
  const f = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", { ...o, timeZone: "UTC" });
  return {
    weekday: f({ weekday: "short" }),
    day: f({ day: "numeric" }),
    month: f({ month: "long" }),
    year: f({ year: "numeric" }),
    /** "Saturday, October 24" */
    long: f({ weekday: "long", month: "long", day: "numeric" }),
    /** "Sat, Oct 24" */
    short: f({ weekday: "short", month: "short", day: "numeric" }),
  };
};

/** Drops replacement characters and half-cut emoji (lone surrogates) left by truncated captions. */
const clean = (s: string): string => s.replace(/\uFFFD|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "").trim();

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;

export function statsLine(d: Pick<DigestDoc, "stats">): string {
  const { pages, posts, minutesSaved } = d.stats;
  return `${plural(pages, "page")} · ${plural(posts, "post")} · ~${minutesSaved} min of scrolling saved`;
}

/** Saved-time figure: minutes when there's at least one, otherwise seconds (never "~0 min"). */
function savedAmount(stats: DigestDoc["stats"]): { value: number; unit: string } {
  return stats.minutesSaved >= 1
    ? { value: stats.minutesSaved, unit: "min" }
    : { value: stats.posts * SECONDS_PER_POST, unit: "sec" };
}

/** "Good morning" / "Good afternoon" / "Good evening" in the digest's timezone. */
export function greeting(now: Date, timeZone: string): string {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(now));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/** "Sat 7:40 AM" in the digest's timezone, or nothing for older digests without a timestamp. */
function postedTime(at: Date | string | undefined, timeZone: string): { iso: string; label: string } | undefined {
  if (!at) return undefined;
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return undefined;
  const label = d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone });
  return { iso: d.toISOString(), label };
}

const TYPE_LABELS: Partial<Record<PostType, string>> = { reel: "Reel", video: "Video", carousel: "Carousel" };

const SKIP_LABELS: Record<SkipReason, string> = { ad: "Ad", repost: "Repost", giveaway: "Giveaway" };

/** Section headlines: fixed editorial copy per category, never generated. */
const SECTION_TITLES: Record<string, string> = {
  news: "Across the world today",
  sports: "On the field",
  science: "Science and discovery",
  tech: "From the world of tech",
  food: "On the table",
  fitness: "Moving well",
  finance: "Money matters",
  entertainment: "On screen and stage",
  memes: "The lighter side",
  other: "Everything else",
};

/** Scraper errors can be technical; visitors get a short, plain explanation. */
function friendlyError(error: string): string {
  if (/private/i.test(error)) return "Private account. SlothScroll only reads public pages.";
  if (/not found|unavailable|doesn'?t exist/i.test(error)) return "Page not found or no longer available.";
  if (/login|log in|blocked|challenge|rate.?limit|429/i.test(error)) return "Instagram asked for a login, so this page was left alone today.";
  if (/no posts/i.test(error)) return "No posts were visible on the page.";
  return "Couldn't be loaded today.";
}

/* ---------- Icons (inline SVG, decorative: aria-hidden) ---------- */

const svg = (body: string, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

const ARROW_OUT = svg('<path d="M7 17 17 7M9 7h8v8"/>', 16);
const ARROW_LEFT = svg('<path d="M19 12H5M11 6l-6 6 6 6"/>', 16);
const ARROW_RIGHT = svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 16);
const CHEVRON = svg('<path d="m9 6 6 6-6 6"/>', 16);
const SUN = svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', 18);
const MOON = svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>', 18);
const RSS_ICON = svg('<path d="M5 11a8 8 0 0 1 8 8M5 5a14 14 0 0 1 14 14"/><circle cx="6" cy="18" r="1.2" fill="currentColor"/>', 16);

/** Sleepy sloth mark. Fixed colours so it reads on both themes. */
function slothMark(size: number): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
<circle cx="16" cy="16" r="15" fill="#A88A6A"/>
<ellipse cx="16" cy="18" rx="11.5" ry="9.5" fill="#F3E9DA"/>
<ellipse cx="10.6" cy="16.4" rx="4" ry="2.7" fill="#5A4433" transform="rotate(-18 10.6 16.4)"/>
<ellipse cx="21.4" cy="16.4" rx="4" ry="2.7" fill="#5A4433" transform="rotate(18 21.4 16.4)"/>
<path d="M9.2 16.6q1.5 1 3 0M19.8 16.6q1.5 1 3 0" stroke="#F3E9DA" stroke-width="1.1" fill="none" stroke-linecap="round"/>
<ellipse cx="16" cy="20.3" rx="1.7" ry="1.15" fill="#3A2C20"/>
<path d="M13.6 23.2q2.4 1.6 4.8 0" stroke="#3A2C20" stroke-width="1.15" fill="none" stroke-linecap="round"/>
</svg>`;
}

const FAVICON = `data:image/svg+xml,${encodeURIComponent(slothMark(32).replace(/\s*aria-hidden="true" focusable="false"/, ' xmlns="http://www.w3.org/2000/svg"'))}`;

/** Category → id slug from the fixed list (anything unknown is "other"). */
const catSlug = (category: string): string => {
  const known = CATEGORIES.find((c) => c.toLowerCase() === category.toLowerCase());
  return (known ?? "Other").toLowerCase();
};

/** Typographic avatar: the account's first letter. Instagram profile photos are never hotlinked. */
function avatar(username: string): string {
  const letter = (username.match(/[A-Za-z0-9]/)?.[0] ?? "?").toUpperCase();
  return `<span class="avatar" aria-hidden="true">${esc(letter)}</span>`;
}

/* ---------- Styles ---------- */

const DARK_TOKENS = `
  color-scheme: dark;
  --bg: #161915; --surface: #1D211C; --surface-2: #252A23; --ink: #ECE9E0; --ink-2: #D2D2C7; --muted: #A1A897;
  --rule: #2D332B; --rule-strong: #3E463B; --accent: #A6BF9E; --accent-ink: #141812; --sage: #222B20; --sage-ink: #C6D8BF;
  --shadow: 0 1px 2px rgb(0 0 0 / .3), 0 10px 28px rgb(0 0 0 / .28);`;

const CSS = `
:root {
  color-scheme: light;
  interpolate-size: allow-keywords;
  --bg: #F8F6F0; --surface: #FFFFFF; --surface-2: #F1EEE6; --ink: #242820; --ink-2: #3B4036; --muted: #656D61;
  --rule: #E5E1D8; --rule-strong: #CDC8BB; --accent: #526B4D; --accent-ink: #FFFFFF; --sage: #EBF0E5; --sage-ink: #3E5438;
  --shadow: 0 1px 2px rgb(36 40 32 / .04), 0 10px 28px rgb(36 40 32 / .07);

  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 20px; --s-6: 24px; --s-8: 32px; --s-10: 40px; --s-12: 48px; --s-16: 64px;
  --r-sm: 4px; --r-md: 8px; --r-lg: 12px; --r-pill: 999px;
  --t-xs: .75rem; --t-sm: .875rem; --t-base: 1rem; --t-md: 1.125rem; --t-lg: 1.3125rem;
  --t-xl: clamp(1.5rem, 1.25rem + 1.1vw, 2rem);
  --t-2xl: clamp(2.75rem, 1.9rem + 4.2vw, 4.5rem);
  --serif: "Newsreader", Georgia, "Times New Roman", serif;
  --sans: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --ease: cubic-bezier(.2, .7, .2, 1);
  --container: 1080px;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {${DARK_TOKENS}} }
:root[data-theme="dark"] {${DARK_TOKENS}}

*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
body {
  margin: 0; background: var(--bg); color: var(--ink);
  font: 400 var(--t-base)/1.6 var(--sans); font-feature-settings: "cv11", "ss01";
  -webkit-font-smoothing: antialiased; overflow-x: hidden;
  transition: background-color .2s, color .2s;
}
a { color: inherit; }
img { max-width: 100%; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: var(--r-sm); }
.wrap { max-width: var(--container); margin: 0 auto; padding-inline: var(--s-4); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.skip { position: absolute; left: var(--s-4); top: -60px; background: var(--accent); color: var(--accent-ink); padding: var(--s-2) var(--s-4); border-radius: var(--r-md); z-index: 30; text-decoration: none; font-weight: 600; }
.skip:focus { top: var(--s-2); }
.num { font-variant-numeric: tabular-nums lining-nums; }
.eyebrow { margin: 0; font: 600 var(--t-xs)/1.4 var(--sans); letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }

/* Masthead */
.masthead { border-bottom: 1px solid var(--rule); }
.masthead .wrap { display: flex; align-items: center; gap: var(--s-4); min-height: 64px; }
.brand { display: inline-flex; align-items: center; gap: 10px; flex: none; text-decoration: none; color: var(--ink); font: 600 1.3125rem/1 var(--serif); letter-spacing: -.015em; padding: var(--s-2) 0; }
.brand i { font-style: italic; font-weight: 400; color: var(--accent); }
.edition { display: none; padding-left: var(--s-4); border-left: 1px solid var(--rule); font: 500 var(--t-xs)/1.2 var(--sans); letter-spacing: .14em; text-transform: uppercase; color: var(--muted); white-space: nowrap; }
.nav { margin-left: auto; display: flex; align-items: center; gap: 2px; }
.nav a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 var(--s-3); border-radius: var(--r-md); text-decoration: none; font: 500 var(--t-sm)/1 var(--sans); color: var(--muted); transition: color .15s, background-color .15s; }
.nav a:hover { color: var(--ink); background: var(--surface-2); }
.nav a[aria-current="page"] { color: var(--ink); text-decoration: underline; text-decoration-color: var(--accent); text-decoration-thickness: 2px; text-underline-offset: 8px; }
.icon-btn { display: inline-grid; place-items: center; width: 44px; height: 44px; margin-left: var(--s-1); border: 0; border-radius: var(--r-pill); background: transparent; color: var(--muted); cursor: pointer; transition: color .15s, background-color .15s; }
.icon-btn:hover { color: var(--ink); background: var(--surface-2); }
.icon-btn .moon { display: none; }
.icon-btn[data-mode="light"] .sun { display: none; }
.icon-btn[data-mode="light"] .moon { display: block; }

/* Morning introduction */
.intro { display: grid; gap: var(--s-4); padding-block: var(--s-6) var(--s-5); }
.greeting { margin: var(--s-2) 0 0; font: 400 clamp(2rem, 1.6rem + 2vw, 3rem)/1.05 var(--serif); letter-spacing: -.035em; font-variation-settings: "opsz" 72; text-wrap: balance; }
.tagline { margin: var(--s-1) 0 0; font: italic 400 var(--t-lg)/1.25 var(--serif); letter-spacing: -.01em; color: var(--accent); }
.lede { margin: var(--s-2) 0 0; max-width: 60ch; font-size: var(--t-base); line-height: 1.55; color: var(--ink-2); text-wrap: pretty; }
.saved { display: grid; grid-template-columns: auto 1fr; align-items: center; column-gap: var(--s-3); padding-top: var(--s-3); border-top: 1px solid var(--rule-strong); }
.saved-n { grid-row: span 2; font: 400 2.5rem/1 var(--serif); letter-spacing: -.04em; font-variation-settings: "opsz" 72; }
.saved-n .tilde { color: var(--muted); font-size: .6em; vertical-align: .18em; margin-right: 1px; }
.saved-n small { font-size: .38em; letter-spacing: 0; margin-left: 4px; }
.saved-l { align-self: end; font: 600 var(--t-xs)/1.4 var(--sans); letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
.saved-note { align-self: start; font: italic 400 var(--t-base)/1.3 var(--serif); color: var(--ink-2); }
.notice, .banner { display: flex; align-items: center; gap: var(--s-3); margin: 0 0 var(--s-6); padding: var(--s-3) var(--s-4); border-radius: var(--r-md); font-size: var(--t-sm); line-height: 1.45; }
.notice { background: var(--surface-2); color: var(--ink-2); }
.banner { background: var(--sage); color: var(--sage-ink); }
.banner svg { flex: none; }
.banner b { font-weight: 600; }

/* Topic navigation */
.topics { position: sticky; top: 0; z-index: 10; background: var(--bg); border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); transition: background-color .2s; }
.topics .wrap { display: flex; align-items: center; gap: var(--s-4); }
.topics-label { display: none; flex: none; }
.tabs { display: flex; gap: var(--s-1); list-style: none; margin: 0 calc(var(--s-4) * -1); padding: 0 var(--s-4); overflow-x: auto; scrollbar-width: none; scroll-snap-type: x proximity; flex: 1; }
.tabs::-webkit-scrollbar { display: none; }
.tab { display: inline-flex; align-items: center; gap: var(--s-2); min-height: 52px; padding: 0 var(--s-3); scroll-snap-align: start; white-space: nowrap; text-decoration: none; font: 500 var(--t-sm)/1 var(--sans); color: var(--muted); border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color .15s, border-color .15s; }
.tab .n { font-size: var(--t-xs); font-weight: 600; padding: 3px 7px; border-radius: var(--r-pill); background: var(--surface-2); color: var(--muted); }
.tab:hover { color: var(--ink); }
.tab[aria-current="true"] { color: var(--ink); border-bottom-color: var(--accent); }
.tab[aria-current="true"] .n { background: var(--sage); color: var(--sage-ink); }

/* Topic sections */
.topic { padding: var(--s-6) 0 var(--s-8); border-bottom: 1px solid var(--rule); scroll-margin-top: 52px; }
.topic-head { margin: 0; }
.topic-head .kicker { display: block; font: 600 var(--t-xs)/1.4 var(--sans); letter-spacing: .14em; text-transform: uppercase; color: var(--accent); }
.topic-head .kicker .count { color: var(--muted); font-weight: 500; letter-spacing: .08em; }
.topic-head .title { display: block; margin-top: var(--s-1); font: 400 var(--t-lg)/1.2 var(--serif); letter-spacing: -.02em; color: var(--ink); text-wrap: balance; }
.deck { margin: var(--s-2) 0 var(--s-5); max-width: 80ch; font: 400 var(--t-base)/1.55 var(--serif); color: var(--ink-2); text-wrap: pretty; }
.label { display: flex; align-items: center; gap: var(--s-3); margin: 0 0 var(--s-3); font: 600 var(--t-xs)/1.4 var(--sans); letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
.label::after { content: ""; flex: 1; height: 1px; background: var(--rule); }
.label .by { font-weight: 400; letter-spacing: .02em; text-transform: none; }

/* Stories */
.story { position: relative; }
.stretch { text-decoration: none; color: inherit; }
.stretch::after { content: ""; position: absolute; inset: 0; border-radius: inherit; }
.stretch:focus-visible { outline: none; }
.story:has(.stretch:focus-visible) { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: var(--r-md); }
.story:hover .headline a { text-decoration: underline; text-decoration-color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 4px; }
.byline { display: flex; align-items: center; flex-wrap: wrap; gap: 4px var(--s-2); margin: 0; font: 400 var(--t-sm)/1.3 var(--sans); color: var(--muted); }
.byline .handle { color: var(--ink); font-weight: 600; }
.byline .dot::before { content: "·"; }
.avatar { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--sage); color: var(--sage-ink); font: 600 .8125rem/1 var(--serif); flex: none; }
.headline { margin: var(--s-3) 0 0; font: 400 var(--t-md)/1.4 var(--serif); letter-spacing: -.005em; text-wrap: pretty; }
.open { display: inline-flex; align-items: center; gap: 6px; margin-top: var(--s-4); font: 600 var(--t-sm)/1 var(--sans); color: var(--accent); }
.open svg { transition: transform .2s var(--ease); }
.story:hover .open svg { transform: translate(2px, -2px); }
.covered { display: inline-block; margin-top: var(--s-3); padding: 3px var(--s-2); border-radius: var(--r-pill); background: var(--sage); color: var(--sage-ink); font: 600 var(--t-xs)/1.4 var(--sans); }
.media { margin: 0; overflow: hidden; border-radius: var(--r-md); background: var(--surface-2); aspect-ratio: 1; }
.media img { display: block; width: 100%; height: 100%; object-fit: cover; }

.lead { display: grid; gap: var(--s-4); align-content: start; padding: var(--s-4); background: var(--surface); border: 1px solid var(--rule); border-radius: var(--r-lg); transition: border-color .2s, box-shadow .2s; }
.lead:hover { border-color: var(--rule-strong); box-shadow: var(--shadow); }
.lead:has(.media) { grid-template-columns: minmax(0, 1fr) 88px; align-items: start; }
.lead .media { order: 2; }
.lead .headline { font-size: clamp(1.1875rem, 1.05rem + .5vw, 1.375rem); line-height: 1.28; letter-spacing: -.015em; font-variation-settings: "opsz" 36; }

.story-grid { display: grid; gap: var(--s-2); }
.supporting { display: grid; }
.support { padding: var(--s-3) 0; border-bottom: 1px solid var(--rule); }
.support:has(.thumb) { display: grid; grid-template-columns: minmax(0, 1fr) 56px; gap: var(--s-4); align-items: start; }
.support .thumb { aspect-ratio: 1; }
.support .headline { margin-top: var(--s-2); font-size: var(--t-base); line-height: 1.4; }
.support .open { margin-top: var(--s-2); font-size: var(--t-xs); }
.lead .open { margin-top: var(--s-3); }

.more { margin-top: var(--s-5); }
.more .label { margin-bottom: 0; }
.more-all > summary, .quiet > summary { list-style: none; cursor: pointer; }
.more-all > summary::-webkit-details-marker, .quiet > summary::-webkit-details-marker { display: none; }
details > summary svg { flex: none; transition: transform .2s var(--ease); }
details[open] > summary svg { transform: rotate(90deg); }
details::details-content { block-size: 0; overflow: clip; transition: block-size .25s var(--ease), content-visibility .25s allow-discrete; }
details[open]::details-content { block-size: auto; }
details.more-all > summary { display: inline-flex; align-items: center; gap: var(--s-1); min-height: 44px; padding: 0 var(--s-2); margin-left: calc(var(--s-2) * -1); border-radius: var(--r-md); font: 600 var(--t-sm)/1 var(--sans); color: var(--accent); transition: background-color .15s; }
details.more-all > summary:hover { background: var(--surface-2); }
.rows { list-style: none; margin: var(--s-2) 0 0; padding: 0; }
.rows li { border-top: 1px solid var(--rule); }
.rows a { display: block; min-height: 44px; padding: var(--s-2) 0; text-decoration: none; }
.rows .meta { display: flex; flex-wrap: wrap; gap: 4px var(--s-2); font: 400 var(--t-xs)/1.4 var(--sans); color: var(--muted); }
.rows .meta b { color: var(--ink); font-weight: 600; font-size: var(--t-sm); }
.rows .g { display: block; margin-top: 1px; font: 400 var(--t-sm)/1.45 var(--serif); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-wrap: pretty; }
.rows a:hover .g { text-decoration: underline; text-decoration-color: var(--accent); text-underline-offset: 3px; }

/* Skipped & unavailable */
.quiet-wrap { padding-top: var(--s-10); }
.quiet { border: 1px solid var(--rule); border-radius: var(--r-lg); background: var(--surface); }
.quiet > summary { display: flex; align-items: center; gap: var(--s-2); min-height: 56px; padding: 0 var(--s-5); border-radius: var(--r-lg); font: 500 var(--t-sm)/1.3 var(--sans); color: var(--ink-2); }
.quiet > summary:hover { color: var(--ink); }
.quiet > summary .n { margin-left: auto; padding: 3px var(--s-2); border-radius: var(--r-pill); background: var(--surface-2); color: var(--muted); font-size: var(--t-xs); font-weight: 600; }
.quiet-body { display: grid; gap: var(--s-6); padding: var(--s-2) var(--s-5) var(--s-5); }
.quiet h3 { margin: 0; font: 600 var(--t-sm)/1.4 var(--sans); }
.quiet h3 span { display: block; font-weight: 400; color: var(--muted); }
.quiet ul { list-style: none; margin: var(--s-2) 0 0; padding: 0; font-size: var(--t-sm); color: var(--ink-2); }
.quiet li { display: flex; gap: var(--s-2); align-items: baseline; padding: var(--s-2) 0; border-top: 1px solid var(--rule); }
.quiet li a { color: var(--ink); font-weight: 600; text-decoration: none; }
.quiet li a:hover { text-decoration: underline; }
.reason { flex: none; padding: 1px 7px; border: 1px solid var(--rule-strong); border-radius: var(--r-pill); font: 600 .6875rem/1.5 var(--sans); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }

/* Edition navigation */
.editions { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: var(--s-3); margin-top: var(--s-10); padding: var(--s-4) 0; border-top: 1px solid var(--rule-strong); border-bottom: 1px solid var(--rule); }
.editions a { text-decoration: none; min-height: 44px; display: inline-flex; align-items: center; gap: var(--s-2); border-radius: var(--r-md); }
.editions .ed { flex-direction: column; align-items: flex-start; justify-content: center; gap: 2px; }
.editions .ed .eyebrow { display: inline-flex; align-items: center; gap: 6px; }
.editions .ed b { font: 400 var(--t-md)/1.2 var(--serif); }
.editions .ed:hover b { text-decoration: underline; text-decoration-color: var(--accent); text-underline-offset: 3px; }
.editions .next { justify-self: end; align-items: flex-end; text-align: right; }
.editions .today { justify-self: center; padding: 0 var(--s-4); border: 1px solid var(--rule-strong); border-radius: var(--r-pill); font: 600 var(--t-sm)/1 var(--sans); transition: border-color .15s, background-color .15s; }
.editions .today:hover { border-color: var(--accent); background: var(--surface); }

/* Empty / message states */
.empty { text-align: center; padding-block: var(--s-16); }
.empty svg { display: block; margin: 0 auto var(--s-5); }
.empty h1, .empty h2 { margin: 0; font: 400 var(--t-xl)/1.2 var(--serif); letter-spacing: -.015em; }
.empty p { margin: var(--s-3) auto 0; max-width: 42ch; color: var(--muted); }
.button { display: inline-flex; align-items: center; gap: var(--s-2); min-height: 44px; margin-top: var(--s-6); padding: 0 var(--s-5); border-radius: var(--r-pill); background: var(--accent); color: var(--accent-ink); text-decoration: none; font: 600 var(--t-sm)/1 var(--sans); transition: box-shadow .15s, transform .15s var(--ease); }
.button:hover { box-shadow: var(--shadow); }
.button:active { transform: scale(.98); }
code { font-size: .9em; padding: 1px 5px; border-radius: var(--r-sm); background: var(--surface-2); }

/* Archive */
.page-head { padding-block: var(--s-12) 0; }
.page-head h1 { margin: var(--s-3) 0 0; font: 400 var(--t-2xl)/1 var(--serif); letter-spacing: -.035em; font-variation-settings: "opsz" 72; }
.page-head p.lede { margin-top: var(--s-4); }
.archive-grid { display: grid; gap: var(--s-10); padding-top: var(--s-8); }
.month { margin: 0 0 var(--s-8); }
.month h2 { margin: 0; padding-bottom: var(--s-3); border-bottom: 1px solid var(--rule-strong); }
.days { list-style: none; margin: 0; padding: 0; }
.days li { border-bottom: 1px solid var(--rule); }
.day { display: grid; grid-template-columns: 52px minmax(0, 1fr) auto; gap: var(--s-4); align-items: center; min-height: 72px; padding: var(--s-4) 0; text-decoration: none; }
.day .date { text-align: center; line-height: 1; }
.day .date b { display: block; font: 400 2rem/1 var(--serif); letter-spacing: -.03em; }
.day .date span { display: block; margin-top: 4px; font: 600 .6875rem/1 var(--sans); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.day .what { min-width: 0; }
.day .t { display: block; font: 400 var(--t-md)/1.35 var(--serif); color: var(--ink); }
.day:hover .t { text-decoration: underline; text-decoration-color: var(--accent); text-underline-offset: 3px; }
.day .s { display: block; margin-top: 2px; font-size: var(--t-sm); color: var(--muted); }
.day .saved-mini { text-align: right; font: 400 var(--t-lg)/1 var(--serif); white-space: nowrap; }
.day .saved-mini small { display: block; margin-top: 4px; font: 600 .6875rem/1 var(--sans); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.demo-tag { display: inline-block; margin-left: var(--s-2); padding: 1px 7px; border-radius: var(--r-pill); background: var(--sage); color: var(--sage-ink); font: 600 .6875rem/1.5 var(--sans); letter-spacing: .04em; vertical-align: 2px; }
.feeds { align-self: start; padding: var(--s-6); border: 1px solid var(--rule); border-radius: var(--r-lg); background: var(--surface); scroll-margin-top: var(--s-6); }
.feeds h2 { display: flex; align-items: center; gap: var(--s-2); margin: 0; font: 400 var(--t-lg)/1.3 var(--serif); }
.feeds h2 svg { color: var(--accent); }
.feeds p { margin: var(--s-2) 0 var(--s-4); font-size: var(--t-sm); color: var(--muted); }
.feeds ul { list-style: none; margin: 0; padding: 0; }
.feeds li { border-top: 1px solid var(--rule); }
.feeds li a { display: flex; flex-direction: column; justify-content: center; min-height: 52px; padding: var(--s-2) 0; text-decoration: none; }
.feeds li b { font-size: var(--t-sm); font-weight: 600; }
.feeds li span { font-size: var(--t-xs); color: var(--muted); word-break: break-all; }
.feeds li a:hover b { color: var(--accent); }

/* Footer */
.footer { margin-top: var(--s-16); border-top: 1px solid var(--rule); padding: var(--s-8) 0 var(--s-12); }
.footer .wrap { display: grid; gap: var(--s-4); }
.footer nav { display: flex; flex-wrap: wrap; gap: 0 var(--s-1); margin-left: calc(var(--s-3) * -1); }
.footer nav a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 var(--s-3); border-radius: var(--r-md); text-decoration: none; font: 500 var(--t-sm)/1 var(--sans); color: var(--muted); }
.footer nav a:hover { color: var(--ink); background: var(--surface-2); }
.footer p { display: inline-flex; align-items: center; gap: var(--s-2); margin: 0; font: italic 400 var(--t-base)/1 var(--serif); color: var(--muted); }

/* Motion */
@keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.reveal { animation: rise .5s var(--ease) both; animation-delay: calc(var(--i, 0) * 60ms); }
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation: none !important; transition: none !important; }
}

@media (min-width: 640px) {
  .edition { display: inline; }
  .lead:has(.media) { grid-template-columns: 132px minmax(0, 1fr); gap: var(--s-5); }
  .lead .media { order: 0; }
  .supporting { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--s-5); }
  .supporting .support:only-child { grid-column: 1 / -1; }
  .rows { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--s-6); }
}
@media (min-width: 768px) {
  .wrap { padding-inline: var(--s-8); }
  .tabs { margin: 0; padding: 0; }
  .intro { grid-template-columns: minmax(0, 1fr) auto; align-items: end; column-gap: var(--s-10); padding-block: var(--s-10) var(--s-6); }
  .saved { display: block; padding: 0 0 var(--s-1) var(--s-6); border-top: 0; border-left: 1px solid var(--rule-strong); min-width: 200px; }
  .saved-n { display: block; font-size: 3rem; }
  .saved-l { display: block; margin-top: var(--s-2); }
  .saved-note { display: block; margin-top: var(--s-1); }
  .topic { padding: var(--s-8) 0 var(--s-10); }
  .footer .wrap { grid-template-columns: 1fr auto; align-items: center; }
}
@media (min-width: 1024px) {
  .topics-label { display: block; }
  .story-grid { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: var(--s-6); align-items: start; }
  .story-grid.solo { grid-template-columns: minmax(0, 1fr); }
  .story-grid .supporting { grid-template-columns: minmax(0, 1fr); }
  .story-grid .support:first-child { padding-top: 0; }
  .archive-grid { grid-template-columns: minmax(0, 7fr) minmax(0, 4fr); gap: var(--s-12); }
  .feeds { position: sticky; top: var(--s-6); }
}
`;

/* ---------- Layout ---------- */

export interface PageMeta {
  /** Public base URL (no trailing slash) for og:url and the canonical link. */
  publicUrl?: string;
  path?: string;
  current?: "today" | "archive";
}

const THEME_BOOT = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}})();`;

// Progressive enhancement only: theme toggle (remembered) and the active topic tab while scrolling.
const ENHANCE = `(function(){
var root=document.documentElement,b=document.getElementById("theme-toggle");
if(b){b.hidden=false;
var cur=function(){return root.dataset.theme||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")};
var sync=function(){var c=cur();b.dataset.mode=c;b.setAttribute("aria-label",c==="dark"?"Switch to light theme":"Switch to dark theme")};
b.addEventListener("click",function(){var n=cur()==="dark"?"light":"dark";root.dataset.theme=n;try{localStorage.setItem("theme",n)}catch(e){}sync()});
sync();}
var tabs=document.querySelectorAll(".tab[href^='#']");
if(tabs.length&&"IntersectionObserver" in window){
var map={};tabs.forEach(function(t){map[t.getAttribute("href").slice(1)]=t});
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){tabs.forEach(function(t){t.removeAttribute("aria-current")});var t=map[e.target.id];if(t){t.setAttribute("aria-current","true");var l=t.parentNode.parentNode;if(l.scrollWidth>l.clientWidth)l.scrollTo({left:t.parentNode.offsetLeft-16,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})}}})},{rootMargin:"-40% 0px -55% 0px"});
document.querySelectorAll(".topic[id]").forEach(function(s){io.observe(s)});}
})();`;

// Instagram image URLs expire; a failed image removes its frame so no broken icon is ever shown.
const IMG_FALLBACK = `this.closest('figure').remove()`;

function layout(opts: { title: string; description: string; meta?: PageMeta; body: string }): string {
  const { title, description, meta = {}, body } = opts;
  const pageUrl = meta.publicUrl ? `${meta.publicUrl}${meta.path ?? "/"}` : undefined;
  const nav = (href: string, label: string, key: PageMeta["current"]) =>
    `<a href="${href}"${meta.current === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#F8F6F0" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#161915" media="(prefers-color-scheme: dark)">
${pageUrl ? `<link rel="canonical" href="${safeUrl(pageUrl)}">` : ""}
<meta property="og:type" content="website">
<meta property="og:site_name" content="SlothScroll">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${pageUrl ? `<meta property="og:url" content="${safeUrl(pageUrl)}">` : ""}
<meta name="twitter:card" content="summary">
<link rel="icon" href="${FAVICON}" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..500&display=swap">
<script>${THEME_BOOT}</script>
<style>${CSS}</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="masthead">
  <div class="wrap">
    <a class="brand" href="/" aria-label="SlothScroll, today's digest">${slothMark(28)}<span>Sloth<i>Scroll</i></span></a>
    <span class="edition">Daily edition</span>
    <nav class="nav" aria-label="Main">
      ${nav("/", "Today", "today")}
      ${nav("/archive", "Archive", "archive")}
      <button class="icon-btn" id="theme-toggle" type="button" aria-label="Toggle theme" hidden><span class="sun">${SUN}</span><span class="moon">${MOON}</span></button>
    </nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="footer">
  <div class="wrap">
    <nav aria-label="Footer">
      <a href="/">Today</a>
      <a href="/archive">Archive</a>
      <a href="/archive#feeds">RSS feeds</a>
      <a href="${safeUrl(MANAGE_PAGES_URL)}" rel="noopener noreferrer">Manage pages</a>
    </nav>
    <p>${slothMark(18)} Made slowly with Gemma</p>
  </div>
</footer>
<script>${ENHANCE}</script>
</body>
</html>`;
}

/* ---------- Story components ---------- */

interface StoryCtx {
  timeZone: string;
}

type Story = DigestPick & { coveredBy?: number };

function byline(p: Story, ctx: StoryCtx): string {
  const time = postedTime(p.postedAt, ctx.timeZone);
  const kind = p.type ? TYPE_LABELS[p.type] : undefined;
  return `<p class="byline">${avatar(p.username)}<span class="handle">@${esc(p.username)}</span>${
    time ? `<span class="dot" aria-hidden="true"></span><time datetime="${esc(time.iso)}">${esc(time.label)}</time>` : ""
  }${kind ? `<span class="dot" aria-hidden="true"></span><span>${esc(kind)}</span>` : ""}</p>`;
}

function media(p: Story, cls: string): string {
  const src = p.imageUrl ? safeUrl(p.imageUrl) : "#";
  if (src === "#") return "";
  const alt = p.altText?.trim() || `Image from @${p.username}'s post`;
  return `<figure class="${cls}"><img src="${src}" alt="${esc(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="${IMG_FALLBACK}"></figure>`;
}

const storyLink = (p: Story) =>
  `<a class="stretch" href="${safeUrl(p.url)}" rel="noopener noreferrer">${esc(clean(p.gist))}<span class="sr-only"> (open the original post on Instagram)</span></a>`;

const covered = (p: Story) =>
  p.coveredBy && p.coveredBy > 1 ? `<span class="covered">Covered by ${p.coveredBy} pages</span>` : "";

function leadStory(p: Story, ctx: StoryCtx): string {
  return `<article class="story lead">${media(p, "media")}<div>${byline(p, ctx)}<h3 class="headline">${storyLink(p)}</h3>${covered(p)}<div><span class="open" aria-hidden="true">Open original post ${ARROW_OUT}</span></div></div></article>`;
}

function supportStory(p: Story, ctx: StoryCtx): string {
  return `<article class="story support"><div>${byline(p, ctx)}<h3 class="headline">${storyLink(p)}</h3>${covered(p)}<div><span class="open" aria-hidden="true">Open post ${ARROW_OUT}</span></div></div>${media(p, "media thumb")}</article>`;
}

function rowStory(p: Story, ctx: StoryCtx): string {
  const time = postedTime(p.postedAt, ctx.timeZone);
  const kind = p.type ? TYPE_LABELS[p.type] : undefined;
  return `<li><a href="${safeUrl(p.url)}" rel="noopener noreferrer"><span class="meta"><b>@${esc(p.username)}</b>${
    time ? `<time datetime="${esc(time.iso)}">${esc(time.label)}</time>` : ""
  }${kind ? `<span>${esc(kind)}</span>` : ""}</span><span class="g">${esc(clean(p.gist))}</span><span class="sr-only"> (opens Instagram)</span></a></li>`;
}

function topicSection(c: DigestDoc["categories"][number], i: number, ctx: StoryCtx): string {
  const slug = catSlug(c.category);
  // Gemma's picks lead; if it picked nothing, the first post leads instead.
  const featured: Story[] = c.picks.length ? c.picks : c.posts.slice(0, 1);
  const featuredUrls = new Set(featured.map((p) => p.url));
  const rest = c.posts.filter((p) => !featuredUrls.has(p.url));
  const [lead, ...supporting] = featured;

  // Up to four remaining posts stay visible; anything beyond folds away.
  const shown = rest.slice(0, 4);
  const hidden = rest.slice(4);
  const more = !rest.length
    ? ""
    : `<div class="more"><p class="label">Also posted</p><ul class="rows">${shown.map((p) => rowStory(p, ctx)).join("")}</ul>${
        hidden.length
          ? `<details class="more-all"><summary>${CHEVRON}${plural(hidden.length, "more post")} in ${esc(c.category)}</summary><ul class="rows">${hidden
              .map((p) => rowStory(p, ctx))
              .join("")}</ul></details>`
          : ""
      }</div>`;

  return `<section class="topic reveal" id="topic-${slug}" style="--i:${Math.min(i + 2, 6)}" aria-labelledby="t-${slug}">
  <div class="wrap">
    <div class="topic-intro">
      <h2 class="topic-head" id="t-${slug}"><span class="kicker">${esc(c.category)} <span class="count num">· ${plural(c.posts.length, "post")}</span></span><span class="sr-only">: </span><span class="title">${esc(SECTION_TITLES[slug] ?? SECTION_TITLES.other!)}</span></h2>
      <p class="deck">${esc(clean(c.summary))}</p>
    </div>
    ${c.picks.length ? `<p class="label">Worth your time <span class="by">· picked by Gemma</span></p>` : ""}
    <div class="story-grid${supporting.length ? "" : " solo"}">
      ${lead ? leadStory(lead, ctx) : ""}
      ${supporting.length ? `<div class="supporting">${supporting.map((p) => supportStory(p, ctx)).join("")}</div>` : ""}
    </div>
    ${more}
  </div>
</section>`;
}

/* ---------- Digest page ---------- */

export interface DigestOptions {
  note?: string;
  /** "Good morning" etc. Present only on today's page; past editions are shown as archived. */
  greeting?: string;
  /** Timezone for post times (DIGEST_TIMEZONE). */
  timeZone?: string;
  /** Neighbouring editions for previous/next navigation. */
  edition?: { prev?: string; next?: string };
  meta?: PageMeta;
}

function editionNav(edition: DigestOptions["edition"], isToday: boolean): string {
  const { prev, next } = edition ?? {};
  if (!prev && !next && isToday) return "";
  const link = (date: string, dir: "prev" | "next") => {
    const p = dateParts(date);
    const label = dir === "prev" ? `${ARROW_LEFT} Previous` : `Next ${ARROW_RIGHT}`;
    return `<a class="ed ${dir}" rel="${dir}" href="/digest/${esc(date)}"><span class="eyebrow">${label}</span><b>${esc(p.short)}</b></a>`;
  };
  return `<nav class="wrap" aria-label="Other editions"><div class="editions">
  ${prev ? link(prev, "prev") : "<span></span>"}
  ${isToday ? "<span></span>" : `<a class="today" href="/">Today's digest</a>`}
  ${next ? link(next, "next") : "<span></span>"}
</div></nav>`;
}

export function renderDigest(digest: DigestDoc, opts: DigestOptions = {}): string {
  // "Other" is a catch-all, so it never leads the page.
  const d = { ...digest, categories: [...digest.categories].sort((a, b) => Number(a.category === "Other") - Number(b.category === "Other")) };
  const ctx: StoryCtx = { timeZone: opts.timeZone ?? "UTC" };
  const isToday = Boolean(opts.greeting);
  const saved = savedAmount(d.stats);
  const parts = dateParts(d.date);

  const lede = d.stats.posts
    ? `${plural(d.stats.posts, "post")} reviewed across ${plural(d.stats.pages, "page")}. ${
        d.categories.length ? "Here are the stories worth your time." : "Nothing in them was worth your time."
      }`
    : `Nothing new from your ${plural(d.stats.pages, "page")} in the last 24 hours.`;

  const intro = `<section class="wrap intro reveal" aria-labelledby="intro-title">
  <div>
    <p class="eyebrow">${isToday ? esc(`${parts.long}, ${parts.year}`) : "Archived edition"}</p>
    <h1 class="greeting" id="intro-title">${isToday ? `${esc(opts.greeting!)}.` : esc(parts.long)}</h1>
    <p class="tagline">${isToday ? "Your world, caught up." : `As it was that morning, ${esc(parts.year)}.`}</p>
    <p class="lede num">${esc(lede)}</p>
  </div>
  ${
    d.stats.posts
      ? `<aside class="saved" aria-label="Time saved"><span class="saved-n num"><span class="tilde" aria-hidden="true">~</span><span class="sr-only">About </span>${saved.value}<small>${esc(saved.unit)}</small></span><span class="saved-l">of scrolling saved</span><span class="saved-note">${isToday ? "Your morning, reclaimed." : "That morning, reclaimed."}</span></aside>`
      : ""
  }
</section>`;

  const notices = [
    opts.note ? `<p class="notice" role="status">${esc(opts.note)}</p>` : "",
    d.demo
      ? `<aside class="banner" aria-label="Demo edition">${slothMark(26)}<span><b>Demo edition.</b> These pages and posts are made up, so you can see SlothScroll at work without touching Instagram.</span></aside>`
      : "",
  ].join("");

  const topicNav = d.categories.length
    ? `<nav class="topics" aria-label="Topics in this edition"><div class="wrap">
  <span class="eyebrow topics-label">In this edition</span>
  <ul class="tabs">${d.categories
    .map((c) => `<li><a class="tab" href="#topic-${catSlug(c.category)}">${esc(c.category)} <span class="n num">${c.posts.length}</span></a></li>`)
    .join("")}</ul>
</div></nav>`
    : "";

  const sections = d.categories.length
    ? d.categories.map((c, i) => topicSection(c, i, ctx)).join("\n")
    : `<section class="wrap empty reveal" style="--i:2">${slothMark(72)}<h2>Nothing new, enjoy the quiet</h2><p>None of your pages posted anything worth reading in the last 24 hours. The sloth approves.</p></section>`;

  const quietCount = d.skipped.length + d.failed.length;
  const quiet = quietCount
    ? `<section class="wrap quiet-wrap" aria-label="Skipped and unavailable">
  <details class="quiet"><summary>${CHEVRON}<span>Skipped &amp; unavailable</span><span class="n num">${quietCount}</span></summary>
  <div class="quiet-body">${
    d.skipped.length
      ? `<div><h3>Skipped on purpose <span>Ads, reposts and giveaways Gemma filtered out.</span></h3><ul>${d.skipped
          .map(
            (s) =>
              `<li><span class="reason">${esc(SKIP_LABELS[s.reason] ?? s.reason)}</span><span><a href="${safeUrl(s.url)}" rel="noopener noreferrer">@${esc(s.username)}</a> ${esc(clean(s.gist))}</span></li>`,
          )
          .join("")}</ul></div>`
      : ""
  }${
    d.failed.length
      ? `<div><h3>Pages we couldn't read <span>These pages will be tried again in the next edition.</span></h3><ul>${d.failed
          .map((f) => `<li><span><b>@${esc(f.username)}</b>: ${esc(friendlyError(f.error))}</span></li>`)
          .join("")}</ul></div>`
      : ""
  }</div>
  </details>
</section>`
    : "";

  const topics = d.categories.map((c) => c.category).join(", ");
  return layout({
    title: isToday ? `SlothScroll · ${formatDate(d.date)}` : `${formatDate(d.date)} · SlothScroll`,
    description: `~${saved.value} ${saved.unit} of scrolling saved: ${plural(d.stats.posts, "post")} from ${plural(d.stats.pages, "Instagram page")}${
      topics ? ` (${topics})` : ""
    }, summarized by Gemma.`,
    meta: opts.meta,
    body: `${intro}\n${notices ? `<div class="wrap">${notices}</div>` : ""}\n${topicNav}\n${sections}\n${quiet}\n${editionNav(opts.edition, isToday)}`,
  });
}

/* ---------- Archive ---------- */

export type ArchiveEntry = Pick<DigestDoc, "date" | "demo" | "stats"> & { categories?: { category: string }[] };

export function renderArchive(digests: ArchiveEntry[], feeds: string[] = [], meta: PageMeta = {}): string {
  const months = new Map<string, ArchiveEntry[]>();
  for (const d of digests) {
    const { month, year } = dateParts(d.date);
    const key = `${month} ${year}`;
    months.set(key, [...(months.get(key) ?? []), d]);
  }

  const list = digests.length
    ? [...months]
        .map(
          ([label, days]) => `<section class="month" aria-labelledby="m-${esc(label.replace(/\s+/g, "-"))}"><h2 class="eyebrow" id="m-${esc(label.replace(/\s+/g, "-"))}">${esc(label)}</h2><ul class="days">${days
            .map((d) => {
              const p = dateParts(d.date);
              const cats = d.categories ?? [];
              const saved = savedAmount(d.stats);
              return `<li><a class="day" href="/digest/${esc(d.date)}">
  <span class="date" aria-hidden="true"><b class="num">${esc(p.day)}</b><span>${esc(p.weekday)}</span></span>
  <span class="what"><span class="t">${esc(p.long)}${d.demo ? `<span class="demo-tag">Demo</span>` : ""}</span><span class="s num">${
    cats.length ? `${esc(cats.map((c) => c.category).join(" · "))} — ` : "A quiet day — "
  }${plural(d.stats.posts, "post")} from ${plural(d.stats.pages, "page")}</span></span>
  <span class="saved-mini num">${d.stats.posts ? `~${saved.value} ${esc(saved.unit)}<small>saved</small>` : ""}</span>
</a></li>`;
            })
            .join("")}</ul></section>`,
        )
        .join("")
    : `<section class="empty">${slothMark(72)}<h2>No editions yet</h2><p>The first one appears after the daily run. To preview one now, run <code>pnpm demo</code>.</p></section>`;

  const feedList = feeds.length
    ? `<aside class="feeds" id="feeds" aria-labelledby="feeds-title"><h2 id="feeds-title">${RSS_ICON}Follow by RSS</h2><p>Prefer a feed reader? Copy a link into Feedly, NetNewsWire, Inoreader or any RSS app. Each item is one post with its Gemma gist.</p><ul>${feeds
        .map(
          (u) =>
            `<li><a href="/feeds/${esc(u)}.xml"><b>@${esc(u)}</b><span>/feeds/${esc(u)}.xml</span></a></li>`,
        )
        .join("")}</ul></aside>`
    : "";

  return layout({
    title: "Archive · SlothScroll",
    description: "Past SlothScroll editions: what your Instagram pages posted each day, and how much scrolling it saved.",
    meta: { ...meta, path: "/archive", current: "archive" },
    body: `<header class="wrap page-head reveal"><p class="eyebrow">Archive</p><h1>The daily editions.</h1><p class="lede">Every past digest, kept as it was. ${
      digests.length ? `${plural(digests.length, "edition")} so far.` : ""
    }</p></header>
<div class="wrap archive-grid"><div>${list}</div>${feedList}</div>`,
  });
}

/* ---------- Messages (404, errors, no digest yet) ---------- */

export function renderMessage(
  title: string,
  message: string,
  meta: PageMeta = {},
  action: { href: string; label: string } = { href: "/", label: "Back to today" },
): string {
  return layout({
    title: `${title} · SlothScroll`,
    description: message,
    meta,
    body: `<section class="wrap empty reveal" role="status">${slothMark(80)}<h1>${esc(title)}</h1><p>${esc(message)}</p><a class="button" href="${esc(action.href)}">${esc(action.label)}</a></section>`,
  });
}
