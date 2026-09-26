import { useEffect } from "react";
import { hideNativeSplash } from "../lib/native";

// iOS-оболочка: убрать нативный сплэш после ПЕРВОГО коммита дерева (эффект идёт
// после отрисовки). В src/main.tsx стоит соседом ErrorBoundary, а не ребёнком
// App — сплэш уйдёт и тогда, когда рендер приложения упал и показан экран
// ошибки. В вебе — no-op (hideNativeSplash проверяет платформу).
export function HideNativeSplash() {
  useEffect(hideNativeSplash, []);
  return null;
}
