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
      launchAutoHide: true,
      launchShowDuration: 0,
      backgroundColor: "#f4f3ef",
    },
    Keyboard: {
      // Клавиатура ужимает <body>, а не весь WebView: поле ввода
      // «Напишите по-португальски» остаётся видимым (раннбук Ф3 п.4).
      resize: KeyboardResize.Body,
    },
  },
};

export default config;
