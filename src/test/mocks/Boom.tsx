// Компонент-«бомба» для CT-теста ErrorBoundary: бросает при рендере.
// В отдельном файле, потому что Playwright CT не позволяет определять
// компоненты прямо в файле спеки.
export function Boom(): never {
  throw new Error("boom (test)");
}
