import type {
  ChatRequestMessage,
  ChatStreamEvent,
  DocMeta,
  HealthResponse,
  QuizResponse,
} from "../types";

const BASE = "/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  const contentType = res.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await res.json().catch(() => null)
    : await res.text().catch(() => "");
  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "error" in body
        ? (body as { error: string }).error
        : typeof body === "string" && body
          ? body
          : "") || `Request failed with status ${res.status}`;
    throw new ApiError(res.status, message);
  }
  return body as T;
}

/* ---------- health ---------- */

export const getHealth = () => request<HealthResponse>("/health");

/* ---------- chat ---------- */

export interface ChatStreamOptions {
  message: string;
  history: ChatRequestMessage[];
  docId?: string;
  docQuestion?: boolean;
  abortSignal: AbortSignal;
  onMeta?: (mode: "live" | "demo") => void;
  onDelta: (text: string) => void;
  onDone?: () => void;
  onError: (message: string) => void;
}

/**
 * Streams a chat response via fetch + SSE parsing.
 * Resolves when the stream ends (done/error/aborted).
 */
export async function streamChat(opts: ChatStreamOptions): Promise<void> {
  const { abortSignal } = opts;
  let response: Response;
  try {
    response = await fetch(`${BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: opts.message,
        history: opts.history,
        docId: opts.docId,
        docQuestion: opts.docQuestion,
      }),
      signal: abortSignal,
    });
  } catch (err) {
    if (abortSignal.aborted) return; // user-initiated stop
    opts.onError(
      `Could not reach the tutoring server. Is the backend running? (npm run dev:server) — ${err instanceof Error ? err.message : String(err)}`,
    );
    return;
  }

  if (!response.ok) {
    let message = `The tutoring server returned status ${response.status}`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      /* non-JSON error body */
    }
    opts.onError(message);
    return;
  }

  if (!response.body) {
    opts.onError("The server returned an empty stream.");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;

  const finalize = () => {
    if (!finished) {
      finished = true;
      opts.onDone?.();
    }
  };

  while (true) {
    let read: ReadableStreamReadResult<Uint8Array>;
    try {
      read = await reader.read();
    } catch {
      if (abortSignal.aborted) {
        finalize();
        return;
      }
      opts.onError("The connection to the server dropped while streaming.");
      return;
    }
    if (read.done) break;
    buffer += decoder.decode(read.value, { stream: true });

    let idx = buffer.indexOf("\n");
    while (idx !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      idx = buffer.indexOf("\n");

      if (!line.startsWith("data:")) continue;
      let event: ChatStreamEvent;
      try {
        event = JSON.parse(line.slice(5)) as ChatStreamEvent;
      } catch {
        continue;
      }
      switch (event.type) {
        case "meta":
          opts.onMeta?.(event.mode ?? "demo");
          break;
        case "delta":
          if (event.text) opts.onDelta(event.text);
          break;
        case "done":
          finalize();
          return;
        case "error":
          opts.onError(event.message || "The tutor failed to produce a response.");
          break;
      }
    }
  }
  // Stream ended without an explicit done marker.
  if (!abortSignal.aborted) finalize();
}

/* ---------- documents ---------- */

export const listDocuments = () =>
  request<{ documents: DocMeta[] }>("/documents").then((d) => d.documents);

export async function uploadDocument(file: File): Promise<DocMeta> {
  const form = new FormData();
  form.append("file", file);
  return request<DocMeta>("/documents", { method: "POST", body: form });
}

export const deleteDocument = (id: string) =>
  request<{ deleted: boolean }>(`/documents/${id}`, { method: "DELETE" });

/* ---------- quiz ---------- */

export interface QuizRequest {
  topics: string[];
  difficulty: string;
  count: number;
}

export const generateQuiz = (payload: QuizRequest) =>
  request<QuizResponse>("/quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
