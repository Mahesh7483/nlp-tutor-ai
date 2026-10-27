import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
      await api.streamChat({
        message,
        history,
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
        onError: (message) => setStreamError(message),
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
