import { isMuted } from "./speech";

// ─── Хаптика (П.6) ───────────────────────────────────────────────────────────
// Короткая тактильная отдача в момент ответа — телесная петля обратной связи,
// как в экранных клавиатурах. Уважает mute (П.3): беззвучный режим глушит и
// вибрацию. На десктопе navigator.vibrate отсутствует — деградирует бесплатно.

export function hapticOk(): void {
  vibrate(10); // короткий «да»
}

export function hapticErr(): void {
  vibrate([8, 40, 8]); // дабл-бамп «не то»
}

function vibrate(pattern: number | number[]): void {
  if (isMuted()) return; // уважает mute (#3)
  try {
    navigator.vibrate?.(pattern); // десктоп — no-op (метода нет)
  } catch {
    // окружение без вибрации / запрет — тихо игнорируем
  }
}
