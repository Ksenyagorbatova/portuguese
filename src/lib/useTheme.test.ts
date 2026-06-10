import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { nextThemeChoice, useTheme } from "./useTheme";

// A controllable matchMedia stub: jsdom doesn't implement matchMedia, and the
// hook follows the OS while on "system", so we drive it from the test.
function stubMatchMedia(initialDark: boolean) {
  let dark = initialDark;
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    get matches() {
      return dark;
    },
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
    addListener: (cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
    removeListener: (cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
    dispatchEvent: () => true,
    onchange: null,
  };
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(mql));
  return {
    set(v: boolean) {
      dark = v;
      listeners.forEach((cb) => cb({ matches: dark } as MediaQueryListEvent));
    },
  };
}

const isDark = () => document.documentElement.getAttribute("data-theme") === "dark";

// The two media-split theme-color metas from index.html (jsdom has no real
// index.html, so the test recreates them in <head>).
const LIGHT_BG = "#f4f3ef";
const DARK_BG = "#16150f";
function addThemeColorMetas() {
  for (const [content, media] of [
    [LIGHT_BG, "(prefers-color-scheme: light)"],
    [DARK_BG, "(prefers-color-scheme: dark)"],
  ]) {
    const m = document.createElement("meta");
    m.name = "theme-color";
    m.content = content;
    m.media = media;
    document.head.appendChild(m);
  }
}
const metaColors = () =>
  [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(
    (m) => m.content,
  );

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("nextThemeChoice", () => {
  it("cycles light → dark → system → light", () => {
    expect(nextThemeChoice("light")).toBe("dark");
    expect(nextThemeChoice("dark")).toBe("system");
    expect(nextThemeChoice("system")).toBe("light");
  });
});

describe("useTheme", () => {
  it("defaults to system and applies the OS theme when nothing is saved", () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.choice).toBe("system");
    expect(result.current.theme).toBe("dark");
    expect(isDark()).toBe(true);
  });

  it("restores a saved explicit choice and ignores the OS", () => {
    localStorage.setItem("theme", "light");
    stubMatchMedia(true); // OS is dark, but the explicit light choice wins
    const { result } = renderHook(() => useTheme());
    expect(result.current.choice).toBe("light");
    expect(result.current.theme).toBe("light");
    expect(isDark()).toBe(false);
  });

  it("cycles the choice and persists it", () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current.choice).toBe("system");

    act(() => result.current.cycle());
    expect(result.current.choice).toBe("light");
    expect(localStorage.getItem("theme")).toBe("light");

    act(() => result.current.cycle());
    expect(result.current.choice).toBe("dark");
    expect(isDark()).toBe(true);

    act(() => result.current.cycle());
    expect(result.current.choice).toBe("system");
  });

  it("tracks live OS changes while on system", () => {
    const mm = stubMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
    expect(isDark()).toBe(false);

    act(() => mm.set(true));
    expect(result.current.theme).toBe("dark");
    expect(isDark()).toBe(true);
  });

  it("pins both theme-color metas to the resolved theme (explicit dark on a light OS)", () => {
    addThemeColorMetas();
    localStorage.setItem("theme", "dark");
    stubMatchMedia(false); // OS is light, app is explicitly dark
    renderHook(() => useTheme());
    // The media-split metas reflect the APP theme, not prefers-color-scheme.
    expect(metaColors()).toEqual([DARK_BG, DARK_BG]);
  });

  it("keeps the theme-color metas in sync while cycling and on OS changes", () => {
    addThemeColorMetas();
    const mm = stubMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(metaColors()).toEqual([LIGHT_BG, LIGHT_BG]); // system → light OS

    act(() => result.current.cycle()); // → light
    expect(metaColors()).toEqual([LIGHT_BG, LIGHT_BG]);

    act(() => result.current.cycle()); // → dark
    expect(metaColors()).toEqual([DARK_BG, DARK_BG]);

    act(() => result.current.cycle()); // → system (OS still light)
    expect(metaColors()).toEqual([LIGHT_BG, LIGHT_BG]);

    act(() => mm.set(true)); // OS flips to dark while on system
    expect(metaColors()).toEqual([DARK_BG, DARK_BG]);
  });

  it("stops tracking the OS once an explicit theme is chosen", () => {
    localStorage.setItem("theme", "light");
    const mm = stubMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");

    // OS flips to dark, but the explicit light choice must not react.
    act(() => mm.set(true));
    expect(result.current.theme).toBe("light");
    expect(isDark()).toBe(false);
  });
});
