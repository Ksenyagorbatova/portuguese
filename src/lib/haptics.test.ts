import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { hapticOk, hapticErr } from "./haptics";
import { setMuted } from "./speech";

// П.6: хаптика уважает mute (#3) и отсутствие navigator.vibrate (десктоп).
describe("haptics — mute gate (П.6)", () => {
  let vibrate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
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
    vi.restoreAllMocks();
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
});
