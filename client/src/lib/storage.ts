import type { StoredChat } from "../types";

/**
 * localStorage persistence with defensive parsing — corrupted or malformed
 * data is discarded instead of crashing the app.
 */

const CHAT_PREFIX = "nlp-tutor:chat:";
const CHAT_INDEX = "nlp-tutor:chat-index";
const PROGRESS_KEY = "nlp-tutor:roadmap-progress";
const QUIZ_STATS = "nlp-tutor:quiz-stats";

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupted entry: remove it so it doesn't keep failing.
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // Quota exceeded or private-browsing failures must not crash the app.
    console.warn("[nlp-tutor] localStorage write failed:", err);
  }
}

/* ---------- chat index ---------- */

export function getChatIndex(): string[] {
  const ids = readJson<string[]>(CHAT_INDEX);
  return Array.isArray(ids) ? ids : [];
}

export function getChat(id: string): StoredChat | null {
  const chat = readJson<StoredChat>(CHAT_PREFIX + id);
  if (
    chat &&
    typeof chat.id === "string" &&
    Array.isArray(chat.messages) &&
    chat.messages.every(
      (m) =>
        m &&
        typeof m.id === "string" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
  ) {
    return chat;
  }
  if (chat) {
    // Exists but malformed → drop quietly.
    try {
      localStorage.removeItem(CHAT_PREFIX + id);
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function saveChat(chat: StoredChat): void {
  writeJson(CHAT_PREFIX + chat.id, chat);
  const index = getChatIndex().filter((id) => id !== chat.id);
  index.unshift(chat.id);
  writeJson(CHAT_INDEX, index.slice(0, 60)); // keep the most recent 60
}

export function deleteChat(id: string): void {
  try {
    localStorage.removeItem(CHAT_PREFIX + id);
  } catch {
    /* ignore */
  }
  writeJson(CHAT_INDEX, getChatIndex().filter((x) => x !== id));
}

export function listChats(): StoredChat[] {
  return getChatIndex()
    .map((id) => getChat(id))
    .filter((c): c is StoredChat => c !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function clearAllChats(): void {
  for (const id of getChatIndex()) {
    try {
      localStorage.removeItem(CHAT_PREFIX + id);
    } catch {
      /* ignore */
    }
  }
  try {
    localStorage.removeItem(CHAT_INDEX);
  } catch {
    /* ignore */
  }
}

/* ---------- roadmap progress ---------- */

export function getRoadmapProgress(): string[] {
  const progress = readJson<string[]>(PROGRESS_KEY);
  return Array.isArray(progress) ? progress : [];
}

export function saveRoadmapProgress(ids: string[]): void {
  writeJson(PROGRESS_KEY, ids);
}

/* ---------- quiz stats ---------- */

export interface QuizStat {
  at: number;
  score: number;
  total: number;
  difficulty: string;
  topics: string[];
}

export function getQuizStats(): QuizStat[] {
  return readJson<QuizStat[]>(QUIZ_STATS) ?? [];
}

export function addQuizStat(stat: QuizStat): void {
  const stats = getQuizStats();
  stats.unshift(stat);
  writeJson(QUIZ_STATS, stats.slice(0, 50));
}

/* ---------- clear everything ---------- */

export function clearAllAppData(): void {
  clearAllChats();
  try {
    localStorage.removeItem(PROGRESS_KEY);
    localStorage.removeItem(QUIZ_STATS);
  } catch {
    /* ignore */
  }
}

/* ---------- misc ---------- */

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
