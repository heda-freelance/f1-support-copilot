import { describe, it, expect, vi } from "vitest";
import { runCases } from "../../src/eval/runner.js";
import type { EvalCase } from "../../src/eval/types.js";

const cases: EvalCase[] = [
  {
    id: "reset",
    query: "reset password",
    expectedCitationDocs: ["account-settings"],
    mustContain: ["settings"],
    mustEscalate: false,
  },
  {
    id: "unknown",
    query: "what is the meaning of life",
    expectedCitationDocs: [],
    mustContain: [],
    mustEscalate: true,
  },
];

describe("runCases", () => {
  it("evaluates each case and returns pass/fail report", async () => {
    const answer = vi.fn().mockImplementation(async (q: string) => {
      if (q === "reset password") {
        return {
          answer: "Reset via settings page.",
          citations: [{ chunkId: 1, quote: "settings" }],
          confidence: 0.9,
          escalate: false,
          _docSources: ["account-settings"],
        };
      }
      return {
        answer: "I don't know.",
        citations: [],
        confidence: 0.1,
        escalate: true,
        _docSources: [],
      };
    });

    const report = await runCases(cases, answer);
    expect(report.total).toBe(2);
    expect(report.passed).toBe(2);
    expect(report.results.find((r) => r.id === "reset")?.passed).toBe(true);
    expect(report.results.find((r) => r.id === "unknown")?.passed).toBe(true);
  });

  it("flags failure when mustContain is missing", async () => {
    const answer = vi.fn().mockResolvedValue({
      answer: "Some unrelated text.",
      citations: [{ chunkId: 1, quote: "x" }],
      confidence: 0.9,
      escalate: false,
      _docSources: ["account-settings"],
    });
    const report = await runCases([cases[0]!], answer);
    expect(report.passed).toBe(0);
    expect(report.results[0]?.failures).toContain(
      "missing_must_contain:settings",
    );
  });
});
