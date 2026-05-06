import { beforeAll, describe, expect, it, vi } from "vitest";

const retrieveMock = vi.fn();
const applyGuardMock = vi.fn();
const generateAnswerMock = vi.fn();
const embedMock = vi.fn();
const rerankMock = vi.fn();
const vectorSearchMock = vi.fn();
const bm25SearchMock = vi.fn();

vi.mock("@support-copilot/core", () => ({
  createDbClient: vi.fn(() => ({})),
  vectorSearch: vectorSearchMock,
  bm25Search: bm25SearchMock,
  retrieve: retrieveMock,
  applyGuard: applyGuardMock,
  buildProviders: vi.fn(() => ({
    chat: { generateAnswer: generateAnswerMock },
    embed: { embed: embedMock, dimensions: () => 1536 },
    rerank: { rerank: rerankMock },
    minConfidence: 0.5,
  })),
}));

beforeAll(() => {
  process.env.DATABASE_URL = "postgres://stub";
});

async function loadRoute() {
  return await import("../../app/api/ask/route.js");
}

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ask", () => {
  it("returns 400 when query missing", async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "query required" });
  });

  it("returns guarded answer with chunk text on each citation", async () => {
    const chunks = [
      {
        chunkId: 1,
        documentId: 10,
        text: "Reset password via Settings → Account.",
        score: 0.9,
        source: "vector" as const,
      },
      {
        chunkId: 2,
        documentId: 11,
        text: "Two-factor codes expire after 30 seconds.",
        score: 0.8,
        source: "bm25" as const,
      },
    ];
    retrieveMock.mockResolvedValueOnce(chunks);
    embedMock.mockResolvedValueOnce([[0.1, 0.2]]);
    generateAnswerMock.mockResolvedValueOnce({
      answer: "Reset via Settings.",
      citations: [{ chunkId: 1, quote: "Settings → Account" }],
      confidence: 0.9,
      escalate: false,
    });
    applyGuardMock.mockImplementationOnce((ans) => ans);

    const { POST } = await loadRoute();
    const res = await POST(makeReq({ query: "how do I reset password" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      answer: "Reset via Settings.",
      citations: [
        {
          chunkId: 1,
          quote: "Settings → Account",
          text: "Reset password via Settings → Account.",
        },
      ],
      confidence: 0.9,
      escalate: false,
    });
    expect(applyGuardMock).toHaveBeenCalledWith(expect.anything(), chunks, {
      minConfidence: 0.5,
    });
  });

  it("sets citation text=null when chunkId not in retrieved chunks", async () => {
    const chunks = [
      {
        chunkId: 1,
        documentId: 10,
        text: "Some doc.",
        score: 0.9,
        source: "vector" as const,
      },
    ];
    retrieveMock.mockResolvedValueOnce(chunks);
    generateAnswerMock.mockResolvedValueOnce({
      answer: "fallback",
      citations: [{ chunkId: 999, quote: "ghost" }],
      confidence: 0.1,
      escalate: true,
    });
    applyGuardMock.mockImplementationOnce((ans) => ans);

    const { POST } = await loadRoute();
    const res = await POST(makeReq({ query: "anything" }));
    const body = await res.json();
    expect(body.citations).toEqual([
      { chunkId: 999, quote: "ghost", text: null },
    ]);
    expect(body.escalate).toBe(true);
  });

  it("propagates guard fallback (low confidence triggers escalate)", async () => {
    const chunks = [
      {
        chunkId: 1,
        documentId: 10,
        text: "Doc text.",
        score: 0.5,
        source: "vector" as const,
      },
    ];
    retrieveMock.mockResolvedValueOnce(chunks);
    generateAnswerMock.mockResolvedValueOnce({
      answer: "uncertain",
      citations: [{ chunkId: 1, quote: "Doc text." }],
      confidence: 0.2,
      escalate: false,
    });
    applyGuardMock.mockImplementationOnce((ans) => ({
      ...ans,
      escalate: true,
      answer: "I don't know — escalating.",
    }));

    const { POST } = await loadRoute();
    const res = await POST(makeReq({ query: "obscure" }));
    const body = await res.json();
    expect(body.escalate).toBe(true);
    expect(body.answer).toBe("I don't know — escalating.");
  });
});
