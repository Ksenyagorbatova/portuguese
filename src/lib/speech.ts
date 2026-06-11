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
  synth.resume?.(); // cancel оставляет движок «paused» — будим до нового speak
  const clean = text.split("/")[0].trim().replace(/\.\.\./g, "").replace(/[?!.]/g, "");

  const emit = (voice: SpeechSynthesisVoice | null) => {
    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang = "pt-PT";
    utt.rate = opts?.rate ?? DEFAULT_RATE;
    if (voice) utt.voice = voice;
    synth.speak(utt);
    // Chrome/macOS: после cancel() движок остаётся «paused», и следующий speak()
    // встаёт в очередь, но не звучит (классический баг Web Speech) — resume()
    // его будит. Безвреден, когда пауза не нужна.
    synth.resume?.();
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

// ─── Mute (П.3) ──────────────────────────────────────────────────────────────
// Авто-озвучка после КАЖДОГО ответа звучит всегда — в метро без наушников, в
// офисе, рядом со спящим ребёнком это вынуждает душить громкость на уровне ОС.
// Тоггл mute глушит только АВТО-вызовы (speakAuto); ручные кнопки 🔊
// (speak/speakSmart) звучат в обход mute — явный тап есть явное намерение.
// Состояние персистится в localStorage (`pt-muted`), чтобы переживать
// перезагрузку; читается один раз при инициализации модуля.
const MUTED_KEY = "pt-muted";

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false; // приватный режим / недоступный storage
  }
}

let muted = readMuted();

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(MUTED_KEY, value ? "1" : "0");
  } catch {
    // storage недоступен — состояние живёт в памяти текущей сессии
  }
}

// Можно ли реально ОЗВУЧИТЬ португальское слово: есть Web Speech API И загружен
// португальский голос. На части систем speechSynthesis присутствует, но голосов
// нет (или ещё не загрузились) — тогда аудио-карточка молчит. Вместе с isMuted()
// это гейт аудио-упражнения (П.1): без голоса или при mute его не показываем.
// primeVoices() при старте обычно успевает прогреть getVoices() до сессии.
export function canSpeakPortuguese(): boolean {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  return pickPortugueseVoice() != null;
}

// Авто-озвучка: no-op при mute. Заменяет speak() там, где слово/предложение
// проигрывается САМО (после ответа, авто-плей карточки). Ручные 🔊 — НЕ это.
export function speakAuto(text: string): void {
  if (muted) return;
  speak(text);
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
