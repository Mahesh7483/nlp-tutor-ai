import { useEffect, useRef } from "react";
import { FileText, Paperclip, Send, Square, X } from "lucide-react";
import type { DocMeta } from "../types";

const MAX_MESSAGE_CHARS = 8000;

interface ComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  docs: DocMeta[];
  attachedDocId?: string;
  onAttachDoc: (doc: DocMeta | null) => void;
  /** Upload a picked file; the parent owns API + error handling. */
  onFileSelected: (file: File) => void;
  disabled?: boolean;
  error?: string | null;
}

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  docs,
  attachedDocId,
  onAttachDoc,
  onFileSelected,
  disabled,
  error,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize up to ~7 rows
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 176)}px`;
  }, [value]);

  const canSend = value.trim().length > 0 && value.length <= MAX_MESSAGE_CHARS && !disabled;
  const overLimit = value.length > MAX_MESSAGE_CHARS;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <div className="border-t border-slate-200 bg-white px-3 pb-3 pt-2.5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto max-w-3xl">
        {/* upload error, if any */}
        {error && (
          <p className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </p>
        )}

        {/* attached notes chip */}
        {attachedDocId && (
          <div className="mb-2 flex items-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[12px] font-medium text-blue-700 dark:border-blue-800/80 dark:bg-blue-950/50 dark:text-blue-300">
              <FileText size={12} />
              {docs.find((d) => d.id === attachedDocId)?.name ?? "Course notes"}
              <button
                type="button"
                onClick={() => onAttachDoc(null)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900"
                aria-label="Detach course notes"
              >
                <X size={11} />
              </button>
            </span>
            <span className="ml-2 text-[11px] text-slate-400 dark:text-zinc-500">
              questions marked for these notes will cite them
            </span>
          </div>
        )}

        <div
          className={`flex items-end gap-2 rounded-2xl border bg-slate-50/60 p-2 shadow-sm transition-colors focus-within:border-blue-400 dark:bg-zinc-950/40 ${
            overLimit ? "border-rose-400 focus-within:border-rose-500" : "border-slate-200 dark:border-zinc-700"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.csv,text/plain,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileSelected(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Upload course notes (PDF or text)"
            title="Upload course notes (PDF or text)"
          >
            <Paperclip size={18} />
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about any NLP topic…  (Enter to send, Shift+Enter for a new line)"
            aria-label="Message"
            className="max-h-44 min-h-[38px] flex-1 resize-none bg-transparent px-1 py-2 text-[14.5px] leading-relaxed outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600"
          />

          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              className="rounded-xl bg-rose-600 p-2.5 text-white shadow-sm transition-colors hover:bg-rose-700"
              aria-label="Stop generating"
              title="Stop generating"
            >
              <Square size={15} className="fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              className="rounded-xl bg-blue-600 p-2.5 text-white shadow-sm transition-colors enabled:hover:bg-blue-700 enabled:active:bg-blue-800 disabled:opacity-40 disabled:hover:bg-blue-600"
              aria-label="Send message"
              title="Send message (Enter)"
            >
              <Send size={15} />
            </button>
          )}
        </div>

        <div className="mt-1.5 flex items-center justify-between px-2">
          <p className="text-[11px] text-slate-400 dark:text-zinc-600">
            {streaming ? "Generating… you can stop it." : "NLP Tutor explains concepts, code and exam prep — verify critical facts against your course notes."}
          </p>
          {overLimit ? (
            <p className="text-[11px] font-medium text-rose-500">Message too long ({value.length} / 8000)</p>
          ) : (
            <p className="text-[11px] text-slate-400 dark:text-zinc-600">{value.length > 7500 ? `${value.length} / 8000` : ""}</p>
          )}
        </div>
      </div>
    </div>
  );
}
