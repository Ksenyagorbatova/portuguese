import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { nextThemeChoice, resolveTheme, useTheme } from "./useTheme";

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

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
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

describe("resolveTheme", () => {
  it("returns the explicit choice verbatim", () => {
    stubMatchMedia(true);
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("follows the OS for system", () => {
    stubMatchMedia(true);
    expect(resolveTheme("system")).toBe("dark");
    stubMatchMedia(false);
    expect(resolveTheme("system")).toBe("light");
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
