# CLAUDE.md

Гайд для Claude Code по работе с этим репозиторием.

## Что это

Тренажёр европейского португальского (A0–A1) с русским интерфейсом: интервальное
повторение (SM-2 / Эббингауз), 5 типов упражнений (выбор pt→ru / ru→pt, ручной
ввод, кросс-предложения, аудирование), теория с озвучкой.

**Стек:** React 19 + TypeScript + Vite (фронтенд, статика на GitHub Pages) ·
Convex (БД + функции + авторизация `@convex-dev/auth`, провайдер Password) ·
Node 24. Тесты: Vitest (+ convex-test) и Playwright Component Testing.
Сайт: `https://ksenyagorbatova.github.io/portuguese/` (base path `/portuguese/`).

## Метод работы: context7 (ОБЯЗАТЕЛЬНО)

Перед тем как писать код или предлагать фикс — тяни актуальную, версионно-точную
документацию через MCP-сервер **context7** и следуй найденным best-practices. Стек
быстро движется (Convex, React 19, Vite 8, `@convex-dev/auth`, Vitest 4, Playwright
CT) — не полагайся на память для форм API и конфигов: резолвни библиотеку в
context7, прочитай нужное, потом реализуй под актуальную версию.

## ⚠️ Рабочий процесс (ОБЯЗАТЕЛЬНО)

1. **Каждая задача — в отдельной ветке, всегда от свежего `origin/main`.** Перед
   началом работы — до первой строки кода, не только до коммита — обнови локальный
   main и ответвись от него: `git checkout main && git pull --ff-only origin main`,
   затем `git checkout -b <type>/<kebab>`. **Не** ответвляйся от устаревшего
   локального main или от другой feature-ветки — `origin/main` единственный источник
   правды. Имя ветки по сути задачи: `feat/...`, `fix/...`, `chore/...`
   (напр. `feat/add-numbers-topic`).
2. **Никогда не коммитить и не пушить напрямую в `main`.** Только через Pull
   Request с feature-ветки. `main` обновляется исключительно мёржем PR
   (мёрж в `main` сам запускает деплой — см. ниже).
