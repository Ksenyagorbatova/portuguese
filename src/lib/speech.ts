// Web Speech API (European Portuguese). Ported verbatim from the original;
// purely client-side, no backend.

export function speak(text: string): void {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const clean = text.split("/")[0].trim().replace(/\.\.\./g, "").replace(/[?!.]/g, "");
  const utt = new SpeechSynthesisUtterance(clean);
  utt.lang = "pt-PT";
  utt.rate = 0.85;
  const voices = window.speechSynthesis.getVoices();
  const v = voices.find((x) => x.lang === "pt-PT") ?? voices.find((x) => x.lang.startsWith("pt"));
  if (v) utt.voice = v;
  window.speechSynthesis.speak(utt);
}

// Chrome populates voices asynchronously; prime them once at startup.
export function primeVoices(): void {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}
