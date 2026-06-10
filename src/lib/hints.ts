import { useEffect, useRef, useState } from "react";

// Служебные хинты («Акценты и пунктуация необязательны…», «Нажми на
// карточку…») учат приёму интерфейса — после нескольких показов приём усвоен,
// и хинт превращается в шум. Гасим насовсем после HINT_SHOW_LIMIT показов
// (счётчик в localStorage; опциональный пункт #4 дизайн-ревью v2).
export const HINT_SHOW_LIMIT = 3;

// Ключи счётчиков (вида pt-hint-*-seen) — единое место, чтобы не разъехались.
export const ACCENTS_HINT_KEY = "pt-hint-accents-seen";
export const FLIP_HINT_KEY = "pt-hint-flip-seen";

// localStorage может быть недоступен (приватный режим, запрет хранилища) —
// тогда считаем «не показывали» и хинт остаётся постоянным: безопасный отказ.
function readCount(key: string): number {
  try {
    const n = Number(window.localStorage.getItem(key));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function shouldShowHint(key: string): boolean {
  return readCount(key) < HINT_SHOW_LIMIT;
}

export function markHintShown(key: string): void {
  try {
    window.localStorage.setItem(key, String(readCount(key) + 1));
  } catch {
    // хранилище недоступно — показ не учитываем, хинт останется постоянным
  }
}

// Показывать ли хинт на этом маунте. Решение фиксируется при маунте (хинт не
// исчезает посреди карточки), показ учитывается ровно один раз за маунт —
// ref-guard держит счётчик честным и под StrictMode-дублем эффектов.
export function useFadingHint(key: string): boolean {
  const [show] = useState(() => shouldShowHint(key));
  const counted = useRef(false);
  useEffect(() => {
    if (!show || counted.current) return;
    counted.current = true;
    markHintShown(key);
  }, [show, key]);
  return show;
}
