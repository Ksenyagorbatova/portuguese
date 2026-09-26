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
  Зарегистрироваться» (настоящая `<button type="button">` — доступна с клавиатуры
  и скринридеру) → форма «Регистрация» / кнопка «Зарегистрироваться»
  (пароль ≥ 8 — серверный минимум провайдера, на клиенте `minLength=8`); успешная
  регистрация сразу впускает (выпускаются токены сессии).
- **Занятый email при регистрации** → `ConvexError("ACCOUNT_EXISTS")` ДО проверки
  пароля: без дубля, без перезаписи пароля и без сессии даже при верном пароле
  (иначе `signUp` на чужой email был бы оракулом подбора пароля — путь провайдера
  `createAccountFromCredentials` проверяет пароль без rate limit, в отличие от
  `signIn`). UI: «Аккаунт с таким email уже есть — войдите.»
- **Коды ошибок → тексты** (`ConvexError.data` доходит до прод-клиента, простой
  `Error` — только как «Server Error»): `ACCOUNT_EXISTS` → «Аккаунт с таким email
  уже есть — войдите.»; `INVALID_EMAIL` (не похоже на email — и при входе) →
  «Проверьте email — похоже, в нём опечатка.»; `REGISTRATION_DISABLED` →
  «Регистрация сейчас закрыта.»; прочее — «Не удалось войти. Проверьте email и
  пароль.» / «Не удалось зарегистрироваться. Проверьте соединение и попробуйте ещё раз.»
- **Поле email** — `type="email" inputMode="email" autoCapitalize="none"
  autoCorrect="off" spellCheck={false}`: iOS-клавиатура не капитализирует и не
  «исправляет» адрес.
- **Нормализация email** — `profile()` возвращает `email.trim().toLowerCase()`
  (и отклоняет не-email кодом `INVALID_EMAIL`).
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
  - Сервер ([`convex/auth.ts`](../../convex/auth.ts)): при `false`
    `assertSignUpAllowed` бросает `ConvexError(REGISTRATION_DISABLED)` для
    `flow === "signUp"` — в обёртке `authorize` и в `profile()` (Password вызывает
    `profile()` для КАЖДОГО flow ДО создания/чтения аккаунта), поэтому `signUp`
    отклоняется до записи любых строк, а `signIn` не затронут.
  - Клиент ([`src/components/SignIn.tsx`](../../src/components/SignIn.tsx)): при
    `false` переключатель «Нет аккаунта?» скрыт (проп `signupEnabled` — для теста).
  - **Закрыть регистрацию снова — переключить ОБА флага в `false`** (и вернуть
    тесты `convex/auth.test.ts` / `SignIn.ct.tsx` к варианту «disabled» — см. историю
    `git log -- convex/auth.test.ts`).
- **OAuth** (GitHub/Google) — опционально, `OAUTH_ENABLED = false`: провайдеры
  закомментированы в `auth.ts`; чтобы включить — создать OAuth-приложения, задать
  env, раскомментировать, поднять флаг.
- **Хранилище токенов:** в вебе — `localStorage` (дефолт `ConvexAuthProvider`); в
  iOS-оболочке (Capacitor) — `@capacitor/preferences` (UserDefaults) через проп
  `storage` ([`src/lib/authStorage.ts`](../../src/lib/authStorage.ts),
  `pickTokenStorage()` по `hasNativePlugin("Preferences")` — нативная сборка без
  плагина остаётся на localStorage, а не виснет в AuthLoading): WebKit вправе чистить script-writable
  storage, UserDefaults живут до удаления приложения. Вход переживает перезапуск;
  выход удаляет ключи. См. [`../feat/ios-capacitor-app.md`](../feat/ios-capacitor-app.md).

## Ключевые решения и алгоритмы

Гейт регистрации намеренно живёт на сервере (а не в UI) — серверная блокировка
не обходится клиентом.

**Обёртка провайдера** (`rejectSignUpForExistingAccounts`): настоящий `authorize`
Password лежит в `provider.options.authorize` (`@convex-dev/auth` 0.0.93 при
материализации мерджит `options` в провайдер), поэтому обёртка подменяет именно
его: для `signUp` — рубильник, валидация email, `retrieveAccount` без секрета
(обычный lookup; нет аккаунта → `InvalidAccountId` → продолжаем) и
`ACCOUNT_EXISTS`; затем исходный `authorize`. Смена формы провайдера роняет модуль
при загрузке (`options.authorize is missing`), а не молча отключает защиту. Парные флаги (сервер + клиент) держать синхронно: один без
другого даёт либо «кнопка есть, но падает», либо «нельзя, но сервер бы пустил».

