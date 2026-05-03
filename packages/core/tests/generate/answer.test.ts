import { describe, it, expect, vi } from "vitest";
import { generateAnswer, AnswerSchema } from "../../src/generate/answer.js";

describe("generateAnswer", () => {
  it("calls LLM with formatted context and parses structured response", async () => {
    const fakeJson = {
      answer: "To reset your password, go to settings.",
      citations: [{ chunkId: 7, quote: "Go to settings." }],
      confidence: 0.92,
      escalate: false,
    };
    const fakeClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(fakeJson) } }],
          }),
        },
      },
    } as any;

    const out = await generateAnswer({
      client: fakeClient,
      query: "how to reset password",
      chunks: [
        {
          chunkId: 7,
          documentId: 1,
          text: "Go to settings.",
          score: 0.9,
          source: "hybrid",
        },
      ],
    });

    expect(AnswerSchema.parse(out)).toEqual(fakeJson);
    expect(fakeClient.chat.completions.create).toHaveBeenCalledOnce();
    const callArgs = fakeClient.chat.completions.create.mock.calls[0][0];
    expect(callArgs.response_format?.type).toBe("json_schema");
    expect(callArgs.messages[0].role).toBe("system");
    expect(callArgs.messages[1].content).toContain("how to reset password");
    expect(callArgs.messages[1].content).toContain("[7]");
  });

  it("throws on malformed model output", async () => {
    const fakeClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "not json" } }],
          }),
        },
      },
    } as any;

    await expect(
      generateAnswer({
        client: fakeClient,
        query: "q",
        chunks: [
          {
            chunkId: 1,
            documentId: 1,
            text: "t",
            score: 0.9,
            source: "hybrid",
          },
        ],
      }),
    ).rejects.toThrow();
  });
});
