# CLAUDE.md

Гайд для Claude Code по работе с этим репозиторием.

## Что это

Тренажёр европейского португальского (A0–A1) с русским интерфейсом: интервальное
повторение (SM-2 / Эббингауз), 4 типа упражнений, теория с озвучкой, кросс-предложения.

**Стек:** React 19 + TypeScript + Vite (фронтенд, статика на GitHub Pages) ·
Convex (БД + функции + авторизация `@convex-dev/auth`, провайдер Password).
Сайт: `https://ksenyagorbatova.github.io/portuguese/` (base path `/portuguese/`).

## ⚠️ Рабочий процесс (ОБЯЗАТЕЛЬНО)

1. **Каждая задача — в отдельной ветке.** Имя ветки по сути задачи:
   `feat/...`, `fix/...`, `chore/...` (напр. `feat/add-numbers-topic`).
2. **Никогда не коммитить и не пушить напрямую в `main`.** Только через Pull
   Request с feature-ветки. `main` обновляется исключительно мёржем PR
   (мёрж в `main` сам запускает деплой — см. ниже).
3. **Перед КАЖДЫМ push прогнать проверки** и убедиться, что ничего не сломано:
   ```bash
   npm run lint        # ESLint
   npm run typecheck   # tsc -b
   npm run build       # сборка (tsc + vite build)
   # быстрый общий прогон: npm run check  (typecheck + lint)
   ```
   Если хоть одна падает — не пушить, чинить.
4. **Браузерное тестирование.** После изменений вручную проверить в браузере
   затронутую функциональность И смежную, которую правка могла задеть
   (запустить `npm run dev`, пройти соответствующие экраны/сценарии).
5. Коммиты — осмысленными порциями; сообщения по существу.

## Команды

```bash
npm run dev            # Vite dev-сервер → http://localhost:5173/portuguese/
npx convex dev         # бэкенд Convex + кодоген convex/_generated (отдельный терминал)
npm run lint           # ESLint
npm run typecheck      # проверка типов (tsc -b)
npm run check          # typecheck + lint
npm run build          # прод-сборка
npx convex run seed:seedContent   # залить/обновить контент в БД (идемпотентно)
```

Локально нужны: `.env.local` с `VITE_CONVEX_URL` (создаётся `npx convex dev`),
и dev-`SITE_URL` (`npx convex env set SITE_URL http://localhost:5173`).

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
- **Авторизация:** Password (email) работает из коробки. GitHub/Google OAuth —
  опционально (флаг `OAUTH_ENABLED` в [`src/components/SignIn.tsx`](src/components/SignIn.tsx)
  + раскомментировать провайдеры в [`convex/auth.ts`](convex/auth.ts) + env).
- **Озвучка** — Web Speech API, чисто клиентская ([`src/lib/speech.ts`](src/lib/speech.ts)).
- **CSS** перенесён вербатим из исходного одно-файлового HTML в
  [`src/index.css`](src/index.css); имена классов сохранять.

## Структура

```
convex/         схема, content.ts (сид-данные), seed.ts, courseQueries.ts,
                progress.ts (SRS), auth.ts/auth.config.ts/http.ts
src/lib/        types, queue, srs (+adaptSrs), text, shuffle, wrongOptions, speech
src/components/ Shell (оркестратор) → Header/ScoreRow/TabBar → ReviewTab/TopicsTab/
                Theory → Session → exercises/{Mc,Type,SentenceBuilder} → Feedback/Complete
.github/workflows/deploy.yml   CI
```

## Деплой

CI ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) на push в `main`
(т.е. при мёрже PR): `convex deploy` prod + сборка фронта с прод-URL +
`seed:seedContent` + публикация на GitHub Pages. Единственный секрет —
`CONVEX_DEPLOY_KEY` (GitHub Actions secret). Прод и dev — разные базы Convex.

## Известные компромиссы

- Нет офлайна (Convex требует сети; до первой загрузки — экран загрузки).
- Streak растёт при первом ответе за день (логика в `recordAnswer`).
- Проверка ответа — на клиенте; сервер доверяет присланному `quality`.
