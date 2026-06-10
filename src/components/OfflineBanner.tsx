import { useConvexConnectionState } from "convex/react";
import { Icon } from "./Icon";

// Ненавязчивый индикатор разрыва соединения с Convex (WebSocket). Клиент при
// разрыве сам ставит мутации в очередь и доотправляет их после реконнекта
// (см. specs/fix/exercise-network-resilience.md) — поэтому баннер честно
// обещает автосохранение. Заодно объясняет, почему фидбэк упражнения
// показывает «следующий повтор: —».
export function OfflineBanner() {
  const { isWebSocketConnected } = useConvexConnectionState();
  if (isWebSocketConnected) return null;
  return (
    <div className="m-offline" role="status">
      <Icon name="wifi-off" size={15} />
      Нет соединения — ответы сохранятся, когда сеть восстановится
    </div>
  );
}
