# Авторизация и гейт регистрации

Статус: baseline (отгружено) · 2026-09-26 · флоу регистрации **готов**, флаг
**временно ВЫКЛЮЧЕН** (выключена 2026-06-04; в ветке `feat/ios-capacitor-app`
флоу доделан — ACCOUNT_EXISTS/INVALID_EMAIL/UI — и по решению владельца закрыт
снова тем же флагом до публикации в App Store)

## Цель

Доступ к приложению — за email+password (Convex Auth, провайдер Password).
Публичная регистрация закрыта флагом (решение владельца 2026-09-26: репозиторий
и сайт публичные — открытый sign-up лишняя поверхность для злоупотреблений).
Откроется перед App Store: тестерам TestFlight и ревью Apple нужен способ завести
аккаунт. Гейт — «рубильник»: открыть/закрыть = переключить два флага, серверную
половину можно переключить env-переменной деплоя без деплоя кода.

## Изменения данных / API

Convex Auth таблицы (`...authTables` в [`convex/schema.ts`](../../convex/schema.ts)):
`users`, `authAccounts`, `authSessions`, … Convex-функции получают пользователя
ТОЛЬКО через `liveUserId` / `requireLiveUserId` ([`convex/account.ts`](../../convex/account.ts)):
id из JWT плюс проверка, что в базе есть и пользователь, и его сессия. JWT Convex
Auth действует до часа и после выхода или удаления аккаунта, поэтому голый
`getAuthUserId` запрещён правилом `no-restricted-imports` в `.oxlintrc.json`.
В тестах — `asNewUser(t)` из `src/test/convexAuth.ts` (пользователь + настоящая
сессия, identity `` `${userId}|${sessionId}` ``).

`account:viewer` — `null` (гость) | `{ state: "live", email }` |
`{ state: "gone" }` (токен валиден, а аккаунта или сессии уже нет).
`account:deleteAccount` — удаление вызывающего пользователя (ниже).

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
- **Гейт регистрации** (`SIGNUP_ENABLED`, сейчас `false` — временно):
  - Сервер ([`convex/auth.ts`](../../convex/auth.ts)): эффективный гейт —
    `signUpEnabled()`: env деплоя `SIGNUP_ENABLED` (`"true"`/`"false"`,
    `npx convex env set SIGNUP_ENABLED true`) перекрывает скомпилированный дефолт,
    иначе действует константа; читается при каждом вызове. При закрытом гейте
    `assertSignUpAllowed` бросает `ConvexError(REGISTRATION_DISABLED)` для
    `flow === "signUp"` — в обёртке `authorize` (ДО проверки занятости email:
    закрытая регистрация не раскрывает, есть ли аккаунт) и в `profile()` (Password
    вызывает `profile()` для КАЖДОГО flow ДО создания/чтения аккаунта), поэтому
    `signUp` отклоняется до записи любых строк, а `signIn` не затронут.
  - Клиент ([`src/components/SignIn.tsx`](../../src/components/SignIn.tsx)): при
    `false` переключатель «Нет аккаунта?» скрыт (проп `signupEnabled` — для теста).
  - **Открыть регистрацию — переключить ОБА флага в `true`** (или серверную
    половину env-переменной без деплоя). Тесты трогать не нужно: полные флоу
    signUp в `convex/auth.test.ts`/`account.test.ts` открывают гейт через
    `stubJwtEnv` (env `SIGNUP_ENABLED=true`), CT `SignIn.ct.tsx` — пропом
    `signupEnabled`; тест дефолта (`SIGNUP_ENABLED` выключен) и тест закрытого
    гейта через провайдер поменяют ожидание — это и есть осознанный сигнал.
- **Удаление аккаунта** (App Store Review Guideline 5.1.1(v) — приложение с
  регистрацией обязано его давать; на сайте то же). В разделе «Профиль», под
  выходом из аккаунта — строка аккаунта: email и «Удалить
  аккаунт» ([`AccountFooter`](../../src/components/AccountFooter.tsx)). Дальше
  `ConfirmDialog` в «опасном» варианте: «Удалить аккаунт?» → «Удалить навсегда».
  Пока запрос в пути, диалог остаётся модальным (кнопки `aria-disabled`, Esc и
  подложка не закрывают, «Удаляем аккаунт…», без сети — «Ждём соединения…»).
  Успех — флаг финала курса на устройстве стирается (`forgetCourseSeen`: он
  выведен из прогресса), затем `signOut()` и экран входа. Ошибка — диалог закрывается, баннер
  «Не удалось удалить аккаунт», фокус возвращается на кнопку. Офлайн кнопка
  отключена с пояснением: иначе мутация встала бы в очередь без ответа.
  Сервер (`deleteAccount`) одной транзакцией удаляет:
  - данные приложения по списку `USER_OWNED_TABLES`;
  - аккаунты провайдеров с кодами подтверждения;
  - счётчики неудачных входов (по `_id` аккаунта и по email);
  - сессии (refresh по ним сразу невозможен);
  - сам users-документ.

  refresh-токены сессий дочищаются в фоне пачками (`purgeRefreshTokens`, по
  1000). Email свободен: регистрация на него снова создаёт чистый аккаунт.
