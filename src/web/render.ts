// Server-rendered HTML for the digest pages: "Morning Paper" design.
// No framework, no build step. Small inline JS only enhances (theme toggle,
// active chip); every page works without it. All dynamic text goes through esc(),
// all hrefs through safeUrl().
import { CATEGORIES } from "../config.js";
import type { DigestDoc, DigestPick } from "../types.js";

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
  return { weekday: f({ weekday: "short" }), day: f({ day: "numeric" }), month: f({ month: "long" }), year: f({ year: "numeric" }) };
};

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;

export function statsLine(d: Pick<DigestDoc, "stats">): string {
  const { pages, posts, minutesSaved } = d.stats;
  return `${plural(pages, "page")} · ${plural(posts, "post")} · ~${minutesSaved} min of scrolling saved`;
}

/** Hero number: minutes when there's at least one, otherwise seconds (never "~0 min"). */
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

/* ---------- Icons (inline SVG, decorative: aria-hidden) ---------- */

const svg = (body: string, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

const CATEGORY_ICONS: Record<string, string> = {
  news: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/>',
  tech: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  food: '<path d="M3 11h18a9 9 0 0 1-18 0Z"/><path d="M8 7.5c0-1.5 1-2 1-3.5M12 7.5c0-1.5 1-2 1-3.5M16 7.5c0-1.5 1-2 1-3.5"/>',
  fitness: '<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>',
  finance: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  entertainment: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.5v5l4.5-2.5Z"/>',
  memes: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
  other: '<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>',
};

const ARROW = svg('<path d="M7 17 17 7M9 7h8v8"/>', 18);
const CHEVRON = svg('<path d="m9 6 6 6-6 6"/>', 16);
const SUN = svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', 18);
const MOON = svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>', 18);

/** Sleepy sloth mark. Fixed colours so it reads on both themes. */
function slothMark(size: number): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
<circle cx="16" cy="16" r="15" fill="#B9906B"/>
<ellipse cx="16" cy="18" rx="11.5" ry="9.5" fill="#F4E6D2"/>
<ellipse cx="10.6" cy="16.4" rx="4" ry="2.7" fill="#5A3E2B" transform="rotate(-18 10.6 16.4)"/>
<ellipse cx="21.4" cy="16.4" rx="4" ry="2.7" fill="#5A3E2B" transform="rotate(18 21.4 16.4)"/>
<path d="M9.2 16.6q1.5 1 3 0M19.8 16.6q1.5 1 3 0" stroke="#F4E6D2" stroke-width="1.1" fill="none" stroke-linecap="round"/>
<ellipse cx="16" cy="20.3" rx="1.7" ry="1.15" fill="#3A281B"/>
<path d="M13.6 23.2q2.4 1.6 4.8 0" stroke="#3A281B" stroke-width="1.15" fill="none" stroke-linecap="round"/>
</svg>`;
}

const FAVICON = `data:image/svg+xml,${encodeURIComponent(slothMark(32).replace(/\s*aria-hidden="true" focusable="false"/, ' xmlns="http://www.w3.org/2000/svg"'))}`;

/** Category → CSS class slug from the fixed list (anything unknown is "other"). */
const catSlug = (category: string): string => {
  const known = CATEGORIES.find((c) => c.toLowerCase() === category.toLowerCase());
  return (known ?? "Other").toLowerCase();
};

const catIcon = (category: string) => svg(CATEGORY_ICONS[catSlug(category)] ?? CATEGORY_ICONS.other!);

/** Typographic avatar: first letter, tint picked from the username so it's stable. */
function avatar(username: string): string {
  const letter = (username.match(/[A-Za-z0-9]/)?.[0] ?? "?").toUpperCase();
  let h = 0;
  for (const ch of username) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const slug = CATEGORIES[h % CATEGORIES.length]!.toLowerCase();
  return `<span class="avatar c-${slug}" aria-hidden="true">${esc(letter)}</span>`;
}

/* ---------- Styles ---------- */

const CSS = `
:root {
  color-scheme: light;
  interpolate-size: allow-keywords;
  --bg: #FAF6EE; --surface: #FFFDF8; --surface-2: #F3EDE2; --ink: #1F1B16; --muted: #6B6257;
  --rule: #E6DDCF; --accent: #B04E26; --accent-ink: #FFFFFF; --accent-soft: #F6E3D8;
  --shadow-1: 0 1px 0 rgb(31 27 22 / .04), 0 1px 3px rgb(31 27 22 / .06);
  --shadow-2: 0 2px 6px rgb(31 27 22 / .06), 0 10px 28px rgb(31 27 22 / .07);
  --news-tint: #E6EDF7; --news-edge: #3E6CA8;  --tech-tint: #ECE8F8; --tech-edge: #6A55B5;
  --food-tint: #F8EADB; --food-edge: #B06A2A;  --fitness-tint: #E2F1E6; --fitness-edge: #3A8150;
  --finance-tint: #EEF1DD; --finance-edge: #6F7A2A; --entertainment-tint: #F8E3EB; --entertainment-edge: #B04A74;
  --memes-tint: #FBF1CF; --memes-edge: #A67F12; --other-tint: #ECE8E2; --other-edge: #7A7064;

  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 20px; --s-6: 24px; --s-8: 32px; --s-10: 40px; --s-12: 48px; --s-16: 64px;
  --r-sm: 6px; --r-md: 10px; --r-lg: 16px; --r-pill: 999px;
  --t-xs: .78rem; --t-sm: .875rem; --t-base: 1rem; --t-md: 1.125rem; --t-lg: 1.375rem; --t-xl: 1.75rem;
  --t-hero: clamp(4.25rem, 22vw, 7rem);
  --serif: "Newsreader", Georgia, "Times New Roman", serif;
  --sans: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --ease: cubic-bezier(.2, .7, .2, 1);
  --column: 720px;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg: #15120E; --surface: #1E1A15; --surface-2: #28221B; --ink: #EDE6DA; --muted: #A89E90;
    --rule: #342E26; --accent: #E8895C; --accent-ink: #1A0F08; --accent-soft: #3A2418;
    --shadow-1: 0 1px 0 rgb(0 0 0 / .3); --shadow-2: 0 2px 8px rgb(0 0 0 / .35), 0 12px 32px rgb(0 0 0 / .3);
    --news-tint: #1C2633; --news-edge: #8DB2E3; --tech-tint: #262236; --tech-edge: #B3A4EC;
    --food-tint: #33261A; --food-edge: #E3A86E; --fitness-tint: #1A2C20; --fitness-edge: #84C79A;
    --finance-tint: #272B19; --finance-edge: #BFC97A; --entertainment-tint: #33202A; --entertainment-edge: #E895B7;
    --memes-tint: #332C16; --memes-edge: #E5C25E; --other-tint: #2A2622; --other-edge: #B8AFA3;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #15120E; --surface: #1E1A15; --surface-2: #28221B; --ink: #EDE6DA; --muted: #A89E90;
  --rule: #342E26; --accent: #E8895C; --accent-ink: #1A0F08; --accent-soft: #3A2418;
  --shadow-1: 0 1px 0 rgb(0 0 0 / .3); --shadow-2: 0 2px 8px rgb(0 0 0 / .35), 0 12px 32px rgb(0 0 0 / .3);
  --news-tint: #1C2633; --news-edge: #8DB2E3; --tech-tint: #262236; --tech-edge: #B3A4EC;
  --food-tint: #33261A; --food-edge: #E3A86E; --fitness-tint: #1A2C20; --fitness-edge: #84C79A;
  --finance-tint: #272B19; --finance-edge: #BFC97A; --entertainment-tint: #33202A; --entertainment-edge: #E895B7;
  --memes-tint: #332C16; --memes-edge: #E5C25E; --other-tint: #2A2622; --other-edge: #B8AFA3;
}
.c-news { --tint: var(--news-tint); --edge: var(--news-edge); }
.c-tech { --tint: var(--tech-tint); --edge: var(--tech-edge); }
.c-food { --tint: var(--food-tint); --edge: var(--food-edge); }
.c-fitness { --tint: var(--fitness-tint); --edge: var(--fitness-edge); }
.c-finance { --tint: var(--finance-tint); --edge: var(--finance-edge); }
.c-entertainment { --tint: var(--entertainment-tint); --edge: var(--entertainment-edge); }
.c-memes { --tint: var(--memes-tint); --edge: var(--memes-edge); }
.c-other { --tint: var(--other-tint); --edge: var(--other-edge); }

*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
body {
  margin: 0; background: var(--bg); color: var(--ink);
  font: 400 var(--t-base)/1.6 var(--sans); font-feature-settings: "cv11", "ss01";
  -webkit-font-smoothing: antialiased; overflow-x: hidden;
}
a { color: inherit; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: var(--r-sm); }
.wrap { max-width: var(--column); margin: 0 auto; padding: 0 var(--s-4); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.skip { position: absolute; left: var(--s-4); top: -60px; background: var(--accent); color: var(--accent-ink); padding: var(--s-2) var(--s-4); border-radius: var(--r-md); z-index: 20; text-decoration: none; font-weight: 600; }
.skip:focus { top: var(--s-2); }
.num { font-variant-numeric: tabular-nums lining-nums; }

/* Masthead */
.masthead { border-bottom: 1px solid var(--rule); }
.masthead .wrap { display: flex; align-items: center; justify-content: space-between; min-height: 60px; gap: var(--s-3); }
.brand { display: inline-flex; align-items: center; gap: var(--s-2); text-decoration: none; font: 600 1.25rem/1 var(--serif); letter-spacing: -.01em; padding: var(--s-2) 0; }
.brand em { font-style: italic; font-weight: 400; color: var(--accent); }
.nav-actions { display: flex; align-items: center; gap: var(--s-1); }
.nav-link { font-size: var(--t-sm); font-weight: 500; color: var(--muted); text-decoration: none; padding: var(--s-3) var(--s-3); border-radius: var(--r-md); transition: color .15s, background .15s; }
.nav-link:hover { color: var(--ink); background: var(--surface-2); }
.nav-link[aria-current="page"] { color: var(--ink); }
.icon-btn { display: inline-grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: var(--r-pill); background: transparent; color: var(--muted); cursor: pointer; transition: color .15s, background .15s; }
.icon-btn:hover { color: var(--ink); background: var(--surface-2); }
.icon-btn .moon { display: none; }
.icon-btn[data-mode="light"] .sun { display: none; }
.icon-btn[data-mode="light"] .moon { display: block; }

/* Hero */
.hero { padding: var(--s-10) 0 var(--s-8); }
.kicker { font: 600 var(--t-xs)/1.4 var(--sans); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin: 0; }
.kicker b { color: var(--accent); font-weight: 600; }
.hero h1 { margin: var(--s-6) 0 0; font-family: var(--serif); font-weight: 500; line-height: .9; letter-spacing: -.035em; }
.hero .big { display: block; font-size: var(--t-hero); }
.hero .big small { font-size: .42em; letter-spacing: -.02em; margin-left: .08em; }
.hero .big .tilde { font-size: .62em; color: var(--muted); margin-right: .02em; vertical-align: .14em; }
.hero .sub { display: block; margin-top: var(--s-2); font: italic 400 var(--t-lg)/1.25 var(--serif); letter-spacing: 0; color: var(--ink); }
.hero .meta { margin: var(--s-4) 0 0; color: var(--muted); font-size: var(--t-sm); }
.hero .meta span + span::before { content: "·"; margin: 0 var(--s-2); }
.notice { margin: var(--s-6) 0 0; padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: var(--surface-2); color: var(--muted); font-size: var(--t-sm); }
.banner { display: flex; gap: var(--s-3); align-items: center; margin: var(--s-6) 0 0; padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: var(--accent-soft); color: var(--ink); font-size: var(--t-sm); line-height: 1.45; }
.banner b { font-family: var(--serif); font-style: italic; font-weight: 400; font-size: var(--t-base); }

/* At a glance */
.glance { position: sticky; top: 0; z-index: 10; margin: 0 calc(var(--s-4) * -1); padding: var(--s-3) var(--s-4); background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: saturate(1.4) blur(8px); -webkit-backdrop-filter: saturate(1.4) blur(8px); border-bottom: 1px solid var(--rule); border-top: 1px solid var(--rule); }
.glance h2 { margin: 0 0 var(--s-2); }
.chips { display: flex; gap: var(--s-2); list-style: none; margin: 0; padding: 0; overflow-x: auto; scrollbar-width: none; scroll-snap-type: x proximity; }
.chips::-webkit-scrollbar { display: none; }
.chip { display: inline-flex; align-items: center; gap: var(--s-2); min-height: 40px; padding: 0 var(--s-4) 0 var(--s-3); border-radius: var(--r-pill); background: var(--tint); color: var(--ink); text-decoration: none; font-size: var(--t-sm); font-weight: 500; white-space: nowrap; scroll-snap-align: start; border: 1px solid transparent; transition: border-color .15s, transform .15s var(--ease); }
.chip svg { color: var(--edge); width: 16px; height: 16px; }
.chip .n { color: var(--muted); font-weight: 600; }
.chip:hover { border-color: var(--edge); }
.chip:active { transform: scale(.97); }
.chip[aria-current="true"] { border-color: var(--edge); box-shadow: inset 0 0 0 1px var(--edge); }

/* Category cards */
.stories { padding: var(--s-6) 0 var(--s-4); display: grid; gap: var(--s-6); }
.cat { position: relative; background: var(--surface); border: 1px solid var(--rule); border-radius: var(--r-lg); box-shadow: var(--shadow-1); padding: var(--s-6) var(--s-5) var(--s-5); scroll-margin-top: 96px; overflow: hidden; }
.cat::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 4px; background: var(--edge); }
.cat-head { display: flex; align-items: center; gap: var(--s-3); }
.cat-icon { display: inline-grid; place-items: center; width: 36px; height: 36px; border-radius: var(--r-md); background: var(--tint); color: var(--edge); flex: none; }
.cat h2 { margin: 0; font: 600 var(--t-lg)/1.2 var(--serif); letter-spacing: -.01em; }
.cat .count { margin-left: auto; font-size: var(--t-sm); color: var(--muted); }
.summary { margin: var(--s-4) 0 0; font: 400 var(--t-md)/1.65 var(--serif); max-width: 68ch; text-wrap: pretty; }
.label { margin: var(--s-6) 0 var(--s-2); font: 600 var(--t-xs)/1.4 var(--sans); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.picks { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--rule); }
.picks li { border-bottom: 1px solid var(--rule); }
.pick { display: grid; grid-template-columns: auto 1fr auto; gap: var(--s-3); align-items: start; min-height: 44px; padding: var(--s-3) var(--s-2); margin: 0 calc(var(--s-2) * -1); text-decoration: none; border-radius: var(--r-md); transition: background .15s, transform .15s var(--ease); }
.pick:hover { background: var(--surface-2); }
.pick:active { transform: scale(.995); }
.pick:hover .go { color: var(--accent); transform: translate(2px, -2px); }
.avatar { display: inline-grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: var(--tint); color: var(--ink); font: 600 .95rem/1 var(--serif); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--edge) 35%, transparent); }
.who { display: flex; align-items: center; gap: var(--s-2); flex-wrap: wrap; font-size: var(--t-sm); font-weight: 600; }
.gist { display: block; margin-top: 2px; font-size: var(--t-base); line-height: 1.5; color: var(--ink); text-wrap: pretty; }
.go { color: var(--muted); margin-top: 2px; transition: color .15s, transform .15s var(--ease); }
.badge { font-size: var(--t-xs); font-weight: 600; padding: 2px var(--s-2); border-radius: var(--r-pill); background: var(--accent-soft); color: var(--ink); }

