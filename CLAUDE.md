# Content Machine

Local web app for an **AI news** account: collects the owner's **X bookmarks** (X API, OAuth, ~$0.001/post) and **free AI news** (RSS feeds + Claude web search) per **topic** (e.g. OpenAI, open-source models). Claude (via the local Claude Code CLI on the owner's **subscription**, no API cost) judges items and writes each post in **six languages: zh, ko, ja, ru, es, pt** (`src/lib/languages.ts`). The owner reviews/edits drafts per language (by hand or by asking the AI) and **posts manually** (no auto-publishing, by owner's choice). The repo is public: README.md is the user guide.

**Read [docs/PROJECT_SCHEME.md](docs/PROJECT_SCHEME.md) first**, especially sections 19–21 (current hosting, ranking and text-first design). Setup steps: [README.md](README.md).

Stack: Next.js 16 (App Router) + Tailwind, **Postgres (Neon) via Drizzle + node-postgres**, text and source links only (no media copies or Blob dependency), hosted on Vercel (password via `APP_PASSWORD`, `src/proxy.ts`). Everything needing X or Claude runs as a **job** (`jobs` table) executed by the local **worker** (`scripts/worker.ts`, started by `npm run dev`); AI via `claude -p` (`src/lib/claude-cli.ts`) or optionally AI SDK 7 + Vercel AI Gateway (`AI_PROVIDER=gateway`).

Design (see `src/app/globals.css`): a clean editorial workspace with soft gray backgrounds, white paper surfaces, strong typography, quiet borders and restrained black accents (type scale `.t-h1…t-caption`, spacing 4/8/16/24/32/40/48/56/64, `.btn`, `.chip`, `.badge`, `.card`, `.infobox`, `.input`, `.segmented`). **Only black, gray and white**: use the tokens `bg`, `paper`, `surface`, `surface-2`, `fg`, `muted`, `subtle`, `line`, `inverse`, `on-inverse`; never Tailwind color palettes, colored emoji or flags in the UI. Icons are `lucide-react`. Light and dark mode both supported. Keep motion short and purposeful; honor `prefers-reduced-motion`. The draft board uses status tabs, collapsible filters and readable text-first cards. Logo: `src/components/Logo.tsx` (`LogoMark`, square or circle), favicon `src/app/icon.svg` (round), README image `docs/logo.png`.

Rules:
- Next.js 16 and AI SDK 7 differ from older versions: check `node_modules/next/dist/docs/` and `node_modules/ai/docs/` before using an API (see AGENTS.md).
- Store original X/Threads/news links, text, metrics and annotations. Never download, upload or preview media; the owner opens the source post for images/videos. The legacy `drafts.media` column is retained for compatibility and unused by new work.
- Never give the AI a write/post tool for X or Threads. X access stays read-only.
- No scraping of X (X's terms forbid it, risk of account ban). X data only via the official API.
- The owner wants ~zero running cost: don't add paid APIs or per-token AI by default.
- Schema change → edit `src/db/schema.ts`, then `npm run db:generate` and `npm run db:migrate`.
- DB calls are async (`await db.select()…`). New work that needs X/Claude = a new job kind (`src/db/schema.ts` JOB_KINDS, `src/lib/jobs/payloads.ts`, `src/lib/jobs/run.ts`) called from the UI with `useJob()`; never run Claude/X inside a Vercel request.
- Check with `npm run typecheck`, `npm run lint`, `npm run build`.

@AGENTS.md
