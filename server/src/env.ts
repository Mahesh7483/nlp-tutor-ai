import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Always load the .env that lives next to the server package root,
// regardless of the process working directory.
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config(); // fall back to process-level env too

function str(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

function int(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export type AppModes = "live" | "demo";

const baseUrl = str("AI_BASE_URL", "").replace(/\/+$/, "");
const apiKey = str("AI_API_KEY", "");
const model = str("AI_MODEL", "");

export const config = {
  port: int("PORT", 8787),
  mode: "demo" as AppModes,
  ai: {
    baseUrl,
    apiKey,
    model,
    configured: Boolean(baseUrl && apiKey && model),
    timeoutMs: int("AI_TIMEOUT_MS", 120_000),
  },
  limits: {
    maxMessageChars: int("MAX_MESSAGE_CHARS", 8_000),
    maxHistoryMessages: 30,
    maxDocBytes: int("MAX_DOC_BYTES", 20_000_000), // 20 MB upload cap
    maxDocChars: int("MAX_DOC_CHARS", 400_000), // extracted text cap
    maxStoredDocs: 10,
    groundingCharBudget: 12_000,
  },
} as {
  port: number;
  mode: "live" | "demo";
  ai: {
    baseUrl: string;
    apiKey: string;
    model: string;
    configured: boolean;
    timeoutMs: number;
  };
  limits: {
    maxMessageChars: number;
    maxHistoryMessages: number;
    maxDocBytes: number;
    maxDocChars: number;
    maxStoredDocs: number;
    groundingCharBudget: number;
  };
};

// Live mode is requested only when all three AI variables are present.
if (config.ai.configured) {
  config.mode = "live";
}

/** Public (secret-free) description of the AI configuration. */
export const aiStatus = () => ({
  mode: config.mode,
  configured: config.ai.configured,
  model: config.ai.model || null,
  baseUrl: config.ai.baseUrl || null,
  requires: config.ai.configured
    ? []
    : ["AI_API_KEY", "AI_BASE_URL", "AI_MODEL"].filter((k) => !process.env[k]),
});