details summary { list-style: none; cursor: pointer; }
details summary::-webkit-details-marker { display: none; }
details summary svg { transition: transform .2s var(--ease); }
details[open] > summary svg { transform: rotate(90deg); }
details::details-content { block-size: 0; overflow: clip; transition: block-size .25s var(--ease), content-visibility .25s allow-discrete; }
details[open]::details-content { block-size: auto; }
.all { margin-top: var(--s-3); }
.all > summary { display: inline-flex; align-items: center; gap: var(--s-1); min-height: 44px; padding: 0 var(--s-2); margin-left: calc(var(--s-2) * -1); border-radius: var(--r-md); font-size: var(--t-sm); font-weight: 600; color: var(--accent); }
.all > summary:hover { background: var(--surface-2); }
.rows { list-style: none; margin: var(--s-1) 0 0; padding: 0; }
.rows a { display: block; padding: var(--s-2) var(--s-2); margin: 0 calc(var(--s-2) * -1); min-height: 44px; border-radius: var(--r-sm); text-decoration: none; font-size: var(--t-sm); line-height: 1.5; color: var(--ink); transition: background .15s; }
.rows a:hover { background: var(--surface-2); }
.rows b { font-weight: 600; }

/* Quiet bottom sections */
.quiet { margin: var(--s-4) 0 0; border-top: 1px solid var(--rule); }
.quiet details { border-bottom: 1px solid var(--rule); }
.quiet summary { display: flex; align-items: center; gap: var(--s-2); min-height: 52px; font-size: var(--t-sm); color: var(--muted); padding: 0 var(--s-1); }
.quiet summary:hover { color: var(--ink); }
.quiet summary .n { font-weight: 600; color: var(--ink); }
.quiet ul { list-style: none; margin: 0 0 var(--s-4); padding: 0 var(--s-1); font-size: var(--t-sm); color: var(--muted); }
.quiet li { padding: var(--s-2) 0; }
.quiet li a { color: var(--ink); }
.tag { font-size: var(--t-xs); font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin-right: var(--s-1); }

