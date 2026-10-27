import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { existsSync } from "node:fs";
import { config } from "./env.js";
import { healthRouter } from "./routes/health.js";
import { chatRouter } from "./routes/chat.js";
import { documentsRouter } from "./routes/documents.js";
import { quizRouter } from "./routes/quiz.js";
import { errorHandler, notFoundHandler } from "./middleware/validation.js";

const app = express();

app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "256kb" }));

// ---------- API ----------
app.use("/api/health", healthRouter);
app.use("/api/chat", chatRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/quiz", quizRouter);

// ---------- optional: serve the built frontend ----------
// `npm run build` in client/, then the server can serve everything on one port.
const clientDist = path.resolve(process.cwd(), "..", "client", "dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api).*/, (_req, res) => {
    const index = path.join(clientDist, "index.html");
    if (fs.existsSync(index)) res.sendFile(index);
    else res.status(503).json({ error: "Client build not found" });
  });
  console.log(`[nlp-tutor] serving client build from ${clientDist}`);
}

app.use("/api", notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log("".padEnd(52, "─"));
  console.log(`  NLP Tutor AI backend`);
  console.log(`  http://localhost:${config.port}`);
  console.log(`  mode: ${config.mode.toUpperCase()}${config.mode === "demo" ? "  (no AI credentials — build server/.env from .env.example)" : `  model=${config.ai.model}`}`);
  console.log("".padEnd(52, "─") + "\n");
});

// Graceful shutdown
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`[nlp-tutor] received ${signal}, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 3_000).unref();
  });
}