3. **Тесты обязательны для каждого изменения.** Любая новая фича, фикс бага,
   рефакторинг и т.п. покрывается тестами — новыми ИЛИ правкой существующих,
   в том же PR. См. раздел [«Тестирование»](#тестирование) и скилл
   [`.claude/skills/test-policy`](.claude/skills/test-policy/SKILL.md).
4. **Спека на задачу (ОБЯЗАТЕЛЬНО).** Ветка, меняющая код, несёт спеку
   `specs/<branch>.md` — см. раздел [«Specs»](#specs) и скилл
   [`.claude/skills/spec`](.claude/skills/spec/SKILL.md) (`/spec`). Pre-push гейт
   блокирует push без неё.
5. **Code-review gate (перед push).** Прогнать скилл `/code-review` на диффе ветки,
   провалидировать КАЖДУЮ находку (реальная или ложная) и починить настоящие баги —
   с тестом, воспроизводящим баг. См. раздел [«Code-review gate»](#code-review-gate).
6. **Перед КАЖДЫМ push всё зелёное:** `npm run verify` (= typecheck + lint + unit +
   backend + Playwright CT; форсит `.githooks/pre-push`) и `npm run build`
   (прод-сборка; в CI — отдельный job). Падает — не пушить, чинить. Обход только в
   крайнем случае: `git push --no-verify`.
7. **Браузерное тестирование.** Помимо автотестов — вручную проверить в браузере
   затронутую функциональность И смежную, которую правка могла задеть
   (`npm run dev`, пройти соответствующие экраны/сценарии). Вход, карта экранов и
   конкретные потоки — скилл [`.claude/skills/browser-smoke`](.claude/skills/browser-smoke/SKILL.md).
8. Коммиты — осмысленными порциями; сообщения по существу.

Довести готовую задачу через все гейты (спека → code-review → verify → build →
смоук) до PR — скилл [`.claude/skills/ship-task`](.claude/skills/ship-task/SKILL.md)
(`/ship-task`); обзор всех скиллов — [«Скиллы проекта»](#скиллы-проекта).

## Specs

Каждая задача-ветка, меняющая код, несёт **спеку** `specs/<branch>.md` (префикс
ветки до `/` — подпапка): что и зачем сделано, ключевые решения, тестирование,
карта файлов. Пиши/обновляй её в том же PR скиллом **`/spec`**
([`.claude/skills/spec`](.claude/skills/spec/SKILL.md)) — он строит спеку из полного
диффа `main...HEAD`. **Pre-push гейт** ([`.githooks/pre-push`](.githooks/pre-push))
блокирует push ветки, которая тронула `src/`/`convex/` без создания/обновления своей
спеки (обход — `git push --no-verify`, только осознанно).

Существующие подсистемы задокументированы baseline-спеками в
[`specs/feature/`](specs/feature/) — они источник правды по подсистеме (CLAUDE.md
лишь обзор + ссылки); при правке подсистемы обновляй её baseline-спеку.

## Code-review gate

Перед пушем код-диффа и открытием/обновлением PR — прогнать скилл **`/code-review`**
на изменениях ветки, **провалидировать каждую находку** (реальная она или ложная) и
**починить настоящие**. Каждый фикс — по тест-политике: сначала тест, воспроизводящий
баг (красный), потом фикс, потом весь набор зелёный. Pre-push печатает напоминание,
но запустить skill за тебя hook не может — это на тебе. В итоговой сводке задачи —
что ревью нашло и что починено (или что находок нет).

## Скиллы проекта

Вызываемые скиллы в [`.claude/skills/`](.claude/skills/) — через `/<имя>` или
автоматически по описанию задачи:

- [`spec`](.claude/skills/spec/SKILL.md) — создать/обновить спеку ветки `specs/<branch>.md`.
- [`test-policy`](.claude/skills/test-policy/SKILL.md) — что и каким уровнем покрывать тестами.
- [`context7-first`](.claude/skills/context7-first/SKILL.md) — перед кодом с API библиотеки
  (Convex / React 19 / Vite 8 / Vitest 4 / @convex-dev/auth / Playwright CT) подтянуть
  версионно-точные доки через context7.
- [`content-authoring`](.claude/skills/content-authoring/SKILL.md) — добавить/править контент
  в `content.ts` (стабильность `lessonKey`/`pt`, кросс-предложения append-only, европейский PT, тесты сида).
- [`convex-conventions`](.claude/skills/convex-conventions/SKILL.md) — серверные конвенции/готчи
  Convex (`pt`→массивы + `adaptSrs`, авторизация, internal-гейты, паттерн `convex-test`).
- [`srs-invariants`](.claude/skills/srs-invariants/SKILL.md) — guard при правке SM-2/порогов/очереди
  (дублированные пороги сервер↔клиент, «событие повторения», статичная interleaved-очередь).
- [`browser-smoke`](.claude/skills/browser-smoke/SKILL.md) — браузерная/preview-проверка: вход
  (dev-аккаунт), карта экранов и потоки, что считать «смежным».
- [`ship-task`](.claude/skills/ship-task/SKILL.md) — прогнать все гейты (спека → code-review →
  verify → build → смоук) и довести задачу до PR.

## Команды

```bash
npm run dev            # Vite dev-сервер → http://localhost:5173/ (dev сервится с корня;
                       # base /portuguese/ только в прод-сборке — см. vite.config.ts)
npx convex dev         # бэкенд Convex + кодоген convex/_generated (отдельный терминал)
npm run lint           # oxlint (Rust; конфиг .oxlintrc.json)
npm run typecheck      # типы: tsc -b + convex/tsconfig + tsconfig.test (тесты)
npm run check          # typecheck + lint
npm run test           # Vitest: unit (jsdom) + backend (convex-test)
npm run test:backend   # только backend-проект Vitest
npm run test:frontend  # только frontend-проект Vitest
npm run test:watch     # Vitest в watch-режиме
npm run test:ct        # Playwright Component Testing (*.ct.tsx)
npm run verify         # check + test + test:ct — то же, что форсит pre-push
npm run build          # прод-сборка
npx convex run seed:seedContent   # залить/обновить контент в БД (идемпотентно)
npm run wt:setup       # настроить git-worktree (локальный Convex + сид) — см. «Worktree»
npm run wt:seed        # пере-сид локального деплоя worktree (контент + dev-аккаунт)
```

Локально нужны: `.env.local` с `VITE_CONVEX_URL` (создаётся `npx convex dev`),
и dev-`SITE_URL` (`npx convex env set SITE_URL http://localhost:5173`).
Версия Node — 24 (см. `.nvmrc`); первый `npm install` подключает pre-push hook.

## Worktree (параллельная разработка)

Несколько задач параллельно в отдельных `git worktree` без конфликтов портов/данных.
Основной checkout НЕ меняется (облачный dev-Convex, фикс-порт 5173). Вся
worktree-логика — только для *linked* worktree (детект — `scripts/worktree.mjs`).

- **Создавай worktree от свежего `origin/main`** (как любую задачу):
  `git fetch origin && git worktree add ../pt-<task> -b <type>/<desc> origin/main`.
  Каждый worktree = своя задача = своя ветка от актуального main (не от устаревшего).
- **Первое в свежем worktree:** `npm run wt:setup` — ставит зависимости, поднимает
  ИЗОЛИРОВАННЫЙ локальный Convex-деплой (свои функции/схема/данные), провижинит
  Convex Auth env и сеет контент + dev-аккаунт **`dev@example.com` / `12345678q`**
  (регистрация выключена → без сида не залогиниться). Идемпотентно; пере-сид —
  `npm run wt:seed`. No-op в основном checkout.
- **Порты:** `npm run dev` (Vite) и `npm run test:ct` (CT) в worktree берут
  смещённый порт (детерминированно от пути), `strictPort` снят — параллельные
  серверы не сталкиваются. Основной checkout: 5173/3100, strict.
- **Convex в worktree:** `npx convex dev` использует локальный деплой из `.env.local`
  (его пишет `wt:setup`); `.convex`/`.env.local` — per-каталог, уже изолированы.
- **Защита от сида на облаке:** `seed:seedLocal` строго локальный — гейты
  `CONVEX_CLOUD_URL` (127.0.0.1) + `ALLOW_DEV_SEED=1`; на облачном dev/prod
  отказывается. Подробности —
  [`specs/chore/worktree-parallel-dev.md`](specs/chore/worktree-parallel-dev.md).

## Тестирование

**Правило:** каждое изменение идёт с тестами (новыми или правкой существующих)
в том же PR; перед push весь набор зелёный (форсит `.githooks/pre-push`). Три уровня:

- **Бэкенд** — Vitest + `convex-test` (edge-runtime), файлы `convex/*.test.ts`.
  Покрывают Convex-функции: SM-2 (`recordAnswer` с `mode`; интервал двигается
  только на «событие повторения», потолок `MAX_INTERVAL`), этапные счётчики
  `mcCorrect/typeCorrect` и «выучено» по ОБОИМ навыкам, классификацию
  (`getSrsState`), идемпотентность сида, `getCourse`, серверную блокировку
  регистрации.
  Авторизованный контекст: `t.withIdentity({ subject: ` + "`${userId}|session`" + ` })`;
  загрузка модулей: `import.meta.glob(["./**/*.*s", "!./**/*.test.ts"])`.
- **Фронт-юнит** — Vitest + jsdom + Testing Library, файлы `src/**/*.test.ts(x)`.
  Покрывают чистую логику `src/lib`. Недетерминированное — мокать `./shuffle`
  (`vi.mock`) ради детерминизма; время — `vi.spyOn(Date, "now")`.
- **Компонентное** — Playwright CT, файлы `src/**/*.ct.tsx`, конфиг
  `playwright-ct.config.ts`. Компоненты с Convex-хуками изолируются алиасом на
  стабы из `src/test/mocks` (`ctViteConfig.resolve.alias`).

Тесты исключены из деплойного `tsc -b` и Convex-бандла (по маске `*.test.ts`);
их тайпчек — отдельный `tsconfig.test.json` (входит в `npm run typecheck`).
Конфиг двух Vitest-проектов — `vitest.config.ts`.

## Архитектура (ключевое)

Подробные спеки подсистем — в [`specs/feature/`](specs/feature/) (источник правды
по каждой; держать в синхроне при правках). Здесь — карта и несущие правила.

- **Контент** — источник правды в [`convex/content.ts`](convex/content.ts),
  идемпотентный сид [`convex/seed.ts`](convex/seed.ts) (upsert по натуральным
  ключам). НЕ менять существующие `lesson.id`/`word.pt` (прогресс завязан на
  `(lessonKey, pt)`); кросс-предложения только дописывать в конец.
  → [`specs/feature/content-and-seed.md`](specs/feature/content-and-seed.md).
- **Прогресс / SRS** — per-user таблица `progress`, ключ `(userId, lessonKey, pt)`
  (НЕ Convex `_id`), SM-2 на сервере [`convex/progress.ts`](convex/progress.ts).
  Интервал двигается ТОЛЬКО на «событие повторения» (слово выучивается этим ответом
  ИЛИ повторяется выученным и реально наступил повтор); потолок `MAX_INTERVAL=120`.
  Классификация new/due/learned/ongoing — `getSrsState`. Доп. поля (все
  `v.optional`): `progress.lapses` (счётчик провалов q0 → бейдж «липучки»),
  `userStats.bestStreak`/`startedAt` (финал курса).
  → [`specs/feature/srs-scheduling.md`](specs/feature/srs-scheduling.md).
- **Модель освоения** — два навыка: узнавание (MC, выбор) и воспроизведение (Type,
  ввод), ВПЕРЕМЕШКУ; «выучено» = `mcCorrect>=MC_TARGET && typeCorrect>=TYPE_TARGET`
  (пороги `=3` дублируются сервер/клиент — держать синхронно). Тип упражнения —
  `pickExerciseType` ([`src/lib/learning.ts`](src/lib/learning.ts)): первое
  знакомство со словом — всегда MC. Аудирование (`mc_audio_ru`) — 5-й тип: для
  выученных в повторении (3-я ступень) и ЭКСТРА в изучении (после mc≥1, шанс
  `AUDIO_EXTRA_CHANCE`); НЕ двигает выученность (серверный mode `"audio"` не растит
  mc/type). Гейт `audioOk = canSpeakPortuguese() && !isMuted()` (звук + pt-голос).
  → [`specs/feature/word-learning-model.md`](specs/feature/word-learning-model.md).
- **Очередь сессии** — СТАТИЧНАЯ, ≤ `SESSION_SIZE` (=20) карточек: клиент собирает
  её interleaved-проходами по недоученным словам урока
  ([`src/lib/queue.ts`](src/lib/queue.ts)); после старта очередь НЕ растёт —
  переспросов нет, недобранное слово возвращается в следующей сессии (прогресс
  mc/type серверный, сквозной). Финал — разбор промахов («Споткнулся на» +
  `buildMistakesQueue`) и CTA по фактическому прогрессу
  ([`src/components/Session.tsx`](src/components/Session.tsx),
  [`Complete.tsx`](src/components/Complete.tsx)). Кросс-предложения —
  при освоении темы на ≥80% и всех выученных `required`, в пределах бюджета
  очереди. Недетерминированное держим вне Convex-queries.
  → [`specs/feature/session-queue-and-rotation.md`](specs/feature/session-queue-and-rotation.md).
- **UI тренировки** — хедер (логотип-«домой» с флагом Португалии, стрик, **mute**
  `volume`/`volume-off`, переключатель темы, выход); во время сессии прячем
  статистику/табы («чистое поле»); строка прогресса — позиция `idx+1/queue.length`
  (знаменатель статичен), не освоение; теория не скрывается после прохождения.
  Прогноз повторений в ReviewTab при due=0 («Завтра к повтору: N»); бейдж липучки
  + ссылка на теорию в разборе ошибок; финал курса `CourseComplete` при 100% всех
  тем (один раз).
  → [`specs/feature/training-ui-and-shell.md`](specs/feature/training-ui-and-shell.md).
- **Тема** — тройной переключатель light/dark/system (дефолт `system`, следит за ОС),
  anti-flash в [`index.html`](index.html).
  → [`specs/feature/theme-system-mode.md`](specs/feature/theme-system-mode.md).
- **Авторизация** — Password (email). Регистрация сейчас ОТКЛЮЧЕНА флагом
  `SIGNUP_ENABLED` (парные флаги: сервер [`convex/auth.ts`](convex/auth.ts) + клиент
  [`src/components/SignIn.tsx`](src/components/SignIn.tsx)).
  → [`specs/feature/auth-and-signup-gate.md`](specs/feature/auth-and-signup-gate.md).
- **Готчи:** `getSrsState` отдаёт `cards`/`tags` МАССИВАМИ (не Record) — `pt`
  содержит не-ASCII (á, ã, ç…), запрещённый в именах полей Convex; клиент собирает
  Record через `adaptSrs` ([`src/lib/srs.ts`](src/lib/srs.ts)) — при новых map-ответах
  с `pt` в ключе поступать так же. Озвучка — Web Speech API, клиентская
  ([`src/lib/speech.ts`](src/lib/speech.ts)): авто-озвучка через `speakAuto`
  (no-op при mute), ручные 🔊 — `speak`/`speakSmart` в обход; `resume()` до/после
  `speak()` лечит зависание движка Chrome/macOS; `canSpeakPortuguese()` требует
  загруженного pt-голоса. CSS перенесён вербатим из исходного одно-файлового HTML
  ([`src/index.css`](src/index.css)) — имена классов сохранять.

## Структура

```
convex/         схема, content.ts (сид-данные), seed.ts, courseQueries.ts,
                progress.ts (SRS), auth.ts/auth.config.ts/http.ts
                *.test.ts — backend-тесты (convex-test)
src/lib/        types, queue (interleaved-сборка), srs (+adaptSrs), srsPredict (зеркало
                планировщика для мгновенной метки повтора, пин-тест к серверу),
                learning (навыки MC/Type, пороги, SESSION_SIZE), hints (гашение
                служебных хинтов), text, shuffle, wrongOptions, speech
                *.test.ts — unit-тесты (Vitest)
src/components/ Shell (оркестратор) → Header/ScoreRow/TabBar → ReviewTab/TopicsTab/
                Theory → Session → exercises/{Mc,Type,SentenceBuilder} → Feedback/Complete
                + ConfirmDialog (модалка выхода из сессии вместо window.confirm)
                *.ct.tsx — компонентные тесты (Playwright CT)
src/test/       setup.ts (jest-dom), mocks/ (стабы для CT)
playwright/     index.html/index.tsx — точка монтирования Playwright CT
scripts/        worktree.mjs (детект/порт-офсет) · wt-setup/wt-seed.mjs (локальный Convex + сид)
specs/          спеки на задачу specs/<branch>.md + baseline-спеки specs/feature/*
.claude/        settings.json (permissions + PostToolUse lint-хук) · hooks/lint-edited-file.sh
                · skills/{spec,test-policy,context7-first,content-authoring,
                  convex-conventions,srs-invariants,browser-smoke,ship-task}
.githooks/      pre-push (spec-гейт + code-review reminder + npm run verify)
.github/workflows/  ci.yml (PR-проверки) · deploy.yml (деплой при мёрже в main)
```

## Деплой

CI ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) на push в `main`
(т.е. при мёрже PR): `convex deploy` prod + сборка фронта с прод-URL +
`seed:seedContent` + публикация на GitHub Pages. Единственный секрет —
`CONVEX_DEPLOY_KEY` (GitHub Actions secret). Прод и dev — разные базы Convex.
Проверки на PR ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) — отдельные
jobs (secret-scan через gitleaks, lint, typecheck, build, backend-тесты,
frontend-тесты, компонентные).

## Известные компромиссы

- Нет офлайна (Convex требует сети; до первой загрузки — экран загрузки).
- Streak растёт при первом ответе за день (логика в `recordAnswer`).
- Проверка ответа — на клиенте; сервер доверяет присланному `quality` и `mode`.
- «Выучено» = оба навыка (`mcCorrect>=MC_TARGET` И `typeCorrect>=TYPE_TARGET`);
  миграции не требуется (старые «выученные» строки уже имеют `mc>=3`).
- Сессия каппирована `SESSION_SIZE` (=20) карточек — большой урок закрывается за
  несколько коротких подходов («Продолжить урок» на финале); слово может не
  «выучиться» за одну сессию и вернётся в следующую (пороги — в `learning.ts`).
