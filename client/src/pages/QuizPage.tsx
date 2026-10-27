import { useState } from "react";
import { CheckCircle2, Circle, RefreshCw, Sparkles, XCircle } from "lucide-react";
import type { Difficulty, QuizQuestion, QuizResponse } from "../types";
import { NLP_TOPICS } from "../data/topics";
import { generateQuiz } from "../lib/api";
import { addQuizStat, getQuizStats } from "../lib/storage";

const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced", "mixed"];
const COUNTS = [3, 5, 8];

export function QuizPage({ onAskTutor }: { onAskTutor: (prompt: string) => void }) {
  const [topics, setTopics] = useState<string[]>(["Tokenization"]);
  const [difficulty, setDifficulty] = useState<Difficulty>("mixed");
  const [count, setCount] = useState(5);
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [source, setSource] = useState<string>("");
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats] = useState(() => getQuizStats());

  const toggleTopic = (name: string) => {
    setTopics((prev) => (prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]));
  };

  const start = async () => {
    setLoading(true);
    setError(null);
    setSubmitted(false);
    setPicked({});
    try {
      const res: QuizResponse = await generateQuiz({
        topics: topics.length ? topics : [],
        difficulty,
        count,
      });
      if (res.questions.length === 0) throw new Error("The generator produced no questions. Try another topic.");
      setQuestions(res.questions);
      setSource(
        res.source === "ai"
          ? "Generated live by your configured AI model."
          : "Built from the offline practice bank (offline mode, or AI generation failed).",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const score = questions
    ? questions.filter((q) => picked[q.id] === q.answerIndex).length
    : 0;

  const submit = () => {
    if (!questions) return;
    setSubmitted(true);
    addQuizStat({
      at: Date.now(),
      score,
      total: questions.length,
      difficulty,
      topics,
    });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-8">
      <header className="mb-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CheckCircle2 size={20} className="text-blue-600" /> Quiz Practice
        </h2>
        <p className="mt-1 text-[13.5px] text-slate-500 dark:text-zinc-400">
          Pick topics and difficulty, generate questions, then check yourself. Beginner → advanced.
        </p>
      </header>

      {/* configuration */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Topics</h3>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {NLP_TOPICS.map((topic) => {
            const active = topics.includes(topic.name);
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => toggleTopic(topic.name)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                  active
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {topic.name}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Difficulty</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  aria-pressed={difficulty === d}
                  className={`rounded-lg border px-3 py-1.5 text-[12.5px] capitalize transition-colors ${
                    difficulty === d
                      ? "border-blue-500 bg-blue-50 font-semibold text-blue-700 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Questions</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {COUNTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCount(c)}
                  aria-pressed={count === c}
                  className={`rounded-lg border px-3.5 py-1.5 text-[12.5px] transition-colors ${
                    count === c
                      ? "border-blue-500 bg-blue-50 font-semibold text-blue-700 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void start()}
          disabled={loading}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-[13.5px] font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {loading ? "Generating…" : "Generate quiz"}
        </button>
        {error && <p className="mt-2 text-[12.5px] text-rose-600 dark:text-rose-400">{error}</p>}
      </section>

      {/* questions */}
      {questions && (
        <section className="mt-6 space-y-4">
          <p className="text-[12px] text-slate-400 dark:text-zinc-500">{source}</p>
          {questions.map((q, i) => {
            const chosen = picked[q.id];
            return (
              <article
                key={q.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-[14.5px] font-medium leading-snug">
                    <span className="mr-1.5 text-slate-400">{i + 1}.</span>
                    {q.question}
                  </h4>
                  <span className="shrink-0 rounded-full border border-slate-200 px-2 py-0.5 text-[10.5px] font-medium text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
                    {q.difficulty}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5">
                  {q.options.map((opt, oi) => {
                    const isChosen = chosen === oi;
                    const isCorrect = oi === q.answerIndex;
                    const state = !submitted
                      ? isChosen
                        ? "chosen"
                        : "idle"
                      : isCorrect
                        ? "correct"
                        : isChosen
                          ? "wrong"
                          : "idle";
                    return (
                      <button
                        key={oi}
                        type="button"
                        disabled={submitted}
                        onClick={() => setPicked((p) => ({ ...p, [q.id]: oi }))}
                        className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-2 text-left text-[13.5px] transition-colors ${
                          state === "correct"
                            ? "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40"
                            : state === "wrong"
                              ? "border-rose-400 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40"
                              : state === "chosen"
                                ? "border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/40"
                                : "border-slate-200 hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60"
                        }`}
                      >
                        {submitted ? (
                          isCorrect ? (
                            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                          ) : isChosen ? (
                            <XCircle size={16} className="mt-0.5 shrink-0 text-rose-500" />
                          ) : (
                            <Circle size={16} className="mt-0.5 shrink-0 text-slate-300 dark:text-zinc-600" />
                          )
                        ) : (
                          <span
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold ${
                              isChosen ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 dark:border-zinc-600"
                            }`}
                          >
                            {isChosen ? "✓" : ""}
                          </span>
                        )}
                        <span className="min-w-0">{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {submitted && (
                  <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-[13px] text-slate-600 dark:bg-zinc-800/60 dark:text-zinc-300">
                    <span className={`font-semibold ${picked[q.id] === q.answerIndex ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {picked[q.id] === q.answerIndex ? "Correct. " : `Answer: option ${q.answerIndex + 1}. `}
                    </span>
                    {q.explanation}
                    <button
                      type="button"
                      onClick={() =>
                        onAskTutor(`Topic: ${q.topic}. Question: ${q.question}. Explain the underlying concept step by step.`)
                      }
                      className="ml-1.5 inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 align-middle text-[11.5px] font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900"
                    >
                      Ask tutor
                    </button>
                  </div>
                )}
              </article>
            );
          })}

          {!submitted ? (
            <div className="sticky bottom-4 rounded-2xl border border-slate-200 bg-white/95 p-3 text-center shadow-lg backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
              <button
                type="button"
                onClick={submit}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-[13.5px] font-medium text-white hover:bg-emerald-700"
              >
                Check answers ({Object.keys(picked).length}/{questions.length} answered)
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-[2em] font-bold tracking-tight text-blue-600 dark:text-blue-400">
                {score} / {questions.length}
              </p>
              <p className="mt-1 text-[13px] text-slate-500 dark:text-zinc-400">
                {score === questions.length
                  ? "Excellent — full marks this round."
                  : score / questions.length >= 0.6
                    ? "Good work. Review the explanations you missed."
                    : "Tricky round. Read the explanations, then try the Ask tutor buttons."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setPicked({});
                  void start();
                }}
                className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700"
              >
                New quiz
              </button>
            </div>
          )}
        </section>
      )}

      {stats.length > 0 && !questions && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Recent rounds</h3>
          <ul className="mt-2 space-y-1.5 text-[13px]">
            {stats.slice(0, 5).map((s, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-zinc-800/60">
                <span className="text-slate-500 dark:text-zinc-400">
                  {new Date(s.at).toLocaleDateString()} · {s.difficulty} · {s.topics.length ? s.topics.slice(0, 2).join(", ") : "all topics"}
                </span>
                <span className="font-semibold text-slate-700 dark:text-zinc-200">
                  {s.score}/{s.total}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
