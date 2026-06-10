import { useEffect, useState } from "react";

// Theme with three user choices: light, dark, or "system" (follow the OS).
// `data-theme="dark"` on <html> activates the warm dark palette. An inline
// script in index.html applies the resolved theme before first paint to avoid
// a flash; this hook keeps the attribute + localStorage in sync, cycles the
// choice, and — while on "system" — tracks live OS theme changes.

export type Theme = "light" | "dark";
export type ThemeChoice = Theme | "system";

// Click order of the toggle: light → dark → system → light.
const ORDER: ThemeChoice[] = ["light", "dark", "system"];

// Browser-chrome color (<meta name="theme-color">) per resolved theme — must
// match --page in src/index.css and the static metas in index.html. The metas
// carry media="(prefers-color-scheme: …)" for the pre-React paint; once the
// hook runs it pins BOTH to the resolved theme, so an explicit in-app choice
// wins over the OS scheme in the browser chrome too.
const THEME_COLOR: Record<Theme, string> = { light: "#f4f3ef", dark: "#16150f" };

export function nextThemeChoice(c: ThemeChoice): ThemeChoice {
  const i = ORDER.indexOf(c);
  return ORDER[(i + 1) % ORDER.length];
}

function prefersDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export function resolveTheme(choice: ThemeChoice): Theme {
  if (choice === "light" || choice === "dark") return choice;
  return prefersDark() ? "dark" : "light";
}

function initialChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {
    // ignore (private mode / storage disabled)
  }
  return "system";
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(initialChoice);
  const [systemDark, setSystemDark] = useState<boolean>(prefersDark);

  // Track the live OS preference. setState lives in the change callback (an
  // external-system subscription), not in the effect body — the initial value
  // already comes from the lazy useState above.
  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Resolved theme is derived, not stored: explicit choice wins; "system"
  // follows the OS. Recomputed each render — no syncing effect needed.
  const resolved: Theme = choice === "system" ? (systemDark ? "dark" : "light") : choice;

  // Persist the choice (external-system update, no setState).
  useEffect(() => {
    try {
      localStorage.setItem("theme", choice);
    } catch {
      // ignore (private mode / storage disabled)
    }
  }, [choice]);

  // Apply the resolved theme to <html> and to the theme-color metas (browser
  // chrome): both media-split metas get the resolved color, so whichever one
  // the browser picks shows the app's actual theme, not the OS one.
  useEffect(() => {
    const el = document.documentElement;
    if (resolved === "dark") el.setAttribute("data-theme", "dark");
    else el.removeAttribute("data-theme");
    const color = THEME_COLOR[resolved];
    document
      .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      .forEach((m) => m.setAttribute("content", color));
  }, [resolved]);

  const cycle = () => setChoice(nextThemeChoice);

  return { choice, theme: resolved, cycle };
}
