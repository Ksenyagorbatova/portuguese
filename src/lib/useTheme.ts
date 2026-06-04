import { useEffect, useState } from "react";

// Warm dark theme. Activated by [data-theme="dark"] on <html>. Initial value:
// the user's saved choice, else the OS preference. An inline script in
// index.html applies it before first paint to avoid a flash; this hook keeps
// the attribute + localStorage in sync and exposes a toggle.

export type Theme = "light" | "dark";

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    const el = document.documentElement;
    if (theme === "dark") el.setAttribute("data-theme", "dark");
    else el.removeAttribute("data-theme");
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // ignore (private mode / storage disabled)
    }
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggle };
}
