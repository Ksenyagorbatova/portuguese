# CLAUDE.md

Гайд для Claude Code по работе с этим репозиторием.

## Что это

Тренажёр европейского португальского (A0–A1) с русским интерфейсом: интервальное
повторение (SM-2 / Эббингауз), 4 типа упражнений, теория с озвучкой, кросс-предложения.

**Стек:** React 19 + TypeScript + Vite (фронтенд, статика на GitHub Pages) ·
Convex (БД + функции + авторизация `@convex-dev/auth`, провайдер Password) ·
Node 24. Тесты: Vitest (+ convex-test) и Playwright Component Testing.
Сайт: `https://ksenyagorbatova.github.io/portuguese/` (base path `/portuguese/`).

## ⚠️ Рабочий процесс (ОБЯЗАТЕЛЬНО)

1. **Каждая задача — в отдельной ветке.** Имя ветки по сути задачи:
   `feat/...`, `fix/...`, `chore/...` (напр. `feat/add-numbers-topic`).
2. **Никогда не коммитить и не пушить напрямую в `main`.** Только через Pull
   Request с feature-ветки. `main` обновляется исключительно мёржем PR
   (мёрж в `main` сам запускает деплой — см. ниже).
3. **Тесты обязательны для каждого изменения.** Любая новая фича, фикс бага,
   рефакторинг и т.п. покрывается тестами — новыми ИЛИ правкой существующих,
   в том же PR. См. раздел [«Тестирование»](#тестирование) и скилл
   [`.claude/skills/test-policy`](.claude/skills/test-policy/SKILL.md).
4. **Перед КАЖДЫМ push все проверки должны быть зелёными:**
   ```bash
   npm run check       # typecheck (tsc -b + convex + тесты) + ESLint
   npm run test        # unit (jsdom) + backend (convex-test) — Vitest
   npm run test:ct     # компонентные — Playwright CT
   npm run build       # прод-сборка
   ```
   Это форсит pre-push hook (`.githooks/pre-push`, подключается автоматически
   при `npm install` через `prepare`): push с красными тестами/проверками
   блокируется. Если что-то падает — не пушить, чинить. Обход только в крайнем
   случае: `git push --no-verify`.
5. **Браузерное тестирование.** Помимо автотестов — вручную проверить в браузере
   затронутую функциональность И смежную, которую правка могла задеть
   (`npm run dev`, пройти соответствующие экраны/сценарии).
6. Коммиты — осмысленными порциями; сообщения по существу.

## Команды

```bash
npm run dev            # Vite dev-сервер → http://localhost:5173/portuguese/
npx convex dev         # бэкенд Convex + кодоген convex/_generated (отдельный терминал)
npm run lint           # ESLint
npm run typecheck      # типы: tsc -b + convex/tsconfig + tsconfig.test (тесты)
npm run check          # typecheck + lint
npm run test           # Vitest: unit (jsdom) + backend (convex-test)
npm run test:backend   # только backend-проект Vitest
npm run test:frontend  # только frontend-проект Vitest
npm run test:watch     # Vitest в watch-режиме
npm run test:ct        # Playwright Component Testing (*.ct.tsx)
npm run build          # прод-сборка
npx convex run seed:seedContent   # залить/обновить контент в БД (идемпотентно)
```

Локально нужны: `.env.local` с `VITE_CONVEX_URL` (создаётся `npx convex dev`),
и dev-`SITE_URL` (`npx convex env set SITE_URL http://localhost:5173`).
Версия Node — 24 (см. `.nvmrc`); первый `npm install` подключает pre-push hook.

## Тестирование

**Правило:** каждое изменение идёт с тестами (новыми или правкой существующих)
в том же PR; перед push весь набор зелёный (форсит `.githooks/pre-push`). Три уровня:

- **Бэкенд** — Vitest + `convex-test` (edge-runtime), файлы `convex/*.test.ts`.
  Покрывают Convex-функции: SM-2 (`recordAnswer`), классификацию (`getSrsState`),
  идемпотентность сида, `getCourse`, серверную блокировку регистрации.
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

- **Контент** (темы/слова/теория/кросс-предложения) — источник правды в
  [`convex/content.ts`](convex/content.ts), заливается идемпотентным сидом
  [`convex/seed.ts`](convex/seed.ts) (upsert по натуральным ключам). Чтобы
  добавить контент: правишь `content.ts` → PR → после мёржа CI пере-сидит БД.
  Правила стабильности: не менять существующие `lesson.id` и `word.pt`
  (прогресс завязан на `(lessonKey, pt)`); кросс-предложения только дописывать
  в конец (ключ `cs_NNNN` берётся из индекса).
- **Прогресс** — per-user, таблица `progress`, ключ `(userId, lessonKey, pt)`,
  НЕ Convex `_id` (чтобы пере-сидинг не ломал прогресс). SM-2 считается на
  сервере в [`convex/progress.ts`](convex/progress.ts) (`recordAnswer`);
  классификация due/new/learned/ongoing — в `getSrsState`.
- **Клиент vs сервер.** Сервер: хранение, авторизация, SM-2, классификация,
  статистика. Клиент ([`src/lib/queue.ts`](src/lib/queue.ts)): shuffle/slice и
  вставка кросс-предложений (недетерминированное держим вне Convex-queries).
- **Важно:** `getSrsState` возвращает `cards`/`tags` МАССИВАМИ (не Record),
  т.к. `pt` содержит не-ASCII (á, ã, ç…), а Convex запрещает не-ASCII в именах
  полей объектов. Клиент собирает Record через `adaptSrs` в
  [`src/lib/srs.ts`](src/lib/srs.ts). При добавлении новых map-ответов из Convex
  с `pt` в ключе — поступать так же.
- **Авторизация:** Password (email). **Регистрация новых пользователей сейчас
  ОТКЛЮЧЕНА** флагом `SIGNUP_ENABLED` (сервер: [`convex/auth.ts`](convex/auth.ts),
  блок в `profile()` бросает `REGISTRATION_DISABLED` для flow `signUp`; клиент:
  [`src/components/SignIn.tsx`](src/components/SignIn.tsx), скрывает переключатель).
  Чтобы включить обратно — оба флага в `true`. GitHub/Google OAuth — опционально
  (флаг `OAUTH_ENABLED` + раскомментировать провайдеры в `convex/auth.ts` + env).
- **Озвучка** — Web Speech API, чисто клиентская ([`src/lib/speech.ts`](src/lib/speech.ts)).
- **CSS** перенесён вербатим из исходного одно-файлового HTML в
  [`src/index.css`](src/index.css); имена классов сохранять.

## Структура

```
convex/         схема, content.ts (сид-данные), seed.ts, courseQueries.ts,
                progress.ts (SRS), auth.ts/auth.config.ts/http.ts
                *.test.ts — backend-тесты (convex-test)
src/lib/        types, queue, srs (+adaptSrs), text, shuffle, wrongOptions, speech
                *.test.ts — unit-тесты (Vitest)
src/components/ Shell (оркестратор) → Header/ScoreRow/TabBar → ReviewTab/TopicsTab/
                Theory → Session → exercises/{Mc,Type,SentenceBuilder} → Feedback/Complete
                *.ct.tsx — компонентные тесты (Playwright CT)
src/test/       setup.ts (jest-dom), mocks/ (стабы для CT)
playwright/     index.html/index.tsx — точка монтирования Playwright CT
.githooks/      pre-push (npm run check + test + test:ct)
.github/workflows/  ci.yml (PR-проверки) · deploy.yml (деплой при мёрже в main)
```

## Деплой

CI ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) на push в `main`
(т.е. при мёрже PR): `convex deploy` prod + сборка фронта с прод-URL +
`seed:seedContent` + публикация на GitHub Pages. Единственный секрет —
`CONVEX_DEPLOY_KEY` (GitHub Actions secret). Прод и dev — разные базы Convex.
Проверки на PR ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) — отдельные
jobs (lint, typecheck, build, backend-тесты, frontend-тесты, компонентные).

## Известные компромиссы

- Нет офлайна (Convex требует сети; до первой загрузки — экран загрузки).
- Streak растёт при первом ответе за день (логика в `recordAnswer`).
- Проверка ответа — на клиенте; сервер доверяет присланному `quality`.
