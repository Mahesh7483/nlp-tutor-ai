import { Router, type Request, type Response } from "express";
import multer from "multer";
import { config } from "../env.js";
import { asyncHandler } from "../middleware/validation.js";
import * as docStore from "../services/docStore.js";
import { HttpError } from "../types.js";

export const documentsRouter = Router();

// ---- upload ----

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.limits.maxDocBytes,
    files: 1,
  },
});

const ACCEPTED_MIME = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/octet-stream", // some .txt uploads; we sniff content anyway
];

documentsRouter.post(
  "/",
  upload.single("file"),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new HttpError(400, "No file received. Attach a field named 'file'.");
    }
    const { originalname, buffer, size } = req.file;
    const mimeType = ACCEPTED_MIME.includes(req.file.mimetype)
      ? req.file.mimetype
      : "application/octet-stream"; // extension/content sniffing decides below

    if (size === 0) {
      throw new HttpError(400, "The file is empty.");
    }

    const meta = await docStore.ingestDocument(originalname, mimeType, buffer);
    res.status(201).json(meta);
  }),
);

// ---- list / inspect / delete ----

documentsRouter.get("/", (_req: Request, res: Response) => {
  res.json({ documents: docStore.listDocuments() });
});

documentsRouter.get("/:id", (req: Request, res: Response) => {
  const doc = docStore.getDocument(String(req.params.id));
  if (!doc) throw new HttpError(404, "Document not found. It may have been removed (documents are kept in server memory only).");
  res.json(doc);
});

documentsRouter.delete("/:id", (req: Request, res: Response) => {
  const ok = docStore.deleteDocument(String(req.params.id));
  if (!ok) throw new HttpError(404, "Document not found.");
  res.json({ deleted: true });
});
