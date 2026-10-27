import { useCallback, useEffect, useState } from "react";
import type { HealthResponse } from "./types";
import type { View } from "./types/nav";
import { ApiError, getHealth } from "./lib/api";
import { useChatStore } from "./lib/useChatStore";
import { useTheme } from "./lib/theme";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { ChatView } from "./components/ChatView";
import { QuizPage } from "./pages/QuizPage";
import { GlossaryPage } from "./pages/GlossaryPage";
import { RoadmapPage } from "./pages/RoadmapPage";
import { CodeExamplesPage } from "./pages/CodeExamplesPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ConfirmDialog } from "./components/Modal";

const VIEW_TITLES: Record<View, string> = {
  chat: "NLP Tutor",
  roadmap: "Learning Roadmap",
  quiz: "Quiz Practice",
  glossary: "NLP Glossary",
  code: "Code Examples",
  documents: "Course Documents",
  settings: "Settings",
};

export default function App() {
  const store = useChatStore();
  const { theme, setTheme, toggle } = useTheme();
  const [view, setView] = useState<View>("chat");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("nlp-tutor:sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });
  const [confirmClear, setConfirmClear] = useState(false);

  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const [isDarkState, setIsDarkState] = useState(isDark);
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkState(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("nlp-tutor:sidebar-collapsed", collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  // Fetch backend health/status once (and again when the tab regains focus)
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getHealth()
        .then((h) => {
          if (!cancelled) {
            setHealth(h);
            setHealthError(null);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setHealth(null);
            setHealthError(err instanceof ApiError ? err.message : String(err));
          }
        });
    void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, []);

  const newChat = useCallback(() => {
    store.createChat();
    setView("chat");
    setMobileOpen(false);
  }, [store]);

  const navigate = useCallback((v: View) => {
    setView(v);
  }, []);

  const askTutor = useCallback((prompt: string) => {
    // Opening the chat also handles existing-chat continuity.
    setView("chat");
    setQueuedPrompt(prompt);
  }, []);

  const activeTitle =
    view === "chat" ? (store.getActive()?.title ?? VIEW_TITLES.chat) : VIEW_TITLES[view];

  const showChatControls = view === "chat" && Boolean(store.getActive()?.messages.length);

  return (
    <div className="flex h-full overflow-hidden">
      {/* desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          store={store}
          view={view}
          onNavigate={navigate}
          onNewChat={newChat}
          onSelectChat={(id) => {
            store.setActiveId(id);
            setView("chat");
          }}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
          onClose={() => undefined}
        />
      </div>

      {/* mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-xl" role="dialog" aria-label="Navigation sidebar">
            <Sidebar
              store={store}
              view={view}
              onNavigate={navigate}
              onNewChat={newChat}
              onSelectChat={(id) => {
                store.setActiveId(id);
                setView("chat");
                setMobileOpen(false);
              }}
              collapsed={false}
              onToggleCollapsed={() => undefined}
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          title={activeTitle}
          onMenu={() => setMobileOpen(true)}
          onToggleTheme={toggle}
          isDark={isDarkState}
          health={health}
          onClearChat={() => setConfirmClear(true)}
          showClearChat={Boolean(showChatControls)}
        />

        {healthError && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[12.5px] text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
            Could not reach the backend at <code>/api/health</code> — {healthError}.{" "}
            {typeof window !== "undefined" &&
            window.location.hostname !== "localhost" &&
            window.location.hostname !== "127.0.0.1" ? (
              <>
                You're viewing a hosted frontend: the Express backend must be deployed separately
                and configured via <code className="font-mono">VITE_API_BASE</code> (see the
                README's "Hosting online" section) — locally, <code className="font-mono">npm run dev:server</code> is enough.
              </>
            ) : (
              <>
                Start it with <code className="font-mono">npm run dev:server</code> in a second
                terminal.
              </>
            )}
          </div>
        )}

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {view === "chat" && (
            <ChatView
              store={store}
              health={health ?? {
                status: "ok",
                app: "NLP Tutor AI",
                mode: "demo",
                ai: { mode: "demo", configured: false, model: null, baseUrl: null, requires: [] },
                uptimeSeconds: 0,
              }}
              queuedPrompt={queuedPrompt}
              onQueuedPromptHandled={() => setQueuedPrompt(null)}
            />
          )}
          {view === "roadmap" && <RoadmapPage onAskTopic={(prompt) => askTutor(prompt)} />}
          {view === "quiz" && <QuizPage onAskTutor={askTutor} />}
          {view === "glossary" && <GlossaryPage onAskTutor={askTutor} />}
          {view === "code" && <CodeExamplesPage onAskTutor={askTutor} />}
          {view === "documents" && (
            <DocumentsPage
              store={store}
              onOpenChat={(chatId) => {
                if (chatId) store.setActiveId(chatId);
                setView("chat");
              }}
            />
          )}
          {view === "settings" && <SettingsPage theme={theme} onThemeChange={setTheme} health={health} />}
        </main>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear this conversation?"
        message="All messages in this conversation will be removed. This cannot be undone."
        confirmLabel="Clear chat"
        destructive
        onConfirm={() => {
          const active = store.getActive();
          if (active) store.clearMessages(active.id);
          setConfirmClear(false);
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
