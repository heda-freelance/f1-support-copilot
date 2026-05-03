import OpenAI from "openai";
import { z } from "zod";
import type { RetrievedChunk } from "../retrieve/vector.js";

export const AnswerSchema = z.object({
  answer: z.string(),
  citations: z.array(z.object({ chunkId: z.number(), quote: z.string() })),
  confidence: z.number().min(0).max(1),
  escalate: z.boolean(),
});

export type Answer = z.infer<typeof AnswerSchema>;

const SYSTEM = `You are a B2B SaaS support copilot.
Use ONLY the provided context chunks to answer the user's question.
- Cite each fact you use by referencing chunk IDs in square brackets like [12].
- For each citation in your answer, include a "citations" entry with the chunkId and a short verbatim quote from that chunk.
- Set confidence between 0 and 1 based on how directly the chunks answer the question.
- If chunks do not contain the answer, set escalate=true, set confidence below 0.5, and politely say you don't know.
Output strictly valid JSON matching the provided schema.`;

const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "citations", "confidence", "escalate"],
  properties: {
    answer: { type: "string" },
    citations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["chunkId", "quote"],
        properties: {
          chunkId: { type: "integer" },
          quote: { type: "string" },
        },
      },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    escalate: { type: "boolean" },
  },
} as const;

export interface GenerateAnswerInput {
  client: OpenAI;
  query: string;
  chunks: RetrievedChunk[];
  model?: string;
}

export async function generateAnswer(
  input: GenerateAnswerInput,
): Promise<Answer> {
  const context = input.chunks
    .map((c) => `[${c.chunkId}] ${c.text}`)
    .join("\n\n");

  const res = await input.client.chat.completions.create({
    model: input.model ?? "gpt-4o-mini",
    temperature: 0.1,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "support_answer",
        strict: true,
        schema: JSON_SCHEMA,
      },
    },
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Question: ${input.query}\n\nContext:\n${context}`,
      },
    ],
  });

  const raw = res.choices[0]?.message.content ?? "";
  const parsed = JSON.parse(raw);
  return AnswerSchema.parse(parsed);
}
