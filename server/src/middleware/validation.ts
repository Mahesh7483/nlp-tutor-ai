import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";
import { HttpError } from "../types.js";

/** Validate a request body against a zod schema, throwing a clean 400. */
export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path?.join(".") || "body";
    throw new HttpError(
      400,
      `Invalid request: ${first?.message ?? "payload failed validation"} (at ${path}).`,
    );
  }
  return result.data;
}

/** Wrap an async handler so rejections reach the error handler. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = fn(req, res, next);
    if (result instanceof Promise) result.catch(next);
  };
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  void _next;
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  // Multer errors
  const isMulter =
    typeof err === "object" && err !== null && "code" in err &&
    (err as { code?: string }).code?.startsWith("LIMIT_");
  if (isMulter) {
    const code = (err as { code: string }).code;
    res.status(413).json({
      error:
        code === "LIMIT_FILE_SIZE"
          ? "The file is too large. Reduce its size or split it into smaller documents."
          : "Upload rejected by the server.",
    });
    return;
  }
  const message = err instanceof Error ? err.message : "Unexpected server error";
  console.error("[nlp-tutor] Unhandled error:", err);
  res.status(500).json({ error: message });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Endpoint not found. This server exposes /api/health, /api/chat, /api/documents and /api/quiz." });
}
