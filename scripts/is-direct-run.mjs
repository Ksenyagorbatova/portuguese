// Запущен ли модуль как CLI (`node path/to/script.mjs`), а не импортирован.
// realpath с обеих сторон: Node строит import.meta.url главного модуля из
// realpath, а process.argv[1] хранит путь как набрали (симлинк на checkout,
// /tmp → /private/tmp) — голое сравнение там молча давало false.
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function isDirectRun(importMetaUrl, argv1 = process.argv[1]) {
  if (!argv1) return false;
  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(importMetaUrl));
  } catch {
    return false;
  }
}
