import type { Answer } from "./answer.js";
import type { RetrievedChunk } from "../retrieve/vector.js";

const FALLBACK =
  "I don't know based on the available docs — escalating to a human agent.";

export interface GuardOptions {
  minConfidence: number;
}

export function applyGuard(
  ans: Answer,
  chunks: RetrievedChunk[],
  opts: GuardOptions,
): Answer {
  const validIds = new Set(chunks.map((c) => c.chunkId));

  const reasons: string[] = [];
  if (ans.confidence < opts.minConfidence) reasons.push("low_confidence");

  const citedKnown = ans.citations.filter((c) => validIds.has(c.chunkId));
  if (citedKnown.length === 0) reasons.push("no_grounded_citation");

  for (const cit of citedKnown) {
    const chunk = chunks.find((c) => c.chunkId === cit.chunkId)!;
    const normalized = (s: string) =>
      s.replace(/\s+/g, " ").toLowerCase().trim();
    if (!normalized(chunk.text).includes(normalized(cit.quote))) {
      reasons.push(`quote_not_in_chunk_${cit.chunkId}`);
    }
  }

  if (reasons.length > 0) {
    return { ...ans, escalate: true, answer: FALLBACK };
  }
  return ans;
}