/* Empty / message states */
.empty { text-align: center; padding: var(--s-12) var(--s-4); }
.empty svg { display: block; margin: 0 auto var(--s-4); }
.empty h2, .empty h1 { margin: 0; font: 500 var(--t-xl)/1.2 var(--serif); letter-spacing: -.01em; }
.empty p { margin: var(--s-2) auto 0; color: var(--muted); max-width: 40ch; }
.button { display: inline-flex; align-items: center; min-height: 44px; margin-top: var(--s-6); padding: 0 var(--s-5); border-radius: var(--r-pill); background: var(--accent); color: var(--accent-ink); text-decoration: none; font-weight: 600; font-size: var(--t-sm); transition: transform .15s var(--ease), box-shadow .15s; }
.button:hover { box-shadow: var(--shadow-2); }
.button:active { transform: scale(.98); }

/* Archive */
.page-head { padding: var(--s-10) 0 var(--s-6); }
.page-head h1 { margin: var(--s-2) 0 0; font: 500 clamp(2.25rem, 10vw, 3.25rem)/1 var(--serif); letter-spacing: -.03em; }
.page-head p { margin: var(--s-3) 0 0; color: var(--muted); }
.month { margin: 0 0 var(--s-8); }
.month h2 { margin: 0 0 var(--s-2); padding-bottom: var(--s-2); border-bottom: 1px solid var(--rule); font: 600 var(--t-xs)/1.4 var(--sans); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.days { list-style: none; margin: 0; padding: 0; }
.days li { border-bottom: 1px solid var(--rule); }
.day { display: grid; grid-template-columns: 56px 1fr auto; gap: var(--s-4); align-items: center; padding: var(--s-4) var(--s-2); margin: 0 calc(var(--s-2) * -1); min-height: 64px; text-decoration: none; border-radius: var(--r-md); transition: background .15s; }
.day:hover { background: var(--surface-2); }
.day .date { text-align: center; line-height: 1; }
.day .date b { display: block; font: 500 1.9rem/1 var(--serif); letter-spacing: -.02em; }
.day .date span { font-size: var(--t-xs); text-transform: uppercase; letter-spacing: .1em; color: var(--muted); }
.day .what { min-width: 0; font-size: var(--t-sm); color: var(--muted); }
.day .what .t { display: block; color: var(--ink); font-weight: 500; font-size: var(--t-base); margin-bottom: 2px; }
.dots { display: inline-flex; gap: 6px; vertical-align: middle; margin-right: var(--s-2); }
.dot { width: 9px; height: 9px; border-radius: 50%; background: var(--edge); }
.day .saved { text-align: right; font: 500 var(--t-lg)/1 var(--serif); white-space: nowrap; }
.day .saved small { display: block; font: 400 var(--t-xs)/1.4 var(--sans); color: var(--muted); margin-top: 2px; }
.demo-tag { font-size: var(--t-xs); font-weight: 600; color: var(--accent); margin-left: var(--s-1); }
.feeds { margin: var(--s-4) 0 var(--s-8); padding: var(--s-5); border-radius: var(--r-lg); background: var(--surface); border: 1px solid var(--rule); scroll-margin-top: var(--s-6); }
.feeds h2 { margin: 0; font: 600 var(--t-md)/1.3 var(--serif); }
.feeds p { margin: var(--s-1) 0 var(--s-3); font-size: var(--t-sm); color: var(--muted); }
.feeds ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--s-2); }
.feeds a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 var(--s-4); border-radius: var(--r-pill); border: 1px solid var(--rule); text-decoration: none; font-size: var(--t-sm); font-weight: 500; transition: border-color .15s, background .15s; }
.feeds a:hover { border-color: var(--accent); background: var(--surface-2); }

