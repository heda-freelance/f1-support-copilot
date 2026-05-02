import { encodingForModel } from "js-tiktoken";

const enc = encodingForModel("gpt-4o-mini");

export interface Chunk {
  index: number;
  text: string;
  tokenCount: number;
}

export interface ChunkOptions {
  maxTokens: number;
  overlap: number;
}

export function countTokens(text: string): number {
  if (!text) return 0;
  return enc.encode(text).length;
}

export function chunkText(text: string, opts: ChunkOptions): Chunk[] {
  if (opts.maxTokens <= 0) throw new Error("maxTokens must be > 0");
  if (opts.overlap < 0 || opts.overlap >= opts.maxTokens) {
    throw new Error("overlap must satisfy 0 <= overlap < maxTokens");
  }

  const tokens = enc.encode(text);
  if (tokens.length === 0) return [];
  if (tokens.length <= opts.maxTokens) {
    return [{ index: 0, text, tokenCount: tokens.length }];
  }

  const stride = opts.maxTokens - opts.overlap;
  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < tokens.length) {
    const end = Math.min(start + opts.maxTokens, tokens.length);
    const slice = tokens.slice(start, end);
    const decoded = enc.decode(slice);
    chunks.push({ index, text: decoded, tokenCount: slice.length });
    if (end === tokens.length) break;
    start += stride;
    index += 1;
  }

  return chunks;
}
