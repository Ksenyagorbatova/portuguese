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
      // Сплэш прячет JS с первого настоящего экрана — вход / загруженный курс /
      // экран ошибки (<HideNativeSplash />). launchShowDuration — страховка
      // (авто-скрытие), если такой экран не отрисовался за 3 с (медленная сеть —
      // тогда виден веб-спиннер «Загрузка…»). С 0 плагин сплэш не показывает
      // вовсе, и между LaunchScreen и первой отрисовкой WebView мелькал белый
      // экран. launchFadeOutDuration на iOS плагин не читает — не задаём.
      launchShowDuration: 3000,
    },
    Keyboard: {
      // Клавиатура ужимает сам WebView (вьюпорт = видимая над ней часть):
      // min-height:100vh у body следует за ним, и нижние кнопки/поле ввода
      // («Проверить», «Дальше», форма входа) докручиваются над клавиатурой.
      // Режим body плагин реализует inline-height у <body>, который наш
      // min-height:100vh перебивает — контент уходил под клавиатуру.
      resize: KeyboardResize.Native,
      // Подложка за клавиатурой (видна в анимации ужатия) — фон body страницы,
      // т.е. --page текущей темы, а не чёрное окно.
      autoBackdropColor: "dom",
    },
  },
};

export default config;
