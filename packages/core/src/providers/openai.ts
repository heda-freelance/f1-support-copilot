import OpenAI from "openai";
import { CohereClient } from "cohere-ai";
import { embedTexts } from "../ingest/embed.js";
import { generateAnswer } from "../generate/answer.js";
import { rerank as cohereRerank } from "../retrieve/rerank.js";
import type { ModelProviders } from "./types.js";

export function buildOpenAIProvider(env: NodeJS.ProcessEnv): ModelProviders {
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const cohere = new CohereClient({ token: env.COHERE_API_KEY });
  return {
    chat: {
      generateAnswer: ({ query, chunks }) =>
        generateAnswer({ client: openai, query, chunks }),
    },
    embed: {
      embed: (texts) => embedTexts(texts, { client: openai }),
      dimensions: () => 1536,
    },
    rerank: {
      rerank: (q, c, opts) => cohereRerank(cohere, q, c, opts),
    },
  };
}
