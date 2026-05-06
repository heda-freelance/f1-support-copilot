import type { Answer, RetrievedChunk } from "@support-copilot/core";

export interface MentionDeps {
  retrieve: (query: string) => Promise<RetrievedChunk[]>;
  generate: (input: {
    query: string;
    chunks: RetrievedChunk[];
  }) => Promise<Answer>;
  guard: (raw: Answer, chunks: RetrievedChunk[]) => Answer;
}

export function stripMention(text: string): string {
  return text.replace(/<@[^>]+>/g, "").trim();
}

export function formatReply(guarded: Answer): string {
  const citationLines = guarded.citations
    .map((c) => `> [${c.chunkId}] ${c.quote}`)
    .join("\n");
  return `${guarded.answer}\n\n${citationLines || "_no citations_"}\n\n_confidence: ${guarded.confidence.toFixed(2)}${guarded.escalate ? " — escalating" : ""}_`;
}

export async function answerMention(
  rawText: string,
  deps: MentionDeps,
): Promise<{ text: string; empty: boolean }> {
  const query = stripMention(rawText);
  if (!query) {
    return { text: "Ask me a question about the docs.", empty: true };
  }
  const chunks = await deps.retrieve(query);
  const raw = await deps.generate({ query, chunks });
  const guarded = deps.guard(raw, chunks);
  return { text: formatReply(guarded), empty: false };
}
