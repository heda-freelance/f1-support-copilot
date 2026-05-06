"use client";
import { useState } from "react";

interface Citation {
  chunkId: number;
  quote: string;
  text: string | null;
}
interface Result {
  answer: string;
  citations: Citation[];
  confidence: number;
  escalate: boolean;
}

export default function Home() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function ask() {
    setBusy(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      setResult(data);
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && q && !busy) ask();
  }

  const confidencePct = result ? Math.round(result.confidence * 100) : 0;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Support Copilot
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Ask a question. Get a cited answer.
        </p>
      </header>

      <div className="space-y-3">
        <div className="relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="How can I reset my password?"
            className="w-full rounded-lg border border-neutral-200 bg-white px-4 py-3 text-[15px] text-neutral-900 placeholder:text-neutral-400 shadow-sm transition focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-200"
          />
        </div>
        <div className="flex justify-end">
          <button
            onClick={ask}
            disabled={busy || !q}
            className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {busy ? "Thinking…" : "Ask"}
          </button>
        </div>
      </div>

      {result && (
        <section className="mt-10 space-y-6">
          <article className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-800">
              {result.answer}
            </p>
            <div className="mt-5 flex items-center gap-3 border-t border-neutral-100 pt-4">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Confidence
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={`h-full rounded-full transition-all ${
                    result.escalate ? "bg-amber-500" : "bg-neutral-900"
                  }`}
                  style={{ width: `${confidencePct}%` }}
                />
              </div>
              <span className="tabular-nums text-xs text-neutral-600">
                {confidencePct}%
              </span>
              {result.escalate && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                  Escalating
                </span>
              )}
            </div>
          </article>

          {result.citations.length > 0 && (
            <div>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                Sources
              </h2>
              <ul className="space-y-2">
                {result.citations.map((c, i) => (
                  <li
                    key={`${c.chunkId}-${i}`}
                    className="flex gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-600 shadow-sm"
                  >
                    <span className="font-mono text-xs text-neutral-400">
                      [{c.chunkId}]
                    </span>
                    <span className="leading-relaxed">{c.quote}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
