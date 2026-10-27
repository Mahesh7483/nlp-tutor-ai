import { randomUUID } from "node:crypto";
import type { DocChunk, DocMeta } from "../types.js";
import { config } from "../env.js";
import { HttpError } from "../types.js";

/**
 * In-memory document store + extraction + very lightweight keyword
 * retrieval ("grounding").
 *
 * Honest scope note (also surfaced in the UI/README): this is keyword
 * retrieval over extracted text with page metadata. It is NOT an
 * embedding/vector-DB RAG pipeline, and the UI never claims otherwise.
 */

interface StoredDoc extends DocMeta {
  chunks: DocChunk[];
}

const docs = new Map<string, StoredDoc>();

/* ---------------- extraction ---------------- */

const TEXT_EXTENSIONS = [".txt", ".md", ".markdown", ".csv", ".log"];

function normalizeWhitespace(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

async function extractPdf(buffer: Buffer): Promise<{ pages: string[] }> {
  // Dynamic import keeps startup fast and isolates pdf.js lifecycle issues.
  const { getDocumentProxy, extractText } = await import("unpdf");
  const bytes = new Uint8Array(buffer);
  const pdf = await getDocumentProxy(bytes);
  const { text, totalPages } = await extractText(pdf, { mergePages: false });
  const pages = (Array.isArray(text) ? text : [text]).map((p) =>
    normalizeWhitespace(String(p ?? "")),
  );
  void totalPages;
  return { pages };
}

function extractPlainText(buffer: Buffer): { pages: string[] } {
  let text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
  const cleaned = normalizeWhitespace(text.replace(CONTROL_CHARS, " "));
  return { pages: [cleaned] };
}

/** Split a page's text into paragraph-based chunks of ~≤ maxChars. */
export function chunkPage(pageText: string, page: number, maxChars: number): DocChunk[] {
  if (!pageText) return [];
  const paragraphs = pageText.split(/\n{2,}/);
  const chunks: DocChunk[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    const p = paragraph.trim();
    if (!p) continue;
    if (p.length > maxChars) {
      // Very long paragraph: hard-split it.
      if (current) {
        chunks.push({ page, text: current });
        current = "";
      }
      for (let i = 0; i < p.length; i += maxChars) {
        chunks.push({ page, text: p.slice(i, i + maxChars) });
      }
      continue;
    }
    if ((current + "\n\n" + p).length > maxChars && current) {
      chunks.push({ page, text: current });
      current = p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
  }
  if (current) chunks.push({ page, text: current });
  return chunks;
}

/* ---------------- ingestion ---------------- */

export async function ingestDocument(
  originalName: string,
  mimeType: string,
  buffer: Buffer,
): Promise<DocMeta> {
  if (buffer.byteLength === 0) {
    throw new HttpError(400, "The uploaded file is empty.");
  }
  if (buffer.byteLength > config.limits.maxDocBytes) {
    throw new HttpError(
      413,
      `File is too large. The limit is ${Math.round(config.limits.maxDocBytes / 1_000_000)} MB.`,
    );
  }

  const lowerName = originalName.toLowerCase();
  const isPdf =
    lowerName.endsWith(".pdf") ||
    buffer.subarray(0, 4).toString("latin1") === "%PDF";

  let extracted: { pages: string[] };
  try {
    if (isPdf) {
      extracted = await extractPdf(buffer);
    } else if (TEXT_EXTENSIONS.some((ext) => lowerName.endsWith(ext)) || mimeType.startsWith("text/")) {
      // Guard against binary masquerading as text
      if (buffer.subarray(0, 512).includes(0)) {
        throw new HttpError(
          415,
          "Unsupported file type. Upload a text-based document (.txt, .md, .csv) or a PDF.",
        );
      }
      extracted = extractPlainText(buffer);
    } else {
      throw new HttpError(
        415,
        `Unsupported file type ("${mimeType || originalName.split(".").pop()}"). Please upload a PDF or a plain-text document (.txt, .md, .csv).`,
      );
    }
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(
      422,
      "The document could not be read. It may be corrupted, password-protected or a scanned PDF without a text layer.",
    );
  }

  const chunks: DocChunk[] = [];
  let totalChars = 0;
  let status: DocMeta["status"] = "ok";
  outer: for (let p = 0; p < extracted.pages.length; p++) {
    for (const chunk of chunkPage(extracted.pages[p], p + 1, 1_200)) {
      if (totalChars + chunk.text.length > config.limits.maxDocChars) {
        status = "trimmed";
        break outer;
      }
      chunks.push(chunk);
      totalChars += chunk.text.length;
    }
  }

  if (totalChars === 0) {
    throw new HttpError(
      422,
      "No readable text could be extracted. This happens with scanned image-only PDFs — try a text-based file.",
    );
  }

  // Housekeeping: keep only the newest documents.
  while (docs.size >= config.limits.maxStoredDocs) {
    const oldest = [...docs.values()].sort(
      (a, b) => a.uploadedAt.localeCompare(b.uploadedAt),
    )[0];
    if (!oldest) break;
    docs.delete(oldest.id);
  }

  const id = randomUUID();
  const previewSource = chunks[0]?.text ?? "";
  const meta: StoredDoc = {
    id,
    name: originalName,
    mimeType: isPdf ? "application/pdf" : "text/plain",
    sizeBytes: buffer.byteLength,
    uploadedAt: new Date().toISOString(),
    pageCount: extracted.pages.length,
    charCount: totalChars,
    preview: previewSource.slice(0, 400),
    status,
    pages: isPdf ? extracted.pages.length : null,
    chunks,
  };
  docs.set(id, meta);

  return toMeta(meta);
}

function toMeta(doc: StoredDoc): DocMeta {
  const { chunks, ...meta } = doc;
  void chunks;
  return meta;
}

/* ---------------- retrieval ---------------- */

const STOP_WORDS = new Set([
  "the","a","an","of","in","on","at","to","for","with","by","from","and","or","is","are",
  "was","were","be","been","it","its","this","that","these","those","as","about","into",
  "explain","what","which","who","whom","how","why","when","where","does","do","did",
  "can","could","should","would","me","you","your","my","we","us","give","tell","show",
  "notes","note","document","file","page","topic","topics","please","also","example",
]);

function tokenizeForSearch(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

/**
 * Keyword-overlap retrieval over page-tagged chunks. Falls back to a
 * deterministic "overview" (early document chunks) when nothing overlaps,
 * so the model still has honest, in-context material to work with.
 */
export function retrieveGrounding(
  docId: string,
  query: string,
  maxChunks = 10,
): { docName: string; chunks: DocChunk[] } | null {
  const doc = docs.get(docId);
  if (!doc) return null;

  const terms = tokenizeForSearch(query);
  const budget = config.limits.groundingCharBudget;

  let candidates = doc.chunks;
  if (terms.length > 0) {
    candidates = doc.chunks
      .map((chunk) => {
        const lower = chunk.text.toLowerCase();
        let score = 0;
        for (const term of terms) {
          if (lower.includes(term)) score += 2;
        }
        // Small bonus: phrase containing several terms close together.
        const first = terms[0] ? lower.indexOf(terms[0]) : -1;
        if (first >= 0) score += 1;
        return { chunk, score };
      })
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((c) => c.chunk);
  }

  if (candidates.length === 0) {
    // No keyword overlap: return an overview from the start of the document.
    candidates = doc.chunks.slice(0, maxChunks);
  }

  const selected: DocChunk[] = [];
  let used = 0;
  for (const chunk of candidates) {
    if (selected.length >= maxChunks) break;
    if (used + chunk.text.length > budget) {
      if (selected.length === 0) {
        // Keep at least a truncated slice of the largest chunk.
        const sliced = chunk.text.slice(0, Math.max(budget - used, 200));
        selected.push({ page: chunk.page, text: sliced });
      }
      break;
    }
    selected.push(chunk);
    used += chunk.text.length;
  }
  return { docName: doc.name, chunks: selected };
}

export function listDocuments(): DocMeta[] {
  return [...docs.values()]
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    .map(toMeta);
}

export function getDocument(id: string): DocMeta | null {
  const doc = docs.get(id);
  return doc ? toMeta(doc) : null;
}

export function deleteDocument(id: string): boolean {
  return docs.delete(id);
}

export function hasDocument(id: string): boolean {
  return docs.has(id);
}
