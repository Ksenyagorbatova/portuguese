import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const core = vi.hoisted(() => ({ isNativePlatform: vi.fn(() => false) }));
vi.mock("@capacitor/core", () => ({ Capacitor: core }));

const splash = vi.hoisted(() => ({
  hide: vi.fn<(o?: { fadeOutDuration?: number }) => Promise<void>>(),
}));
vi.mock("@capacitor/splash-screen", () => ({ SplashScreen: splash }));

import { hideNativeSplash, isNative } from "./native";

// requestAnimationFrame под контролем теста: кадры «прокручиваются» вручную.
let frames: FrameRequestCallback[] = [];
const flushFrame = () => {
  const due = frames;
  frames = [];
  due.forEach((cb) => cb(0));
};
function setReadyState(state: DocumentReadyState) {
  Object.defineProperty(document, "readyState", { value: state, configurable: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  splash.hide.mockResolvedValue(undefined);
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
  setReadyState("complete");
});

afterEach(() => {
  vi.unstubAllGlobals();
  setReadyState("complete");
});

// Единственная точка «мы в нативной iOS-оболочке?» — остальные модули (хранилище
// токенов, хаптика, статус-бар) ветвятся через неё и мокают именно её.
describe("isNative", () => {
  it("is false in the browser (Pages build)", () => {
    core.isNativePlatform.mockReturnValue(false);
    expect(isNative()).toBe(false);
  });

  it("is true inside the Capacitor shell", () => {
    core.isNativePlatform.mockReturnValue(true);
    expect(isNative()).toBe(true);
  });
});

// Нативный сплэш держится, пока WebKit реально не отрисовал страницу: иначе
// между LaunchScreen и первым кадром WebView мелькает пустой фон.
describe("hideNativeSplash", () => {
  it("hides with a short fade two frames after the page has loaded", () => {
    core.isNativePlatform.mockReturnValue(true);
    hideNativeSplash();
    expect(splash.hide).not.toHaveBeenCalled();
    flushFrame(); // кадр 1
    expect(splash.hide).not.toHaveBeenCalled();
    flushFrame(); // кадр 2 — страница уже нарисована
    expect(splash.hide).toHaveBeenCalledWith({ fadeOutDuration: 200 });
  });

  it("waits for window load while subresources (render-blocking CSS) are pending", () => {
    core.isNativePlatform.mockReturnValue(true);
    setReadyState("interactive");
    hideNativeSplash();
    flushFrame();
    flushFrame();
    expect(splash.hide).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("load"));
    flushFrame();
    flushFrame();
    expect(splash.hide).toHaveBeenCalledOnce();
  });

  it("is a no-op in the browser", () => {
    core.isNativePlatform.mockReturnValue(false);
    hideNativeSplash();
    flushFrame();
    flushFrame();
    expect(splash.hide).not.toHaveBeenCalled();
    expect(frames).toHaveLength(0);
  });

  it("swallows a plugin rejection (no unhandled rejection)", async () => {
    core.isNativePlatform.mockReturnValue(true);
    splash.hide.mockRejectedValue(new Error("not visible"));
    hideNativeSplash();
    expect(() => {
      flushFrame();
      flushFrame();
    }).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});