Провайдеры в `App.tsx`/`main.tsx`: `ConvexAuthProvider`, затем
`<AuthLoading>`/`<Unauthenticated>`/`<Authenticated>` разводят на `Splash`/`SignIn`/`Shell`.

## Тестирование

- [`convex/auth.test.ts`](../../convex/auth.test.ts): «registration enabled» — флаг
  `true`; `signUp` создаёт ровно одного `users` + один `authAccounts` (секрет —
  хеш) и выпускает токены; нормализация email при регистрации; повторный `signUp`
  на тот же email (в другом регистре) → `ACCOUNT_EXISTS`, без дубля и без смены
  пароля; `signUp` на существующий email даже с ВЕРНЫМ паролем → `ACCOUNT_EXISTS`
  и ноль сессий; мусорный email (`""`, пробелы, без `@`/домена, с пробелом) →
  `INVALID_EMAIL` без строк; рубильник `assertSignUpAllowed` (закрыт — `signUp`
  бросает `REGISTRATION_DISABLED`, `signIn` проходит; открыт — всё проходит); зарегистрированные креды работают в `signIn` (неверный пароль —
  `InvalidSecret`); пароль < 8 отклоняется до записи строк. Нормализация email
  при входе (`«  DEV@Example.COM »` находит аккаунт: полный успешный signIn под
  стабом `JWT_PRIVATE_KEY` (jose, RS256) + различение `InvalidSecret`/`InvalidAccountId`);
  `adminResetPassword` (старый пароль перестаёт работать, новый работает,
  пароль <8 отклоняется без изменения секрета, несуществующий аккаунт — ошибка).
- [`src/components/SignIn.ct.tsx`](../../src/components/SignIn.ct.tsx):
  переключатель виден и переводит форму в «Регистрация»/«Зарегистрироваться»
  (`autocomplete=new-password`) и обратно; переключатель — `button type=button`,
  работает с клавиатуры; `signupEnabled={false}` прячет его; атрибуты поля email
  (`inputmode`/`autocapitalize`/`autocorrect`/`spellcheck`); aria-label полей;
  коды `ACCOUNT_EXISTS`/`REGISTRATION_DISABLED`/`INVALID_EMAIL` → свои тексты,
  прочий сбой → общий текст (стаб `window.__signInError` в
  `src/test/mocks/convexAuthReact.ts`).

## Карта файлов

- [`convex/auth.ts`](../../convex/auth.ts) — `SIGNUP_ENABLED`, коды
  `REGISTRATION_DISABLED`/`ACCOUNT_EXISTS`/`INVALID_EMAIL`, `assertSignUpAllowed`,
  обёртка `rejectSignUpForExistingAccounts`, `normalizeEmail`/`validEmail`,
  `adminResetPassword`.
- [`convex/auth.config.ts`](../../convex/auth.config.ts), [`convex/http.ts`](../../convex/http.ts) — конфиг/роуты.
- [`src/components/SignIn.tsx`](../../src/components/SignIn.tsx) — форма, парные флаги, тексты ошибок.
- [`src/main.tsx`](../../src/main.tsx), [`src/App.tsx`](../../src/App.tsx) — провайдер и развод по состоянию авторизации.
- [`src/lib/authStorage.ts`](../../src/lib/authStorage.ts) (+test) — адаптер токенов над `@capacitor/preferences` для iOS-оболочки.

## Известные ограничения

- Защиты от массовой регистрации (капча, rate limit, подтверждение email) нет —
  приемлемо для закрытого круга тестеров; при публичном запуске — кандидат на
  доработку (провайдер Password поддерживает `verify` через email-провайдер).
- Сброса пароля пользователем нет — только админ-процедура `adminResetPassword`.
- Worktree: свежий локальный Convex-деплой пуст — `npm run wt:setup` сеет готовый
  dev-аккаунт `dev@example.com` / `12345678q` (быстрый вход без регистрации).
