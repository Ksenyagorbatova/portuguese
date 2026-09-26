import { useEffect } from "react";
import { hideNativeSplash } from "../lib/native";

// iOS-оболочка: убрать нативный сплэш, когда отрисован первый НАСТОЯЩИЙ экран.
// Рендерят его SignIn (гость), Shell с загруженным курсом и fallback
// ErrorBoundary — но не спиннер «Загрузка…»: иначе старт выглядел бы как
// «логотип → спиннер → главный». В вебе — no-op (hideNativeSplash проверяет
// платформу).
export function HideNativeSplash() {
  useEffect(hideNativeSplash, []);
  return null;
}
