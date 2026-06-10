# Дыры в гейтах качества + UX-полиш

Ветка: `chore/quality-infra` · PR: — · Дата: 2026-06-10 · Статус: готово

## Цель

Закрыть подтверждённые ревью дыры в гейтах качества (нетайпчекаемые тесты,
нелинтуемые скрипты, слепые падения CT на CI, неприколотые actions) и добить
пачку мелких UX-огрехов (склонение «N слов», нечестная кнопка повторения,
молчаливый выход из сессии по логотипу, рассинхрон theme-color) — каждый фикс
с тестом. Плюс вычистить мёртвый код/CSS, подтверждённый грепом.

## Изменения данных / API

Серверные API не менялись (`convex/` не тронут). Клиентские контракты:

- `src/lib/srs.ts`: `pluralRu` теперь экспортируется (склонение в UI);
  `intervalLabel` удалён (был мёртвым — использовался только своим тестом).
- `src/lib/queue.ts`: новый экспорт `REVIEW_DUE_LIMIT = 15` — лимит срочных
  слов в сессии повторения (использован в `buildReviewQueue` и в кнопке
  `ReviewTab`, чтобы число не дублировалось); `queueCounts` удалён (жил только
  ради собственного теста).
- `src/lib/useTheme.ts`: `resolveTheme` удалён (хук выводит тему из
  React-состояния сам); добавлен внутренний `THEME_COLOR` и запись
  resolved-цвета в `<meta name="theme-color">`.
- `src/test/mocks/convexReact.ts` (только CT): `useQuery` отдаёт фикстуры по
  имени функции (`getFunctionName`), новый `__setQueryData`; фикстуры приходят
  из теста через `mount(..., { hooksConfig: { queries } })` → `beforeMount` в
  `playwright/index.tsx` (новый экспортируемый тип `HooksConfig`).

## Поведение (для пользователя)

- **Склонение:** «1 слово / 2 слова / 5 слов пора повторить» (баннер и кнопка
  ReviewTab), «Ещё 1 слово ждёт / 2 слова ждут / 5 слов ждут повторения»
  (Complete).
- **Честная кнопка повторения:** сессия берёт максимум 15 срочных слов, при
  `due > 15` кнопка показывает «Повторить (15 из 40)» вместо обещания всех 40.
- **Confirm на логотипе:** клик по логотипу-«домой» во время активной сессии
  спрашивает «Выйти из тренировки?»; отмена оставляет сессию. Прочие пути
  («К повторению» с экрана завершения, «Назад» из теории) — без confirm.
- **theme-color:** цвет браузерного хрома следует за темой приложения (явный
  выбор перебивает ОС), а не только за `prefers-color-scheme`.
- Визуально ничего не менялось от чистки CSS (удалены только классы-сироты).

## Ключевые решения и алгоритмы

- **tsconfig.test.json:** причина дыры — наследуемый `exclude` из
  `tsconfig.app.json` молча вычёркивал `src/**/*.test.ts(x)` и `src/test` из
  include (exclude фильтрует include) — то есть не тайпчекались не только CT,
  но и ВСЕ фронтовые юнит-тесты. Лечится `"exclude": []` в самом конфиге +
  include для `src/**/*.ct.tsx` и `playwright/index.tsx`. Всплыло 22 ошибки в
  2 файлах (Session.ct.tsx — 7, srs.test.ts — 15), все починены; остальные
  13 CT-файлов оказались чистыми.
- **oxlint:** отдельный override `scripts/**/*.mjs` (env node) с тем же
  набором JS-correctness правил, что и для ts/tsx, минус typescript/react;
  правила-warn (`react/exhaustive-deps`, `react-hooks-js/incompatible-library`,
  `react-hooks-js/unsupported-syntax`) переведены в error. Нарушений не
  всплыло — lint зелёный без disable-комментариев.
- **CI:** кэш браузеров Playwright ключуется точной версией
  `@playwright/experimental-ct-react` из package-lock (bump → инвалидация);
  при cache-hit ставятся только OS-зависимости. Трейсы: при `retries: 0`
  прежний `on-first-retry` не мог записаться никогда → на CI
  `retain-on-failure`, локально `off`. HTML-репортер добавлен только на CI:
  без него `playwright-report/` не существовал и артефакту при падении было
  нечего выгружать, кроме сырых трейсов.
- **SHA-pin:** все `uses:` в ci.yml/deploy.yml приколоты к полным commit SHA
  (тег в комментарии `# vX`), SHA взяты через `gh api repos/<o>/<r>/commits/<tag>`.
  Для новых шагов: `actions/cache@v5`, `actions/upload-artifact@v7` (v6+
  требует Node 24 runner — на hosted ubuntu-latest ок). Dependabot (weekly,
  npm + github-actions, лимит 5 PR) дальше бампает пины сам.
- **Confirm только на пути логотипа** (`goHome`), не в `switchTab`: иначе
  «К повторению» с экрана `Complete` (он тоже зовёт `switchTab` при
  `view.kind === "session"`) ловил бы бессмысленный confirm.
