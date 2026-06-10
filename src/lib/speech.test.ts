import { describe, it, expect, vi, afterEach } from "vitest";
import { speak, speakSmart } from "./speech";

class FakeUtterance {
  lang = "";
  rate = 1;
  voice: SpeechSynthesisVoice | null = null;
  constructor(public text: string) {}
}

function mockSynth(initial: Array<{ lang: string; name?: string }> = [{ lang: "pt-PT" }]) {
  let voices = initial;
  const listeners: Record<string, Array<() => void>> = {};
  const synth = {
    cancel: vi.fn(),
    speak: vi.fn<(u: FakeUtterance) => void>(),
    getVoices: () => voices as SpeechSynthesisVoice[],
    addEventListener: (ev: string, cb: () => void) => {
      (listeners[ev] ??= []).push(cb);
    },
    removeEventListener: (ev: string, cb: () => void) => {
      listeners[ev] = (listeners[ev] ?? []).filter((f) => f !== cb);
    },
    onvoiceschanged: null,
    // test helpers
    _setVoices: (v: Array<{ lang: string; name?: string }>) => {
      voices = v;
    },
    _fire: (ev: string) => (listeners[ev] ?? []).slice().forEach((f) => f()),
  };
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  return synth;
}

describe("speak", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("cancels any current speech, then speaks cleaned text in pt-PT", () => {
    const synth = mockSynth();
    speak("olá?");
    expect(synth.cancel).toHaveBeenCalled();
    expect(synth.speak).toHaveBeenCalledOnce();
    const utt = synth.speak.mock.calls[0][0];
    expect(utt.text).toBe("olá");
    expect(utt.lang).toBe("pt-PT");
  });

  it("uses the first slash-variant and strips ellipsis/punctuation", () => {
    const synth = mockSynth();
    speak("sim / não...");
    expect(synth.speak.mock.calls[0][0].text).toBe("sim");
  });

  it("prefers the European Portuguese voice over Brazilian", () => {
    const synth = mockSynth([
      { lang: "pt-BR", name: "Luciana" },
      { lang: "pt-PT", name: "Joana" },
    ]);
    speak("olá");
    expect(synth.speak.mock.calls[0][0].voice?.lang).toBe("pt-PT");
  });

  it("matches pt-PT even when the platform reports it as pt_PT", () => {
    const synth = mockSynth([{ lang: "pt_PT", name: "Joana" }]);
    speak("olá");
    expect(synth.speak.mock.calls[0][0].voice?.lang).toBe("pt_PT");
  });

  it("falls back to any Portuguese voice rather than the English default", () => {
    const synth = mockSynth([{ lang: "en-US" }, { lang: "pt-BR", name: "Luciana" }]);
    speak("olá");
    expect(synth.speak.mock.calls[0][0].voice?.lang).toBe("pt-BR");
  });

  it("defers speaking until voices load instead of using the English default", () => {
    const synth = mockSynth([]); // voices not ready yet
    speak("olá");
    expect(synth.speak).not.toHaveBeenCalled(); // did not speak with a wrong voice

    synth._setVoices([{ lang: "pt-PT", name: "Joana" }]);
    synth._fire("voiceschanged");

    expect(synth.speak).toHaveBeenCalledOnce();
    expect(synth.speak.mock.calls[0][0].voice?.lang).toBe("pt-PT");
  });

  it("still speaks via the timeout fallback if voiceschanged never fires", () => {
    vi.useFakeTimers();
    const synth = mockSynth([]);
    speak("olá");
    expect(synth.speak).not.toHaveBeenCalled();
    synth._setVoices([{ lang: "pt-PT" }]);
    vi.advanceTimersByTime(300);
    expect(synth.speak).toHaveBeenCalledOnce();
  });

  it("no-ops when the Web Speech API is unavailable", () => {
    vi.stubGlobal("speechSynthesis", undefined);
    expect(() => speak("olá")).not.toThrow();
  });

  it("speaks at the default rate 0.9, or the rate passed via opts", () => {
    const synth = mockSynth();
    speak("olá");
    expect(synth.speak.mock.calls[0][0].rate).toBe(0.9);
    speak("olá", { rate: 0.6 });
    expect(synth.speak.mock.calls[1][0].rate).toBe(0.6);
  });
});

// П.10 (дизайн-ревью v2): повторный тап по 🔊 с ТЕМ ЖЕ текстом в течение 4с —
// медленный повтор (0.6), затем цикл заново с обычной скорости.
describe("speakSmart", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const rates = (synth: ReturnType<typeof mockSynth>) =>
    synth.speak.mock.calls.map((c) => c[0].rate);

  it("cycles normal → slow → normal for repeated taps on the same text", () => {
    const synth = mockSynth();
    vi.spyOn(Date, "now").mockReturnValue(1000);
    speakSmart("olá"); // 1-й тап — обычная
    vi.spyOn(Date, "now").mockReturnValue(2000);
    speakSmart("olá"); // 2-й подряд (в окне) — медленно
    vi.spyOn(Date, "now").mockReturnValue(3000);
    speakSmart("olá"); // 3-й — цикл заново, обычная
    expect(rates(synth)).toEqual([0.9, 0.6, 0.9]);
  });

  // Состояние «последнего тапа» — модульное (живёт между тестами): каждому
  // тесту — своя «эпоха» времени сильно позже предыдущей, чтобы хвост соседа
  // гарантированно выпал из 4с-окна.
  it("repeats at the NORMAL rate once the 4s window has passed", () => {
    const synth = mockSynth();
    vi.spyOn(Date, "now").mockReturnValue(100_000);
    speakSmart("olá");
    vi.spyOn(Date, "now").mockReturnValue(100_000 + 4001); // окно истекло
    speakSmart("olá");
    expect(rates(synth)).toEqual([0.9, 0.9]);
  });

  it("a different text resets the cycle (no slow replay)", () => {
    const synth = mockSynth();
    vi.spyOn(Date, "now").mockReturnValue(200_000);
    speakSmart("olá");
    vi.spyOn(Date, "now").mockReturnValue(201_000);
    speakSmart("adeus"); // другой текст — обычная
    vi.spyOn(Date, "now").mockReturnValue(202_000);
    speakSmart("adeus"); // а вот его повтор — уже медленный
    expect(rates(synth)).toEqual([0.9, 0.9, 0.6]);
  });
});
