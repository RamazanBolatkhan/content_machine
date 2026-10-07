import type { Job } from "@/db/schema";
import { editDraft, writeMissingLanguages } from "@/lib/agents/editor";
import {
  addReferencePosts,
  deleteReferencePost,
  rebuildReferenceProfile,
  setReferenceText,
} from "@/lib/agents/reference";
import { findLikeTopPosts, findNews, syncBookmarks } from "@/lib/agents/scout";
import { improveTopic } from "@/lib/agents/topic-setup";
import type { LangCode } from "@/lib/languages";
import { getDraft } from "@/lib/queries";
import { JOB_PAYLOADS } from "./payloads";

/** Runs one job on the local worker (X + Claude). The return value is stored as the job's result. */
export async function runJob(job: Job): Promise<unknown> {
  switch (job.kind) {
    case "find_news": {
      const p = JOB_PAYLOADS.find_news.parse(job.payload);
      return findNews(p.topicId, job.id);
    }
    case "bookmarks":
      return [await syncBookmarks(job.id)];
    case "similar":
      return [await findLikeTopPosts(job.id)];
    case "write": {
      const p = JOB_PAYLOADS.write.parse(job.payload);
      return { written: await writeMissingLanguages(p.draftId) };
    }
    case "edit": {
      const p = JOB_PAYLOADS.edit.parse(job.payload);
      const found = await getDraft(p.draftId);
      if (!found) throw new Error("Draft not found");
      return { text: await editDraft(found.draft, p.lang as LangCode, p.currentText, p.instruction) };
    }
    case "improve_topic": {
      const p = JOB_PAYLOADS.improve_topic.parse(job.payload);
      return improveTopic(p.topicId);
    }
    case "add_top_posts": {
      const p = JOB_PAYLOADS.add_top_posts.parse(job.payload);
      return addReferencePosts(p.urls, p.note);
    }
    case "set_top_text": {
      const p = JOB_PAYLOADS.set_top_text.parse(job.payload);
      await setReferenceText(p.id, p.text);
      return {};
    }
    case "delete_top_post": {
      const p = JOB_PAYLOADS.delete_top_post.parse(job.payload);
      await deleteReferencePost(p.id);
      return {};
    }
    case "rebuild_profile":
      await rebuildReferenceProfile();
      return {};
  }
}