/* Footer */
.footer { margin-top: var(--s-12); border-top: 1px solid var(--rule); padding: var(--s-8) 0 var(--s-12); text-align: center; }
.footer nav { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--s-1) var(--s-2); }
.footer nav a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 var(--s-3); text-decoration: none; font-size: var(--t-sm); font-weight: 500; color: var(--muted); border-radius: var(--r-md); }
.footer nav a:hover { color: var(--ink); background: var(--surface-2); }
.footer p { margin: var(--s-4) 0 0; display: inline-flex; align-items: center; gap: var(--s-2); font: italic 400 var(--t-base)/1 var(--serif); color: var(--muted); }

/* Motion */
@keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.reveal { animation: rise .55s var(--ease) both; animation-delay: calc(var(--i, 0) * 70ms); }
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation: none !important; transition: none !important; }
}

@media (min-width: 720px) {
  .wrap { padding: 0 var(--s-6); }
  .glance { position: static; margin: 0; padding: var(--s-4) 0; background: none; backdrop-filter: none; -webkit-backdrop-filter: none; border-top: 0; }
  .cat { padding: var(--s-8) var(--s-8) var(--s-6); scroll-margin-top: var(--s-6); }
  .hero { padding-top: var(--s-16); }
  .chips { flex-wrap: wrap; overflow: visible; }
}
`;

/* ---------- Layout ---------- */

export interface PageMeta {
  /** Public base URL (no trailing slash) for og:url. */
  publicUrl?: string;
  path?: string;
  current?: "today" | "archive";
}

const THEME_BOOT = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}})();`;

