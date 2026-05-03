import OpenAI from "openai";
import { generateAnswer } from "../generate/answer.js";
import type { RetrievedChunk } from "../retrieve/vector.js";
import type { ModelProviders } from "./types.js";

export interface LocalConfig {
  llmUrl: string;
  llmModel: string;
  embedUrl: string;
  embedModel: string;
  embedDim: number;
  rerankUrl: string;
  rerankModel: string;
}

export function buildLocalProvider(cfg: LocalConfig): ModelProviders {
  const llm = new OpenAI({ apiKey: "local", baseURL: cfg.llmUrl });
  const embedClient = new OpenAI({ apiKey: "local", baseURL: cfg.embedUrl });

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
        const out: number[][] = [];
        for (let i = 0; i < texts.length; i += 64) {
          const batch = texts.slice(i, i + 64);
          const res = await embedClient.embeddings.create({
            model: cfg.embedModel,
            input: batch,
            encoding_format: "float",
          });
          for (const item of res.data) out.push(item.embedding as number[]);
        }
        return out;
      },
    },
    rerank: {
      rerank: async (
        query: string,
        chunks: RetrievedChunk[],
        opts: { topN: number },
      ) => {
        if (chunks.length === 0) return [];
        const res = await fetch(`${cfg.rerankUrl}/v1/rerank`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: cfg.rerankModel,
            query,
            documents: chunks.map((c) => c.text),
          }),
        });
        if (!res.ok) throw new Error(`llama.cpp rerank: ${res.status}`);
        const json = (await res.json()) as {
          results: { index: number; relevance_score: number }[];
        };
        return json.results
          .sort((a, b) => b.relevance_score - a.relevance_score)
          .slice(0, opts.topN)
          .map((r) => ({
            ...chunks[r.index]!,
            score: r.relevance_score,
          }));
      },
    },
  };
}
