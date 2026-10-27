import { memo } from "react";
import { AlertTriangle, FileText, GraduationCap, Copy, RefreshCw, RotateCcw, User, Square } from "lucide-react";
import { Markdown } from "./Markdown";
import type { StoredMessage } from "../types";

interface MessageBubbleProps {
  message: StoredMessage;
  docName?: string;
  streaming?: boolean;
  isLastAssistant: boolean;
  onCopy: (text: string) => void;
  onRegenerate: () => void;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  docName,
  streaming = false,
  isLastAssistant,
  onCopy,
  onRegenerate,
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`group px-3 py-4 md:px-6 ${isUser ? "bg-transparent" : "bg-slate-50/60 dark:bg-zinc-950/40"}`}>
      <div className="mx-auto flex max-w-3xl gap-3">
        <div
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
            isUser
              ? "bg-slate-200 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300"
              : "bg-blue-600 text-white shadow-sm"
          }`}
          aria-hidden
        >
          {isUser ? <User size={15} /> : <GraduationCap size={15} />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 text-[12px] font-medium text-slate-400 dark:text-zinc-500">
            <span>{isUser ? "You" : "NLP Tutor"}</span>
            {!isUser && message.mode === "demo" && (
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-400">
                offline
              </span>
            )}
            {!isUser && docName && (
              <span className="inline-flex max-w-[180px] items-center gap-1 truncate rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300">
                <FileText size={9} />
                {docName}
              </span>
            )}
          </div>

          {isUser ? (
            <div className="inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-md bg-blue-600 px-3.5 py-2.5 text-[14.5px] leading-relaxed text-white shadow-sm">
              {message.content}
            </div>
          ) : (
            <div className="text-slate-800 dark:text-zinc-200">
              {message.content ? (
                <Markdown text={message.content} />
              ) : streaming ? (
                <div className="flex items-center gap-2 py-1 text-[13px] text-slate-400 dark:text-zinc-500">
                  <span className="flex gap-1" aria-label="Generating answer">
                    <Dot delay="0ms" />
                    <Dot delay="160ms" />
                    <Dot delay="320ms" />
                  </span>
                  thinking…</div>
              ) : null}

              {message.stopped && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-[11.5px] text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
                  <Square size={10} className="fill-current" /> generation stopped
                </div>
              )}

              {message.error && (
                <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium">Something went wrong</p>
                      <p className="mt-0.5 break-words text-rose-600/90 dark:text-rose-300/90">{message.error}</p>
                      <button
                        type="button"
                        onClick={onRegenerate}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-rose-700"
                      >
                        <RotateCcw size={12} /> Retry
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {!message.error && message.content && (
                <div className={`mt-2 flex items-center gap-1 transition-opacity ${streaming ? "opacity-0" : "opacity-60 hover:opacity-100"}`}>
                  <button
                    type="button"
                    onClick={() => onCopy(message.content)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-slate-500 hover:bg-slate-200/70 hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    aria-label="Copy answer"
                  >
                    <Copy size={12} /> Copy
                  </button>
                  {isLastAssistant && !streaming && (
                    <button
                      type="button"
                      onClick={onRegenerate}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-slate-500 hover:bg-slate-200/70 hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      aria-label="Regenerate response"
                    >
                      <RefreshCw size={12} /> Regenerate
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500"
      style={{ animationDelay: delay }}
    />
  );
}
