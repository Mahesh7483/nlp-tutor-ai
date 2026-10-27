import type {
  ChatRequestMessage,
  ChatStreamEvent,
  ChatRequestBody,
} from "../types.js";

export interface UpstreamRequest {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  temperature?: number;
}

export class UpstreamError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
  }
}

function completionUrl(baseUrl: string): string {
  const clean = baseUrl.replace(/\/+$/, "");
  return clean.endsWith("/chat/completions")
    ? clean
    : `${clean}/chat/completions`;
}

/** Map upstream failures to short, actionable messages. */
export function describeUpstreamFailure(status: number, body: string): string {
  const snippet = body.replace(/\s+/g, " ").slice(0, 300);
  switch (status) {
    case 401:
      return "The AI provider rejected the API key (401 Unauthorized). Check AI_API_KEY in server/.env.";
    case 403:
      return "The AI provider refused the request (403 Forbidden). Your key may lack access to this model.";
    case 404:
      return "The AI provider could not find the endpoint or model (404). Check AI_BASE_URL and AI_MODEL in server/.env.";
    case 429:
      return "Rate limit or quota exceeded at the AI provider (429). Try again shortly or check your plan/quota.";
    default:
      return `AI provider error (HTTP ${status}). ${snippet}`;
  }
}

/**
 * Streams an OpenAI-compatible chat completion, invoking onDelta for each
 * token chunk. Resolves with the full text. Throws UpstreamError on failure.
 */
export async function streamChatCompletion(
  opts: {
    baseUrl: string;
    apiKey: string;
    model: string;
    timeoutMs: number;
  },
  request: UpstreamRequest,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<string> {
  const url = completionUrl(opts.baseUrl);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: request.messages,
        stream: true,
        ...(request.temperature !== undefined
          ? { temperature: request.temperature }
          : {}),
      }),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(opts.timeoutMs)])
        : AbortSignal.timeout(opts.timeoutMs),
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new UpstreamError(
        `The AI provider did not respond within ${opts.timeoutMs / 1000}s. Check AI_BASE_URL and your network.`,
      );
    }
    throw new UpstreamError(
      `Could not reach the AI provider at ${opts.baseUrl}. ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    throw new UpstreamError(
      describeUpstreamFailure(response.status, text),
      response.status,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let sawAnything = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // OpenAI SSE: lines of "data: {...}" separated by \n\n
    let index: number;
    while ((index = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line || line.startsWith(":")) continue;
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload) as {
          choices?: { delta?: { content?: string }; text?: string }[];
          error?: { message?: string };
        };
        if (json.error) {
          throw new UpstreamError(json.error.message || "Provider returned an error mid-stream.");
        }
        const delta =
          json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.text ?? "";
        if (delta) {
          sawAnything = true;
          full += delta;
          onEvent({ type: "delta", text: delta });
        }
      } catch (err) {
        if (err instanceof UpstreamError) throw err;
        // Ignore malformed fragments rather than killing the stream.
      }
    }
  }

  if (!sawAnything) {
    throw new UpstreamError(
      "The AI provider accepted the request but returned no content. Check that AI_MODEL is a valid chat model for your endpoint.",
    );
  }
  return full;
}

/** Non-streaming completion, used for quiz generation. */
export async function getChatCompletion(
  opts: {
    baseUrl: string;
    apiKey: string;
    model: string;
    timeoutMs: number;
  },
  request: UpstreamRequest,
  signal?: AbortSignal,
): Promise<string> {
  const url = completionUrl(opts.baseUrl);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: request.messages,
        stream: false,
        ...(request.temperature !== undefined
          ? { temperature: request.temperature }
          : {}),
      }),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(opts.timeoutMs)])
        : AbortSignal.timeout(opts.timeoutMs),
    });
  } catch (err: unknown) {
    throw new UpstreamError(
      `Could not reach the AI provider at ${opts.baseUrl}. ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new UpstreamError(
      describeUpstreamFailure(response.status, text),
      response.status,
    );
  }
  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content ?? "";
}

/** Builds the message list sent upstream for a chat turn. */
export function buildUpstreamMessages(
  body: ChatRequestBody,
  systemPrompt: string,
): UpstreamRequest["messages"] {
  const history = body.history.slice(-30).map((m) => ({
    role: m.role,
    content: m.content.slice(0, 16_000),
  }));
  return [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: body.message },
  ] as UpstreamRequest["messages"];
}

export type { ChatRequestMessage };
