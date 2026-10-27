import { aiStatus } from "./env.js";

/* ---------- Chat ---------- */

export interface ChatRequestMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequestBody {
  /** Client-side chat id, echoed for logging only. */
  chatId?: string;
  message: string;
  history: ChatRequestMessage[];
  /** Optional document to ground the answer in. */
  docId?: string;
  /** Ask about the selected doc rather than general NLP knowledge. */
  docQuestion?: boolean;
}

/* ---------- Streaming (SSE events server -> client) ---------- */

export type ChatStreamEvent =
  | { type: "meta"; mode: "live" | "demo"; model: string | null }
  | { type: "delta"; text: string }
  | { type: "done"; intent?: string }
  | { type: "error"; message: string };

/* ---------- Health ---------- */

export interface HealthResponse {
  status: "ok";
  app: string;
  mode: "live" | "demo";
  ai: ReturnType<typeof aiStatus>;
  uptimeSeconds: number;
}

/* ---------- Documents ---------- */

export interface DocChunk {
  page: number; // 1-based; 1 for plain text files
  text: string;
}

export interface DocMeta {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  pageCount: number;
  charCount: number;
  preview: string;
  status: "ok" | "trimmed";
  /** Set when the library returned page-level text; null for plain text files. */
  pages?: number | null;
}

/* ---------- Quiz ---------- */

export interface QuizQuestion {
  id: string;
  topic: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  question: string;
  options: string[]; // exactly 4
  /** zero-based index into options */
  answerIndex: number;
  explanation: string;
}

export interface QuizResponse {
  questions: QuizQuestion[];
  source: "ai" | "built-in";
}

/* ---------- Errors ---------- */

export class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}
