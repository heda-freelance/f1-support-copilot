import { describe, it, expect, vi } from "vitest";
import {
  answerMention,
  formatReply,
  stripMention,
} from "../src/handler.js";
import type { Answer, RetrievedChunk } from "@support-copilot/core";

const chunk = (id: number, text: string): RetrievedChunk => ({
  chunkId: id,
  documentId: 1,
  text,
  score: 0.9,
  source: "hybrid",
});

const ans = (over: Partial<Answer> = {}): Answer => ({
  answer: "Reset via settings.",
  citations: [{ chunkId: 1, quote: "Go to settings." }],
  confidence: 0.91,
  escalate: false,
  ...over,
});

describe("stripMention", () => {
  it("removes <@USER> tokens and trims", () => {
    expect(stripMention("<@U123> how do I reset password?")).toBe(
      "how do I reset password?",
    );
  });

  it("removes multiple mentions", () => {
    expect(stripMention("<@U1> hi <@U2> there")).toBe("hi  there");
  });

  it("returns empty string when only mention", () => {
    expect(stripMention("<@U123>")).toBe("");
  });
});

describe("formatReply", () => {
  it("renders answer + citation lines + confidence", () => {
    const out = formatReply(ans());
    expect(out).toContain("Reset via settings.");
    expect(out).toContain("> [1] Go to settings.");
    expect(out).toContain("_confidence: 0.91_");
    expect(out).not.toContain("escalating");
  });

  it("shows escalating tag when escalate=true", () => {
    const out = formatReply(ans({ escalate: true, confidence: 0.2 }));
    expect(out).toContain("_confidence: 0.20 — escalating_");
  });

  it("falls back to _no citations_ when none", () => {
    const out = formatReply(ans({ citations: [] }));
    expect(out).toContain("_no citations_");
  });
});

describe("answerMention", () => {
  it("short-circuits empty queries without calling deps", async () => {
    const deps = {
      retrieve: vi.fn(),
      generate: vi.fn(),
      guard: vi.fn(),
    };
    const out = await answerMention("<@U123>", deps);
    expect(out.empty).toBe(true);
    expect(out.text).toBe("Ask me a question about the docs.");
    expect(deps.retrieve).not.toHaveBeenCalled();
    expect(deps.generate).not.toHaveBeenCalled();
    expect(deps.guard).not.toHaveBeenCalled();
  });

  it("pipelines retrieve → generate → guard and formats", async () => {
    const chunks = [chunk(1, "Go to settings.")];
    const raw = ans();
    const guarded = ans({ confidence: 0.8 });

    const deps = {
      retrieve: vi.fn().mockResolvedValue(chunks),
      generate: vi.fn().mockResolvedValue(raw),
      guard: vi.fn().mockReturnValue(guarded),
    };

    const out = await answerMention(
      "<@U123> how do I reset password?",
      deps,
    );

    expect(deps.retrieve).toHaveBeenCalledWith("how do I reset password?");
    expect(deps.generate).toHaveBeenCalledWith({
      query: "how do I reset password?",
      chunks,
    });
    expect(deps.guard).toHaveBeenCalledWith(raw, chunks);
    expect(out.empty).toBe(false);
    expect(out.text).toContain("Reset via settings.");
    expect(out.text).toContain("_confidence: 0.80_");
  });

  it("propagates escalation through guard", async () => {
    const chunks = [chunk(1, "Go to settings.")];
    const raw = ans();
    const guarded = ans({
      escalate: true,
      confidence: 0.2,
      answer: "I don't know.",
    });

    const out = await answerMention("<@U1> q?", {
      retrieve: vi.fn().mockResolvedValue(chunks),
      generate: vi.fn().mockResolvedValue(raw),
      guard: vi.fn().mockReturnValue(guarded),
    });

    expect(out.text).toContain("I don't know.");
    expect(out.text).toContain("escalating");
  });
});
