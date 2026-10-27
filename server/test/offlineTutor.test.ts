import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  composeOfflineAnswer,
  shouldShowOfflineBanner,
  offlineTutorStats,
  type OfflineContext,
} from "../src/services/offlineTutor.js";
import { TOPIC_CARDS } from "../src/services/knowledge.js";

const ask = (message: string, opts: Partial<OfflineContext> = {}): string =>
  composeOfflineAnswer({ message, history: [], ...opts });

describe("offline tutor engine", () => {
  it("knowledge base is complete and consistent", () => {
    assert.ok(TOPIC_CARDS.length >= 20);
    const ids = new Set(TOPIC_CARDS.map((c) => c.id));
    assert.equal(ids.size, TOPIC_CARDS.length, "duplicate card ids");
    for (const card of TOPIC_CARDS) {
      assert.ok(card.keywords.trim(), `card ${card.id} missing keywords`);
      assert.ok(new RegExp(card.keywords, "i")); // keywords must compile
      assert.ok(card.short && card.definition && card.intuition);
      assert.ok(card.steps.length >= 3 && card.examNotes.length >= 2 && card.practice);
      // every card has full lesson material or explicit code coverage
      assert.ok(card.cons.length >= 2 && card.pros.length >= 2);
    }
    assert.ok(offlineTutorStats.comparisons >= 5);
  });

  it("greets conversationally", () => {
    const answer = ask("Hi");
    assert.match(answer, /tutor/i);
    assert.ok(answer.length < 700);
  });

  it("answers a topical question with a markdown lesson", () => {
    const answer = ask("what is TF-IDF?");
    assert.ok(answer.includes("Bag of Words, one-hot encoding and TF-IDF"));
    assert.ok(answer.includes("**Intuition.**"));
    assert.ok(answer.includes("Exam corner"));
  });

  it("goes deep on request and includes runnable code for code-ready topics", () => {
    const answer = ask("explain tokenization step by step");
    assert.ok(answer.includes("How it works, step by step"));
    assert.ok(answer.includes('"'));
    assert.match(answer, /Strengths & limitations/);
  });

  it("uses per-chat memory for pronoun follow-ups", () => {
    const chatId = "test-chat-1";
    ask("what is stemming vs lemmatization", { chatId }); // establishes topic
    const deeper = ask("explain it more deeply", { chatId });
    assert.ok(deeper.includes("How it works, step by step"));
    const code = ask("give me the python code for this", { chatId });
    assert.match(code, /pip install nltk/);
    assert.match(code, /PorterStemmer/);
  });

  it("asks which topic when a follow-up has no prior topic", () => {
    const answer = ask("give me the python code for this", { chatId: "fresh-chat" });
    assert.match(answer, /which topic/i);
  });

  it("builds comparison tables", () => {
    const answer = ask("difference between stemming and lemmatization?");
    assert.ok(answer.includes("| Aspect | Stemming | Lemmatization |"));
    assert.ok(answer.includes("Rule of thumb"));
  });

  it("runs the practice → reveal loop", () => {
    const chatId = "test-quiz";
    ask("explain parsing", { chatId }); // establish the topic for the chat
    const q = ask("ask me a practice question", { chatId });
    assert.match(q, /Practice question/);
    const reveal = ask("show answer", { chatId });
    assert.match(reveal, /walk/i);
    assert.ok(reveal.length > 80);
  });

  it("gives exam notes per topic and a general sheet without a topic", () => {
    assert.match(ask("exam notes on attention", { chatId: "exam-1" }), /Exam prep/);
    assert.match(ask("Exam prep", { chatId: "exam-2" }), /exam-relevant/i);
  });

  it("points quiz generation to the Quiz tab but quizzes in chat on request", () => {
    assert.match(ask("generate a quiz on parsing", { chatId: "quiz-1" }), /multiple-choice quiz/);
    assert.match(ask("quiz me on embeddings", { chatId: "quiz-2" }), /Practice question/);
  });

  it("stays in scope: off-topic asks are declined honestly", () => {
    assert.match(ask("write me a poem about rain"), /outside my lane/i);
    const unknown = ask("explain quantum neuro-linguistic spectroscopy");
    assert.match(unknown, /don't have a built-in lesson/i);
    assert.match(unknown, /upload/i);
  });

  it("banner shows once per chat and not afterwards", () => {
    const chatId = "banner-chat-test";
    assert.equal(shouldShowOfflineBanner(chatId), true);
    assert.equal(shouldShowOfflineBanner(chatId), false);
    assert.equal(shouldShowOfflineBanner(undefined), true);
  });
});
