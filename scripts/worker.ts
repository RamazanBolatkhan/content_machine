/**
 * The local worker: does everything that needs X or Claude (your subscription)
 * for the website, local or on Vercel. Jobs are queued in the database.
 *
 *   npm run worker        (npm run dev also starts it)
 */
import os from "node:os";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "../src/db";
import type { Job, WorkerInfo } from "../src/db/schema";
import { AI_PROVIDER, aiConfigured, aiSetupHint } from "../src/lib/ai";
import { runJob } from "../src/lib/jobs/run";
import { xLoginConfigured } from "../src/lib/x/auth";
import { xConfigured } from "../src/lib/x/client";

const SLOTS = 2; // jobs at the same time (Claude calls are the slow part)
const POLL_MS = 2000;
const HEARTBEAT_MS = 30_000;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run `vercel env pull` (see README).");
  process.exit(1);
}

function info(): WorkerInfo {
  return {
    ai: aiConfigured(),
    aiProvider: AI_PROVIDER,
    aiHint: aiConfigured() ? undefined : aiSetupHint(),
    xSearch: xConfigured(),
    xLogin: xLoginConfigured(),
    host: os.hostname(),
  };
}

async function heartbeat() {
  const row = { id: 1, lastSeen: new Date(), info: info() };
  await db
    .insert(schema.workerStatus)
    .values(row)
    .onConflictDoUpdate({ target: schema.workerStatus.id, set: { lastSeen: row.lastSeen, info: row.info } });
}

/** Atomically take the oldest queued job (safe even if two workers run). */
async function claim(): Promise<Job | null> {
  const res = await db.execute<{ id: number }>(sql`
    UPDATE jobs SET status = 'running', started_at = now()
    WHERE id = (SELECT id FROM jobs WHERE status = 'queued' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED)
    RETURNING id`);
  const id = res.rows[0]?.id;
  if (!id) return null;
  const [job] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, id));
  return job ?? null;
}

async function work(job: Job) {
  const started = Date.now();
  console.log(`▶ #${job.id} ${job.kind} ${JSON.stringify(job.payload).slice(0, 80)}`);
  try {
    const result = await runJob(job);
    await db
      .update(schema.jobs)
      .set({ status: "done", result: result ?? {}, finishedAt: new Date() })
      .where(eq(schema.jobs.id, job.id));
    console.log(`✓ #${job.id} ${job.kind} in ${Math.round((Date.now() - started) / 1000)}s`);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await db.update(schema.jobs).set({ status: "error", error, finishedAt: new Date() }).where(eq(schema.jobs.id, job.id));
    console.log(`✗ #${job.id} ${job.kind}: ${error.slice(0, 200)}`);
  }
}

async function main() {
  // Jobs left "running" by a previous worker that stopped mid-way
  await db
    .update(schema.jobs)
    .set({ status: "error", error: "The worker stopped while this was running. Please try again.", finishedAt: new Date() })
    .where(eq(schema.jobs.status, "running"));

  await heartbeat();
  setInterval(() => heartbeat().catch((e) => console.error("heartbeat:", e.message)), HEARTBEAT_MS);
  const i = info();
  console.log(
    `Worker on ${i.host} ready. AI: ${i.ai ? i.aiProvider : `not ready (${i.aiHint})`}. X search: ${i.xSearch ? "yes" : "no"}.`,
  );

  let running = 0;
  for (;;) {
    while (running < SLOTS) {
      const job = await claim().catch((e) => {
        console.error("claim:", e.message);
        return null;
      });
      if (!job) break;
      running++;
      void work(job).finally(() => running--);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main();
