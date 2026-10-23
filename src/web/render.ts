// Server-rendered HTML for the digest pages. No client JS, no framework.
import type { DigestDoc, DigestPick } from "../types.js";

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

/** Only http(s) links are rendered as hrefs. */
const safeUrl = (u: string): string => (/^https?:\/\//i.test(u) ? esc(u) : "#");

export function formatDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;

export function statsLine(d: Pick<DigestDoc, "stats">): string {
  const { pages, posts, minutesSaved } = d.stats;
  return `${plural(pages, "page")} · ${plural(posts, "post")} · ~${minutesSaved} min of scrolling saved`;
}

const CSS = `
:root {
  --bg: #faf8f5; --surface: #ffffff; --text: #1d1b19; --muted: #6b6560;
  --border: #e8e3dc; --accent: #2f6f5e; --accent-soft: #e3f0ec; --warn: #9a5b13; --warn-soft: #fbefdc;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #151413; --surface: #1f1d1b; --text: #ece8e3; --muted: #a39d96;
    --border: #2f2c29; --accent: #7cc4ad; --accent-soft: #1e3530; --warn: #e5b06a; --warn-soft: #3a2c19;
    color-scheme: dark;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font: 16px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-text-size-adjust: 100%;
}
main { max-width: 680px; margin: 0 auto; padding: 20px 16px 48px; }
a { color: var(--accent); }
nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; font-size: 14px; }
nav .brand { font-weight: 700; color: var(--text); text-decoration: none; letter-spacing: -0.01em; }
nav .brand span { color: var(--accent); }
header h1 { font-size: 26px; line-height: 1.2; margin: 0 0 6px; letter-spacing: -0.02em; }
header .stats { color: var(--muted); margin: 0; }
.badge {
  display: inline-block; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 999px;
  background: var(--warn-soft); color: var(--warn); vertical-align: middle;
}
.note { color: var(--muted); font-size: 14px; margin: 8px 0 0; }
.card {
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
  padding: 18px; margin-top: 16px;
}
.card h2 { font-size: 18px; margin: 0 0 8px; display: flex; justify-content: space-between; gap: 8px; }
.card h2 .count { font-size: 13px; font-weight: 500; color: var(--muted); }
.card p { margin: 0; }
.picks { list-style: none; padding: 0; margin: 14px 0 0; display: grid; gap: 8px; }
.picks a {
  display: block; padding: 10px 12px; border-radius: 10px; background: var(--accent-soft);
  color: var(--text); text-decoration: none;
}
.picks a:hover, .picks a:focus-visible { outline: 2px solid var(--accent); outline-offset: 0; }
.who { display: block; font-size: 13px; font-weight: 600; color: var(--accent); }
details { margin-top: 12px; font-size: 14px; }
summary { cursor: pointer; color: var(--muted); }
.list { padding-left: 18px; margin: 8px 0 0; }
.list li { margin: 6px 0; }
.muted { color: var(--muted); }
.tag { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
.archive { list-style: none; padding: 0; margin: 0; }
.archive li { border-top: 1px solid var(--border); }
.archive li:first-child { border-top: 0; }
.archive a { display: block; padding: 12px 0; text-decoration: none; color: var(--text); }
.archive .stats { display: block; font-size: 14px; color: var(--muted); }
footer { margin-top: 32px; font-size: 13px; color: var(--muted); text-align: center; }
@media (min-width: 600px) { header h1 { font-size: 30px; } main { padding-top: 32px; } }
`;

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
<main>
<nav><a class="brand" href="/">Sloth<span>Scroll</span></a><a href="/archive">Archive</a></nav>
${body}
<footer>Summaries by Gemma · posts from the last 24 hours</footer>
</main>
</body>
</html>`;
}

const pickItem = (p: DigestPick): string =>
  `<li><a href="${safeUrl(p.url)}" rel="noopener noreferrer"><span class="who">@${esc(p.username)}</span>${esc(p.gist)}</a></li>`;

const listItem = (p: DigestPick, extra = ""): string =>
  `<li>${extra}<a href="${safeUrl(p.url)}" rel="noopener noreferrer">@${esc(p.username)}</a>: ${esc(p.gist)}</li>`;

export function renderDigest(d: DigestDoc, opts: { note?: string } = {}): string {
  const cards = d.categories
    .map(
      (c) => `<section class="card">
<h2>${esc(c.category)} <span class="count">${plural(c.posts.length, "post")}</span></h2>
<p>${esc(c.summary)}</p>
<ul class="picks">${c.picks.map(pickItem).join("")}</ul>
${
  c.posts.length > c.picks.length
    ? `<details><summary>All ${c.posts.length} posts</summary><ul class="list">${c.posts.map((p) => listItem(p)).join("")}</ul></details>`
    : ""
}
</section>`,
    )
    .join("\n");

  const skipped = d.skipped.length
    ? `<section class="card"><h2>Skipped <span class="count">ads, giveaways, reposts</span></h2>
<ul class="list">${d.skipped.map((s) => listItem(s, `<span class="tag">${esc(s.reason)}</span> `)).join("")}</ul></section>`
    : "";

  const failed = d.failed.length
    ? `<section class="card"><h2>Failed pages <span class="count">${d.failed.length}</span></h2>
<ul class="list">${d.failed.map((f) => `<li>@${esc(f.username)}: <span class="muted">${esc(f.error)}</span></li>`).join("")}</ul></section>`
    : "";

  const empty = d.categories.length
    ? ""
    : `<section class="card"><p class="muted">Nothing new in the last 24 hours. Enjoy the quiet.</p></section>`;

  return layout(
    `SlothScroll · ${d.date}`,
    `<header>
<h1>${esc(formatDate(d.date))}${d.demo ? ` <span class="badge">demo data</span>` : ""}</h1>
<p class="stats">${esc(statsLine(d))}</p>
${opts.note ? `<p class="note">${esc(opts.note)}</p>` : ""}
</header>
${cards}${empty}
${skipped}
${failed}`,
  );
}

export function renderArchive(digests: Pick<DigestDoc, "date" | "demo" | "stats">[], feeds: string[] = []): string {
  const items = digests.length
    ? `<ul class="archive">${digests
        .map(
          (d) =>
            `<li><a href="/digest/${esc(d.date)}">${esc(formatDate(d.date))}${
              d.demo ? ` <span class="badge">demo</span>` : ""
            }<span class="stats">${esc(statsLine(d))}</span></a></li>`,
        )
        .join("")}</ul>`
    : `<p class="muted">No digests yet.</p>`;
  const feedList = feeds.length
    ? `<section class="card"><h2>RSS feeds <span class="count">one per page</span></h2>
<ul class="list">${feeds.map((u) => `<li><a href="/feeds/${esc(u)}.xml">@${esc(u)}</a></li>`).join("")}</ul></section>`
    : "";
  return layout(
    "SlothScroll · Archive",
    `<header><h1>Archive</h1></header><section class="card">${items}</section>${feedList}`,
  );
}

export function renderMessage(title: string, message: string): string {
  return layout(`SlothScroll · ${title}`, `<header><h1>${esc(title)}</h1><p class="stats">${esc(message)}</p></header>`);
}
