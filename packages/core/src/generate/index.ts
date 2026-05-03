import { applyGuard } from "./guard.js";
import type { Answer } from "./answer.js";
import type { RetrievedChunk } from "../retrieve/vector.js";

export interface AnswerQueryDeps {
  retrieve: (query: string) => Promise<RetrievedChunk[]>;
  generate: (input: {
    query: string;
    chunks: RetrievedChunk[];
  }) => Promise<Answer>;
  minConfidence: number;
}

export async function answerQuery(
  query: string,
  deps: AnswerQueryDeps,
): Promise<Answer> {
  const chunks = await deps.retrieve(query);
  const ans = await deps.generate({ query, chunks });
  return applyGuard(ans, chunks, { minConfidence: deps.minConfidence });
}

export { generateAnswer, AnswerSchema, type Answer } from "./answer.js";
export { applyGuard } from "./guard.js";
