// Web Speech API — European Portuguese (pt-PT). Client-side only.
//
// Browsers (Chrome especially) load the voice list asynchronously: the very
// first getVoices() after page load can be empty. If we speak then, no voice is
// set and the engine falls back to the system default (usually English) reading
// the Portuguese text — sounds wrong. So when voices aren't ready we wait once
// for `voiceschanged`, then speak with the European Portuguese voice.

// Pick the best Portuguese voice: European first, then any Portuguese (still far
// better than the English default). `lang` may use "_" or "-" across platforms.
function pickPortugueseVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const norm = (l: string) => l.replace(/_/g, "-").toLowerCase();
  return (
    voices.find((v) => norm(v.lang) === "pt-pt") ??
    voices.find((v) => norm(v.lang).startsWith("pt")) ??
    null
  );
}

// Обычная скорость воспроизведения (медленный повтор — SLOW_RATE через speakSmart).
const DEFAULT_RATE = 0.9;
const SLOW_RATE = 0.6;
// Окно повторного тапа: второй запрос ТОГО ЖЕ текста в эти мс играет медленно.
const SLOW_WINDOW_MS = 4000;

export function speak(text: string, opts?: { rate?: number }): void {
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const clean = text.split("/")[0].trim().replace(/\.\.\./g, "").replace(/[?!.]/g, "");

  const emit = (voice: SpeechSynthesisVoice | null) => {
    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang = "pt-PT";
    utt.rate = opts?.rate ?? DEFAULT_RATE;
    if (voice) utt.voice = voice;
    synth.speak(utt);
  };

  const voice = pickPortugueseVoice();
  if (voice) {
    emit(voice);
    return;
  }
  // Voices not loaded yet — defer so the first tap isn't read by the English
  // default. Speak once, whichever of the event / timeout fires first.
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    synth.removeEventListener?.("voiceschanged", go);
    emit(pickPortugueseVoice());
  };
  synth.addEventListener?.("voiceschanged", go, { once: true });
  setTimeout(go, 300);
}

// «Умная» озвучка кнопки 🔊: повторный тап по ТОМУ ЖЕ тексту в течение
// SLOW_WINDOW_MS играет замедленно (SLOW_RATE), затем цикл заново с обычной
// скорости. Другой текст сбрасывает цикл. Авто-озвучка после ответа остаётся
// обычным speak() — замедление только для осознанного «повтори-ка».
let last: { text: string; at: number; slow: boolean } | null = null;
export function speakSmart(text: string): void {
  const now = Date.now();
  const slow = !!last && last.text === text && now - last.at < SLOW_WINDOW_MS && !last.slow;
  last = { text, at: now, slow };
  speak(text, { rate: slow ? SLOW_RATE : DEFAULT_RATE });
}

// Chrome populates voices asynchronously; prime them once at startup so most
// taps hit the synchronous path above.
export function primeVoices(): void {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", () =>
    window.speechSynthesis.getVoices(),
  );
}
