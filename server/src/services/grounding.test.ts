import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chunkPage, ingestDocument, retrieveGrounding, deleteDocument } from "./docStore.js";

test("chunkPage splits long text and preserves page numbers", () => {
  const short = "First paragraph.\n\nSecond paragraph with a couple of sentences here.";
  const chunks = chunkPage(short, 2, 1200);
  assert.equal(chunks[0].page, 2);
  assert.ok(chunks.length >= 1);

  const long = "A ".repeat(900); // ~1800 chars, oversized
  const huge = chunkPage(long, 7, 600);
  assert.ok(huge.length >= 3, "oversized paragraph is hard-split");
  assert.equal(huge[0].page, 7);
  assert.doesNotMatch(chunks.map((c) => c.text).join(""), /\n{3,}/);
});

let docId: string | null = null;
before(async () => {
  const chunkText = (text: string) => text + "\n" + "filler ".repeat(40);

  const docText = [
    chunkText("This chapter introduces tokenization. BPE reduces vocabulary size."),
    chunkText("Chapter two covers TF-IDF weighting and idf smoothing."),
    chunkText("Attention replaces recurrence in transformers using queries, keys and values."),
  ].join("\n\n");

  const meta = await ingestDocument(
    "unit-test-notes.txt",
    "text/plain",
    Buffer.from(docText, "utf-8"),
  );
  docId = meta.id;
});

after(() => {
  if (docId) deleteDocument(docId);
});

test("retrieveGrounding surfaces the most relevant chunk for a keyword query", () => {
  assert.ok(docId, "document ingested");
  const result = retrieveGrounding(docId!, "explain attention queries keys");
  assert.ok(result, "grounding returns a result for a known doc");
  assert.ok(
    result!.chunks[0].text.toLowerCase().includes("attention"),
    "attention chunk must rank first",
  );
});

test("retrieveGrounding falls back to an overview when no overlap exists", () => {
  const result = retrieveGrounding(docId!, "quantum chemistry elephant");
  assert.ok(result);
  // Overview fallback → starts from the beginning of the document
  assert.ok(result!.chunks[0].text.toLowerCase().includes("tokenization"));
});

test("retrieveGrounding returns null for unknown docs", () => {
  assert.equal(retrieveGrounding("no-such-doc", "anything"), null);
});
