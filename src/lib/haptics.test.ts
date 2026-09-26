import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Нативная ветка (iOS-оболочка): @capacitor/haptics вместо navigator.vibrate,
// которого в WKWebView нет. Переключатель платформы — isNative() из ./native.
const native = vi.hoisted(() => ({ isNative: vi.fn(() => false) }));
vi.mock("./native", () => native);

const plugin = vi.hoisted(() => ({
  impact: vi.fn<(o: { style: string }) => Promise<void>>(),
  notification: vi.fn<(o: { type: string }) => Promise<void>>(),
}));
vi.mock("@capacitor/haptics", () => ({
  Haptics: plugin,
  ImpactStyle: { Heavy: "HEAVY", Medium: "MEDIUM", Light: "LIGHT" },
  NotificationType: { Success: "SUCCESS", Warning: "WARNING", Error: "ERROR" },
}));

import { hapticOk, hapticErr } from "./haptics";
import { setMuted } from "./speech";

// П.6: хаптика уважает mute (#3) и отсутствие navigator.vibrate (десктоп).
describe("haptics — mute gate (П.6)", () => {
  let vibrate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    native.isNative.mockReturnValue(false);
    vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", {
      value: vibrate,
      configurable: true,
      writable: true,
    });
    setMuted(false);
  });

  afterEach(() => {
    setMuted(false);
    // @ts-expect-error — снимаем тестовую подмену vibrate
    delete navigator.vibrate;
    vi.clearAllMocks();
  });

  it("hapticOk вибрирует 10мс, hapticErr — дабл-бамп, когда звук включён", () => {
    hapticOk();
    expect(vibrate).toHaveBeenCalledWith(10);
    hapticErr();
    expect(vibrate).toHaveBeenCalledWith([8, 40, 8]);
  });

  it("НЕ вибрирует при mute (уважает #3)", () => {
    setMuted(true);
    hapticOk();
    hapticErr();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("no-op без navigator.vibrate (десктоп) — без исключения", () => {
    // @ts-expect-error — эмулируем десктоп без вибро-API
    delete navigator.vibrate;
    expect(() => {
      hapticOk();
      hapticErr();
    }).not.toThrow();
  });

  it("в вебе нативный плагин не зовётся", () => {
    hapticOk();
    hapticErr();
    expect(plugin.impact).not.toHaveBeenCalled();
    expect(plugin.notification).not.toHaveBeenCalled();
  });
});

describe("haptics — нативная ветка (iOS, @capacitor/haptics)", () => {
  let vibrate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    native.isNative.mockReturnValue(true);
    plugin.impact.mockResolvedValue(undefined);
    plugin.notification.mockResolvedValue(undefined);
    vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", {
      value: vibrate,
      configurable: true,
      writable: true,
    });
    setMuted(false);
  });

  afterEach(() => {
    setMuted(false);
    // @ts-expect-error — снимаем тестовую подмену vibrate
    delete navigator.vibrate;
    vi.clearAllMocks();
  });

  it("верный ответ — лёгкий impact, промах — notification Error; vibrate не трогаем", () => {
    hapticOk();
    expect(plugin.impact).toHaveBeenCalledWith({ style: "LIGHT" });
    hapticErr();
    expect(plugin.notification).toHaveBeenCalledWith({ type: "ERROR" });
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("mute глушит и нативную хаптику", () => {
    setMuted(true);
    hapticOk();
    hapticErr();
    expect(plugin.impact).not.toHaveBeenCalled();
    expect(plugin.notification).not.toHaveBeenCalled();
  });

  it("отказ плагина гасится (без необработанного rejection и исключения)", async () => {
    plugin.impact.mockRejectedValue(new Error("haptics unavailable"));
    plugin.notification.mockRejectedValue(new Error("haptics unavailable"));
    expect(() => {
      hapticOk();
      hapticErr();
    }).not.toThrow();
    // Дать промисам отрезолвиться: необработанный rejection Vitest показал бы ошибкой.
    await new Promise((r) => setTimeout(r, 0));
  });
});
