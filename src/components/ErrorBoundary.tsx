import { Component, type ErrorInfo, type ReactNode } from "react";

// Корневой error boundary: раньше любая необработанная ошибка рендера или
// query оставляла белый экран без объяснений. Классовый компонент — в React 19
// это по-прежнему единственный способ поймать ошибку рендера и показать
// fallback (хук-аналога нет). Стиль — существующие классы m-* (тон Splash).
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Необработанная ошибка рендера:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="m-app">
          <div className="m-splash" role="alert">
            <div>Что-то пошло не так.</div>
            <div>Перезагрузите страницу — прогресс хранится на сервере и не потеряется.</div>
            <button
              className="m-btn m-btn--primary"
              style={{ marginTop: 10 }}
              onClick={() => window.location.reload()}
            >
              Перезагрузить
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
