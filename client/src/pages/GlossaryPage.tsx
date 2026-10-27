import { useMemo, useState } from "react";
import { BookOpen, MessageCircleQuestion, Search } from "lucide-react";
import { GLOSSARY } from "../data/glossary";

export function GlossaryPage({ onAskTutor }: { onAskTutor: (prompt: string) => void }) {
  const [query, setQuery] = useState("");
  const [only, setOnly] = useState("");

  const letters = useMemo(() => [...new Set(GLOSSARY.map((t) => t.term[0].toUpperCase()))].sort(), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GLOSSARY.filter((t) => {
      const matchesQuery = !q || t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q);
      const matchesLetter = !only || t.term[0].toUpperCase() === only;
      return matchesQuery && matchesLetter;
    });
  }, [query, only]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-8">
      <header className="mb-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <BookOpen size={20} className="text-blue-600" /> NLP Glossary
        </h2>
        <p className="mt-1 text-[13.5px] text-slate-500 dark:text-zinc-400">
          {GLOSSARY.length} terms with concise definitions and practical examples. The “Ask tutor” button
          requests a deeper explanation in the chat.
        </p>
      </header>

      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOnly("");
          }}
          placeholder="Search terms or definitions…"
          aria-label="Search glossary"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-[14px] shadow-sm focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setOnly("")}
          className={`rounded-md px-2.5 py-1 text-[12px] font-medium ${!only ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"}`}
        >
          All
        </button>
        {letters.map((letter) => (
          <button
            key={letter}
            type="button"
            onClick={() => setOnly(letter)}
            className={`rounded-md px-2.5 py-1 text-[12px] font-medium ${
              only === letter ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
            }`}
          >
            {letter}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-8 text-center text-[13.5px] text-slate-400">
          No terms match “{query}”. Try a different keyword (e.g. “embedding”, “perplexity”, “BLEU”).
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {filtered.map((term) => (
            <li
              key={term.term}
              className="rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[15px] font-semibold">{term.term}</h3>
                <button
                  type="button"
                  onClick={() => onAskTutor(term.ask)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11.5px] font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900"
                >
                  <MessageCircleQuestion size={12} /> Ask tutor
                </button>
              </div>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600 dark:text-zinc-300">{term.definition}</p>
              <p className="mt-2 rounded-lg bg-blue-50/70 px-3 py-2 text-[12.5px] leading-relaxed text-blue-900/80 dark:bg-blue-950/40 dark:text-blue-200">
                <span className="mr-1 font-semibold">Example:</span>
                {term.example}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
