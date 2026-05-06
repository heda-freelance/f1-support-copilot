import bolt from "@slack/bolt";
import {
  createDbClient,
  vectorSearch,
  bm25Search,
  retrieve,
  applyGuard,
  buildProviders,
} from "@support-copilot/core";
import { answerMention } from "./handler.js";

const { App } = bolt;

const app = new App({
  token: process.env.SLACK_BOT_TOKEN!,
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
});

const db = createDbClient(process.env.DATABASE_URL!);
const providers = buildProviders();

app.event("app_mention", async ({ event, say }) => {
  const reply = await answerMention(event.text, {
    retrieve: (query) =>
      retrieve(query, {
        embedQuery: async (q) => (await providers.embed.embed([q]))[0]!,
        vectorSearch: (vec, opts) => vectorSearch(db, vec, opts),
        bm25Search: (q, opts) => bm25Search(db, q, opts),
        rerank: (q, c, opts) => providers.rerank.rerank(q, c, opts),
        candidatePool: 20,
        topN: 6,
      }),
    generate: (input) => providers.chat.generateAnswer(input),
    guard: (raw, chunks) =>
      applyGuard(raw, chunks, {
        minConfidence: providers.minConfidence,
      }),
  });
  await say({ text: reply.text, thread_ts: event.ts });
});

const port = Number(process.env.PORT ?? 3000);
app.start(port).then(() => console.log(`slack-app listening on :${port}`));
