import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Code2, Compass, Map, Target } from "lucide-react";
import type { ProviderMode } from "../types";
import type { ChatStore } from "../lib/useChatStore";
import type { DocMeta, HealthResponse } from "../types";
import * as api from "../lib/api";
import { Composer } from "./Composer";
import { MessageBubble } from "./MessageBubble";
import { Welcome } from "./Welcome";

interface ChatViewProps {
  store: ChatStore;
  health: HealthResponse;
  /** Prompt queued from other pages (glossary/quiz/code). */
  queuedPrompt: string | null;
  onQueuedPromptHandled: () => void;
}

const SCROLL_EPSILON = 60;

/** Quick-reply chips shown under the latest answer (sent verbatim on click). */
const FOLLOW_UPS = [
  { text: "Show me Python code for this", icon: Code2 },
  { text: "Explain it more deeply", icon: BookOpen },
  { text: "Ask me a practice question", icon: Target },
] as const;

/** Chips shown when the last reply wasn't a topic lesson (greetings, moods, pointers…). */
const EXPLORER_CHIPS = [
  { text: "What topics do you cover?", icon: Compass },
  { text: "How should I start learning NLP?", icon: Map },
  { text: "Ask me a practice question", icon: Target },
] as const;

/** Reply intents that call for the explorer chips instead of topic chips. */
const EXPLORER_INTENTS = new Set([
  "greeting",
  "bye",
  "mood",
  "name",
  "confirmation",
  "decline",
  "conversation",
  "capabilities",
  "identity",
  "topics",
  "quiz-point",
  "glossary-point",
  "roadmap-point",
  "need-topic",
  "off-topic",
  "unknown",
  "notes-point",
]);

/* Server used to reject oversized histories (400) — errors show as an empty
   bubble. Keep sent history within the documented cap. */
const MAX_HISTORY_SENT = 30; // must stay in sync with the server's limit

