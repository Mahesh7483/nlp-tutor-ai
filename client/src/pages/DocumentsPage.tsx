import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, FileUp, Trash2, MessageSquarePlus, LoaderCircle, AlertTriangle } from "lucide-react";
import type { DocMeta, StoredChat } from "../types";
import type { ChatStore } from "../lib/useChatStore";
import * as api from "../lib/api";

interface DocumentsPageProps {
  store?: ChatStore;
  onOpenChat?: (chatId: string | null) => void;
  /** Convenience mode used when opened without the store (standalone page). */
  mode?: "standalone" | "with-store";
}

interface UploadState {
  uploading: boolean;
  error: string | null;
  success: string | null;
}

export function DocumentsPage(props: DocumentsPageProps) {
  const { store, onOpenChat } = props;
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [upload, setUpload] = useState<UploadState>({ uploading: false, error: null, success: null });
  const [removing, setRemoving] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    api.listDocuments().then(setDocs).catch(() => setDocs([]));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const uploadFile = async (file: File) => {
    setUpload({ uploading: true, error: null, success: null });
    try {
      const meta = await api.uploadDocument(file);
      setUpload({
        uploading: false,
        error: null,
        success: `“${meta.name}” uploaded — ${meta.pageCount} page${meta.pageCount === 1 ? "" : "s"}, ${meta.charCount.toLocaleString()} characters extracted${meta.status === "trimmed" ? " (truncated to fit)" : ""}.`,
      });
      refresh();
    } catch (err) {
      setUpload({ uploading: false, error: err instanceof Error ? err.message : String(err), success: null });
    }
  };

  const remove = async (id: string) => {
    setRemoving(id);
    try {
      await api.deleteDocument(id);
      refresh();
    } finally {
      setRemoving(null);
    }
  };

  const askAboutDoc = async (doc: DocMeta) => {
    if (!store) return;
    // If a chat with this doc exists, continue it; else create one.
    const existing = store.chats.find(
      (c: StoredChat) => c.docId === doc.id,
    );
    if (existing) {
      onOpenChat?.(existing.id);
      return;
    }
    const chat = store.createChat(doc.id, doc.name);
    onOpenChat?.(chat.id);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-8">
      <header className="mb-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <FileText size={20} className="text-blue-600" /> Course Documents
        </h2>
        <p className="mt-1 text-[13.5px] text-slate-500 dark:text-zinc-400">
          Upload your NLP course notes (PDF with a text layer, or plain text: .txt, .md, .csv). The
          tutor reads extracted pages and cites page numbers when answering questions about them.
        </p>
      </header>

      {/* upload zone */}
      <section
        className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-6 text-center transition-colors hover:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) void uploadFile(file);
        }}
      >
        <FileUp size={28} className="mx-auto text-slate-400" />
        <p className="mt-2 text-[13.5px] text-slate-500 dark:text-zinc-400">
          Drag & drop a file here, or{" "}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="font-medium text-blue-600 underline decoration-blue-300 hover:decoration-blue-500 dark:text-blue-400"
          >
            browse
          </button>
        </p>
        <p className="mt-1 text-[11.5px] text-slate-400 dark:text-zinc-600">PDF or text · up to 20 MB · text-based files only (no scans)</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.md,.csv,text/plain,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadFile(file);
            e.target.value = "";
          }}
        />

        {upload.uploading && (
          <p className="mt-3 inline-flex items-center gap-2 text-[12.5px] text-blue-600 dark:text-blue-400">
            <LoaderCircle size={14} className="animate-spin" /> Extracting text…
          </p>
        )}
        {upload.error && (
          <p className="mx-auto mt-3 inline-flex max-w-md items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-left text-[12.5px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {upload.error}
          </p>
        )}
        {upload.success && (
          <p className="mx-auto mt-3 inline-block max-w-md rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            {upload.success}
          </p>
        )}
      </section>

      {/* document list */}
      <section className="mt-6">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
          Your documents ({docs.length})
        </h3>
        {docs.length === 0 ? (
          <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-[13px] text-slate-500 dark:bg-zinc-900 dark:text-zinc-400">
            Nothing uploaded yet. Documents are kept in server memory, so they disappear when the
            backend restarts — re-upload them then.
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {docs.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                  <FileText size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{doc.name}</p>
                  <p className="mt-0.5 text-[11.5px] text-slate-400 dark:text-zinc-500">
                    {doc.pageCount} page{doc.pageCount === 1 ? "" : "s"} · {doc.charCount.toLocaleString()} chars ·{" "}
                    {Math.round(doc.sizeBytes / 1024)} KB ·{" "}
                    {doc.status === "trimmed" ? "trimmed" : "ready"}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[12px] text-slate-400 dark:text-zinc-500">{doc.preview}…</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {store && onOpenChat && (
                    <button
                      type="button"
                      onClick={() => void askAboutDoc(doc)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11.5px] font-medium text-white hover:bg-blue-700"
                      aria-label={`Ask in chat about ${doc.name}`}
                    >
                      <MessageSquarePlus size={13} /> Chat
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void remove(doc.id)}
                    disabled={removing === doc.id}
                    className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                    aria-label={`Remove ${doc.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[12.5px] leading-relaxed text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        <p>
          <strong className="text-slate-600 dark:text-zinc-300">How grounded answering works here:</strong>{" "}
          text is extracted per page, split into chunks, and matched to your question with keyword
          retrieval. The tutor cites page tags from these chunks and clearly separates notes content
          from its general knowledge. This is not a full embeddings/vector-database RAG pipeline —
          retrieval is simple keyword scoring over the extracted text (up to 10 documents at a time).
        </p>
      </section>
    </div>
  );
}
