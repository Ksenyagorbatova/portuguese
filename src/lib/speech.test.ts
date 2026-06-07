import { describe, it, expect, vi, afterEach } from "vitest";
import { speak } from "./speech";

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
});
