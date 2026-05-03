import { buildOpenAIProvider } from "./openai.js";
import { buildLocalProvider } from "./local.js";
import type { ModelProviders } from "./types.js";

export function buildProviders(
  env: NodeJS.ProcessEnv = process.env,
): ModelProviders {
  const kind = env.MODEL_PROVIDER ?? "openai";
  if (kind === "local") {
    return buildLocalProvider({
      llmUrl: env.LOCAL_LLM_URL ?? "http://localhost:8080/v1",
      embedUrl: env.LOCAL_EMBED_URL ?? "http://localhost:8081",
      rerankUrl: env.LOCAL_RERANK_URL ?? "http://localhost:8082",
      embedDim: Number(env.LOCAL_EMBED_DIM ?? 768),
      llmModel: env.LOCAL_LLM_MODEL ?? "default",
    });
  }
  return buildOpenAIProvider(env);
}

export type {
  ModelProviders,
  ChatProvider,
  EmbedProvider,
  RerankProvider,
} from "./types.js";
export { buildOpenAIProvider } from "./openai.js";
export { buildLocalProvider } from "./local.js";
