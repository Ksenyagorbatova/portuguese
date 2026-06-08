# Миграция линтера ESLint → oxlint

Ветка: `chore/oxlint-migration` · PR: (TBD) · 2026-06-09 · Статус: готово к ревью

## Цель

Перевести линтер с ESLint (+ typescript-eslint) на **oxlint** (Rust) — заметно
быстрее, единый линтер с проектом wershina2. Миграция с паритетом правил, без
ужесточения (чтобы не всплыли новые нарушения в `src/`).

## Изменения данных / API

Только инфраструктура (`src/`/`convex/` не тронуты):
- Добавлено: `.oxlintrc.json`, devDep `oxlint`.
- Удалено: `eslint.config.js`, devDeps `eslint`, `@eslint/js`, `typescript-eslint`,
  `eslint-plugin-react-refresh`, `globals`.
- Оставлен `eslint-plugin-react-hooks` — теперь как **бэкинг jsPlugin** oxlint
  (`react-hooks-js`), а не как ESLint-плагин.
- `package.json`: `"lint": "oxlint"`, `"check": "npm run typecheck && npm run lint"`.

## Поведение

`npm run lint` → `oxlint` (рекурсивно от корня, по `.oxlintrc.json`). CI-job `lint`
и pre-push (`npm run verify` → `check` → `lint`) не меняются — вызывают `npm run lint`.
PostToolUse-линт-хук (PR2) уже forward-compat: при наличии `.oxlintrc.json` он сам
переключается на oxlint — отдельной правки хука не потребовалось.

## Ключевые решения и алгоритмы

- **Точный паритет правил.** `.oxlintrc.json` повторяет прежний набор eslint:
  `js.recommended` + `typescript-eslint recommended` + react-refresh
  `only-export-components` + ВСЕ правила react-hooks `recommended`:
  - `correctness: off` + явный список correctness-правил (детерминированно);
  - плагины `typescript` + `react` (нативные oxlint), `env.browser` для `.ts(x)`.
- **React-hooks — ВСЕ 16 правил `recommended` (включая React Compiler).** Старый
  eslint применял `eslint-plugin-react-hooks@7.1.1 recommended` — а это не только
  `rules-of-hooks`/`exhaustive-deps`, но и compiler-проверки (`set-state-in-effect`,
  `set-state-in-render`, `immutability`, `purity`, `refs`, `static-components`,
  `use-memo`, `preserve-manual-memoization`, …). Воспроизведены 1:1: `rules-of-hooks`
  + `exhaustive-deps` — нативными oxlint, остальные 14 — через jsPlugin
  `react-hooks-js` (бэкинг `eslint-plugin-react-hooks`), как у wershina2. Миграция
  НЕ теряет ни одной react-проверки.
- **oxlint линтит шире eslint** (eslint покрывал только `src`/`convex`/`*.ts`):
  теперь под линтером и `scripts/`, и конфиги. На текущем коде — чисто (проверено).

## Тестирование

- Кода приложения нет — юнит/бэкенд/CT без изменений.
- Проверено: `node_modules/.bin/oxlint` — exit 0 (чисто) на всём репозитории;
  на заведомо-битом коде ловит `no-unused-vars`, `typescript/no-explicit-any` И
  `react-hooks-js/set-state-in-render` (плагины + jsPlugin активны). `npm run verify`
  и `npm run build` — зелёные.
- Примечание окружения: локальный RTK-прокси портит вывод прямого `npm run lint`
  (парсит его как ESLint-JSON) — это артефакт прокси, не линтера; нативный oxlint и
  `npm run check`/`verify` (где lint вызывается вложенно) проходят.

## Карта файлов

Добавлено: `.oxlintrc.json`, `specs/chore/oxlint-migration.md`.
Удалено: `eslint.config.js`.
Изменено: `package.json` (deps + `lint`/`check`), `package-lock.json`, `CLAUDE.md`.

## Известные ограничения

- `react/exhaustive-deps`, `react-hooks-js/unsupported-syntax`/`incompatible-library`
  — `warn` (как в `recommended`): не валят линт, но видны в выводе.
- jsPlugin oxlint — экспериментальная фича; бэкинг `eslint-plugin-react-hooks`
  остаётся в devDeps ради этих правил.
