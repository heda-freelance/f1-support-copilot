import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { CaseListSchema, type EvalCase } from "./types.js";

export async function loadCases(path: string): Promise<EvalCase[]> {
  const raw = await readFile(path, "utf8");
  const parsed = parseYaml(raw);
  return CaseListSchema.parse(parsed);
}