// Progressive enhancement only: theme toggle (remembered) and the active chip while scrolling.
const ENHANCE = `(function(){
var root=document.documentElement,b=document.getElementById("theme-toggle");
if(b){b.hidden=false;
var cur=function(){return root.dataset.theme||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")};
var sync=function(){var c=cur();b.dataset.mode=c;b.setAttribute("aria-label",c==="dark"?"Switch to light theme":"Switch to dark theme")};
b.addEventListener("click",function(){var n=cur()==="dark"?"light":"dark";root.dataset.theme=n;try{localStorage.setItem("theme",n)}catch(e){}sync()});
sync();}
var chips=document.querySelectorAll(".chip[href^='#']");
if(chips.length&&"IntersectionObserver" in window){
var map={};chips.forEach(function(c){map[c.getAttribute("href").slice(1)]=c});
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){chips.forEach(function(c){c.removeAttribute("aria-current")});var c=map[e.target.id];if(c){c.setAttribute("aria-current","true");if(c.scrollIntoView&&matchMedia("(max-width: 719px)").matches)c.scrollIntoView({block:"nearest",inline:"nearest"})}}})},{rootMargin:"-45% 0px -50% 0px"});
document.querySelectorAll(".cat[id]").forEach(function(s){io.observe(s)});}
})();`;

