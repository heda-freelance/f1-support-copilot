import { describe, it, expect, vi } from "vitest";
import { answerQuery } from "../../src/generate/index.js";
import type { RetrievedChunk } from "../../src/retrieve/vector.js";
import type { Answer } from "../../src/generate/answer.js";

const chunks: RetrievedChunk[] = [
  {
    chunkId: 1,
    documentId: 1,
    text: "Go to settings.",
    score: 0.9,
    source: "hybrid",
  },
];
const okAnswer: Answer = {
  answer: "Settings page.",
  citations: [{ chunkId: 1, quote: "Go to settings." }],
  confidence: 0.9,
  escalate: false,
};

describe("answerQuery", () => {
  it("retrieves chunks, generates answer, applies guard", async () => {
    const deps = {
      retrieve: vi.fn().mockResolvedValue(chunks),
      generate: vi.fn().mockResolvedValue(okAnswer),
      minConfidence: 0.5,
    };
    const out = await answerQuery("how reset password", deps);
    expect(deps.retrieve).toHaveBeenCalledWith("how reset password");
    expect(deps.generate).toHaveBeenCalledWith({
      query: "how reset password",
      chunks,
    });
    expect(out.escalate).toBe(false);
  });

  it("escalates when guard rejects ungrounded answer", async () => {
    const deps = {
      retrieve: vi.fn().mockResolvedValue(chunks),
      generate: vi.fn().mockResolvedValue({ ...okAnswer, confidence: 0.1 }),
      minConfidence: 0.5,
    };
    const out = await answerQuery("q", deps);
    expect(out.escalate).toBe(true);
  });
});
