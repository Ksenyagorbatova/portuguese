// Component Testing entry point. Pull in the app's global styles so mounted
// components render with their real CSS (class names are shared verbatim).
import { beforeMount } from "@playwright/experimental-ct-react/hooks";
import { __setQueryData } from "../src/test/mocks/convexReact";
import "../src/index.css";

// Состояние, которое нужно подготовить в браузере ДО рендера компонента
// (page.evaluate до mount ненадёжен: первый mount в воркере навигирует
// страницу и стирает window). Стабы читают его из window/модуля — см.
// src/test/mocks/convexReact.ts:
//   • queries    — фикстуры Convex-query по имени функции (например,
//     "courseQueries:getCourse") для компонентов с useQuery (Shell);
//   • connection — состояние сокета для офлайн-баннера.
export type HooksConfig = {
  queries?: Record<string, unknown>;
  connection?: { isWebSocketConnected: boolean };
};

beforeMount<HooksConfig>(async ({ hooksConfig }) => {
  // Страница переиспользуется между тестами — каждый mount начинает с чистых
  // стабов, чтобы конфиг одного теста не протекал в следующий.
  delete window.__mutationMock;
  __setQueryData(hooksConfig?.queries ?? {});
  if (hooksConfig?.connection) window.__connectionMock = hooksConfig.connection;
  else delete window.__connectionMock;
});
