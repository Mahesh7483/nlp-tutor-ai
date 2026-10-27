import { Router, type Request, type Response } from "express";
import { aiStatus, config } from "../env.js";
import type { HealthResponse } from "../types.js";

export const healthRouter = Router();

healthRouter.get(
  "/",
  (_req: Request, res: Response) => {
    const response: HealthResponse = {
      status: "ok",
      app: "NLP Tutor AI",
      mode: config.mode,
      ai: aiStatus(),
      uptimeSeconds: Math.round(process.uptime()),
    };
    res.json(response);
  },
);
