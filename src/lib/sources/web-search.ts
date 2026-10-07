import { z } from "zod";
import type { Topic } from "@/db/schema";
import { aiObject } from "@/lib/ai";
import { lines } from "@/lib/util";
import type { NewsItem } from "./types";

const resultSchema = z.object({
  items: z.array(
    z.object({
      title: z.string(),
      url: z.string().describe("Direct link to the article or official post"),
      source: z.string().describe("Site name, e.g. OpenAI blog, The Verge, TechCrunch"),
      publishedAt: z.string().describe("ISO date if known, otherwise empty string"),
      summary: z.string().describe("3–5 sentences in English with the key facts"),
    }),
  ),
});

/** Ask Claude (with web search) for the latest news about a topic. */
export async function searchTopicNews(topic: Topic, sinceHours: number, maxItems: number): Promise<NewsItem[]> {
  const days = Math.max(1, Math.round(sinceHours / 24));
  const today = new Date().toISOString().slice(0, 10);
  const { items } = await aiObject(resultSchema, {
    web: "search",
    instructions: [
      "You are an AI news researcher. Use web search to find real, recent news. Never invent items.",
      "Prefer official sources (company blogs, papers, release notes) and reputable tech outlets. Skip SEO spam, listicles, rumor farms and how-to guides.",
      "Each item must be a separate news story with its own direct URL.",
    ].join("\n"),
    prompt: [
      `Today is ${today}. Find up to ${maxItems} of the most important news stories from the last ${days} day(s) about "${topic.name}" in the field of artificial intelligence.`,
      lines(topic.keywords).length ? `Related names / search terms: ${lines(topic.keywords).join(", ")}.` : "",
      "Only include stories published within that period. If there is no real news, return an empty list.",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  return items
    .filter((i) => /^https?:\/\//.test(i.url))
    .map((i) => {
      const date = i.publishedAt ? new Date(i.publishedAt) : null;
      return {
        url: i.url,
        title: i.title,
        summary: i.summary,
        sourceName: i.source,
        publishedAt: date && !Number.isNaN(date.getTime()) ? date : null,
      };
    });
}
