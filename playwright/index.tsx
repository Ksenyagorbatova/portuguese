// Component Testing entry point. Pull in the app's global styles so mounted
// components render with their real CSS (class names are shared verbatim).
import "../src/index.css";
import { beforeMount } from "@playwright/experimental-ct-react/hooks";

// Состояние, которое нужно подготовить в браузере ДО рендера компонента
// (page.evaluate до mount ненадёжен: первый mount в воркере навигирует
// страницу и стирает window). Стабы читают его из window — см.
// src/test/mocks/convexReact.ts.
export type HooksConfig = {
  connection?: { isWebSocketConnected: boolean };
};

beforeMount<HooksConfig>(async ({ hooksConfig }) => {
  // Страница переиспользуется между тестами — каждый mount начинает с чистых
  // стабов, чтобы конфиг одного теста не протекал в следующий.
  delete window.__mutationMock;
  if (hooksConfig?.connection) window.__connectionMock = hooksConfig.connection;
  else delete window.__connectionMock;
});
