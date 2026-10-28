import { useCallback, useEffect, useState } from "react";

const THEME_STORAGE_KEY = "tts-reader-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export type Theme = "light" | "dark";

function loadStoredTheme(): Theme | null {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
}

/** 직접 고른 테마가 없으면 OS 설정을 따른다. */
export function useTheme() {
  const [storedTheme, setStoredTheme] = useState(loadStoredTheme);
  const [systemTheme, setSystemTheme] = useState<Theme>(() =>
    window.matchMedia(DARK_QUERY).matches ? "dark" : "light",
  );

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const handleChange = () => setSystemTheme(query.matches ? "dark" : "light");
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (storedTheme) {
      document.documentElement.dataset.theme = storedTheme;
    } else {
      delete document.documentElement.dataset.theme;
    }
  }, [storedTheme]);

  const theme = storedTheme ?? systemTheme;

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_STORAGE_KEY, next);
    setStoredTheme(next);
  }, [theme]);

  return { theme, toggleTheme };
}
