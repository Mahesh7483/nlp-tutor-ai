/* Shared client-side types. Mirrors the server API contract. */

export type ProviderMode = "live" | "demo";
export type Role = "user" | "assistant";
export type Difficulty = "beginner" | "intermediate" | "advanced" | "mixed";

/* ---------- health ---------- */

export interface AiStatus {
  mode: ProviderMode;
  configured: boolean;
  model: string | null;
  baseUrl: string | null;
  requires: string[];
}

export interface HealthResponse {
  status: "ok";
  app: string;
  mode: ProviderMode;
  ai: AiStatus;
  uptimeSeconds: number;
}

/* ---------- chat ---------- */

export interface ChatRequestMessage {
  role: Role;
  content: string;
}

export interface ChatStreamEvent {
  type: "meta" | "delta" | "done" | "error";
  mode?: ProviderMode;
  model?: string | null;
  text?: string;
  message?: string;
}

/* ---------- chat history (localStorage) ---------- */

export interface StoredMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  /** assistant messages */
  error?: string;
  stopped?: boolean;
  mode?: ProviderMode;
}

export interface StoredChat {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: StoredMessage[];
  /** document attached to this chat, if any */
  docId?: string;
  docName?: string;
}

/* ---------- documents ---------- */

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
  pages?: number | null;
}

/* ---------- quiz ---------- */

export interface QuizQuestion {
  id: string;
  topic: string;
  difficulty: Difficulty;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface QuizResponse {
  questions: QuizQuestion[];
  source: "ai" | "built-in";
  bankSize?: number;
  mode?: string;
}
