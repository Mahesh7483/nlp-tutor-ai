import { useState } from "react";
import { Monitor, Moon, Sun, Info, Trash2, ShieldCheck } from "lucide-react";
import type { ThemeSetting } from "../lib/theme";
import type { HealthResponse } from "../types";
import { clearAllAppData } from "../lib/storage";
import { ConfirmDialog } from "../components/Modal";

interface SettingsPageProps {
  theme: ThemeSetting;
  onThemeChange: (t: ThemeSetting) => void;
  health: HealthResponse | null;
}

const THEMES: { value: ThemeSetting; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function SettingsPage({ theme, onThemeChange, health }: SettingsPageProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [cleared, setCleared] = useState(false);

  const mode = health?.ai;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:py-8">
      <h2 className="text-lg font-semibold">Settings</h2>

      {/* appearance */}
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Appearance</h3>
        <div className="mt-3 flex gap-2">
          {THEMES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => onThemeChange(value)}
              aria-pressed={theme === value}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                theme === value
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </section>

      {/* AI configuration status */}
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
          AI provider status
        </h3>
        {mode ? (
          <>
            <div className="mt-3 space-y-1.5 text-[13.5px]">
              <p className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-zinc-400">Mode</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
                    mode.mode === "live"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400"
                  }`}
                >
                  {mode.mode === "live" ? "Live AI" : "Offline tutor"}
                </span>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span className="text-slate-500 dark:text-zinc-400">Model</span>
                <span className="truncate font-mono text-[12.5px]">{mode.model ?? "—"}</span>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span className="text-slate-500 dark:text-zinc-400">Endpoint</span>
                <span className="truncate font-mono text-[12.5px]">{mode.baseUrl ?? "—"}</span>
              </p>
            </div>
            {mode.mode === "demo" && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-[13px] text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                <p className="font-semibold">Offline tutor mode is active</p>
                <p className="mt-1 leading-relaxed">
                  Replies come from the built-in NLP knowledge base — a rule-based engine with 20 topic
                  lessons, Python snippets, comparisons and practice questions. It needs no API key. To
                  converse with a live model instead, create{" "}
                  <code className="font-mono">server/.env</code> (copy{" "}
                  <code className="font-mono">server/.env.example</code>) and restart the backend with:
                </p>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-amber-950/30 p-2.5 font-mono text-[11.5px] text-amber-100 dark:bg-black/30">
{`# inside server/.env
AI_API_KEY=sk-your-key
AI_BASE_URL=https://api.openai.com/v1   # your provider's endpoint
AI_MODEL=gpt-4o-mini                    # your provider's model id

# then restart
npm run dev:server`}
                </pre>
                <p className="mt-2 leading-relaxed text-amber-700/90 dark:text-amber-300/90">
                  Any OpenAI-compatible chat-completions endpoint works (OpenAI, Azure/OpenRouter style
                  gateways, LM Studio, Ollama with <code>/v1</code>…). Keys stay server-side only.
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="mt-3 text-[13.5px] text-slate-500 dark:text-zinc-400">
            Backend status unknown — start the server (<code className="font-mono">npm run dev:server</code>).
          </p>
        )}
      </section>

      {/* data & privacy */}
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Data &amp; privacy</h3>
        <div className="mt-3 space-y-2 text-[13.5px] text-slate-600 dark:text-zinc-300">
          <p className="flex items-start gap-2">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-600" />
            Chat history, roadmap progress and quiz scores are stored only in this browser
            (localStorage). The API key never reaches the browser.
          </p>
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-[13px] font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
          >
            <Trash2 size={14} /> Clear all local data
          </button>
          {cleared && <p className="text-[12px] text-emerald-600">Local data cleared.</p>}
          <p className="pt-1 text-[12px] leading-relaxed text-slate-400 dark:text-zinc-500">
            Uploaded documents are processed server-side and kept in server memory only. They are not
            persisted to disk, and they disappear when the backend restarts.
          </p>
        </div>
      </section>

      {/* about */}
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
          <Info size={13} /> About
        </h3>
        <p className="mt-2.5 text-[13px] leading-relaxed text-slate-600 dark:text-zinc-300">
          <strong>NLP Tutor AI</strong> — a study chatbot for NLP engineering: explanations with
          examples, code walkthroughs, quizzes, a glossary, a roadmap with saved progress, and
          question-answering over uploaded course notes (page-cited, keyword-grounded).
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-slate-400 dark:text-zinc-500">
          Limitations: offline mode answers from the built-in NLP knowledge base (not a live LLM);
          document QA is keyword-based (not full RAG); history is per-browser. Always verify
          exam-critical facts against your own course material.
        </p>
      </section>

      <ConfirmDialog
        open={confirmClear}
        title="Clear all local data?"
        message="This removes every conversation, roadmap progress and quiz score stored in this browser."
        confirmLabel="Clear data"
        destructive
        onConfirm={() => {
          clearAllAppData();
          setConfirmClear(false);
          setCleared(true);
          window.location.reload();
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
