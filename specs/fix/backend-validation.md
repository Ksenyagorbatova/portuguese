# Валидация и ужесточение бэкенда (ключи, auth-гейт, prune, email, сброс пароля)

Ветка: `fix/backend-validation` · 2026-06-10 · статус: готово

## Цель

Закрыть пачку слабых мест серверного слоя, найденных ревью: мутации прогресса
принимали любые ключи (мусор молча оседал в `progress`), `getCourse` отдавал
контент без авторизации, удалённый из `content.ts` контент навсегда зависал в БД,
схема несла неиспользуемые индексы, email не нормализовался (риск «не найденного»
аккаунта из-за регистра/пробелов), а забытый пароль было нечем сбросить.

## Изменения данных / API

- `progress.recordAnswer` — перед записью проверяет существование слова одним
  indexed-чтением (`words.by_lessonKey_pt`); нет слова → `ConvexError("unknown word")`,
  строка не создаётся.
- `progress.markTheorySeen` — аналогично валидирует урок (`lessons.by_lessonKey`)
  → `ConvexError("unknown lesson")`.
- `courseQueries.getCourse` — auth-gated: `getAuthUserId` → не авторизован →
  `return null` (паттерн `getSrsState`; Shell уже показывает Splash при falsy).
- `seed.seedContent` — после upsert новая **prune-фаза**: удаляет из контентных
  таблиц (`topics`/`lessons`/`words`/`crossSentences`) строки, чьих натуральных
  ключей больше нет в `content.ts`; per-user таблицы (`progress`/`theorySeen`/
  `userStats`) не трогает никогда. Возврат дополнен `pruned: {…}` (и проброшен в
  аннотацию `seedLocal`).
- `schema.ts` — удалены неиспользуемые индексы `lessons.by_topicKey`,
  `words.by_lessonKey`, `progress.by_user_lesson` (греп подтвердил: ссылок нет;
  `theorySeen.by_user_lesson` используется и остаётся).
- `auth.ts` — `profile()` нормализует email (`trim().toLowerCase()`, хелпер
  `normalizeEmail`); новая `auth:adminResetPassword` (internalAction) для ручного
  сброса пароля через CLI.
- `SignIn.tsx` — `minLength` пароля 6 → 8 (серверный минимум Password).

## Поведение (для пользователя)

- Видимых изменений нет; незалогиненный больше не может вытащить контент курса
  через публичный query.
- Владелец может сбросить пароль:
  `npx convex run --prod auth:adminResetPassword '{"email":"…","newPassword":"…"}'`
  (раздел «Забыли пароль (админ-процедура)» в конце README).
- Вход с email в другом регистре / с пробелами попадает в тот же аккаунт.

## Ключевые решения

- **Нормализации email достаточно на сервере.** Проверено по
  `@convex-dev/auth@0.0.93` (`dist/providers/Password.js`): `authorize` берёт
  `const { email } = profile(params)` и передаёт его в
  `retrieveAccount({ account: { id: email } })` для `signIn` (и в
  `createAccount` для `signUp`) — сырой `params.email` для поиска не используется,
  клиент не правим.
- **`adminResetPassword` без env-гейтов** (в отличие от `seedLocal`): функция
  должна работать на проде; `internalAction` сама по себе недоступна клиенту —
  это и есть гейт (вызов только через CLI с deploy-ключом). Валидация пароля ≥8 —
  серверный минимум Password, иначе вход валиден, а смена через будущий
  reset-флоу — нет. `modifyAccountCredentials` (`ActionCtx`,
  `{ provider, account: { id, secret } }`) хеширует секрет scrypt'ом провайдера и
  падает на несуществующем аккаунте. Сессии не инвалидируются (единственный
  пользователь — владелец).
- **Prune только контента.** Сид собирает «живые» ключи во время upsert-прохода
  и удаляет несоответствующие строки; прогресс с осиротевшими ключами лежит без
  вреда (его никто не читает) — трогать per-user данные из сида запрещено.
- **Валидация — одно indexed-чтение**, до любых записей: мутация отказывает
  целиком, ничего не оставляя.

## Тестирование

- `convex/progress.test.ts` — мусорные `lessonKey`/`pt` → reject + строка не
  создана (и для `markTheorySeen`); все существующие тесты переведены на
  предварительный сид слова/урока (`seedWordA`/`seedLesson`).
- `convex/courseQueries.test.ts` — неавторизованный → `null`; остальные тесты —
  в авторизованном контексте (`withIdentity({ subject: `userId|session` })`).
- `convex/seed.test.ts` — prune удаляет мусорные контентные строки всех 4 таблиц;
  per-user строки с осиротевшими ключами не тронуты; повторный сид — no-op.
- `convex/auth.test.ts` — нормализация email: полный успешный signIn с
  `«  DEV@Example.COM »` (стаб `JWT_PRIVATE_KEY` ключом jose/RS256 +
  `CONVEX_SITE_URL`) и различение `InvalidSecret` (аккаунт найден) /
  `InvalidAccountId` (не найден); `adminResetPassword`: старый пароль перестаёт
  работать / новый работает, нормализация входного email, пароль <8 отклоняется
  без смены секрета, несуществующий аккаунт — ошибка.

## Карта файлов

- изменено: `convex/progress.ts`, `convex/courseQueries.ts`, `convex/seed.ts`,
  `convex/schema.ts`, `convex/auth.ts`, `src/components/SignIn.tsx`,
  `convex/progress.test.ts`, `convex/courseQueries.test.ts`, `convex/seed.test.ts`,
  `convex/auth.test.ts`, `README.md` (раздел в конце),
  `specs/feature/content-and-seed.md`, `specs/feature/auth-and-signup-gate.md`,
  `specs/feature/srs-scheduling.md`
- добавлено: `specs/fix/backend-validation.md`

## Известные ограничения

- `adminResetPassword` не инвалидирует существующие сессии (осознанно, см. выше).
- Сервер по-прежнему доверяет присланным `quality`/`mode` — валидация ключей не
  меняет этот компромисс.
- Удаление индексов требует пуша схемы (`convex deploy`) — на проде произойдёт
  при мёрже через CI.
