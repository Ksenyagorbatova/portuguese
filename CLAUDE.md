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
npm run dev            # Vite dev-сервер → http://localhost:5173/ (dev сервится с корня;
                       # base /portuguese/ только в прод-сборке — см. vite.config.ts)
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

- **Контент** (темы/слова/теория/кросс-предложения) — источник правды в
  [`convex/content.ts`](convex/content.ts), заливается идемпотентным сидом
  [`convex/seed.ts`](convex/seed.ts) (upsert по натуральным ключам). Чтобы
  добавить контент: правишь `content.ts` → PR → после мёржа CI пере-сидит БД.
  Правила стабильности: не менять существующие `lesson.id` и `word.pt`
  (прогресс завязан на `(lessonKey, pt)`); кросс-предложения только дописывать
  в конец (ключ `cs_NNNN` берётся из индекса).
- **Прогресс** — per-user, таблица `progress`, ключ `(userId, lessonKey, pt)`,
  НЕ Convex `_id` (чтобы пере-сидинг не ломал прогресс). SM-2 считается на
  сервере в [`convex/progress.ts`](convex/progress.ts) (`recordAnswer`).
  **Важно:** интервал SM-2 двигается ТОЛЬКО на «событие повторения» — когда
  слово выучивается этим ответом (выпуск) ИЛИ повторяется уже выученным И
  реально наступил повтор (`due<=now`). Промежуточные ответы внутрисессионной
  отработки расписание НЕ трогают (иначе интервал умножается на `ef` по ~6 раз
  за сессию и улетает в тысячи дней — был баг «следующий повтор: 4131 дн»):
  недоученное слово получает короткий шаг обучения (через день) и
  классифицируется как `ongoing` (а не застревает на `due=0`/«срочное»), а
  ранняя практика выученного не-`due` слова расписание не сдвигает. Интервал
  ограничен сверху `MAX_INTERVAL=365` дн. Классификация
  due/new/learned/ongoing — в `getSrsState`.
- **Смешанная модель освоения слова.** Каждое слово тренируется двумя навыками —
  **узнавание (MC, выбор)** и **воспроизведение (Type, ручной ввод)** —
  ВПЕРЕМЕШКУ в случайном порядке (НЕ «сначала все выборы, потом все вводы»). В
  таблице `progress` два счётчика: `mcCorrect` (верные выборы) и `typeCorrect`
  (верные ручные вводы), оба `v.optional` (старые строки читаются как 0). Пороги
  `MC_TARGET=3` и `TYPE_TARGET=3`. `recordAnswer` принимает `mode: "mc" | "type"`
  и при верном ответе (`quality>=1`) растит соответствующий счётчик.
  **`isLearned(c)` = `mcCorrect>=MC_TARGET && typeCorrect>=TYPE_TARGET`** —
  выучено, когда набраны ОБА навыка (оба порога дублируются в
  [`src/lib/learning.ts`](src/lib/learning.ts) — держать синхронно, Convex не
  делит модули с `src/`). Тип следующего упражнения выбирает `pickExerciseType`
  ([`learning.ts`](src/lib/learning.ts)): первое знакомство со словом (ещё ни
  одного верного ответа, `mc=0 && type=0`) — всегда **выбор (MC)**, т.к. ввод по
  никогда не виденному слову набрать нельзя; дальше — случайно среди ещё НЕ
  набранных навыков (так сессия гарантированно добирает и `MC_TARGET` выборов, и
  `TYPE_TARGET` вводов, но вперемешку).
- **Клиент vs сервер.** Сервер: хранение, авторизация, SM-2, классификация,
  статистика. Клиент: shuffle и вставка кросс-предложений
  ([`src/lib/queue.ts`](src/lib/queue.ts)) — урок берёт в стартовый набор ВСЕ
  слова темы (не срез), случайный выбор MC/Type вперемешку и **динамическая
  внутрисессионная ротация** ([`src/components/Session.tsx`](src/components/Session.tsx)):
  не выученное слово возвращается в той же сессии в СЛУЧАЙНУЮ позицию задней
  части очереди (`requeuePosition`: от `idx+REQUEUE_GAP` до конца — НЕ фиксированно
  на `idx+REQUEUE_GAP`, иначе первые `REQUEUE_GAP` слов образуют тесный цикл и
  остальные слова урока не показываются, пока те не выучены), с предохранителем
  `SESSION_REQUEUE_CAP`, пока не дойдёт до `learned`. Очередь от `queue.ts` —
  лишь СТАРТОВЫЙ набор. Недетерминированное держим вне Convex-queries.
