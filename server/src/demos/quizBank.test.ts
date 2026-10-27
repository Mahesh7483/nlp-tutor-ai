import { test } from "node:test";
import assert from "node:assert/strict";
import { QUIZ_BANK, sampleFromBank } from "./quizBank.js";

test("built-in quiz bank integrity", () => {
  assert.ok(QUIZ_BANK.length >= 30, `expected a substantial bank, got ${QUIZ_BANK.length}`);
  for (const q of QUIZ_BANK) {
    assert.equal(q.options.length, 4, `question "${q.question}" must have exactly 4 options`);
    assert.ok(q.answerIndex >= 0 && q.answerIndex < q.options.length);
    assert.ok(q.options[q.answerIndex].length > 0, "correct option must not be empty");
    assert.ok(q.explanation.length > 10, "explanation required");
    assert.ok(["beginner", "intermediate", "advanced"].includes(q.difficulty));
    assert.doesNotMatch(q.question, /^\s*$/);
  }
});

test("sampleFromBank filters by difficulty and respects count", () => {
  const beginner = sampleFromBank([], "beginner", 5);
  assert.ok(beginner.every((q) => q.difficulty === "beginner"));
  assert.ok(beginner.length <= 5 && beginner.length > 0);

  const all = sampleFromBank([], "mixed", 10);
  assert.equal(all.length, 10);

  const unique = new Set(all.map((q) => q.question));
  assert.equal(unique.size, all.length, "no duplicate questions in one sample");
});

test("sampleFromBank falls back to full bank when topic filter has no matches", () => {
  const res = sampleFromBank(["nonexistent-topic-xyz"], "mixed", 8);
  assert.ok(res.length > 0 && res.length <= 8);
});