- **CT-фикстуры для Shell** — через документированный механизм
  `hooksConfig`/`beforeMount` (фикстуры сериализуются в браузерный бандл, где
  живёт стаб `convex/react`); ключ — `"module:function"` от `getFunctionName`,
  работает с `anyApi`-прокси `convex/_generated/api`.
- **Мёртвый код:** правило отбора — экспорт жив только благодаря собственному
  тесту ⇒ удаляются оба. `queueCounts` остался в `queue.test.ts` локальным
  хелпером (другие тесты считали им бейджи). `.m-stats` стал 3-колоночным
  (единственный потребитель `ScoreRow` всегда добавлял `--3`); пресеты
  `ocean`/`coral` не тронуты (задокументированы как намеренные).

## Тестирование

- `npm run verify` (typecheck + lint + unit + backend + CT, 55 CT) и
  `npm run build` — зелёные.
- Новые тесты: юнит `pluralRu` (1/2/5/11/14/21/22/0); юнит на срез очереди по
  `REVIEW_DUE_LIMIT`; CT ReviewTab (формы 1/2/5, «Повторить (15 из 40)»); CT
  Complete («1 слово ждёт» / «2 слова ждут»); `Shell.ct.tsx` — 5 сценариев
  (теория не просмотрена → экран теории; просмотрена → сразу сессия; confirm
  логотипа принят → домой; отменён → сессия живёт; вне сессии — без confirm);
  юнит useTheme на синк обоих theme-color-метатегов (явный dark на светлой ОС;
  перецикливание; живая смена ОС).
- Тайпчек тестов: `tsc -p tsconfig.test.json` теперь реально покрывает
  src-юнит и все `*.ct.tsx` (входит в `npm run typecheck`).

## Карта файлов

Добавлено:
- `.github/dependabot.yml` — weekly npm + github-actions.
- `src/components/Shell.ct.tsx` — CT-покрытие Shell (было ноль).
- `specs/chore/quality-infra.md` — эта спека.

Изменено:
- `tsconfig.test.json` — сброс exclude, include CT + playwright/index.tsx.
- `.oxlintrc.json` — override scripts/**/*.mjs; warn → error.
- `.github/workflows/ci.yml` — кэш Playwright, артефакты при падении CT, SHA-pin.
- `.github/workflows/deploy.yml` — SHA-pin (логика не менялась).
- `playwright-ct.config.ts` — trace retain-on-failure на CI, html-репортер на CI.
- `playwright/index.tsx` — `beforeMount` + `HooksConfig` (фикстуры запросов).
- `package.json` — engines.node `>=24`.
- `README.md` — dev-URL, таблица скриптов, раздел «Тестирование», ci.yml.
- `src/lib/srs.ts` / `srs.test.ts` — экспорт pluralRu, − intervalLabel, типы фикстур.
- `src/lib/queue.ts` / `queue.test.ts` — REVIEW_DUE_LIMIT, − queueCounts.
- `src/lib/useTheme.ts` / `useTheme.test.ts` — theme-color-синк, − resolveTheme.
- `src/components/ReviewTab.tsx` / `.ct.tsx` — склонение + честная кнопка.
- `src/components/Complete.tsx` / `.ct.tsx` — склонение «ждёт/ждут».
- `src/components/Shell.tsx` — confirm на goHome, useMemo для adaptSrs.
- `src/components/Session.ct.tsx` — явные типы хелперов, lastSeen в фикстурах.
- `src/components/ScoreRow.tsx` / `.ct.tsx` — `m-stats` без `--3`.
- `src/test/mocks/convexReact.ts` — фикстуры useQuery по имени функции.
- `src/index.css` — удалены сироты: `.m-kicker`, `.m-title` (+ @media),
  `.m-topic-pct`, `[data-density="compact"]`, `.m-stat-n.alert`, `.m-chips`,
  `.m-stats--3` (база стала 3-колоночной).
- `specs/feature/training-ui-and-shell.md`, `specs/feature/theme-system-mode.md`
  — baseline-спеки обновлены под confirm/кнопку/theme-color/удаления.

Удалено: только перечисленный мёртвый код/CSS (файлы не удалялись).

## Известные ограничения / дальнейшие шаги

- Confirm срабатывает и на экране завершения сессии (`Complete`) при клике
  именно по логотипу: Shell не знает, что очередь уже дойдена (`view.kind`
  всё ещё `"session"`). Редкий и безвредный случай; лечится отдельным
  сигналом «сессия завершена» из Session, если будет мешать.
- `window.confirm` — нативный диалог, не стилизуется под тему приложения.
- Кнопка «Повторить (15 из N)» считает по глобальному `dueCountAll`; если
  часть срочных слов — из уроков с непросмотренной теорией, фактическая
  очередь может быть короче 15 (поведение очереди не менялось).
- SHA-пины фиксируют версии actions — обновления теперь только через
  Dependabot-PR (это намеренно).
