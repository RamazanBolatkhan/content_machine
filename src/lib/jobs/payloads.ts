import { z } from "zod";
import type { JobKind } from "@/db/schema";
import { LANG_CODES } from "@/lib/languages";

/** What each job kind expects. Validated when the website creates a job. */
export const JOB_PAYLOADS = {
  find_news: z.object({ topicId: z.number().int().positive().optional() }),
  bookmarks: z.object({}),
  similar: z.object({}),
  write: z.object({ draftId: z.number().int().positive() }),
  edit: z.object({
    draftId: z.number().int().positive(),
    lang: z.enum(LANG_CODES as [string, ...string[]]),
    currentText: z.string().max(5000),
    instruction: z.string().trim().min(1).max(2000),
  }),
  improve_topic: z.object({ topicId: z.number().int().positive() }),
  add_top_posts: z.object({ urls: z.array(z.string().max(500)).min(1).max(30), note: z.string().max(200) }),
  set_top_text: z.object({ id: z.number().int().positive(), text: z.string().trim().min(1).max(10_000) }),
  delete_top_post: z.object({ id: z.number().int().positive() }),
  rebuild_profile: z.object({}),
} satisfies Record<JobKind, z.ZodType>;

export type JobPayload<K extends JobKind> = z.infer<(typeof JOB_PAYLOADS)[K]>;
