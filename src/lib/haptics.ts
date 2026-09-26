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
  if (isMuted()) return; // уважает mute (#3)
  if (isNative()) {
    void Haptics.impact({ style: ImpactStyle.Light }).catch(ignore);
    return;
  }
  vibrate(10); // короткий «да»
}

export function hapticErr(): void {
  if (isMuted()) return;
  if (isNative()) {
    void Haptics.notification({ type: NotificationType.Error }).catch(ignore);
    return;
  }
  vibrate([8, 40, 8]); // дабл-бамп «не то»
}

function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern); // десктоп — no-op (метода нет)
  } catch {
    // окружение без вибрации / запрет — тихо игнорируем
  }
}

// Хаптика — украшение: отказ плагина не должен всплывать необработанным
// rejection'ом посреди ответа.
function ignore(): void {}
