// Test stub for "convex/react" (aliased in playwright-ct.config.ts) so
// components that call useMutation/useQuery mount in CT without a live Convex
// client. useMutation returns a stub that resolves a value shaped like
// progress.recordAnswer (card + streak), which the exercises read for the
// "next review" label.
//
// Поведение мутации конфигурируется per-test через `window.__mutationMock`
// (тест выставляет его page.evaluate ПОСЛЕ mount — первый mount в воркере
// навигирует страницу и стёр бы конфиг; читается конфиг в момент вызова):
//   • manual  — промис висит, пока тест не позовёт release(): детерминированно
//     держит «окно сетевого roundtrip» открытым (таймеры тут флаки: на холодном
//     воркере CDP-паузы между действиями больше любой разумной задержки);
//   • reject  — промис реджектится (ошибка сервера);
//   • calls   — счётчик фактических вызовов мутации, тест читает его обратно;
//   • release — выставляется стабом в manual-режиме: отпускает ВСЕ зависшие
//     вызовы (цепочка), зовётся тестом через page.evaluate.
// Без конфигурации поведение прежнее: мгновенный resolve — существующие CT
// на него полагаются.

export type MutationMockConfig = {
  manual?: boolean;
  reject?: boolean;
  calls?: number;
  release?: () => void;
};

declare global {
  interface Window {
    __mutationMock?: MutationMockConfig;
    __connectionMock?: { isWebSocketConnected: boolean };
  }
}

export function useMutation() {
  return async () => {
    const cfg = (window.__mutationMock ??= {});
    cfg.calls = (cfg.calls ?? 0) + 1;
    if (cfg.manual) {
      await new Promise<void>((resolve) => {
        const prev = cfg.release;
        cfg.release = () => {
          prev?.();
          resolve();
        };
      });
    }
    if (cfg.reject) throw new Error("recordAnswer failed (mock)");
    return {
      card: {
        interval: 1,
        ef: 2.5,
        due: Date.now() + 86_400_000,
        seen: 1,
        correct: 1,
        lastSeen: Date.now(),
        mcCorrect: 1,
        typeCorrect: 0,
      },
      streak: 1,
    };
  };
}

export function useQuery() {
  return undefined;
}

// Стаб состояния соединения для офлайн-баннера: онлайн по умолчанию; тест
// переключает через `window.__connectionMock = { isWebSocketConnected: false }`
// ДО mount (хук читается на рендере). Форма — ConnectionState из convex 1.40.
export function useConvexConnectionState() {
  return {
    hasInflightRequests: false,
    isWebSocketConnected: window.__connectionMock?.isWebSocketConnected ?? true,
    timeOfOldestInflightRequest: null as Date | null,
    hasEverConnected: true,
    connectionCount: 1,
    connectionRetries: 0,
    inflightMutations: 0,
    inflightActions: 0,
  };
}
