/// <reference types="@capacitor/splash-screen" />
import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize } from "@capacitor/keyboard";

// iOS-оболочка (Capacitor 8, SPM): локальный бандл `dist-ios` (vite build
// --mode ios / ios-release, base "/"), а не server.url на GitHub Pages — см.
// specs/feat/ios-capacitor-app.md (решения 1–3). appId закрепляется за записью
// приложения ПЕРВОЙ загрузкой в App Store Connect — менять только до неё.
const config: CapacitorConfig = {
  appId: "io.github.ksenyagorbatova.portuguese",
  appName: "Português",
  webDir: "dist-ios",
  ios: {
    // Под статус-баром/«островом» — наш фон, отступы даёт CSS safe-area.
    contentInset: "never",
  },
  plugins: {
    SplashScreen: {
      // Сплэш прячет JS после первого кадра React (hideNativeSplash в
      // src/main.tsx). launchShowDuration — только страховка, если JS не дошёл:
      // с 0 плагин сплэш не показывает вовсе, и между LaunchScreen и первой
      // отрисовкой WebView мелькал белый экран.
      launchAutoHide: true,
      launchShowDuration: 3000,
      launchFadeOutDuration: 200,
    },
    Keyboard: {
      // Клавиатура ужимает <body>, а не весь WebView: поле ввода
      // «Напишите по-португальски» остаётся видимым (раннбук Ф3 п.4).
      resize: KeyboardResize.Body,
    },
  },
};

export default config;
