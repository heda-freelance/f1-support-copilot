import { z } from "zod";

export const CaseSchema = z.object({
  id: z.string(),
  query: z.string(),
  expectedCitationDocs: z.array(z.string()).default([]),
  mustContain: z.array(z.string()).default([]),
  mustEscalate: z.boolean().default(false),
});

export type EvalCase = z.infer<typeof CaseSchema>;

export const CaseListSchema = z.array(CaseSchema);
