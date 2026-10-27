import { useMemo, useState } from "react";
import {
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Code2,
  FileText,
  GraduationCap,
  MessageSquare,
  MessagesSquare,
  PanelLeftClose,
  Pencil,
  PlusCircle,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import type { ChatStore } from "../lib/useChatStore";
import type { View } from "../types/nav";

interface SidebarProps {
  store: ChatStore;
  view: View;
  onNavigate: (view: View) => void;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onClose: () => void; // mobile drawer
}

const NAV_ITEMS: { view: View; label: string; icon: typeof BookOpen }[] = [
  { view: "roadmap", label: "Learning Roadmap", icon: BrainCircuit },
  { view: "quiz", label: "Quiz Practice", icon: CheckCircle2 },
  { view: "glossary", label: "NLP Glossary", icon: BookOpen },
  { view: "code", label: "Code Examples", icon: Code2 },
  { view: "documents", label: "Course Documents", icon: FileText },
];

export function Sidebar({
  store,
  view,
  onNavigate,
  onNewChat,
  onSelectChat,
  collapsed,
  onToggleCollapsed,
  onClose,
}: SidebarProps) {
  const [query, setQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const history = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = store.chats;
    if (!q) return list;
    return list.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q)),
    );
  }, [store.chats, query]);

  return (
    <div
      className={`flex h-full flex-col border-r border-slate-200 bg-slate-50/80 dark:border-zinc-800 dark:bg-zinc-950/80 ${
        collapsed ? "w-[68px]" : "w-[270px]"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 pt-3.5 pb-1">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
          <GraduationCap size={20} />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold tracking-tight">NLP Tutor AI</div>
            <div className="text-[11px] text-slate-500 dark:text-zinc-500">NLP Engineering study companion</div>
          </div>
        )}
        {/* close on mobile */}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 lg:hidden dark:hover:bg-zinc-800"
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>
        {/* collapse on desktop */}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="ml-auto hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 lg:block dark:hover:bg-zinc-800"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <PanelLeftClose size={16} className={collapsed ? "rotate-180" : ""} />
        </button>
      </div>

      {/* New chat */}
      <div className="px-3 pt-2">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 active:bg-blue-800"
        >
          <PlusCircle size={17} />
          {collapsed ? null : "New Chat"}
        </button>
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="relative px-3 pt-3">
          <Search size={14} className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-[13px] placeholder-slate-400 focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder-zinc-600"
          />
        </div>
      )}

      {/* History */}
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {!collapsed && (
          <div className="flex items-center justify-between px-1.5 pb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              {query ? "Search results" : "Recent chats"}
            </span>
            <MessagesSquare size={13} className="text-slate-300 dark:text-zinc-600" />
          </div>
        )}
        {history.length === 0 ? (
          !collapsed && (
            <p className="px-2 py-4 text-[12px] leading-relaxed text-slate-400 dark:text-zinc-500">
              {query ? "No conversations match your search." : "No conversations yet. Start a new chat!"}
            </p>
          )
        ) : (
          <ul className="space-y-0.5">
            {history.map((chat) => (
              <li key={chat.id}>
                {renamingId === chat.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (renameValue.trim()) store.renameChat(chat.id, renameValue);
                      setRenamingId(null);
                    }}
                    className="px-1"
                  >
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => setRenamingId(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      aria-label="Rename conversation"
                      className="w-full rounded-md border border-blue-400 bg-white px-2 py-1.5 text-[13px] dark:border-blue-500 dark:bg-zinc-900"
                    />
                  </form>
                ) : (
                  <div
                    className={`group flex items-center gap-2 rounded-lg px-2 py-2 text-[13px] transition-colors ${
                      view === "chat" && store.activeId === chat.id
                        ? "bg-blue-100/80 text-blue-900 dark:bg-blue-950/70 dark:text-blue-200"
                        : "hover:bg-slate-200/60 dark:hover:bg-zinc-800/70"
                    }`}
                  >
                    <MessageSquare
                      size={14}
                      className={`shrink-0 ${view === "chat" && store.activeId === chat.id ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-zinc-500"}`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onSelectChat(chat.id);
                        onClose();
                      }}
                      className="min-w-0 flex-1 truncate text-left"
                      title={chat.title}
                    >
                      {collapsed ? chat.title.slice(0, 1) : chat.title}
                    </button>
                    {!collapsed && (
                      <span className="flex shrink-0 items-center gap-0.5 opacity-40 transition-opacity group-hover:opacity-100 focus-within:opacity-100 hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingId(chat.id);
                            setRenameValue(chat.title);
                          }}
                          className="rounded-md p-1 text-slate-400 hover:bg-slate-300/70 hover:text-slate-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                          aria-label={`Rename \"${chat.title}\"`}
                        >
                          <Pencil size={12.5} />
                        </button>
                        <button
                          type="button"
                          onClick={() => store.deleteChat(chat.id)}
                          className="rounded-md p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/60 dark:hover:text-rose-400"
                          aria-label={`Delete \"${chat.title}\"`}
                        >
                          <Trash2 size={12.5} />
                        </button>
                      </span>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Study tools */}
      <div className="border-t border-slate-200 px-2 py-2 dark:border-zinc-800">
        {!collapsed && (
          <div className="px-1.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            Study tools
          </div>
        )}
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = view === item.view;
            return (
              <li key={item.view}>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate(item.view);
                    onClose();
                  }}
                  title={collapsed ? item.label : undefined}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-blue-100/80 text-blue-900 dark:bg-blue-950/70 dark:text-blue-200"
                      : "text-slate-600 hover:bg-slate-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800/70"
                  }`}
                >
                  <Icon size={16} className={active ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-zinc-500"} />
                  {collapsed ? null : item.label}
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => {
                onNavigate("settings");
                onClose();
              }}
              title={collapsed ? "Settings" : undefined}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                view === "settings"
                  ? "bg-blue-100/80 text-blue-900 dark:bg-blue-950/70 dark:text-blue-200"
                  : "text-slate-600 hover:bg-slate-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800/70"
              }`}
            >
              <Settings size={16} className={view === "settings" ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-zinc-500"} />
              {collapsed ? null : "Settings"}
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