- **Токен удалённого или вышедшего аккаунта.** На другом устройстве JWT ещё до
  часа валиден: `viewer` отдаёт `gone`, и `Shell` сам вызывает `signOut()`.
  Без этого `getSrsState` = `null` держал бы экран на «Загрузка…» без шапки.
  Все записи (`recordAnswer`, `markTheorySeen`, `deleteAccount`) такому токену
  отвечают `Not authenticated`: строк-сирот нет. Токен вышедшей (отозванной)
  сессии аккаунт удалить не может.
- **Гонка входа и удаления.** Вход по паролю — две транзакции: поиск аккаунта,
  затем создание сессии. Колбэк `beforeSessionCreation` в `convexAuth` отвергает
  сессию для уже удалённого пользователя кодом `ACCOUNT_DELETED` и откатывает
  вход.
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

**Удаление — полное, проверяемое схемой.** Список таблиц приложения с данными
пользователя (`USER_OWNED_TABLES`) тест сверяет со схемой: любая таблица со
ссылкой на `users` обязана в нём быть и иметь индекс `by_user`. Auth-таблицы
`deleteAccount` чистит явно. Своя транзакционная очистка вместо библиотечной
`invalidateSessions`: та требует action-контекст и отдельную транзакцию.

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
- [`convex/account.test.ts`](../../convex/account.test.ts):
  - стирание всего, что связано с пользователем (users, аккаунт, сессии,
    refresh-токены, лимиты по `_id` и по email, коды, прогресс, теория,
    статистика), и ничего чужого;
  - сессии уходят сразу, 2300 refresh-токенов — пачками в фоне;
  - гость — `Not authenticated`;
  - протухший токен удалённого аккаунта: ни записей, ни `getSrsState`/`getCourse`,
    `viewer` — `gone`;
  - токен вышедшей сессии удалить аккаунт не может;
  - гонка: `auth:store signIn` для удалённого пользователя → `ACCOUNT_DELETED`
    и ноль сессий;
  - email свободен для новой регистрации;
  - полнота по схеме (`USER_OWNED_TABLES`, индекс `by_user`);
  - `viewer`: `live`/`null`/`gone`.
- CT: [`AccountFooter.ct.tsx`](../../src/components/AccountFooter.ct.tsx):
  - email и кнопка; подтверждение «опасного» вида с фокусом на «Отмена»;
  - «Отмена» ничего не удаляет;
  - подтверждение → одна мутация и `signOut`;
  - в пути диалог модальный (`aria-disabled`, Esc не закрывает);
  - ошибка → баннер и фокус на кнопке;
  - офлайн — кнопка отключена с пояснением;
  - без email — текст без адреса;
  - успех стирает флаг финала курса, ошибка — нет;
  - длинный email переносится внутри диалога на экране 320px;
  - зона нажатия кнопки — 44px по высоте;
  - email и пояснение офлайн — контраст AA в обеих темах.

  [`Shell.ct.tsx`](../../src/components/Shell.ct.tsx):
  - строка аккаунта только в профиле (нет на «Сегодня», в курсе, сессии и теории);
  - падение `account:viewer` не роняет приложение;
  - `gone` → `signOut`.

  [`ConfirmDialog.ct.tsx`](../../src/components/ConfirmDialog.ct.tsx): вариант
  `danger`, состояние `pending`.
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
- [`convex/account.ts`](../../convex/account.ts) (+test) — `liveUserId`/`requireLiveUserId`,
  `viewer`, `deleteAccount`, `purgeRefreshTokens`, `USER_OWNED_TABLES`.
- [`src/components/AccountFooter.tsx`](../../src/components/AccountFooter.tsx) (+ct) —
  строка аккаунта и поток удаления; выход по `gone` — в
  [`Shell.tsx`](../../src/components/Shell.tsx).
- [`src/test/convexAuth.ts`](../../src/test/convexAuth.ts) — общие хелперы backend-тестов
  (`asNewUser`, `stubJwtEnv`, `signUpWith`/`signInWith`).
- [`.oxlintrc.json`](../../.oxlintrc.json) — запрет голого `getAuthUserId` в `convex/`.

## Известные ограничения

- Защиты от массовой регистрации (капча, rate limit, подтверждение email) нет —
  приемлемо для закрытого круга тестеров; при публичном запуске — кандидат на
  доработку (провайдер Password поддерживает `verify` через email-провайдер).
- Сброса пароля пользователем нет — только админ-процедура `adminResetPassword`.
- Worktree: свежий локальный Convex-деплой пуст — `npm run wt:setup` сеет готовый
  dev-аккаунт `dev@example.com` / `12345678q` (быстрый вход без регистрации).
