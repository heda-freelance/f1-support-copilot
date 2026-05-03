import { describe, it, expect } from "vitest";
import { applyGuard } from "../../src/generate/guard.js";
import type { Answer } from "../../src/generate/answer.js";
import type { RetrievedChunk } from "../../src/retrieve/vector.js";

const chunk = (id: number, text: string): RetrievedChunk => ({
  chunkId: id,
  documentId: 1,
  text,
  score: 0.9,
  source: "hybrid",
});

const baseAnswer: Answer = {
  answer: "Reset via settings.",
  citations: [{ chunkId: 1, quote: "Go to settings." }],
  confidence: 0.9,
  escalate: false,
};

describe("applyGuard", () => {
  it("passes a well-grounded answer through unchanged", () => {
    const out = applyGuard(baseAnswer, [chunk(1, "Go to settings.")], {
      minConfidence: 0.5,
    });
    expect(out.escalate).toBe(false);
    expect(out.answer).toBe("Reset via settings.");
  });

  it("escalates when confidence below threshold", () => {
    const low: Answer = { ...baseAnswer, confidence: 0.3 };
    const out = applyGuard(low, [chunk(1, "Go to settings.")], {
      minConfidence: 0.5,
    });
    expect(out.escalate).toBe(true);
    expect(out.answer.toLowerCase()).toContain("don't know");
  });

  it("escalates when no citation references retrieved chunk ids", () => {
    const ungrounded: Answer = {
      ...baseAnswer,
      citations: [{ chunkId: 999, quote: "fabricated" }],
    };
    const out = applyGuard(ungrounded, [chunk(1, "Go to settings.")], {
      minConfidence: 0.5,
    });
    expect(out.escalate).toBe(true);
  });

  it("escalates when quote is not contained verbatim in cited chunk", () => {
    const wrongQuote: Answer = {
      ...baseAnswer,
      citations: [{ chunkId: 1, quote: "this text is nowhere in the chunk" }],
    };
    const out = applyGuard(wrongQuote, [chunk(1, "Go to settings.")], {
      minConfidence: 0.5,
    });
    expect(out.escalate).toBe(true);
  });
});
