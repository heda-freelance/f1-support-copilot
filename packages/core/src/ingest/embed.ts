import OpenAI from "openai";

export interface EmbedOptions {
  client?: OpenAI;
  model?: string;
  batchSize?: number;
}

export async function embedTexts(
  texts: string[],
  opts: EmbedOptions = {},
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const client = opts.client ?? new OpenAI();
  const model = opts.model ?? "text-embedding-3-small";
  const batchSize = opts.batchSize ?? 64;

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const res = await client.embeddings.create({ model, input: batch });
    for (const item of res.data) out.push(item.embedding as number[]);
  }
  return out;
}
