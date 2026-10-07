import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import type { NewsItem } from "@/lib/sources/types";
import { findV2Payload, parseV2Posts, POST_FIELDS, type V2Payload, type XPost } from "./parse";

export type { XPost } from "./parse";

export function xConfigured(): boolean {
  return Boolean(process.env.X_BEARER_TOKEN);
}

function bearer(): string {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) throw new Error("X_BEARER_TOKEN is not set (see .env.example)");
  return token;
}

const mode = () => (process.env.X_MODE === "direct" ? "direct" : "mcp");

/** Read-only tools the AI may use. Anything else from the server is dropped. */
export function toolAllowlist(): string[] {
  return (
    process.env.X_API_TOOL_ALLOWLIST ??
    "search_posts_recent,search_posts_all,get_posts_by_ids,get_users_by_username,searchPostsRecent,getPostsByIds,getUsersByUsername"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function connectXMcp(): Promise<MCPClient> {
  return createMCPClient({
    transport: {
      type: "http",
      url: process.env.X_MCP_URL ?? "https://api.x.com/mcp",
      headers: { Authorization: `Bearer ${bearer()}` },
    },
    maxRetries: 2,
  });
}

/** X MCP tools filtered to the read-only allowlist, ready to give to an agent. */
export async function getXReadTools(client: MCPClient) {
  const all = await client.tools();
  const allowed = new Set(toolAllowlist());
  return Object.fromEntries(Object.entries(all).filter(([name]) => allowed.has(name)));
}

type JsonSchema = { properties?: Record<string, { type?: string | string[] }> };

/**
 * Build MCP tool arguments from X API query params. The tool's input schema
 * decides whether list params are sent as arrays or comma-separated strings.
 */
function toToolArgs(params: Record<string, string | number | readonly string[]>, schema: JsonSchema) {
  const props = schema.properties ?? {};
  const args: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    const prop = props[key];
    if (Object.keys(props).length && !prop) continue; // server doesn't accept this param
    const wantsArray = prop?.type === "array" || (Array.isArray(prop?.type) && prop.type.includes("array"));
    if (Array.isArray(value)) args[key] = wantsArray ? value : value.join(",");
    else args[key] = prop?.type === "integer" || prop?.type === "number" ? Number(value) : value;
  }
  return args;
}

// X search allows ~1 request per second: space calls out
let lastSearchAt = 0;
async function pace() {
  const wait = lastSearchAt + 1200 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastSearchAt = Date.now();
}

/**
 * Call the first X MCP tool that exists, out of several possible names
 * (the hosted server uses snake_case, e.g. search_posts_all; self-hosted xmcp uses operationIds).
 */
async function callXTool(
  toolNames: string[],
  params: Record<string, string | number | readonly string[]>,
): Promise<V2Payload> {
  await pace();
  const client = await connectXMcp();
  try {
    const { tools } = await client.listTools();
    const tool = toolNames.map((name) => tools.find((t) => t.name === name)).find(Boolean);
    if (!tool) {
      throw new Error(`X MCP has none of ${toolNames.join(", ")}. Available: ${tools.map((t) => t.name).join(", ")}`);
    }
    const toolName = tool.name;
    const props = (tool.inputSchema as JsonSchema).properties ?? {};
    // The hosted server names "tweet.fields" "post.fields"
    const renamed = Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k === "tweet.fields" && "post.fields" in props ? "post.fields" : k, v]),
    );
    const result = await client.callTool({
      name: toolName,
      arguments: toToolArgs(renamed, tool.inputSchema as JsonSchema),
    });
    const payload = findV2Payload(result);
    if (result.isError || !payload) {
      throw new Error(`X MCP ${toolName} failed: ${JSON.stringify(result).slice(0, 500)}`);
    }
    return payload;
  } finally {
    await client.close();
  }
}

async function callXApi(endpoint: string, params: Record<string, string | number | readonly string[]>) {
  const url = new URL(`https://api.x.com/2/${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const res = await fetch(url, { headers: { Authorization: `Bearer ${bearer()}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`X API ${endpoint} ${res.status}: ${JSON.stringify(body).slice(0, 500)}`);
  }
  return body as V2Payload;
}

export type SearchOptions = {
  query: string;
  maxResults: number; // 10–100
  sinceHours: number;
};

export async function searchRecentPosts({ query, maxResults, sinceHours }: SearchOptions): Promise<XPost[]> {
  const params = {
    query,
    max_results: Math.min(100, Math.max(10, maxResults)),
    sort_order: "relevancy",
    // X requires start_time within the last 7 days
    start_time: new Date(Date.now() - Math.min(sinceHours, 167) * 3600_000).toISOString(),
    ...POST_FIELDS,
  };
  const payload =
    mode() === "mcp"
      ? await callXTool(["search_posts_recent", "searchPostsRecent", "search_posts_all"], params)
      : await callXApi("tweets/search/recent", params);
  return parseV2Posts(payload);
}

export async function getPostsByIds(ids: string[]): Promise<XPost[]> {
  if (!ids.length) return [];
  const params = { ids: ids.slice(0, 100), ...POST_FIELDS };
  const payload =
    mode() === "mcp" ? await callXTool(["get_posts_by_ids", "getPostsByIds"], params) : await callXApi("tweets", params);
  return parseV2Posts(payload);
}

type XNewsStory = { id: string; name?: string; hook?: string; summary?: string; url?: string; updated_at?: string };

/**
 * X News: stories X builds from what's trending (title + summary), via the hosted MCP server.
 * Returns [] in direct mode or when the server has no such tool.
 */
export async function searchXNews(query: string, maxResults: number, maxAgeHours: number): Promise<NewsItem[]> {
  if (mode() !== "mcp") return [];
  await pace();
  const client = await connectXMcp();
  try {
    const { tools } = await client.listTools();
    if (!tools.some((t) => t.name === "search_news")) return [];
    const result = await client.callTool({
      name: "search_news",
      arguments: { query, max_results: maxResults, max_age_hours: Math.min(maxAgeHours, 167) },
    });
    const payload = findV2Payload(result) as { data?: XNewsStory[] } | null;
    if (result.isError || !payload) throw new Error(`X News failed: ${JSON.stringify(result).slice(0, 300)}`);
    return (Array.isArray(payload.data) ? payload.data : []).map((s) => ({
      url: s.url ?? `https://x.com/i/trending/${s.id}`,
      title: s.name ?? "",
      summary: [s.hook, s.summary].filter(Boolean).join("\n\n"),
      sourceName: "X News",
      publishedAt: s.updated_at ? new Date(s.updated_at) : null,
    }));
  } finally {
    await client.close();
  }
}
