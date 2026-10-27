import { useCallback, useEffect, useState } from "react";

export type ThemeSetting = "light" | "dark" | "system";
const THEME_KEY = "nlp-tutor:theme";

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(setting: ThemeSetting): void {
  const dark = setting === "dark" || (setting === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

export function useTheme(): {
  theme: ThemeSetting;
  setTheme: (t: ThemeSetting) => void;
  toggle: () => void;
} {
  const [theme, setThemeState] = useState<ThemeSetting>(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY) as ThemeSetting | null;
      if (stored === "light" || stored === "dark" || stored === "system") return stored;
    } catch {
      /* ignore */
    }
    return "system";
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Follow OS changes when in system mode
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((t: ThemeSetting) => {
    setThemeState(t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    const current = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setTheme(current === "dark" ? "light" : "dark");
  }, [setTheme]);

  return { theme, setTheme, toggle };
}
