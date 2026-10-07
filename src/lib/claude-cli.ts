import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Runs the owner's local Claude Code CLI (`claude -p`) in headless mode.
 * It uses the Claude subscription the CLI is logged in with — no API key.
 * Personal, single-user use only (Anthropic's terms).
 */

let cachedBin: string | null | undefined;

export function findClaudeBin(): string | null {
  if (cachedBin !== undefined) return cachedBin;
  const candidates = [
    process.env.CLAUDE_BIN,
    ...(process.env.PATH ?? "").split(path.delimiter).map((dir) => path.join(dir, "claude")),
    path.join(os.homedir(), ".local/bin/claude"),
    path.join(os.homedir(), ".claude/local/claude"),
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
  ].filter((p): p is string => Boolean(p));
  cachedBin = candidates.find((p) => fs.existsSync(p)) ?? null;
  return cachedBin;
}

// Empty folder to run in, so Claude doesn't pick up this repo's CLAUDE.md
const WORK_DIR = path.join(process.cwd(), "data", "claude-work");

type ClaudeResult = {
  is_error: boolean;
  result?: string;
  structured_output?: unknown;
  subtype?: string;
};

export type RunClaudeOptions = {
  system: string;
  prompt: string;
  /** JSON Schema for structured output */
  jsonSchema?: object;
  /** Built-in tools Claude may use, e.g. ["WebSearch", "WebFetch"]. Default: none. */
  tools?: string[];
  timeoutMs?: number;
};

export async function runClaude({ system, prompt, jsonSchema, tools = [], timeoutMs = 300_000 }: RunClaudeOptions) {
  const bin = findClaudeBin();
  if (!bin) throw new Error("Claude Code CLI not found. Install it, run `claude` once to log in, or set CLAUDE_BIN.");
  fs.mkdirSync(WORK_DIR, { recursive: true });

  const args = [
    "-p",
    "--output-format", "json",
    "--model", process.env.CLAUDE_MODEL || "sonnet",
    "--system-prompt", system,
    "--tools", tools.join(","),
    "--setting-sources", "",
    "--strict-mcp-config",
    "--no-session-persistence",
  ];
  if (tools.length) args.push("--allowedTools", ...tools);
  if (jsonSchema) args.push("--json-schema", JSON.stringify(jsonSchema));

  // Never let an API key slip in: that would bill the API instead of the subscription
  const env = { ...process.env };
  for (const key of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT"]) delete env[key];

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(bin, args, { cwd: WORK_DIR, env, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Claude timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 && !out.trim()) reject(new Error(`claude exited with ${code}: ${err.slice(0, 500)}`));
      else resolve(out);
    });
    child.stdin.end(prompt);
  });

  let parsed: ClaudeResult;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(`Unexpected Claude output: ${stdout.slice(0, 300)}`);
  }
  if (parsed.is_error) {
    throw new Error(`Claude error (${parsed.subtype ?? "unknown"}): ${String(parsed.result ?? "").slice(0, 500)}`);
  }
  return { text: (parsed.result ?? "").trim(), structured: parsed.structured_output };
}
