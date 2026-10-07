# Content Machine

Local web app for an **AI news** account: collects the owner's **X bookmarks** (X API, OAuth, ~$0.001/post) and **free AI news** (RSS feeds + Claude web search) per **topic** (e.g. OpenAI, open-source models). Claude (via the local Claude Code CLI on the owner's **subscription**, no API cost) judges items and writes each post in **six languages: zh, ko, ja, ru, es, pt** (`src/lib/languages.ts`). The owner reviews/edits drafts per language (by hand or by asking the AI) and **posts manually** (no auto-publishing, by owner's choice). The repo is public: README.md is the user guide.

**Read [docs/PROJECT_SCHEME.md](docs/PROJECT_SCHEME.md) first**, especially sections 13–14 (current design, decisions, code map). Setup steps: [README.md](README.md).

Stack: Next.js 16 (App Router) + Tailwind, SQLite via Drizzle (`data/app.db`), AI via `claude -p` (`src/lib/claude-cli.ts`) or optionally AI SDK 7 + Vercel AI Gateway (`AI_PROVIDER=gateway`).

Rules:
- Next.js 16 and AI SDK 7 differ from older versions: check `node_modules/next/dist/docs/` and `node_modules/ai/docs/` before using an API (see AGENTS.md).
- Never give the AI a write/post tool for X or Threads. X access stays read-only.
- No scraping of X (X's terms forbid it, risk of account ban). X data only via the official API.
- The owner wants ~zero running cost: don't add paid APIs or per-token AI by default.
- Schema change → edit `src/db/schema.ts`, then `npm run db:generate`.
- Check with `npm run typecheck`, `npm run lint`, `npm run build`.

@AGENTS.md