function layout(opts: { title: string; description: string; meta?: PageMeta; body: string }): string {
  const { title, description, meta = {}, body } = opts;
  const ogUrl = meta.publicUrl ? `${meta.publicUrl}${meta.path ?? "/"}` : undefined;
  const nav = (href: string, label: string, key: PageMeta["current"]) =>
    `<a class="nav-link" href="${href}"${meta.current === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#FAF6EE" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#15120E" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="website">
<meta property="og:site_name" content="SlothScroll">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${ogUrl ? `<meta property="og:url" content="${safeUrl(ogUrl)}">` : ""}
<meta name="twitter:card" content="summary">
<link rel="icon" href="${FAVICON}" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Newsreader:ital,wght@0,400;0,500;0,600;1,400&display=swap">
<script>${THEME_BOOT}</script>
<style>${CSS}</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="masthead">
  <div class="wrap">
    <a class="brand" href="/" aria-label="SlothScroll, today's digest">${slothMark(30)}<span>Sloth<em>Scroll</em></span></a>
    <nav class="nav-actions" aria-label="Main">
      ${nav("/", "Today", "today")}
      ${nav("/archive", "Archive", "archive")}
      <button class="icon-btn" id="theme-toggle" type="button" aria-label="Toggle theme" hidden><span class="sun">${SUN}</span><span class="moon">${MOON}</span></button>
    </nav>
  </div>
</header>
<main id="main" class="wrap">
${body}
</main>
<footer class="footer">
  <div class="wrap">
    <nav aria-label="Footer">
      <a href="/archive">Archive</a>
      <a href="/archive#feeds">RSS</a>
      <a href="${safeUrl(MANAGE_PAGES_URL)}" rel="noopener noreferrer">Manage pages</a>
    </nav>
    <p>${slothMark(18)} Made slowly with Gemma</p>
  </div>
</footer>
<script>${ENHANCE}</script>
</body>
</html>`;
}

