import type { EvalCase } from "./types.js";

export interface AnnotatedAnswer {
  answer: string;
  citations: { chunkId: number; quote: string }[];
  confidence: number;
  escalate: boolean;
  _docSources: string[];
}

export interface CaseResult {
  id: string;
  passed: boolean;
  failures: string[];
  answer: AnnotatedAnswer;
}

export interface RunReport {
  total: number;
  passed: number;
  results: CaseResult[];
}

export async function runCases(
  cases: EvalCase[],
  answer: (query: string) => Promise<AnnotatedAnswer>,
): Promise<RunReport> {
  const results: CaseResult[] = [];
  for (const c of cases) {
    const ans = await answer(c.query);
    const failures: string[] = [];

    for (const phrase of c.mustContain) {
      if (!ans.answer.toLowerCase().includes(phrase.toLowerCase())) {
        failures.push(`missing_must_contain:${phrase}`);
      }
    }

    if (c.mustEscalate && !ans.escalate) failures.push("expected_escalate");
    if (!c.mustEscalate && ans.escalate) failures.push("unexpected_escalate");

    if (c.expectedCitationDocs.length > 0) {
      const cited = new Set(ans._docSources);
      for (const d of c.expectedCitationDocs) {
        if (!cited.has(d)) failures.push(`missing_citation_doc:${d}`);
      }
    }

    results.push({
      id: c.id,
      passed: failures.length === 0,
      failures,
      answer: ans,
    });
  }
  return {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    results,
  };
}
