import { FileText, Sparkles, BrainCircuit } from "lucide-react";
import { SUGGESTED_PROMPTS } from "../data/topics";
import { GraduationCap } from "lucide-react";

interface WelcomeProps {
  onPickPrompt: (prompt: string) => void;
  docName?: string;
}

export function Welcome({ onPickPrompt, docName }: WelcomeProps) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
        <GraduationCap size={30} />
      </div>
      <h2 className="mt-5 text-center text-[22px] font-semibold tracking-tight text-slate-900 dark:text-zinc-50 md:text-2xl">
        Learn NLP Engineering, step by step.
      </h2>
      <p className="mt-2 max-w-xl text-center text-[13.5px] leading-relaxed text-slate-500 dark:text-zinc-400">
        Ask for clear explanations with worked examples, Python code, exam notes and practice
        questions. Attach your own course notes and get answers grounded in them.
      </p>

      {docName && (
        <div className="mt-4 inline-flex max-w-md items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-[13px] text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
          <FileText size={16} className="shrink-0" />
          <span>
            <strong className="font-semibold">{docName}</strong> is attached — ask questions about
            these notes and answers will cite page numbers.
          </span>
        </div>
      )}

      <div className="mt-7 w-full max-w-2xl">
        <div className="mb-2.5 flex items-center justify-center gap-1.5 text-[12px] font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">
          <Sparkles size={13} /> Try a starter question
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onPickPrompt(prompt)}
              className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left text-[13.5px] leading-snug text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-blue-800 dark:hover:bg-blue-950/40 dark:hover:text-blue-200"
            >
              <span className="mr-1.5 inline-block text-blue-400 transition-transform group-hover:translate-x-0.5">›</span>
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[12px] text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        <BrainCircuit size={15} className="text-blue-500" />
        Covers preprocessing → classical NLP → Transformers & LLMs, at beginner to advanced depth.
      </div>
    </div>
  );
}
