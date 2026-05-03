import OpenAI from "openai";
import { generateAnswer } from "../generate/answer.js";
import type { RetrievedChunk } from "../retrieve/vector.js";
import type { ModelProviders } from "./types.js";

export interface LocalConfig {
  llmUrl: string;
  embedUrl: string;
  rerankUrl: string;
  embedDim: number;
  llmModel: string;
}

export function buildLocalProvider(cfg: LocalConfig): ModelProviders {
  const llm = new OpenAI({ apiKey: "local", baseURL: cfg.llmUrl });

  return {
    chat: {
      generateAnswer: ({ query, chunks }) =>
        generateAnswer({
          client: llm,
          query,
          chunks,
          model: cfg.llmModel,
        }),
    },
    embed: {
      dimensions: () => cfg.embedDim,
      embed: async (texts) => {
        if (texts.length === 0) return [];
        const res = await fetch(`${cfg.embedUrl}/embed`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ inputs: texts }),
        });
        if (!res.ok) throw new Error(`tei embed: ${res.status}`);
        return (await res.json()) as number[][];
      },
    },
    rerank: {
      rerank: async (
        query: string,
        chunks: RetrievedChunk[],
        opts: { topN: number },
      ) => {
        if (chunks.length === 0) return [];
        const res = await fetch(`${cfg.rerankUrl}/rerank`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            query,
            texts: chunks.map((c) => c.text),
            return_text: false,
          }),
        });
        if (!res.ok) throw new Error(`tei rerank: ${res.status}`);
        const json = (await res.json()) as { index: number; score: number }[];
        return json
          .sort((a, b) => b.score - a.score)
          .slice(0, opts.topN)
          .map((r) => ({ ...chunks[r.index]!, score: r.score }));
      },
    },
  };
}
