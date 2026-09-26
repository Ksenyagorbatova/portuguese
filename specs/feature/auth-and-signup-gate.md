# Авторизация и гейт регистрации

Статус: baseline (отгружено) · 2026-09-26 · регистрация **ВКЛЮЧЕНА** (была
выключена 2026-06-04 … 2026-09-26; включена в ветке `feat/ios-capacitor-app`)

## Цель

Доступ к приложению — за email+password (Convex Auth, провайдер Password).
Публичная регистрация открыта (решение владельца 2026-09-26: тестеры iOS-сборки
из TestFlight заводят аккаунт с телефона; будущему ревью App Store нужен
demo-доступ). Гейт регистрации остаётся в коде как «рубильник»: закрыть её
снова — переключить два флага.

## Изменения данных / API

Convex Auth таблицы (`...authTables` в [`convex/schema.ts`](../../convex/schema.ts)):
`users`, `authAccounts`, `authSessions`, … Каждая Convex-функция получает
пользователя через `getAuthUserId(ctx)`; identity subject в тестах —
`` `${userId}|session` ``.

## Поведение

- **Вход** (`signIn`) — email+password.
- **Регистрация** (`signUp`) — на экране входа переключатель «Нет аккаунта?
  Зарегистрироваться» → форма «Регистрация» / кнопка «Зарегистрироваться»
  (пароль ≥ 8 — серверный минимум провайдера, на клиенте `minLength=8`); успешная
  регистрация сразу впускает (выпускаются токены сессии). Повторная регистрация
  на существующий email отклоняется провайдером (`Account … already exists`) без
  дубля и без перезаписи пароля; UI показывает «Не удалось зарегистрироваться.
  Возможно, аккаунт с таким email уже есть.»
- **Поле email** — `type="email" inputMode="email" autoCapitalize="none"
  autoCorrect="off" spellCheck={false}`: iOS-клавиатура не капитализирует и не
  «исправляет» адрес.
- **Нормализация email** — `profile()` возвращает `email.trim().toLowerCase()`.
  Password.authorize берёт email ИЗ РЕЗУЛЬТАТА `profile()` для всех флоу — и как
  account id при `signUp`, и для поиска аккаунта при `signIn` (проверено по
  `@convex-dev/auth` 0.0.93, `dist/providers/Password.js`) — поэтому серверной
  нормализации достаточно, клиент ввод не трогает. «Email@X.com» и «email@x.com»
  попадают в один аккаунт (и при регистрации, и при входе).
- **Сброс пароля** — `auth:adminResetPassword` (internalAction, клиенту
  недоступна — это и есть гейт; работает и на проде):
  `npx convex run --prod auth:adminResetPassword '{"email":"…","newPassword":"…"}'`.
  Валидация: пароль ≥ 8 символов; email нормализуется; под капотом
  `modifyAccountCredentials` (`{ provider, account: { id, secret } }`, хеширует
  scrypt'ом провайдера, падает на несуществующем аккаунте). Существующие сессии
  НЕ инвалидируются. Процедура задокументирована в конце README.
- **Гейт регистрации** (`SIGNUP_ENABLED`, сейчас `true`):
  - Сервер ([`convex/auth.ts`](../../convex/auth.ts)): при `false` `profile()`
    бросает `ConvexError(REGISTRATION_DISABLED)` для `flow === "signUp"` —
    Password вызывает `profile()` для КАЖДОГО flow ДО создания/чтения аккаунта,
    поэтому `signUp` отклоняется до записи любых строк, а `signIn` не затронут.
  - Клиент ([`src/components/SignIn.tsx`](../../src/components/SignIn.tsx)): при
    `false` переключатель «Нет аккаунта?» скрыт.
  - **Закрыть регистрацию снова — переключить ОБА флага в `false`** (и вернуть
    тесты `convex/auth.test.ts` / `SignIn.ct.tsx` к варианту «disabled» — см. историю
    `git log -- convex/auth.test.ts`).
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

- [`convex/auth.test.ts`](../../convex/auth.test.ts): «registration enabled» — флаг
  `true`; `signUp` создаёт ровно одного `users` + один `authAccounts` (секрет —
  хеш) и выпускает токены; нормализация email при регистрации; повторный `signUp`
  на тот же email (в другом регистре) → `already exists`, без дубля и без смены
  пароля; зарегистрированные креды работают в `signIn` (неверный пароль —
  `InvalidSecret`); пароль < 8 отклоняется до записи строк. Нормализация email
  при входе (`«  DEV@Example.COM »` находит аккаунт: полный успешный signIn под
  стабом `JWT_PRIVATE_KEY` (jose, RS256) + различение `InvalidSecret`/`InvalidAccountId`);
  `adminResetPassword` (старый пароль перестаёт работать, новый работает,
  пароль <8 отклоняется без изменения секрета, несуществующий аккаунт — ошибка).
- [`src/components/SignIn.ct.tsx`](../../src/components/SignIn.ct.tsx):
  переключатель виден и переводит форму в «Регистрация»/«Зарегистрироваться»
  (`autocomplete=new-password`) и обратно; атрибуты поля email
  (`inputmode`/`autocapitalize`/`autocorrect`/`spellcheck`); aria-label полей.

## Карта файлов

- [`convex/auth.ts`](../../convex/auth.ts) — `SIGNUP_ENABLED`, `REGISTRATION_DISABLED`,
  провайдеры, `normalizeEmail`, `adminResetPassword`.
- [`convex/auth.config.ts`](../../convex/auth.config.ts), [`convex/http.ts`](../../convex/http.ts) — конфиг/роуты.
- [`src/components/SignIn.tsx`](../../src/components/SignIn.tsx) — форма, парные флаги, тексты ошибок.
- [`src/main.tsx`](../../src/main.tsx), [`src/App.tsx`](../../src/App.tsx) — провайдер и развод по состоянию авторизации.

## Известные ограничения

- Защиты от массовой регистрации (капча, rate limit, подтверждение email) нет —
  приемлемо для закрытого круга тестеров; при публичном запуске — кандидат на
  доработку (провайдер Password поддерживает `verify` через email-провайдер).
- Сброса пароля пользователем нет — только админ-процедура `adminResetPassword`.
- Worktree: свежий локальный Convex-деплой пуст — `npm run wt:setup` сеет готовый
  dev-аккаунт `dev@example.com` / `12345678q` (быстрый вход без регистрации).