/* ---------- Digest page ---------- */

const pickRow = (p: DigestPick & { coveredBy?: number }): string =>
  `<li><a class="pick" href="${safeUrl(p.url)}" rel="noopener noreferrer">${avatar(p.username)}<span><span class="who">@${esc(p.username)}${
    p.coveredBy && p.coveredBy > 1 ? ` <span class="badge">covered by ${p.coveredBy} pages</span>` : ""
  }</span><span class="gist">${esc(p.gist)}</span></span><span class="go">${ARROW}<span class="sr-only"> (opens Instagram)</span></span></a></li>`;

export interface DigestOptions {
  note?: string;
  /** Shown as the hero kicker greeting, e.g. "Good morning". Omitted for past digests. */
  greeting?: string;
  meta?: PageMeta;
}

export function renderDigest(digest: DigestDoc, opts: DigestOptions = {}): string {
  // "Other" is a catch-all, so it never leads the page.
  const d = { ...digest, categories: [...digest.categories].sort((a, b) => Number(a.category === "Other") - Number(b.category === "Other")) };
  const saved = savedAmount(d.stats);
  const parts = dateParts(d.date);
  const kicker = opts.greeting
    ? `<b>${esc(opts.greeting)}</b> · ${esc(parts.weekday)} ${esc(parts.day)} ${esc(parts.month)} ${esc(parts.year)}`
    : `From the archive · ${esc(formatDate(d.date))}`;

  const hero = `<section class="hero reveal" aria-labelledby="hero-title">
  <p class="kicker">${kicker}</p>
  <h1 id="hero-title"><span class="big num"><span class="tilde" aria-hidden="true">~</span><span class="sr-only">about </span>${saved.value}<small>${esc(saved.unit)}</small></span><span class="sub">of scrolling saved</span></h1>
  <p class="meta num"><span>${plural(d.stats.pages, "page")}</span><span>${plural(d.stats.posts, "post")}</span>${
    d.categories.length ? `<span>${plural(d.categories.length, "topic")}</span>` : ""
  }</p>
  ${opts.note ? `<p class="notice">${esc(opts.note)}</p>` : ""}
  ${
    d.demo
      ? `<aside class="banner" aria-label="Demo edition">${slothMark(28)}<span><b>Demo edition.</b> These pages and posts are made up, so you can see SlothScroll at work without touching Instagram.</span></aside>`
      : ""
  }
</section>`;

  const glance = d.categories.length
    ? `<nav class="glance" aria-labelledby="glance-title">
  <h2 class="kicker" id="glance-title">Today at a glance</h2>
  <ul class="chips">${d.categories
    .map((c) => {
      const slug = catSlug(c.category);
      return `<li><a class="chip c-${slug}" href="#cat-${slug}">${catIcon(c.category)}${esc(c.category)} <span class="n num">${c.posts.length}</span></a></li>`;
    })
    .join("")}</ul>
</nav>`
    : "";

  const cards = d.categories
    .map((c, i) => {
      const slug = catSlug(c.category);
      const more = c.posts.length > c.picks.length;
      return `<section class="cat c-${slug} reveal" id="cat-${slug}" style="--i:${i + 2}" aria-labelledby="h-${slug}">
  <header class="cat-head"><span class="cat-icon">${catIcon(c.category)}</span><h2 id="h-${slug}">${esc(c.category)}</h2><span class="count num">${plural(c.posts.length, "post")}</span></header>
  <p class="summary">${esc(c.summary)}</p>
  ${c.picks.length ? `<h3 class="label">Worth opening</h3><ul class="picks">${c.picks.map(pickRow).join("")}</ul>` : ""}
  ${
    more
      ? `<details class="all"><summary>${CHEVRON}All ${c.posts.length} posts</summary><ul class="rows">${c.posts
          .map((p) => `<li><a href="${safeUrl(p.url)}" rel="noopener noreferrer"><b>@${esc(p.username)}</b> · ${esc(p.gist)}</a></li>`)
          .join("")}</ul></details>`
      : ""
  }
</section>`;
    })
    .join("\n");

  const empty = d.categories.length
    ? ""
    : `<section class="empty reveal" style="--i:2">${slothMark(72)}<h2>Nothing new, enjoy the quiet</h2><p>None of your pages posted in the last 24 hours. The sloth approves.</p></section>`;

  const quiet =
    d.skipped.length || d.failed.length
      ? `<section class="quiet" aria-label="Skipped and failed">
  ${
    d.skipped.length
      ? `<details><summary>${CHEVRON}<span><span class="n num">${plural(d.skipped.length, "post")}</span> skipped: ads, giveaways, reposts</span></summary><ul>${d.skipped
          .map((s) => `<li><span class="tag">${esc(s.reason)}</span><a href="${safeUrl(s.url)}" rel="noopener noreferrer">@${esc(s.username)}</a>: ${esc(s.gist)}</li>`)
          .join("")}</ul></details>`
      : ""
  }
  ${
    d.failed.length
      ? `<details><summary>${CHEVRON}<span><span class="n num">${plural(d.failed.length, "page")}</span> couldn't be read today</span></summary><ul>${d.failed
          .map((f) => `<li><b>@${esc(f.username)}</b>: ${esc(f.error)}</li>`)
          .join("")}</ul></details>`
      : ""
  }
</section>`
      : "";

  const topics = d.categories.map((c) => c.category).join(", ");
  return layout({
    title: opts.greeting ? `SlothScroll · ${formatDate(d.date)}` : `SlothScroll · ${d.date}`,
    description: `~${saved.value} ${saved.unit} of scrolling saved: ${plural(d.stats.posts, "post")} from ${plural(d.stats.pages, "Instagram page")}${
      topics ? ` (${topics})` : ""
    }, summarized by Gemma.`,
    meta: opts.meta,
    body: `${hero}\n${glance}\n<div class="stories">${cards}${empty}</div>\n${quiet}`,
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
          ([label, days]) => `<section class="month"><h2>${esc(label)}</h2><ul class="days">${days
            .map((d) => {
              const p = dateParts(d.date);
              const cats = d.categories ?? [];
              const saved = savedAmount(d.stats);
              return `<li><a class="day" href="/digest/${esc(d.date)}">
  <span class="date"><b class="num">${esc(p.day)}</b><span>${esc(p.weekday)}</span></span>
  <span class="what"><span class="t">${plural(d.stats.posts, "post")} from ${plural(d.stats.pages, "page")}${d.demo ? `<span class="demo-tag">demo</span>` : ""}</span>${
    cats.length
      ? `<span class="dots" aria-hidden="true">${cats.map((c) => `<span class="dot c-${catSlug(c.category)}"></span>`).join("")}</span>${esc(cats.map((c) => c.category).join(" · "))}`
      : "Nothing new"
  }</span>
  <span class="saved num">~${saved.value} ${esc(saved.unit)}<small>saved</small></span>
</a></li>`;
            })
            .join("")}</ul></section>`,
        )
        .join("")
    : `<section class="empty">${slothMark(72)}<h2>No digests yet</h2><p>The first one appears after the daily run, or run <code>pnpm demo</code>.</p></section>`;

  const feedList = feeds.length
    ? `<section class="feeds" id="feeds" aria-labelledby="feeds-title"><h2 id="feeds-title">RSS feeds</h2><p>Follow any page in your feed reader, one gist per post.</p><ul>${feeds
        .map((u) => `<li><a href="/feeds/${esc(u)}.xml">@${esc(u)}</a></li>`)
        .join("")}</ul></section>`
    : "";

  return layout({
    title: "Archive · SlothScroll",
    description: "Past SlothScroll digests: what your Instagram pages posted each day, and how much scrolling it saved.",
    meta: { ...meta, path: "/archive", current: "archive" },
    body: `<header class="page-head reveal"><p class="kicker">The slow archive</p><h1>Every morning, kept</h1><p>${plural(digests.length, "digest")} so far.</p></header>${list}${feedList}`,
  });
}

/* ---------- Messages (404, errors, no digest yet) ---------- */

export function renderMessage(title: string, message: string, meta: PageMeta = {}): string {
  return layout({
    title: `${title} · SlothScroll`,
    description: message,
    meta,
    body: `<section class="empty reveal">${slothMark(80)}<h1>${esc(title)}</h1><p>${esc(message)}</p><a class="button" href="/">Back to today</a></section>`,
  });
}
