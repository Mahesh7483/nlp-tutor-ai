import { useState } from "react";
import { Code2, Package, Info, MessageCircleQuestion } from "lucide-react";
import { CODE_EXAMPLES, type CodeExample } from "../data/codeExamples";
import { CopyButton } from "../components/Markdown";
import { Markdown } from "../components/Markdown";

export function CodeExamplesPage({ onAskTutor }: { onAskTutor: (prompt: string) => void }) {
  const [selectedId, setSelectedId] = useState(CODE_EXAMPLES[0].title);
  const selected = CODE_EXAMPLES.find((ex) => ex.title === selectedId) ?? CODE_EXAMPLES[0];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-8">
      <header className="mb-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Code2 size={20} className="text-blue-600" /> Code Learning
        </h2>
        <p className="mt-1 text-[13.5px] text-slate-500 dark:text-zinc-400">
          Curated Python examples for common NLP tasks. Every example lists the packages it needs and
          is presented as{" "}
          <em>reference code</em> — nothing here is claimed to have been executed locally.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-[240px_1fr]">
        {/* example list */}
        <nav aria-label="Code examples" className="lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto lg:sticky lg:top-2 lg:self-start">
          <ul className="space-y-1">
            {CODE_EXAMPLES.map((ex) => (
              <li key={ex.title}>
                <button
                  type="button"
                  onClick={() => setSelectedId(ex.title)}
                  aria-current={selectedId === ex.title}
                  className={`w-full rounded-xl px-3 py-2 text-left text-[13px] transition-colors ${
                    selectedId === ex.title
                      ? "bg-blue-50 font-semibold text-blue-800 dark:bg-blue-950/60 dark:text-blue-200"
                      : "text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  {ex.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* detail */}
        <ExampleDetail example={selected} onAskTutor={onAskTutor} />
      </div>
    </div>
  );
}

function ExampleDetail({ example, onAskTutor }: { example: CodeExample; onAskTutor: (prompt: string) => void }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-semibold">{example.title}</h3>
          <p className="mt-0.5 text-[13.5px] text-slate-500 dark:text-zinc-400">{example.task}</p>
        </div>
        <button
          type="button"
          onClick={() =>
            onAskTutor(
              `Walk me through this ${example.title.toLowerCase()} implementation: ${example.task}`,
            )
          }
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11.5px] font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900"
        >
          <MessageCircleQuestion size={12} /> Ask tutor
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 font-medium text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
          <Package size={12} /> {example.packages.join(", ")}
        </span>
        <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 ${example.tags.includes("nltk") || example.tags.includes("pytorch") ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"}`}>
          <Info size={12} /> install: {example.install}
        </span>
      </div>

      <div className="mt-4">
        <Markdown text={"```python\n" + example.code + "\n```"} />
      </div>

      {example.input && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/60">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Sample input</p>
          <pre className="mt-1 overflow-x-auto font-mono text-[12.5px] text-slate-700 dark:text-zinc-300">{example.input}</pre>
        </div>
      )}

      {example.output && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/60">
          <p className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
            Expected output (approximate, not executed here)
            <CopyButton text={example.output} />
          </p>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-[12.5px] text-slate-700 dark:text-zinc-300">{example.output}</pre>
        </div>
      )}

      <div className="mt-4 border-t border-slate-100 pt-3 dark:border-zinc-800">
        <p className="text-[13px] leading-relaxed text-slate-600 dark:text-zinc-300">{example.explanation}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {example.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
}
