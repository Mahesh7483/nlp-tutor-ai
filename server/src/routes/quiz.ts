import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { config } from "../env.js";
import { parseBody, asyncHandler } from "../middleware/validation.js";
import { getChatCompletion, UpstreamError } from "../services/aiProvider.js";
import { TUTOR_SYSTEM_PROMPT } from "../services/tutorPrompt.js";
import { sampleFromBank, QUIZ_BANK } from "../demos/quizBank.js";
import type { QuizQuestion, QuizResponse } from "../types.js";

export const quizRouter = Router();

const quizSchema = z.object({
  topics: z.array(z.string().min(1).max(80)).max(20).default([]),
  difficulty: z.enum(["beginner", "intermediate", "advanced", "mixed"]).default("mixed"),
  count: z.number().int().min(1).max(10).default(5),
});

/** Extract the first JSON object/array from a model response. */
function parseJsonLoose(text: string): unknown | null {
  const start = text.indexOf("{");
  const startArr = text.indexOf("[");
  const from =
    start === -1 ? startArr : startArr === -1 ? start : Math.min(start, startArr);
  if (from === -1) return null;
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (end <= from) return null;
  try {
    return JSON.parse(text.slice(from, end + 1));
  } catch {
    return null;
  }
}

const questionSchema = z.object({
  topic: z.string().min(1),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  answerIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(1),
});

function buildQuizPrompt(topics: string[], difficulty: string, count: number): string {
  const topicText = topics.length > 0 ? topics.join("; ") : "general NLP engineering";
  return `Generate ${count} multiple-choice questions to help a student practice NLP engineering.

Requirements:
- Topic focus: ${topicText}. Difficulty: ${difficulty}.
- Exactly 4 answer options per question; exactly one correct.
- Include an explanation of the correct answer (1-3 sentences, factual; mention the underlying principle).
- Do not invent APIs or pretend a library does something it does not.
- Respond with ONLY valid JSON matching:
{"questions":[{"topic":"...","difficulty":"beginner|intermediate|advanced","question":"...","options":["","","",""],"answerIndex":0,"explanation":"..."}]}`;
}

quizRouter.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(quizSchema, req.body);

    let questions: QuizQuestion[] | null = null;
    let source: QuizResponse["source"] = "built-in";

    if (config.mode === "live") {
      try {
        const raw = await getChatCompletion(
          {
            baseUrl: config.ai.baseUrl,
            apiKey: config.ai.apiKey,
            model: config.ai.model,
            timeoutMs: config.ai.timeoutMs,
          },
          {
            messages: [
              { role: "system", content: TUTOR_SYSTEM_PROMPT },
              { role: "user", content: buildQuizPrompt(body.topics, body.difficulty, body.count) },
            ],
            temperature: 0.6,
          },
        );
        const parsed = parseJsonLoose(raw);
        const list = parsed !== null ? (parsed as { questions?: unknown[] }).questions : null;
        if (Array.isArray(list) && list.length > 0) {
          const validated: QuizQuestion[] = [];
          for (const item of list) {
            const result = questionSchema.safeParse(item);
            if (result.success) {
              validated.push({ id: `q-${validated.length + 1}`, ...result.data });
            }
          }
          if (validated.length > 2) {
            questions = validated.slice(0, body.count);
            source = "ai";
          }
        }
      } catch (err) {
        // Fall back to the built-in bank; surface why in the response meta.
        console.warn("[nlp-tutor] Live quiz generation failed, using bank:", err instanceof UpstreamError ? err.message : err);
      }
    }

    if (!questions) {
      questions = sampleFromBank(body.topics, body.difficulty, body.count).map((q) => ({
        ...q,
      }));
    }

    res.json({
      questions,
      source,
      bankSize: QUIZ_BANK.length,
      mode: config.mode,
    } satisfies QuizResponse & { bankSize: number; mode: string });
  }),
);