- **Кросс-предложения** появляются, только когда тема(ы) их слов выучены на
  **≥80%** (`SENTENCE_TOPIC_THRESHOLD`) И все `required`-слова выучены —
  гейт в `eligibleSentences` ([`src/lib/queue.ts`](src/lib/queue.ts)).
- **Теория не скрывается** после прохождения: в каждом уроке кнопка «Теория»
  ([`src/components/TopicsTab.tsx`](src/components/TopicsTab.tsx) → `openTheory` в
  `Shell`), открывает [`Theory`](src/components/Theory.tsx) в любой момент
  (с кнопкой «Назад»). Онбординг (теория перед первой практикой) сохранён.
- **UI тренировки.** Хедер ([`Header.tsx`](src/components/Header.tsx)) — только
  логотип слева; справа по порядку стрик, переключатель темы, выход (выход —
  icon-кнопка с иконкой двери `log-out`, крайний правый; класс `.m-signout`
  удалён).
  Во время сессии (`view.kind === "session"`) [`Shell`](src/components/Shell.tsx)
  скрывает статистику (`ScoreRow`) и табы (`TabBar`), а [`Session`](src/components/Session.tsx)
  не рендерит чипы — остаётся «само поле тренировки». Карточка упражнения
  уплотнена через scoped-класс `.m-session` в [`index.css`](src/index.css)
  (включая скрытие до-ответной строки «следующий повтор …» — она дублирует
  фидбэк — и срез нижнего паддинга `.m-app`), чтобы кнопка «Дальше» помещалась
  без прокрутки и на десктопе, и на мобиле (проверено вживую вплоть до 640px
  высоты для самого высокого случая — выбор из 4 + фидбэк). Вместо табов у
  сессии свой выход (`onExit`, крестик в строке прогресса). Строка прогресса
  сессии (полоса + счётчик) показывает **позицию** (`idx+1/items.length` —
  текущая карточка / длина рабочей очереди, знаменатель растёт с переспросами),
  а НЕ долю освоения. Освоение слов смотрим на «Темах»/«Повторении» (серверный
  `learned` из `getSrsState`), но в строке сессии его НЕ показываем: мини-кольцо
  освоения пробовали и убрали — оно стартовало с нуля каждую сессию и
  расходилось с глобальным прогрессом «Тем» (вводило в заблуждение). Логотип в хедере —
  кнопка «на главный экран» (`onHome` → вкладка «Повторение»); его фон — флаг
  Португалии (токены `--flag-green`/`--flag-red`, только в иконке; остальной
  интерфейс — на `--accent`).
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
src/lib/        types, queue, srs (+adaptSrs), learning (навыки MC/Type, ротация, пороги),
                text, shuffle, wrongOptions, speech
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
jobs (secret-scan через gitleaks, lint, typecheck, build, backend-тесты,
frontend-тесты, компонентные).

## Известные компромиссы

- Нет офлайна (Convex требует сети; до первой загрузки — экран загрузки).
- Streak растёт при первом ответе за день (логика в `recordAnswer`).
- Проверка ответа — на клиенте; сервер доверяет присланному `quality` и `mode`.
- «Выучено» = оба навыка (`mcCorrect>=MC_TARGET` И `typeCorrect>=TYPE_TARGET`).
  Миграции не требуется: ранее «выученные» строки уже имеют `mc>=3` (в старой
  фазовой модели `type` рос только после фазы выбора), так что правило их не
  разучивает.
- Урок берёт в сессию ВСЕ слова темы, и каждое доводится до «выучено» за сессию
  (~(`MC_TARGET`+`TYPE_TARGET`) верных ответов на слово) — поэтому первая
  тренировка большого урока (до 10 слов) длинная; пороги — в `learning.ts`.
