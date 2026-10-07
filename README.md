# Content Machine

Your X bookmarks + fresh gaming news → Claude translates them into Russian Threads posts → you review, edit, copy and post to Threads yourself.

**Running cost:** about $0. The AI runs on your Claude subscription (Claude Code). Bookmark import costs ~$0.001 per bookmark from your X API credits. News comes from free RSS feeds and Claude web search.

## 1. Setup

```bash
npm install
cp .env.example .env.local
npm run dev        # open http://127.0.0.1:3000
```

The AI needs Claude Code installed and logged in (`claude` once in a terminal). The Settings page shows ✅ when it's found.

## 2. Connect X (for bookmarks)

1. In the X developer console (console.x.com), open your app → **User authentication settings** → set up:
   - App permissions: **Read**
   - Type of app: **Native App** (no secret needed). If you choose **Web App**, also copy the Client Secret.
   - Callback URL: `http://127.0.0.1:3000/api/x/callback`
   - Website URL: anything, e.g. your X profile link
2. Copy the **OAuth 2.0 Client ID** (and Client Secret for Web App) into `.env.local` as `X_CLIENT_ID=` / `X_CLIENT_SECRET=`.
3. Add a few dollars of credits in the console (new accounts get $20 free).
4. Restart `npm run dev`, open **http://127.0.0.1:3000/settings** → **Connect X account**.

Always open the app at `127.0.0.1:3000` (not `localhost`) for the X login to work.

## 3. Daily use

1. **Settings → Games**: add a game with keywords and feeds only about that game, e.g.
   - Reddit: `https://www.reddit.com/r/GTA6/top/.rss?t=day`
   - Steam news: `https://store.steampowered.com/feeds/news/app/<APP_ID>`
   - YouTube channel: `https://www.youtube.com/feeds/videos.xml?channel_id=<ID>`
2. **Settings → General news feeds**: gaming sites (e.g. `https://www.gematsu.com/feed`). Their items are matched to your games by keyword.
3. Scroll X as usual and **bookmark** posts you want to repost.
4. On **Drafts**: press **📥 Import bookmarks** and/or **📰 Find news**.
5. Open a draft → edit by hand or ask the AI (“Сделай короче”) → **Copy text** + **Download media** → post on Threads → **Mark posted**.

Optional: `npm run scout:loop -- 240` imports bookmarks and finds news every 4 hours while the terminal stays open.

## Good to know
- Claude usage comes out of your plan's monthly Agent SDK credit. A run takes ~30–60 s per game.
- Reddit sometimes answers “429 Too Many Requests”. That only skips the feed for that run (shown as a warning).
- Paid X search (~$0.005 per post) still exists. Turn it on in Settings and set `X_BEARER_TOKEN` if you ever want it.