export function ChatView({ store, health, queuedPrompt, onQueuedPromptHandled }: ChatViewProps) {
  const [input, setInput] = useState("");
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [streamText, setStreamText] = useState("");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [docError, setDocError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const activeChat = store.getActive();
  const attachedDocId = activeChat?.docId;
  const attachedDoc = docs.find((d) => d.id === attachedDocId) ?? null;

  useEffect(() => {
    api.listDocuments().then(setDocs).catch(() => setDocs([]));
  }, []);

  /* Keep latest stream metadata visible to the finaliser. */
  const streamErrorRef = useRef<string | null>(null);
  const streamModeRef = useRef<ProviderMode | null>(null);
  useEffect(() => {
    streamErrorRef.current = streamError;
  }, [streamError]);

  const runStream = useCallback(
    async (chatId: string, assistantMessageId: string, history: { role: "user" | "assistant"; content: string }[], message: string, docId?: string) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setStreamText("");
      setStreamError(null);
      streamErrorRef.current = null;
      streamModeRef.current = null;

      let acc = "";
      let replyIntent: string | undefined;
      await api.streamChat({
        message,
        history: history.slice(-MAX_HISTORY_SENT),
        chatId,
        docId,
        docQuestion: Boolean(docId),
        abortSignal: controller.signal,
        onMeta: (mode) => {
          streamModeRef.current = mode;
        },
        onDelta: (text) => {
          acc += text;
          setStreamText(acc);
        },
        onDone: (intent) => {
          replyIntent = intent;
        },
        onError: (message) => {
          streamErrorRef.current = message; // write through directly: the finaliser reads it before the effect tick
          setStreamError(message);
        },
      });

      abortRef.current = null;
      setStreamingId(null);
      setStreamText("");
      setStreamError(null);
      // Persist the final answer (also covers stopped / failed generations).
      store.updateMessage(chatId, assistantMessageId, (m) => ({
        ...m,
        content: acc,
        error: streamErrorRef.current ?? undefined,
        stopped: controller.signal.aborted ? true : undefined,
        mode: streamModeRef.current ?? health.mode,
        intent: replyIntent,
      }));
    },
    [store, health.mode],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /* ------------------------- sending ------------------------- */

  const sendMessage = useCallback(
    (rawText: string, opts?: { regenerate?: boolean }) => {
      const text = rawText.trim();
      if (streamingId || abortRef.current) return;

      let chat = store.getActive();
      if (!chat) chat = store.createChat();
      const chatId = chat.id;
      const docId = chat.docId;

      if (opts?.regenerate) {
        // Remove trailing assistant messages; re-ask the last user question.
        const msgs = [...chat.messages];
        while (msgs.length && msgs[msgs.length - 1].role === "assistant") msgs.pop();
        const lastUser = msgs[msgs.length - 1];
        if (!lastUser || lastUser.role !== "user") return;
        store.truncateMessagesAfter(chatId, lastUser.id);
        const history = msgs.map((m) => ({ role: m.role, content: m.content }));
        const assistant = store.addMessage(chatId, { role: "assistant", content: "" });
        setStreamingId(assistant.id);
        void runStream(chatId, assistant.id, history, lastUser.content, docId);
        return;
      }

      if (!text) return;
      if (text.length > 8000) {
        setStreamError("Message is too long — please split it into smaller questions.");
        return;
      }

      const history = [...chat.messages.map((m) => ({ role: m.role, content: m.content })), { role: "user" as const, content: text }];
      const userMessage = store.addMessage(chatId, { role: "user", content: text });
      const assistant = store.addMessage(chatId, { role: "assistant", content: "", mode: health.mode });
      setInput("");
      setStreamingId(assistant.id);
      void runStream(chatId, assistant.id, history, text, docId);
      void userMessage;
    },
    [store, streamingId, health.mode, runStream],
  );

  /* -------- queued prompt arriving from other pages -------- */

  useEffect(() => {
    if (queuedPrompt) {
      sendMessage(queuedPrompt);
      onQueuedPromptHandled();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queuedPrompt]);

  /* ------------------------- autoscroll ------------------------- */

  useEffect(() => {
    if (stickToBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [streamText, activeChat?.messages.length]);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_EPSILON;
  }, []);

  /* ---------------------- doc attach/delete ---------------------- */

  const handleFileSelected = useCallback(
    async (file: File) => {
      setDocError(null);
      try {
        const meta = await api.uploadDocument(file);
        setDocs((prev) => [meta, ...prev.filter((d) => d.id !== meta.id)]);
        if (activeChat) store.setChatDoc(activeChat.id, meta.id, meta.name);
        else store.createChat(meta.id, meta.name);
      } catch (err) {
        setDocError(`Could not upload "${file.name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [activeChat, store],
  );

  const attachExistingDoc = useCallback(
    (doc: DocMeta | null) => {
      if (!activeChat) {
        if (doc) store.createChat(doc.id, doc.name);
        return;
      }
      store.setChatDoc(activeChat.id, doc?.id, doc?.name);
    },
    [activeChat, store],
  );

  /* ------------------------- render ------------------------- */

  const messages = activeChat?.messages ?? [];
  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "assistant") return messages[i].id;
    return null;
  }, [messages]);

  const lastMessage = messages[messages.length - 1];
  const showFollowUps =
    Boolean(streamingId) === false &&
    !streamError &&
    Boolean(lastMessage) &&
    lastMessage?.role === "assistant" &&
    !lastMessage?.error &&
    !lastMessage?.stopped &&
    Boolean(lastMessage?.content);

  const followUpChips =
    lastMessage?.intent && EXPLORER_INTENTS.has(lastMessage.intent) ? EXPLORER_CHIPS : FOLLOW_UPS;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto" onScroll={onScroll}>
        {messages.length === 0 ? (
          <Welcome onPickPrompt={(p) => sendMessage(p)} docName={attachedDoc?.name} />
        ) : (
          <div className="pb-6">
            {messages.map((message) => {
              const live = message.id === streamingId;
              return (
                <MessageBubble
                  key={message.id}
                  message={
                    live
                      ? {
                          ...message,
                          content: streamText || message.content,
                          error: streamError ?? undefined,
                        }
                      : message
                  }
                  docName={activeChat?.docName}
                  streaming={live}
                  isLastAssistant={message.id === lastAssistantId && !live}
                  onCopy={(text) => void navigator.clipboard.writeText(text)}
                  onRegenerate={() => sendMessage("", { regenerate: true })}
                />
              );
            })}
            {showFollowUps && (
              <div className="mx-auto flex max-w-3xl flex-wrap gap-2 px-3 pb-3 md:px-6">
                {followUpChips.map((chip) => {
                  const Icon = chip.icon;
                  return (
                    <button
                      key={chip.text}
                      type="button"
                      onClick={() => sendMessage(chip.text)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
                    >
                      <Icon size={13} />
                      {chip.text}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <Composer
        value={input}
        onChange={setInput}
        onSend={() => sendMessage(input)}
        onStop={stopStreaming}
        streaming={Boolean(streamingId)}
        docs={docs}
        attachedDocId={attachedDocId}
        onAttachDoc={attachExistingDoc}
        onFileSelected={(f) => void handleFileSelected(f)}
        error={docError}
      />
    </div>
  );
}
