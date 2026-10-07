/**
 * Imports X bookmarks and finds news for all enabled games every N minutes,
 * while the terminal stays open.
 * Usage: npm run scout:loop -- 240
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const { findNews, syncBookmarks } = await import("../src/lib/agents/scout");
const { xAccount } = await import("../src/lib/x/auth");
const minutes = Number(process.argv[2]) || 240;

async function tick() {
  console.log(`[${new Date().toLocaleTimeString()}] collecting…`);
  const results = [...(xAccount() ? [await syncBookmarks()] : []), ...(await findNews())];
  for (const r of results) {
    console.log(`  ${r.label}: found ${r.read}, checked ${r.candidates}, saved ${r.saved}${r.error ? ` ERROR ${r.error}` : ""}`);
    for (const w of r.warnings) console.log(`    ⚠ ${w}`);
  }
}

await tick();
setInterval(tick, minutes * 60_000);
console.log(`Next run every ${minutes} min. Ctrl+C to stop.`);
