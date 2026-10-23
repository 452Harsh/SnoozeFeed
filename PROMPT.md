# Build: SlothScroll — a lazy morning digest of the Instagram pages I follow

## Goal
Every morning I want ONE page that tells me, grouped by category, what the Instagram
pages I follow posted in the last 24 hours — so I never have to scroll Instagram.
This is a Hacktoberfest "Slow and Steady" challenge entry (deadline Oct 25, 11:59 PM PDT),
so favor a working, demo-able MVP over completeness. Open-weight AI (Gemma) is the core.

## Stack (use these; each one must do real work)
- TypeScript + Node 20, pnpm.
- Browserbase + Stagehand SDK: real cloud browser to open each Instagram profile and
  extract posts from the last 24h (caption, image URL, post URL, timestamp, type).
- Gemma (open-weight) via an OpenAI-compatible client configured by `AI_PROVIDER`,
  `AI_BASE_URL`, `AI_MODEL` (default `gemma-4-26b-a4b-it`), `AI_API_KEY`.
  Local dev can point `AI_BASE_URL` at Ollama instead.
  Use it for: categorizing pages/posts, describing images when the caption is weak,
  writing per-category summaries.
- EmbeddingGemma (`google/embeddinggemma-300m` via Hugging Face; `AI_EMBED_PROVIDER`,
  `AI_EMBED_MODEL`, `AI_EMBED_API_KEY`): cluster near-duplicate posts across pages
  (e.g. five news pages covering one story → shown once, "covered by 5 pages").
- ElevenLabs (`ELEVENLABS_API_KEY`, optional): ~2-minute audio version of the digest,
  playable from the web page.
- Render: Blueprint (`render.yaml`) with
  - a Web Service (Express or Hono) serving the digest page + archive
  - a Cron Job that runs the daily pipeline (schedule in UTC, configurable)
- MongoDB Atlas (`MONGODB_URI`, `MONGODB_DB`) stores pages, posts and digests (cron
  writes, web reads). Store EmbeddingGemma vectors on posts and use Atlas Vector Search
  for duplicate-story clustering.
- Email (optional, last milestone): send a short HTML summary + link via Resend or SMTP.

## Pipeline (one run = one digest)
1. Load `pages.yaml`: list of `{ username, category? }`. Missing category → Gemma assigns one
   from a fixed list (News, Tech, Food, Fitness, Finance, Entertainment, Memes, Other).
2. Scrape each page with Stagehand in a Browserbase session. Reuse a Browserbase Context
   (`BROWSERBASE_CONTEXT_ID`) so a session I log into once (via live view) persists.
   Be polite: one run per day, sequential pages, small random delays, public pages only.
   Per-page failures must not fail the run — record them and continue.
3. Keep posts from the last 24h; dedupe by post URL against MongoDB (unique index).
4. Gemma per post: 1-line gist; if caption is mostly emojis/hashtags, describe the image.
   Flag ads/reposts/giveaways as "skipped".
5. Gemma per category: 2–3 line summary + the 1–3 posts worth opening (with links).
6. Save the digest (JSON + rendered HTML) to MongoDB; optionally email it.
7. Also expose each page's posts as an RSS feed at `/feeds/:username.xml`.

## Web page
- `/` = today's digest: header with date, "X pages · Y posts · ~Z min of scrolling saved"
  (estimate 8s per post), then one card per category, then "Skipped" and "Failed pages".
- `/archive` and `/digest/:date` for past days.
- Clean, mobile-first, light/dark, no heavy framework needed (server-rendered HTML is fine).

## Demo mode (build this FIRST)
`pnpm demo` runs the whole pipeline on fixture data in `fixtures/` (3–4 fake pages, ~15
posts across categories) without Browserbase, so the demo and judges never depend on
Instagram cooperating. Fixtures must be made up; no real people's data.

## Config & secrets
All secrets via env vars, never committed. Provide `.env.example` with placeholders only:
BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID, BROWSERBASE_CONTEXT_ID,
AI_PROVIDER, AI_BASE_URL, AI_MODEL, AI_API_KEY,
AI_EMBED_PROVIDER, AI_EMBED_MODEL, AI_EMBED_API_KEY,
ELEVENLABS_API_KEY, MONGODB_URI, MONGODB_DB, DIGEST_TIMEZONE,
EMAIL_TO, RESEND_API_KEY (or SMTP_*).
Local values live in `.env.local` (already exists — never read out or log its values);
make sure `.env.local` and `.env` are in `.gitignore` before the first commit.
Declare them in `render.yaml` with `sync: false`.

## Milestones (commit after each with a clear message — this session is recorded with
Entire and will be shown in the write-up, so keep commits small and meaningful)
1. Scaffold repo, config loader, MongoDB collections + indexes (setup script), `.env.example`.
2. Gemma client + categorize/summarize prompts, working on fixtures (`pnpm demo`).
3. Digest web page (today + archive) rendering demo data.
4. Browserbase/Stagehand scraper for one real public page, then all pages, with failure handling.
5. `render.yaml` Blueprint (web + cron, MongoDB Atlas external); verify a deploy works end to end.
6. RSS feed endpoints.
7. EmbeddingGemma duplicate-story clustering via Atlas Vector Search.
8. (Stretch) ElevenLabs audio digest.
9. (Stretch) Email delivery.

## Deliverables
- Working repo with README: what it is, architecture diagram (ASCII is fine), local setup,
  Render deploy button/instructions, how to log in once via Browserbase live view.
- `NOTES_FOR_POST.md`: what each open/partner piece does, honest trade-offs
  (cloud browser vs. privacy, Instagram ToS — personal use, public pages, once a day),
  time-saved numbers from a real run, and anything that broke and how it was fixed.

## Ground rules
- Ask me before adding dependencies beyond the stack above.
- Don't hard-code any keys, cookies, or Instagram credentials anywhere.
- If Instagram blocks scraping, don't fight it with evasion tricks — log it, fall back
  gracefully, and tell me.
