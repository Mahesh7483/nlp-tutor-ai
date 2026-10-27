import { useCallback, useMemo, useState } from "react";
import type { StoredChat, StoredMessage } from "../types";
import * as storage from "../lib/storage";

/**
 * Chat state kept in localStorage via the storage helpers.
 * Handles create, rename, search, delete, and message bookkeeping.
 */

function deriveTitle(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 48 ? `${compact.slice(0, 48)}…` : compact || "New chat";
}

function makeChat(firstMessage: string, docId?: string, docName?: string): StoredChat {
  const now = Date.now();
  return {
    id: storage.newId(),
    title: deriveTitle(firstMessage),
    createdAt: now,
    updatedAt: now,
    messages: [],
    docId,
    docName,
  };
}

export function useChatStore() {
  const [chats, setChats] = useState<StoredChat[]>(() => storage.listChats());
  const [activeId, setActiveId] = useState<string | null>(() => storage.listChats()[0]?.id ?? null);

  const getActive = useCallback((): StoredChat | null => {
    return activeId ? storage.getChat(activeId) : null;
  }, [activeId]);

  const refresh = useCallback(() => {
    setChats(storage.listChats());
  }, []);

  const createChat = useCallback(
    (docId?: string, docName?: string): StoredChat => {
      const chat = makeChat("", docId, docName);
      storage.saveChat(chat);
      setChats((prev) => [chat, ...prev]);
      setActiveId(chat.id);
      return chat;
    },
    [],
  );

  const patchChat = useCallback(
    (id: string, mutator: (chat: StoredChat) => StoredChat): StoredChat => {
      const current = storage.getChat(id);
      if (!current) throw new Error(`Chat ${id} not found`);
      const updated = mutator({ ...current });
      updated.updatedAt = Date.now();
      storage.saveChat(updated);
      setChats(storage.listChats());
      return updated;
    },
    [],
  );

  const addMessage = useCallback(
    (id: string, message: Omit<StoredMessage, "id" | "createdAt">): StoredMessage => {
      const full: StoredMessage = { ...message, id: storage.newId(), createdAt: Date.now() };
      patchChat(id, (chat) => ({
        ...chat,
        messages: [...chat.messages, full],
        title: chat.messages.length === 0 && message.role === "user" ? deriveTitle(message.content) : chat.title,
      }));
      return full;
    },
    [patchChat],
  );

  const updateMessage = useCallback(
    (id: string, messageId: string, mutator: (msg: StoredMessage) => StoredMessage) => {
      patchChat(id, (chat) => ({
        ...chat,
        messages: chat.messages.map((m) => (m.id === messageId ? mutator(m) : m)),
      }));
    },
    [patchChat],
  );

  /** Remove every message after (not including) the given message id. */
  const truncateMessagesAfter = useCallback(
    (id: string, messageId: string) => {
      patchChat(id, (chat) => {
        const index = chat.messages.findIndex((m) => m.id === messageId);
        if (index < 0) return chat;
        return { ...chat, messages: chat.messages.slice(0, index + 1) };
      });
    },
    [patchChat],
  );

  const clearMessages = useCallback(
    (id: string) => {
      patchChat(id, (chat) => ({ ...chat, messages: [] }));
    },
    [patchChat],
  );

  const dropMessagesFrom = useCallback(
    (id: string, messageId: string) => {
      patchChat(id, (chat) => {
        const index = chat.messages.findIndex((m) => m.id === messageId);
        if (index < 0) return chat;
        return { ...chat, messages: chat.messages.slice(0, index) };
      });
    },
    [patchChat],
  );

  const renameChat = useCallback(
    (id: string, title: string) => {
      patchChat(id, (chat) => ({ ...chat, title: title.trim() || chat.title }));
    },
    [patchChat],
  );

  const deleteChat = useCallback(
    (id: string) => {
      storage.deleteChat(id);
      setChats(storage.listChats());
      setActiveId((current) => (current === id ? storage.listChats()[0]?.id ?? null : current));
    },
    [],
  );

  const setChatDoc = useCallback(
    (id: string, docId?: string, docName?: string) => {
      patchChat(id, (chat) => ({ ...chat, docId, docName }));
    },
    [patchChat],
  );

  return useMemo(
    () => ({
      chats,
      activeId,
      setActiveId,
      createChat,
      addMessage,
      updateMessage,
      dropMessagesFrom,
      truncateMessagesAfter,
      clearMessages,
      renameChat,
      deleteChat,
      setChatDoc,
      setChat: (chat: StoredChat) => {
        storage.saveChat(chat);
        refresh();
      },
      getActive,
    }),
    [
      chats,
      activeId,
      createChat,
      addMessage,
      updateMessage,
      dropMessagesFrom,
      truncateMessagesAfter,
      clearMessages,
      renameChat,
      deleteChat,
      setChatDoc,
      getActive,
      refresh,
    ],
  );
}

export type ChatStore = ReturnType<typeof useChatStore>;
