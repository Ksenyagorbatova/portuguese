# Worktree-параллелизм: изолированный локальный Convex + порт-офсеты

Ветка: `chore/worktree-parallel-dev` · PR: (TBD) · 2026-06-09 · Статус: готово к ревью

## Цель

Запускать несколько Claude-сессий/задач параллельно в отдельных `git worktree`,
у каждой свой dev-сервер и свой бэкенд — без конфликтов портов и общих данных.
Основной checkout не меняется. Адаптация подхода из проекта wershina2 (Вариант B —
локальный Convex-деплой на worktree), упрощённая под portuguese (контент
глобальный, без Tauri/lists/Google).

## Изменения данных / API

- **`convex/seed.ts`**: новый `seedLocal` (internalAction) + `findUserByEmail`
  (internalQuery) + `DEV_EMAIL`/`DEV_PASSWORD` + гейт `isNonLocalCloudUrl`.
  `seedLocal` заливает контент (`seedContent`) и создаёт dev-аккаунт через
  `createAccount` (`@convex-dev/auth/server`). Существующий `seedContent` не тронут.
- `convex/_generated` — без изменений (api.d.ts тянет `typeof import("../seed")`).

## Поведение

- **`npm run wt:setup`** (в linked-worktree): `npm ci` → копирует `.env.local`
  основного checkout → `convex deployment create/select local` → провижинит auth-env
  → `seed:seedLocal`. No-op в основном checkout. Идемпотентно. Пере-сид — `npm run wt:seed`.
- Готовый dev-логин **`dev@example.com` / `12345678q`** (регистрация выключена —
  `SIGNUP_ENABLED`, — поэтому без сида в worktree не залогиниться; `createAccount`
  обходит UI-флоу регистрации).
- **Порты:** в linked-worktree Vite-порт = `5173 + portOffset()` (детерминированно
  от пути), `strictPort` снят; CT-порт = `3100 + portOffset()` (или `CT_PORT`).
  Основной checkout — фикс 5173/3100, strict (как было).

## Ключевые решения и алгоритмы

- **Вариант B (локальный Convex), не облачный дев на worktree.** Полная изоляция
  данных/схемы, без расхода облачных слотов, офлайн. Цена — локальный рантайм
  Convex на worktree (`npx convex dev` берёт его из `.env.local`).
- **Многослойная защита сида от облака** (иначе сид затронул бы прод/дев-данные):
  1. `scripts/wt-seed.mjs` работает только в linked-worktree И отказывается, если
     `CONVEX_DEPLOYMENT` не `local:`/`anonymous:` (защита от сорвавшегося `select`).
  2. `seed:seedLocal` сам бросает, если `CONVEX_CLOUD_URL` не локальный (системная
     переменная, которой владеет бэкенд — её нельзя подделать) ИЛИ нет `ALLOW_DEV_SEED=1`.
- **`globalThis.process.env`** (не голый `process`) в seed.ts — файл тайпчекается и
  под фронтовым tsconfig (через `_generated/api.d.ts`, где нет node-типов).
- **Bootstrap import-clean**: `wt-setup.mjs` подключает `wt-seed.mjs` (зависит от
  `jose`) ЛЕНИВО (`await import`), т.к. до шага установки `node_modules` нет —
  статический импорт уронил бы свежий worktree. Инвариант запинен тестом.
- **`portOffset`** — FNV-хеш `process.cwd()` → 0–899: стабильная полоса портов на
  worktree без рантайм-проб.

## Тестирование

- [`convex/seed.test.ts`](../../convex/seed.test.ts): `seedLocal` — гейты (нет
  `ALLOW_DEV_SEED` → бросает и ничего не создаёт; облачный `CONVEX_CLOUD_URL` →
  бросает; локальный+opt-in → проходит), создаёт dev-пользователя + контент, пароль
  хранится хешированным, идемпотентность (2-й запуск без дублей). Под convex-test.
- [`scripts/worktree.test.ts`](../../scripts/worktree.test.ts): `portOffset`
  детерминирован и в диапазоне; `wt-setup.mjs` не тянет сторонние пакеты статически
  и подключает сид лениво после установки.
- **Не покрыто автотестами** (нужен реальный `git worktree` + Convex CLI + локальный
  бэкенд — вне CI): сквозной прогон `npm run wt:setup` и провижининг auth-ключей.
  Проверяется вручную при первом реальном worktree.

## Карта файлов

Добавлено: `scripts/worktree.mjs`, `scripts/worktree.d.mts`, `scripts/wt-setup.mjs`,
`scripts/wt-seed.mjs`, `scripts/worktree.test.ts`, `specs/chore/worktree-parallel-dev.md`.
Изменено: `convex/seed.ts` (+seedLocal/findUserByEmail), `convex/seed.test.ts`
(+seedLocal-тесты), `vite.config.ts` + `playwright-ct.config.ts` (порт-офсеты),
`vitest.config.ts` + `tsconfig.test.json` (scripts-тесты), `package.json`
(wt-скрипты + `jose`), `CLAUDE.md` (раздел «Worktree»).

## Известные ограничения

- Tauri/native у portuguese нет — блок «Tauri запрещён в worktree» из wershina2 не нужен.
- Сквозной worktree-флоу не E2E-тестируется в CI (нужен локальный Convex-бэкенд);
  логика `seedLocal` покрыта convex-test, скрипты — unit-инвариантами.
- Локальный деплой ест место на диске под `.convex`; worktree удаляется штатно
  `git worktree remove` (его `.convex`/`node_modules` — per-каталог).
