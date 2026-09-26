import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { isMuted } from "./speech";
import { isNative } from "./native";

// ─── Хаптика (П.6) ───────────────────────────────────────────────────────────
// Короткая тактильная отдача в момент ответа — телесная петля обратной связи,
// как в экранных клавиатурах. Уважает mute (П.3): беззвучный режим глушит и
// вибрацию. На десктопе navigator.vibrate отсутствует — деградирует бесплатно.
// В iOS-оболочке (Capacitor) Vibration API в WKWebView нет — там нативный
// Taptic Engine через @capacitor/haptics: лёгкий impact «да», notification
// Error «не то» (системный дабл-бамп).

export function hapticOk(): void {
  haptic(() => Haptics.impact({ style: ImpactStyle.Light }), 10); // короткий «да»
}

export function hapticErr(): void {
  haptic(() => Haptics.notification({ type: NotificationType.Error }), [8, 40, 8]); // дабл-бамп «не то»
}

// Общая развилка: mute (#3) глушит всё; в оболочке — Taptic Engine, в браузере —
// Vibration API. Хаптика — украшение: отказ плагина не должен всплывать
// необработанным rejection'ом посреди ответа, запрет вибрации — исключением.
function haptic(native: () => Promise<void>, pattern: number | number[]): void {
  if (isMuted()) return;
  if (isNative()) {
    void native().catch(() => {});
    return;
  }
  try {
    navigator.vibrate?.(pattern); // десктоп — no-op (метода нет)
  } catch {
    // окружение без вибрации / запрет — тихо игнорируем
  }
}
