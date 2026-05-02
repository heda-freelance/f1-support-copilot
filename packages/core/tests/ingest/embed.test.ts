import { describe, it, expect, vi } from "vitest";
import { embedTexts } from "../../src/ingest/embed.js";

describe("embedTexts", () => {
  it("calls OpenAI with batched inputs and returns vectors aligned to input order", async () => {
    const create = vi
      .fn()
      .mockImplementation(async ({ input }: { input: string[] }) => ({
        data: input.map((_, i) => ({ embedding: new Array(1536).fill(i) })),
      }));
    const fakeClient = { embeddings: { create } } as any;

    const out = await embedTexts(["a", "b", "c"], {
      client: fakeClient,
      batchSize: 2,
    });

    expect(out).toHaveLength(3);
    expect(out[0]?.length).toBe(1536);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]?.[0].input).toEqual(["a", "b"]);
    expect(create.mock.calls[1]?.[0].input).toEqual(["c"]);
  });

  it("returns empty array for empty input without calling api", async () => {
    const create = vi.fn();
    const fakeClient = { embeddings: { create } } as any;
    const out = await embedTexts([], { client: fakeClient, batchSize: 10 });
    expect(out).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });
});
