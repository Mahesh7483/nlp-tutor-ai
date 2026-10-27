import { Menu, Moon, Sun, Trash2, RadioTower, Wifi, WifiOff } from "lucide-react";
import type { HealthResponse } from "../types";

interface HeaderProps {
  title: string;
  onMenu: () => void;
  onToggleTheme: () => void;
  isDark: boolean;
  health: HealthResponse | null;
  onClearChat: () => void;
  showClearChat: boolean;
}

export function headerStatus(health: HealthResponse | null): { label: string; tone: string; icon: typeof Wifi } {
  if (!health) {
    return { label: "Connecting…", tone: "text-slate-400 border-slate-200 dark:border-zinc-700", icon: RadioTower };
  }
  if (health.mode === "live") {
    return {
      label: `Live · ${health.ai.model ?? "model"}`,
      tone: "text-emerald-600 border-emerald-200 bg-emerald-50/70 dark:text-emerald-400 dark:border-emerald-900/70 dark:bg-emerald-950/40",
      icon: Wifi,
    };
  }
  return {
    label: "Demo mode",
    tone: "text-amber-700 border-amber-200 bg-amber-50/70 dark:text-amber-400 dark:border-amber-900/70 dark:bg-amber-950/40",
    icon: WifiOff,
  };
}

export function Header({ title, onMenu, onToggleTheme, isDark, health, onClearChat, showClearChat }: HeaderProps) {
  const status = headerStatus(health);
  const StatusIcon = status.icon;

  return (
    <header className="flex h-14 items-center gap-2 border-b border-slate-200 bg-white/80 px-3 backdrop-blur md:px-5 dark:border-zinc-800 dark:bg-zinc-900/80">
      <button
        type="button"
        onClick={onMenu}
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:text-zinc-400 dark:hover:bg-zinc-800"
        aria-label="Open sidebar"
      >
        <Menu size={19} />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-semibold tracking-tight">{title}</h1>
      </div>

      <div
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium ${status.tone}`}
        title={
          health
            ? health.mode === "live"
              ? `Provider ${health.ai.baseUrl ?? ""} · model ${health.ai.model ?? ""}`
              : "No AI_API_KEY/AI_BASE_URL/AI_MODEL configured — answers come from built-in demo lessons."
            : "Checking backend configuration…"
        }
      >
        <StatusIcon size={12} />
        <span className="hidden sm:inline">{status.label}</span>
      </div>

      {showClearChat && (
        <button
          type="button"
          onClick={onClearChat}
          className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-zinc-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
          aria-label="Clear this conversation"
          title="Clear this conversation"
        >
          <Trash2 size={17} />
        </button>
      )}

      <button
        type="button"
        onClick={onToggleTheme}
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDark ? <Sun size={17} /> : <Moon size={17} />}
      </button>
    </header>
  );
}
