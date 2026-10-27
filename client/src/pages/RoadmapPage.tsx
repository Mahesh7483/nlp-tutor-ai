import { useMemo, useState } from "react";
import { BrainCircuit, CheckSquare, Square, RotateCcw } from "lucide-react";
import { ROADMAP, totalRoadmapItems } from "../data/roadmap";
import { NLP_TOPICS } from "../data/topics";
import { getRoadmapProgress, saveRoadmapProgress } from "../lib/storage";

interface RoadmapPageProps {
  onAskTopic: (topicPrompt: string) => void;
}

export function RoadmapPage({ onAskTopic }: RoadmapPageProps) {
  const [done, setDone] = useState<Set<string>>(() => new Set(getRoadmapProgress()));

  const toggle = (id: string) => {
    const next = new Set(done);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDone(next);
    saveRoadmapProgress([...next]);
  };

  const percent = useMemo(() => Math.round((done.size / totalRoadmapItems) * 100), [done]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-8">
      <header>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <BrainCircuit size={20} className="text-blue-600" /> Learning Roadmap
        </h2>
        <p className="mt-1 text-[13.5px] text-slate-500 dark:text-zinc-400">
          A structured path from NLP fundamentals to Transformers and modern LLM applications. Tick
          items as you complete them — progress is saved on this device.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-[13px] font-semibold text-blue-600 dark:text-blue-400">{percent}%</span>
          <button
            type="button"
            onClick={() => {
              setDone(new Set());
              saveRoadmapProgress([]);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] text-slate-500 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label="Reset roadmap progress"
          >
            <RotateCcw size={12} /> Reset
          </button>
        </div>
      </header>

      <ol className="mt-6 space-y-5">
        {ROADMAP.map((stage) => {
          const stageDone = stage.items.filter((i) => done.has(i.id)).length;
          return (
            <li key={stage.id} className="relative rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-semibold">
                    <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-[12px] font-bold text-white">
                      {stage.phase}
                    </span>
                    {stage.title}
                  </h3>
                  <p className="mt-1 text-[13px] text-slate-500 dark:text-zinc-400">{stage.outcome}</p>
                  <p className="mt-0.5 text-[12px] text-slate-400 dark:text-zinc-500">Prerequisites: {stage.prereq}</p>
                </div>
                <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[11.5px] font-medium text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {stageDone}/{stage.items.length}
                </span>
              </div>

              <ul className="mt-3 space-y-1">
                {stage.items.map((item) => {
                  const checked = done.has(item.id);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => toggle(item.id)}
                        aria-pressed={checked}
                        className={`flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13.5px] transition-colors ${
                          checked
                            ? "text-slate-400 line-through dark:text-zinc-500"
                            : "hover:bg-slate-50 dark:hover:bg-zinc-800/60"
                        }`}
                      >
                        {checked ? (
                          <CheckSquare size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                        ) : (
                          <Square size={16} className="mt-0.5 shrink-0 text-slate-300 dark:text-zinc-600" />
                        )}
                        <span className="min-w-0">
                          {item.label}
                          {item.note && <span className="ml-1.5 text-[12px] text-slate-400">{item.note}</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-[14px] font-semibold">Topic library</h3>
        <p className="mt-1 text-[12.5px] text-slate-500 dark:text-zinc-400">
          Click a topic to ask the tutor to teach it in the chat.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {NLP_TOPICS.map((topic) => (
            <button
              key={topic.id}
              type="button"
              onClick={() => onAskTopic(topic.prompt)}
              title={topic.blurb}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-[12.5px] text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-blue-800 dark:hover:bg-blue-950/40 dark:hover:text-blue-200"
            >
              {topic.name}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11.5px] text-slate-400 dark:text-zinc-600">
          These topics are the default scope, not a claim about any syllabus. Uploaded course notes (Documents page) take priority.
        </p>
      </section>
    </div>
  );
}
