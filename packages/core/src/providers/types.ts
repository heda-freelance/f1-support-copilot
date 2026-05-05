import type { Answer } from "../generate/answer.js";
import type { RetrievedChunk } from "../retrieve/vector.js";

export interface ChatProvider {
  generateAnswer(input: {
    query: string;
    chunks: RetrievedChunk[];
  }): Promise<Answer>;
}

export interface EmbedProvider {
  embed(texts: string[]): Promise<number[][]>;
  dimensions(): number;
}

export interface RerankProvider {
  rerank(
    query: string,
    chunks: RetrievedChunk[],
    opts: { topN: number },
  ): Promise<RetrievedChunk[]>;
}

export interface ModelProviders {
  chat: ChatProvider;
  embed: EmbedProvider;
  rerank: RerankProvider;
  minConfidence: number;
}
