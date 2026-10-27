import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { config } from "../env.js";
import { parseBody, asyncHandler } from "../middleware/validation.js";
import { TUTOR_SYSTEM_PROMPT, buildNotesContext } from "../services/tutorPrompt.js";
import {
  streamChatCompletion,
  buildUpstreamMessages,
  UpstreamError,
} from "../services/aiProvider.js";
import { buildDemoAnswer, DEMO_BANNER } from "../services/demoEngine.js";
import { retrieveGrounding, hasDocument } from "../services/docStore.js";
import { HttpError, type ChatStreamEvent } from "../types.js";

export const chatRouter = Router();

const chatSchema = z.object({
  chatId: z.string().max(64).optional(),
  message: z.string().trim().min(1, "Message cannot be empty").max(config.limits.maxMessageChars),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(16_000),
      }),
    )
    .max(config.limits.maxHistoryMessages)
    .optional()
    .default([]),
  docId: z.string().max(64).optional(),
  docQuestion: z.boolean().optional().default(false),
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Emit a ChatStreamEvent as an SSE frame. */
function writeEvent(res: Response, event: ChatStreamEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

chatRouter.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(chatSchema, req.body);

    // ---- Compose system prompt (with doc grounding when relevant) ----
    let systemPrompt = TUTOR_SYSTEM_PROMPT;
    if (body.docId) {
      if (!hasDocument(body.docId)) {
        throw new HttpError(
          404,
          "That document is no longer available on the server (documents are held in server memory). Please re-upload it from the Documents panel.",
        );
      }
      const grounding = retrieveGrounding(body.docId, body.message);
      if (grounding && body.docQuestion) {
        systemPrompt = systemPrompt + "\n\n" + buildNotesContext(grounding.docName, grounding.chunks);
      }
    }

    // ---- SSE headers ----
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    writeEvent(res, { type: "meta", mode: config.mode, model: config.ai.model || null });

    // Stop streaming if the client disconnects before the response finishes.
    const abort = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) abort.abort(new Error("client disconnected"));
    });
    req.socket.on("error", () => abort.abort(new Error("socket error")));

    try {
      if (config.mode === "demo") {
        // Demo mode: grounded doc questions show the honest retrieved excerpts.
        let answer: string;
        if (body.docQuestion && body.docId) {
          const grounding = retrieveGrounding(body.docId, body.message);
          if (grounding) {
            const excerpts = grounding.chunks
              .map((c) => `> **[Notes p.${c.page}]** ${c.text.slice(0, 500)}${c.text.length > 500 ? "…" : ""}`)
              .join("\n\n");
            answer = `${DEMO_BANNER}**Demo mode can check your notes but cannot compose a live grounded answer** (no AI provider configured). Here is what the document "${grounding.docName}" contains for your question:\n\n${excerpts}\n\n---\nWith a live provider (\`AI_API_KEY\`, \`AI_BASE_URL\`, \`AI_MODEL\` in \`server/.env\`), this answer would explain the excerpts in detail, citing these page numbers.`;
          } else {
            answer = `${DEMO_BANNER}The document you referenced no longer exists on the server. Please re-upload it from the **Documents** panel.`;
          }
        } else {
          answer = buildDemoAnswer(body);
        }
        // Stream the canned answer in small chunks for a realistic feel.
        const step = 24;
        for (let i = 0; i < answer.length && !abort.signal.aborted; i += step) {
          writeEvent(res, { type: "delta", text: answer.slice(i, i + step) });
          await sleep(8);
        }
        if (!abort.signal.aborted) writeEvent(res, { type: "done" });
      } else {
        const upstream = buildUpstreamMessages(body, systemPrompt);
        await streamChatCompletion(
          {
            baseUrl: config.ai.baseUrl,
            apiKey: config.ai.apiKey,
            model: config.ai.model,
            timeoutMs: config.ai.timeoutMs,
          },
          { messages: upstream, temperature: 0.7 },
          (event) => {
            if (abort.signal.aborted) return;
            writeEvent(res, event);
          },
          abort.signal,
        );
        if (!abort.signal.aborted) writeEvent(res, { type: "done" });
      }
    } catch (err) {
      if (!abort.signal.aborted) {
        const message =
          err instanceof UpstreamError
            ? err.message
            : err instanceof Error && err.name === "AbortError"
              ? "" // client-initiated stop; just close quietly
              : `The tutor could not generate a response: ${err instanceof Error ? err.message : String(err)}`;
        if (message) writeEvent(res, { type: "error", message });
      }
    } finally {
      req.socket.removeAllListeners("error");
      res.end();
    }
  }),
);
