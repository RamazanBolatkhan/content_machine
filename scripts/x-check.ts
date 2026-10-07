/**
 * Checks the X connection: lists the MCP tools and runs one small search.
 * Usage: npm run x:check -- "GTA 6"
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const { connectXMcp, searchRecentPosts, toolAllowlist } = await import("../src/lib/x/client");

const query = process.argv[2] ?? "GTA 6";

if (process.env.X_MODE !== "direct") {
  console.log("Connecting to X MCP:", process.env.X_MCP_URL ?? "https://api.x.com/mcp");
  const client = await connectXMcp();
  const { tools } = await client.listTools();
  await client.close();
  console.log(`Server offers ${tools.length} tools.`);
  for (const name of toolAllowlist()) {
    const tool = tools.find((t) => t.name === name);
    console.log(tool ? `  ✓ ${name}` : `  ✗ ${name} (not found!)`);
    if (tool && process.argv.includes("--schema")) console.log(JSON.stringify(tool.inputSchema, null, 2));
  }
}

console.log(`\nSearching recent posts for: ${query} (mode: ${process.env.X_MODE ?? "mcp"})`);
const posts = await searchRecentPosts({ query: `${query} -is:retweet`, maxResults: 10, sinceHours: 24 });
for (const p of posts) {
  console.log(`- @${p.authorHandle} ❤️ ${p.metrics.likes} 🔁 ${p.metrics.reposts} media:${p.media.length}  ${p.text.slice(0, 90).replace(/\s+/g, " ")}`);
}
console.log(`\n${posts.length} posts. X connection works ✅`);
