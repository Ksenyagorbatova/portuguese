# Авторизация и блокировка регистрации

Статус: baseline (отгружено) · 2026-06-09 · регистрация ВРЕМЕННО отключена

## Цель

Доступ к приложению — за email+password (Convex Auth, провайдер Password).
Публичная регистрация сейчас закрыта флагом, но провайдер остаётся полностью
подключённым (включить обратно — переключить два флага).

## Изменения данных / API

Convex Auth таблицы (`...authTables` в [`convex/schema.ts`](../../convex/schema.ts)):
`users`, `authAccounts`, `authSessions`, … Каждая Convex-функция получает
пользователя через `getAuthUserId(ctx)`; identity subject в тестах —
`` `${userId}|session` ``.

## Поведение

- **Вход** (`signIn`) — email+password, работает из коробки.
- **Регистрация ОТКЛЮЧЕНА** (`SIGNUP_ENABLED = false`):
  - Сервер ([`convex/auth.ts`](../../convex/auth.ts)): `profile()` бросает
    `ConvexError(REGISTRATION_DISABLED)` для `flow === "signUp"` — Password
    вызывает `profile()` для КАЖДОГО flow ДО создания/чтения аккаунта, поэтому
    `signUp` отклоняется до записи любых строк, а `signIn` не затронут.
  - Клиент ([`src/components/SignIn.tsx`](../../src/components/SignIn.tsx)):
    `SIGNUP_ENABLED = false` скрывает переключатель «Нет аккаунта?».
  - **Включить обратно — переключить ОБА флага в `true`.**
- **OAuth** (GitHub/Google) — опционально, `OAUTH_ENABLED = false`: провайдеры
  закомментированы в `auth.ts`; чтобы включить — создать OAuth-приложения, задать
  env, раскомментировать, поднять флаг.

## Ключевые решения и алгоритмы

Гейт регистрации намеренно живёт в `profile()` (а не в UI) — серверная блокировка
не обходится клиентом. Парные флаги (сервер + клиент) держать синхронно: один без
другого даёт либо «кнопка есть, но падает», либо «нельзя, но сервер бы пустил».

Провайдеры в `App.tsx`/`main.tsx`: `ConvexAuthProvider`, затем
`<AuthLoading>`/`<Unauthenticated>`/`<Authenticated>` разводят на `Splash`/`SignIn`/`Shell`.

## Тестирование

- [`convex/auth.test.ts`](../../convex/auth.test.ts): серверная блокировка `signUp`
  (бросает `REGISTRATION_DISABLED`), `signIn` проходит.

## Карта файлов

- [`convex/auth.ts`](../../convex/auth.ts) — `SIGNUP_ENABLED`, `REGISTRATION_DISABLED`, провайдеры.
- [`convex/auth.config.ts`](../../convex/auth.config.ts), [`convex/http.ts`](../../convex/http.ts) — конфиг/роуты.
- [`src/components/SignIn.tsx`](../../src/components/SignIn.tsx) — форма, парные флаги, тексты ошибок.
- [`src/main.tsx`](../../src/main.tsx), [`src/App.tsx`](../../src/App.tsx) — провайдер и развод по состоянию авторизации.

## Известные ограничения

- Регистрация отключена временно — при включении не забыть оба флага.
- Свежий локальный Convex-деплой (worktree) пуст и не даёт зарегистрироваться →
  для параллельной разработки нужен локально-гейтнутый сид dev-пользователя
  (отдельная задача про worktree-параллелизм).
