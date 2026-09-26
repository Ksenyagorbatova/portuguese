import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

// Единственная точка «мы в нативной iOS-оболочке (Capacitor)?». Хранилище
// токенов, хаптика и статус-бар ветвятся через неё (а тесты мокают её одну);
// в вебе (GitHub Pages) — false, поведение сайта не меняется.
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

// Нативный сплэш (логотип на фоне темы) держится, пока WebKit реально не
// отрисовал страницу: первый кадр WebView ждёт render-blocking CSS (шрифты
// Google Fonts), и спрятанный раньше сплэш открывал пустой фон. Поэтому —
// после window load и ещё двух кадров. Страховка на случай, если JS не дошёл
// сюда, — launchShowDuration в capacitor.config.ts.
export function hideNativeSplash(): void {
  if (!isNative()) return;
  const hide = () => void SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {});
  const afterPaint = () => requestAnimationFrame(() => requestAnimationFrame(hide));
  if (document.readyState === "complete") afterPaint();
  else window.addEventListener("load", afterPaint, { once: true });
}
