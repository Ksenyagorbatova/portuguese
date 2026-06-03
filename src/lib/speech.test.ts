import { describe, it, expect, vi, afterEach } from "vitest";
import { speak } from "./speech";

class FakeUtterance {
  lang = "";
  rate = 1;
  voice: SpeechSynthesisVoice | null = null;
  constructor(public text: string) {}
}

function mockSynth(voices: Array<{ lang: string }> = [{ lang: "pt-PT" }]) {
  const synth = {
    cancel: vi.fn(),
    speak: vi.fn<(u: FakeUtterance) => void>(),
    getVoices: () => voices as SpeechSynthesisVoice[],
    onvoiceschanged: null,
  };
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  return synth;
}

describe("speak", () => {
  afterEach(() => vi.unstubAllGlobals());

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

  it("no-ops when the Web Speech API is unavailable", () => {
    vi.stubGlobal("speechSynthesis", undefined);
    expect(() => speak("olá")).not.toThrow();
  });
});
