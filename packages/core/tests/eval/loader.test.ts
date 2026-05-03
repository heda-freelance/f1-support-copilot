import { describe, it, expect } from "vitest";
import { writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCases } from "../../src/eval/loader.js";

describe("loadCases", () => {
  it("loads valid yaml and validates schema", async () => {
    const dir = await mkdtemp(join(tmpdir(), "eval-"));
    const file = join(dir, "cases.yaml");
    await writeFile(
      file,
      `
- id: reset-password
  query: How do I reset my password?
  expectedCitationDocs: ["account-settings"]
  mustContain: ["settings"]
- id: billing
  query: When am I billed?
  expectedCitationDocs: ["billing-faq"]
`,
    );
    const cases = await loadCases(file);
    expect(cases).toHaveLength(2);
    expect(cases[0]?.id).toBe("reset-password");
    expect(cases[0]?.mustContain).toEqual(["settings"]);
  });

  it("rejects malformed cases", async () => {
    const dir = await mkdtemp(join(tmpdir(), "eval-"));
    const file = join(dir, "bad.yaml");
    await writeFile(file, "- id: missing-query\n");
    await expect(loadCases(file)).rejects.toThrow();
  });
});
